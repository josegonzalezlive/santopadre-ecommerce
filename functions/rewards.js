const crypto = require('crypto');
const functions = require('firebase-functions');
const functionsV1 = require('firebase-functions/v1');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath, Timestamp } = require('firebase-admin/firestore');
// TEMPORAL: ver notas de deploy - no requerir './notifications' evita que defineSecret()
// bloquee el analisis de deploy sin WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID en Secret Manager.
const sendComprobanteWhatsapp = null, waToken = null, waPhoneId = null;
const { _claimReferralForUser, _completeReferralForPurchase } = require('./referrals');
const { requireAuth, requireRole, isAdmin, getAdminRole } = require('./authz');
const {
  WELCOME_POINTS,
  REWARD_CATALOG,
  DEFAULT_TIER_REWARDS,
  transactionDocId,
  pointsForPurchase,
  pointsForDeposit,
  normalizeTierReward,
  mergeTierRewards,
  normalizeLoyaltyCampaign,
  nextPointsExpiry
} = require('./loyalty');
const {
  LEDGER_COLLECTION,
  RECONCILIATION_COLLECTION,
  buildPointLedgerEntry,
  buildLedgerEntryFromUserTransaction,
  writePointLedger,
  ledgerDocId,
  calculateLedgerBalance
} = require('./ledger');
const { assertKnownKeys } = require('./validation');
const { dailyLimitDateKey, dailyLimitDocId } = require('./limits');
const { verifySolanaTransfer } = require('./solana');

if (!getApps().length) initializeApp();

const db = getFirestore();
const CALLABLE_OPTIONS = { maxInstances: 10, ...(process.env.ENFORCE_APP_CHECK === 'true' ? { enforceAppCheck: true } : {}) };
const JOB_STATE_COLLECTION = 'loyaltyJobState';
const BACKFILL_JOB = 'backfillLoyaltyLedger';
const RECONCILE_JOB = 'reconcileLoyaltyBalances';
const EXPIRE_JOB = 'expireLoyaltyPoints';
const DAILY_LIMIT_COLLECTION = 'loyaltyDailyLimits';
const NOTIFICATION_FAILURES_COLLECTION = 'notificationFailures';
const DAILY_PURCHASE_CONFIRM_LIMIT = Number(process.env.DAILY_PURCHASE_CONFIRM_LIMIT || 20);
const DAILY_PURCHASE_USD_LIMIT = Number(process.env.DAILY_PURCHASE_USD_LIMIT || 5000);
const DAILY_DEPOSIT_CONFIRM_LIMIT = Number(process.env.DAILY_DEPOSIT_CONFIRM_LIMIT || 10);
const DAILY_DEPOSIT_USD_LIMIT = Number(process.env.DAILY_DEPOSIT_USD_LIMIT || 1000);
const DAILY_BONUS_CLAIM_LIMIT = Number(process.env.DAILY_BONUS_CLAIM_LIMIT || 5);

function assertPositiveAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    throw new HttpsError('invalid-argument', `${label} invalido`);
  }
  return Math.round(amount * 100) / 100;
}

function assertIntegerInRange(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpsError('invalid-argument', `${label} debe estar entre ${min} y ${max}`);
  }
  return number;
}

function assertUserId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,140}$/.test(id)) throw new HttpsError('invalid-argument', 'userId invalido');
  return id;
}

function assertReason(value) {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length < 4 || reason.length > 240) {
    throw new HttpsError('invalid-argument', 'Debes especificar un motivo valido');
  }
  return reason;
}

function logLoyalty(event, payload = {}) {
  functions.logger.info(event, { component: 'loyalty_rewards', ...payload });
}

function publicProfileFromAuth(auth, data = {}) {
  return {
    uid: auth.uid,
    name: String(data.name || auth.token.name || 'Cliente').slice(0, 120),
    email: auth.token.email || '',
    photoURL: auth.token.picture || 'assets/logo-sm.webp'
  };
}

async function enforceRateLimit(tx, uid, action, intervalMs) {
  const ref = rateLimitRef(uid, action);
  const snap = await tx.get(ref);
  applyRateLimit(tx, ref, snap, uid, action, intervalMs);
}

function rateLimitRef(uid, action) {
  return db.collection('rateLimits').doc(`${uid}_${action}`);
}

function applyRateLimit(tx, ref, snap, uid, action, intervalMs) {
  const now = Date.now();
  const lastAt = snap.exists ? Number(snap.data().lastAt || 0) : 0;
  if (lastAt && now - lastAt < intervalMs) {
    throw new HttpsError('resource-exhausted', 'Demasiadas solicitudes. Intenta nuevamente en unos segundos');
  }
  tx.set(ref, { uid, action, lastAt: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function enforceCallableRateLimit(uid, action, intervalMs) {
  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, uid, action, intervalMs);
  });
}

async function enforceDailyLimit(tx, uid, action, { maxCount, maxAmount = null, amount = 0 }) {
  const day = dailyLimitDateKey();
  const ref = dailyLimitRef(uid, action, day);
  const snap = await tx.get(ref);
  applyDailyLimit(tx, ref, snap, uid, action, { day, maxCount, maxAmount, amount });
}

function dailyLimitRef(uid, action, day = dailyLimitDateKey()) {
  return db.collection(DAILY_LIMIT_COLLECTION).doc(dailyLimitDocId(uid, action, day));
}

function applyDailyLimit(tx, ref, snap, uid, action, { day, maxCount, maxAmount = null, amount = 0 }) {
  const current = snap.exists ? snap.data() : {};
  const nextCount = Number(current.count || 0) + 1;
  const amountDelta = Number(amount || 0);
  const nextAmount = Math.round((Number(current.amount || 0) + amountDelta) * 100) / 100;

  if (Number.isFinite(maxCount) && nextCount > maxCount) {
    logLoyalty('loyalty_daily_limit_exceeded', { userId: uid, action, day, limitType: 'count', nextCount, maxCount });
    throw new HttpsError('resource-exhausted', 'Limite diario alcanzado para esta operacion');
  }
  if (maxAmount !== null && Number.isFinite(maxAmount) && nextAmount > maxAmount) {
    logLoyalty('loyalty_daily_limit_exceeded', { userId: uid, action, day, limitType: 'amount', nextAmount, maxAmount });
    throw new HttpsError('resource-exhausted', 'Limite diario de monto alcanzado para esta operacion');
  }

  tx.set(ref, {
    uid,
    action,
    day,
    count: nextCount,
    amount: nextAmount,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function enforceRateAndDailyLimit(tx, uid, rateAction, intervalMs, dailyAction, dailyOptions) {
  const day = dailyLimitDateKey();
  const rateRef = rateLimitRef(uid, rateAction);
  const limitRef = dailyLimitRef(uid, dailyAction, day);
  const [rateSnap, limitSnap] = await Promise.all([tx.get(rateRef), tx.get(limitRef)]);
  applyRateLimit(tx, rateRef, rateSnap, uid, rateAction, intervalMs);
  applyDailyLimit(tx, limitRef, limitSnap, uid, dailyAction, { ...dailyOptions, day });
}

async function recordNotificationFailure({ type, userId, payload, error, sourceId }) {
  const ref = await db.collection(NOTIFICATION_FAILURES_COLLECTION).add({
    type,
    userId,
    sourceId: sourceId || null,
    payload: compactMetadata(payload || {}),
    error: compactMetadata(error?.response?.data || error?.message || error || 'unknown_error'),
    status: 'pending_retry',
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function creditUserPoints({ userId, pointsDelta, type, sourceId, reason, orderId, amountUsd, extraUserUpdate, actor, metadata, dailyLimit }) {
  const userRef = db.collection('users').doc(userId);
  const txRef = userRef.collection('transactions').doc(transactionDocId(type, sourceId));
  const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerDocId(userId, type, sourceId));

  return db.runTransaction(async (tx) => {
    const [userSnap, txSnap, ledgerSnap] = await Promise.all([tx.get(userRef), tx.get(txRef), tx.get(ledgerRef)]);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    if (txSnap.exists) {
      if (!ledgerSnap.exists) {
        const existingDelta = Number(txSnap.data().pointsDelta || txSnap.data().amount || 0);
        const ledgerEntry = buildPointLedgerEntry({
          userId,
          type: txSnap.data().type || type,
          sourceId: txSnap.data().sourceId || sourceId,
          orderId: txSnap.data().orderId || orderId || null,
          pointsDelta: existingDelta,
          reason: txSnap.data().reason || reason,
          balanceBefore: null,
          balanceAfter: userSnap.data().points || 0,
          actor: actor || { role: 'system' },
          metadata: { ...(metadata || {}), backfilledFromUserTransaction: true }
        });
        tx.set(ledgerRef, {
          ...ledgerEntry,
          transactionPath: txRef.path,
          userPath: userRef.path
        });
      }
      return {
        alreadyProcessed: true,
        transactionId: txRef.id,
        ledgerId: ledgerRef.id,
        pointsDelta: txSnap.data().pointsDelta || txSnap.data().amount || 0,
        newPoints: userSnap.data().points || 0
      };
    }

    const user = userSnap.data();
    const prevPoints = user.points || 0;
    const nextPoints = Math.max(0, prevPoints + pointsDelta);
    if (dailyLimit) {
      await enforceDailyLimit(tx, userId, dailyLimit.action || type, dailyLimit);
    }
    const expiresAt = nextPoints > 0 ? Timestamp.fromDate(nextPointsExpiry()) : null;
    tx.set(userRef, {
      points: nextPoints,
      isVip: nextPoints >= 100,
      updatedAt: FieldValue.serverTimestamp(),
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: expiresAt,
      ...(amountUsd ? { usdcBalance: FieldValue.increment(amountUsd) } : {}),
      ...(extraUserUpdate || {})
    }, { merge: true });

    const ledgerId = writePointLedger(tx, db, userRef, txRef, buildPointLedgerEntry({
      userId,
      type,
      sourceId: String(sourceId),
      orderId: orderId || null,
      pointsDelta,
      reason,
      balanceBefore: prevPoints,
      balanceAfter: nextPoints,
      actor: actor || { role: 'system' },
      metadata
    }));

    return { alreadyProcessed: false, transactionId: txRef.id, ledgerId, pointsDelta, newPoints: nextPoints };
  });
}

function campaignIsActive(campaign, now = Date.now()) {
  if (!campaign.active) return false;
  const startsAt = campaign.startsAt ? Date.parse(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? Date.parse(campaign.endsAt) : null;
  if (Number.isFinite(startsAt) && now < startsAt) return false;
  if (Number.isFinite(endsAt) && now > endsAt + (campaign.endsAt.length <= 10 ? 86399999 : 0)) return false;
  return true;
}

async function getCurrentCampaign() {
  const snap = await db.collection('loyaltyCampaigns').doc('current').get();
  return normalizeLoyaltyCampaign(snap.exists ? snap.data() : {});
}

async function getActiveCampaign() {
  const campaign = await getCurrentCampaign();
  return campaignIsActive(campaign) ? campaign : null;
}

async function getConfiguredTierRewards() {
  const snap = await db.collection('tierRewards').get();
  const overrides = [];
  snap.forEach((doc) => overrides.push({ level: Number(doc.id), ...doc.data() }));
  return mergeTierRewards(overrides);
}

function auditPayload({ auth, role, userId, user, prevPoints, newPoints, prevStamps, newStamps, reason, action, metadata }) {
  return {
    action: action || 'admin_update',
    actorUid: auth.uid,
    adminEmail: auth.token.email || auth.uid,
    adminRole: role || 'admin',
    userId,
    userName: user.name || user.email || 'Cliente SantoPadre',
    prevPoints,
    newPoints,
    oldPoints: prevPoints,
    oldStamps: prevStamps,
    prevStamps,
    newStamps,
    reason,
    metadata: compactMetadata(metadata || {}),
    timestamp: new Date().toISOString()
  };
}

exports.initializeUserRewards = functionsV1.auth.user().onCreate(async (user) => {
  const userRef = db.collection('users').doc(user.uid);
  const txRef = userRef.collection('transactions').doc('welcome_bonus');

  await db.runTransaction(async (tx) => {
    const [userSnap, txSnap] = await Promise.all([tx.get(userRef), tx.get(txRef)]);
    const existing = userSnap.exists ? userSnap.data() : {};
    tx.set(userRef, {
      uid: user.uid,
      email: user.email || existing.email || '',
      name: user.displayName || existing.name || 'Cliente',
      photoURL: user.photoURL || existing.photoURL || 'assets/logo-sm.webp',
      points: Number.isFinite(existing.points) ? existing.points : WELCOME_POINTS,
      stamps: Number.isFinite(existing.stamps) ? existing.stamps : 0,
      isVip: typeof existing.isVip === 'boolean' ? existing.isVip : false,
      activeRewards: Array.isArray(existing.activeRewards) ? existing.activeRewards : [],
      claimedRewards: Array.isArray(existing.claimedRewards) ? existing.claimedRewards : [],
      pointsLastActivityAt: existing.pointsLastActivityAt || FieldValue.serverTimestamp(),
      pointsExpiresAt: existing.pointsExpiresAt || Timestamp.fromDate(nextPointsExpiry()),
      createdAt: existing.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (!txSnap.exists) {
      writePointLedger(tx, db, userRef, txRef, buildPointLedgerEntry({
        userId: user.uid,
        type: 'welcome_bonus',
        sourceId: user.uid,
        pointsDelta: WELCOME_POINTS,
        reason: 'Bono de bienvenida',
        balanceBefore: 0,
        balanceAfter: WELCOME_POINTS,
        actor: { role: 'system' }
      }));
    }
  });

  logLoyalty('welcome_bonus_initialized', { userId: user.uid, pointsAwarded: WELCOME_POINTS });
});

exports.syncUserProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['name', 'referrerId'], 'syncUserProfile');
  const profile = publicProfileFromAuth(auth, request.data || {});
  const userRef = db.collection('users').doc(auth.uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (snap.exists) {
      tx.set(userRef, { ...profile, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    tx.set(userRef, {
      ...profile,
      points: WELCOME_POINTS,
      stamps: 0,
      isVip: false,
      activeRewards: [],
      claimedRewards: [],
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc('welcome_bonus'), buildPointLedgerEntry({
      userId: auth.uid,
      type: 'welcome_bonus',
      sourceId: auth.uid,
      pointsDelta: WELCOME_POINTS,
      reason: 'Bono de bienvenida',
      balanceBefore: 0,
      balanceAfter: WELCOME_POINTS,
      actor: { role: 'system' },
      metadata: { createdBySyncUserProfile: true }
    }));
  });

  let referral = null;
  if (request.data?.referrerId) {
    try {
      referral = await _claimReferralForUser(auth.uid, request.data.referrerId);
    } catch (err) {
      if (err.code !== 'already-exists' && err.code !== 'failed-precondition') throw err;
    }
  }

  const snap = await userRef.get();
  return { profile: snap.data(), referral };
});

exports.confirmPurchaseAndAwardPoints = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['orderId', 'solanaSignature', 'cluster'], 'confirmPurchaseAndAwardPoints');
  await enforceCallableRateLimit(auth.uid, 'confirmPurchaseAndAwardPoints', 5000);
  const orderId = typeof request.data?.orderId === 'string' ? request.data.orderId.trim() : '';
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId es requerido');

  const adminCaller = await isAdmin(request);
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError('not-found', 'Orden no encontrada');

  const order = orderSnap.data();
  const orderUserId = order.userId;
  const total = assertPositiveAmount(order.total, 'Total de orden');
  const solanaSignature = request.data?.solanaSignature || order.txHash;

  if (!adminCaller) {
    if (orderUserId !== auth.uid || order.payment !== 'phantom' || !solanaSignature) {
      throw new HttpsError('permission-denied', 'Solo un administrador puede confirmar esta compra');
    }
    await verifySolanaTransfer({ signature: solanaSignature, amountUsd: total, cluster: request.data?.cluster || order.solanaCluster });
  } else if (solanaSignature && order.payment === 'phantom') {
    await verifySolanaTransfer({ signature: solanaSignature, amountUsd: total, cluster: request.data?.cluster || order.solanaCluster });
  }

  const basePoints = pointsForPurchase(total);
  const campaign = await getActiveCampaign();
  const points = campaign ? Math.max(1, Math.floor(basePoints * campaign.pointsMultiplier)) : basePoints;
  const result = await creditUserPoints({
    userId: orderUserId,
    pointsDelta: points,
    type: 'purchase',
    sourceId: orderId,
    reason: 'Compra verificada',
    orderId,
    actor: {
      uid: auth.uid,
      email: auth.token.email || null,
      role: adminCaller ? await getAdminRole(request) : 'customer'
    },
    metadata: {
      payment: order.payment || null,
      verificationType: solanaSignature ? 'solana' : 'admin',
      basePoints,
      campaign: campaign ? { name: campaign.name, pointsMultiplier: campaign.pointsMultiplier } : null
    },
    dailyLimit: {
      action: 'purchase_confirmed',
      maxCount: DAILY_PURCHASE_CONFIRM_LIMIT,
      maxAmount: DAILY_PURCHASE_USD_LIMIT,
      amount: total
    }
  });

  const orderUpdate = {
    status: 'Completado',
    rewardCredited: true,
    confirmedAt: FieldValue.serverTimestamp(),
    confirmedBy: adminCaller ? (auth.token.email || auth.uid) : 'solana_verification',
    verificationType: solanaSignature ? 'solana' : 'admin'
  };
  if (!result.alreadyProcessed) {
    orderUpdate.pointsEarned = points;
    orderUpdate.basePointsEarned = basePoints;
    orderUpdate.campaign = campaign ? { name: campaign.name, pointsMultiplier: campaign.pointsMultiplier } : null;
  }
  await orderRef.set(orderUpdate, { merge: true });

  const referral = await _completeReferralForPurchase(orderUserId, orderId);
  logLoyalty('purchase_confirmed', { orderId, userId: orderUserId, pointsAwarded: result.pointsDelta || points, ledgerId: result.ledgerId, alreadyProcessed: result.alreadyProcessed });
  return { ...result, success: true, orderId, pointsAwarded: result.pointsDelta || points, referral };
});

exports.confirmSolanaDeposit = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['amountUsd', 'signature', 'cluster'], 'confirmSolanaDeposit');
  await enforceCallableRateLimit(auth.uid, 'confirmSolanaDeposit', 10000);
  const amountUsd = assertPositiveAmount(request.data?.amountUsd, 'Monto');
  const verification = await verifySolanaTransfer({
    signature: request.data?.signature,
    amountUsd,
    cluster: request.data?.cluster
  });
  const points = pointsForDeposit(amountUsd);
  const result = await creditUserPoints({
    userId: auth.uid,
    pointsDelta: points,
    type: 'solana_deposit',
    sourceId: verification.signature,
    reason: 'Deposito Solana verificado',
    amountUsd,
    actor: { uid: auth.uid, email: auth.token.email || null, role: 'customer' },
    metadata: { amountUsd, cluster: verification.cluster, lamports: verification.lamports },
    dailyLimit: {
      action: 'solana_deposit_confirmed',
      maxCount: DAILY_DEPOSIT_CONFIRM_LIMIT,
      maxAmount: DAILY_DEPOSIT_USD_LIMIT,
      amount: amountUsd
    }
  });

  let notification = null;
  if (!result.alreadyProcessed) {
    const notificationPayload = {
      recipientPhone: null,
      userName: null,
      amount: amountUsd,
      pointsAwarded: points,
      signature: verification.signature
    };
    try {
      const profileSnap = await db.collection('users').doc(auth.uid).get();
      const profile = profileSnap.exists ? profileSnap.data() : {};
      notificationPayload.recipientPhone = profile.phone || auth.token.phone_number || '';
      notificationPayload.userName = profile.name || auth.token.name || 'Cliente SantoPadre';
      if (typeof sendComprobanteWhatsapp !== 'function') {
        throw new Error('sendComprobanteWhatsapp_not_configured');
      }
      notification = await sendComprobanteWhatsapp(notificationPayload);
    } catch (err) {
      const failureId = await recordNotificationFailure({
        type: 'deposit_comprobante',
        userId: auth.uid,
        sourceId: verification.signature,
        payload: notificationPayload,
        error: err
      });
      notification = { sent: false, error: err.message, failureId };
      functions.logger.error('comprobante_notification_failed', {
        component: 'loyalty_notifications',
        userId: auth.uid,
        failureId,
        error: err.response?.data || err.message
      });
    }
  }

  logLoyalty('solana_deposit_confirmed', { userId: auth.uid, amountUsd, pointsAwarded: points, signature: verification.signature, ledgerId: result.ledgerId, alreadyProcessed: result.alreadyProcessed });
  return { ...result, success: true, amountUsd, pointsAwarded: points, solana: verification, notification };
});

exports.redeemReward = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['rewardId'], 'redeemReward');
  const rewardId = request.data?.rewardId;
  const catalogEntry = REWARD_CATALOG[rewardId];
  if (!catalogEntry) throw new HttpsError('invalid-argument', 'Recompensa inválida');

  const uid = auth.uid;
  const userRef = db.doc(`users/${uid}`);
  const rewardDocId = crypto.randomBytes(10).toString('hex');
  const couponCode = 'SP-PT-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const result = await db.runTransaction(async (tx) => {
    // Firestore exige que TODAS las lecturas de una transaccion ocurran antes que
    // cualquier escritura. enforceRateLimit() hace su propia lectura+escritura del doc
    // de rate limit, asi que debe ir DESPUES de las demas lecturas (tx.get(userRef)), no
    // antes - si no, revienta con "Firestore transactions require all reads to be
    // executed before all writes" en cuanto se llega a esa lectura. Bug real encontrado
    // probando el flujo completo contra el emulador de Functions (nunca se habia
    // ejercitado end-to-end antes de esto).
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    await enforceRateLimit(tx, uid, 'redeemReward', 3000);

    const balance = userDoc.data().points || 0;
    if (balance < catalogEntry.cost) throw new HttpsError('failed-precondition', 'Saldo insuficiente');
    const newPoints = balance - catalogEntry.cost;
    const rewardClaim = {
      id: rewardDocId,
      name: catalogEntry.name,
      code: couponCode,
      date: new Date().toISOString()
    };
    const activeRewards = [...(userDoc.data().activeRewards || []), rewardClaim];

    tx.update(userRef, {
      points: newPoints,
      isVip: newPoints >= 100,
      activeRewards,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: newPoints > 0 ? Timestamp.fromDate(nextPointsExpiry()) : null
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc(`redeem_${rewardDocId}`), buildPointLedgerEntry({
      userId: uid,
      type: 'canje',
      sourceId: rewardDocId,
      rewardId,
      pointsDelta: -catalogEntry.cost,
      reward: catalogEntry.name,
      couponCode,
      reason: `Canje de recompensa: ${catalogEntry.name}`,
      balanceBefore: balance,
      balanceAfter: newPoints,
      actor: { uid: auth.uid, email: auth.token.email || null, role: 'customer' },
      metadata: { rewardId, rewardName: catalogEntry.name, couponCode },
      attributes: { rewardId, reward: catalogEntry.name, couponCode }
    }));
    tx.set(db.collection('orders').doc(), {
      userId: uid,
      items: [{ name: `Canje: ${catalogEntry.name} (Código: ${couponCode})`, quantity: 1, price: 0 }],
      total: 0,
      pointsEarned: -catalogEntry.cost,
      createdAt: new Date().toISOString(),
      status: 'canjeado',
      orderType: 'reward_redeem'
    });
    return { reward: rewardClaim, newPoints };
  });

  logLoyalty('reward_redeemed', { userId: uid, rewardId, pointsSpent: catalogEntry.cost });
  return { success: true, rewardName: catalogEntry.name, couponCode, cost: catalogEntry.cost, reward: result.reward, newPoints: result.newPoints };
});

exports.claimTierReward = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, [], 'claimTierReward');
  const uid = auth.uid;
  const userRef = db.doc(`users/${uid}`);
  let response;

  await db.runTransaction(async (tx) => {
    // Ver nota en redeemReward: todas las lecturas antes que cualquier escritura.
    const [userDoc, tiersSnap] = await Promise.all([tx.get(userRef), tx.get(db.collection('tierRewards'))]);
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    await enforceRateLimit(tx, uid, 'claimTierReward', 3000);

    const overrides = [];
    tiersSnap.forEach((doc) => overrides.push({ level: Number(doc.id), ...doc.data() }));
    const tiers = mergeTierRewards(overrides);
    const data = userDoc.data();
    const claimedRewards = data.claimedRewards || [];
    const completedTiers = Math.floor((data.stamps || 0) / 5);
    if (claimedRewards.length >= completedTiers) {
      throw new HttpsError('failed-precondition', 'No tienes premios de ascenso pendientes');
    }

    const tierIndex = Math.min(claimedRewards.length, tiers.length - 1);
    const tier = tiers[tierIndex];
    if (tier.active === false) throw new HttpsError('failed-precondition', 'Este premio de nivel no esta activo');
    const level = tierIndex + 1;
    const couponCode = 'SP-ASCENSO-' + level + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const newClaimed = [...claimedRewards, level];
    const newActive = [...(data.activeRewards || []), {
      id: crypto.randomBytes(10).toString('hex'),
      name: tier.reward,
      code: couponCode,
      date: new Date().toISOString()
    }];

    tx.update(userRef, { claimedRewards: newClaimed, activeRewards: newActive, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection('orders').doc(), {
      userId: uid,
      items: [{ name: `Ascenso a ${tier.name}: ${tier.reward}`, couponCode, quantity: 1, price: 0 }],
      total: 0,
      status: 'Completado',
      date: new Date().toISOString()
    });
    response = { level, name: tier.name, reward: tier.reward, couponCode };
  });

  return { success: true, ...response };
});

const SOCIAL_QUESTS = {
  review: { statusField: 'reviewStatus', claimedField: 'reviewClaimed', points: 150, reason: 'Aprobación de reseña en Google Maps' },
  igStory: { statusField: 'igStoryStatus', claimedField: 'igStoryClaimed', points: 100, reason: 'Aprobación de Historia de Instagram' },
  igPost: { statusField: 'igPostStatus', claimedField: 'igPostClaimed', points: 200, reason: 'Aprobación de Publicación de Instagram' },
  tiktok: { statusField: 'tiktokStatus', claimedField: 'tiktokClaimed', points: 300, reason: 'Aprobación de Video de TikTok' }
};

async function writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason, options = {}) {
  const auditRef = db.collection('audit_logs').doc();
  tx.set(auditRef, auditPayload({
    auth,
    role: options.role,
    userId: userRef.id,
    user,
    prevPoints: user.points || 0,
    newPoints,
    prevStamps: user.stamps || 0,
    newStamps,
    reason,
    action: options.action,
    metadata: options.metadata
  }));
  return auditRef.id;
}

function writeConfigAudit(tx, { auth, role, action, targetRef, before, after, reason }) {
  const auditRef = db.collection('audit_logs').doc();
  tx.set(auditRef, {
    action,
    actorUid: auth.uid,
    adminEmail: auth.token.email || auth.uid,
    adminRole: role || 'admin',
    targetPath: targetRef.path,
    reason,
    before: compactMetadata(before || {}),
    after: compactMetadata(after || {}),
    timestamp: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp()
  });
  return auditRef.id;
}

exports.adminQuickAddStamp = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'cashier']);
  assertKnownKeys(request.data, ['userId'], 'adminQuickAddStamp');
  const userId = assertUserId(request.data?.userId);
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    await enforceRateLimit(tx, auth.uid, 'adminQuickAddStamp', 3000);
    const user = snap.data();
    const newStamps = (user.stamps || 0) + 1;
    if (newStamps > 25) throw new HttpsError('failed-precondition', 'El cliente ya alcanzo el limite de 25 sellos');
    const newPoints = (user.points || 0) + 100;
    const reason = 'Escaneo de tarjeta de sellos rápido (+1 sello, +100 PTS)';
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason, {
      role,
      action: 'admin_quick_add_stamp'
    });
    tx.update(userRef, {
      points: newPoints,
      stamps: newStamps,
      isVip: newPoints >= 100,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc(`quick_stamp_${auditId}`), buildPointLedgerEntry({
      userId,
      type: 'stamp_scan',
      sourceId: auditId,
      pointsDelta: 100,
      reason,
      balanceBefore: user.points || 0,
      balanceAfter: newPoints,
      actor: { uid: auth.uid, email: auth.token.email || null, role },
      metadata: { auditId, stampsDelta: 1 }
    }));
    result = { userId, points: newPoints, stamps: newStamps, auditId };
  });
  return result;
});

exports.adminAdjustUserLoyalty = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['userId', 'points', 'stamps', 'reason'], 'adminAdjustUserLoyalty');
  const userId = assertUserId(request.data?.userId);
  const newPoints = assertIntegerInRange(request.data?.points, 'points', 0, 100000);
  const newStamps = assertIntegerInRange(request.data?.stamps, 'stamps', 0, 25);
  const reason = assertReason(request.data?.reason);
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    await enforceRateLimit(tx, auth.uid, 'adminAdjustUserLoyalty', 3000);
    const user = snap.data();
    const pointsDelta = newPoints - (user.points || 0);
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason, {
      role,
      action: 'admin_adjust_loyalty'
    });
    tx.update(userRef, {
      points: newPoints,
      stamps: newStamps,
      isVip: newPoints >= 100,
      updatedAt: FieldValue.serverTimestamp(),
      ...(pointsDelta !== 0 ? {
        pointsLastActivityAt: FieldValue.serverTimestamp(),
        pointsExpiresAt: newPoints > 0 ? Timestamp.fromDate(nextPointsExpiry()) : null
      } : {})
    });
    if (pointsDelta !== 0) {
      writePointLedger(tx, db, userRef, userRef.collection('transactions').doc(`admin_adjust_${auditId}`), buildPointLedgerEntry({
        userId,
        type: 'admin_adjustment',
        sourceId: auditId,
        pointsDelta,
        reason: `Ajuste Admin: ${reason}`,
        balanceBefore: user.points || 0,
        balanceAfter: newPoints,
        actor: { uid: auth.uid, email: auth.token.email || null, role },
        metadata: { auditId, stampsBefore: user.stamps || 0, stampsAfter: newStamps }
      }));
    }
    result = { userId, points: newPoints, stamps: newStamps, pointsDelta, auditId };
  });
  return result;
});

exports.adminApproveSocialQuest = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'marketing']);
  assertKnownKeys(request.data, ['userId', 'questType'], 'adminApproveSocialQuest');
  const userId = assertUserId(request.data?.userId);
  const quest = SOCIAL_QUESTS[request.data?.questType];
  if (!quest) throw new HttpsError('invalid-argument', 'Mision invalida');
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    await enforceRateLimit(tx, auth.uid, `adminApprove_${request.data.questType}`, 3000);
    const user = snap.data();
    if (user[quest.claimedField] === true) {
      result = { userId, alreadyClaimed: true, pointsDelta: 0 };
      return;
    }
    const newPoints = (user.points || 0) + quest.points;
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, user.stamps || 0, quest.reason, {
      role,
      action: 'admin_approve_social_quest',
      metadata: { questType: request.data.questType }
    });
    tx.update(userRef, {
      points: newPoints,
      isVip: newPoints >= 100,
      [quest.statusField]: 'approved',
      [quest.claimedField]: true,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc(`social_${request.data.questType}_${auditId}`), buildPointLedgerEntry({
      userId,
      type: 'quest_reward',
      sourceId: `${request.data.questType}_${auditId}`,
      pointsDelta: quest.points,
      reason: quest.reason,
      balanceBefore: user.points || 0,
      balanceAfter: newPoints,
      actor: { uid: auth.uid, email: auth.token.email || null, role },
      metadata: { auditId, questType: request.data.questType }
    }));
    result = { userId, points: newPoints, pointsDelta: quest.points, auditId };
  });
  return result;
});

exports.adminRejectSocialQuest = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'marketing']);
  assertKnownKeys(request.data, ['userId', 'questType'], 'adminRejectSocialQuest');
  const userId = assertUserId(request.data?.userId);
  const quest = SOCIAL_QUESTS[request.data?.questType];
  if (!quest) throw new HttpsError('invalid-argument', 'Mision invalida');
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    const reason = `Rechazo de misión: ${quest.reason}`;
    const auditId = await writeAdminAudit(tx, auth, userRef, user, user.points || 0, user.stamps || 0, reason, {
      role,
      action: 'admin_reject_social_quest',
      metadata: { questType: request.data.questType }
    });
    tx.update(userRef, { [quest.statusField]: 'rejected', updatedAt: FieldValue.serverTimestamp() });
    result = { userId, rejected: true, auditId };
  });
  return result;
});

exports.adminConsumeReward = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'cashier']);
  assertKnownKeys(request.data, ['userId', 'rewardId'], 'adminConsumeReward');
  const userId = assertUserId(request.data?.userId);
  const rewardId = typeof request.data?.rewardId === 'string' ? request.data.rewardId.trim() : '';
  if (!rewardId) throw new HttpsError('invalid-argument', 'rewardId es requerido');
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    const activeRewards = user.activeRewards || [];
    const reward = activeRewards.find((item) => item.id === rewardId);
    if (!reward) throw new HttpsError('not-found', 'Premio activo no encontrado');
    const claimedRewards = user.claimedRewards || [];
    const auditId = await writeAdminAudit(tx, auth, userRef, user, user.points || 0, user.stamps || 0, `Validación de canje: ${reward.name}`, {
      role,
      action: 'admin_consume_reward',
      metadata: { rewardId, rewardName: reward.name, couponCode: reward.code || null }
    });
    tx.update(userRef, {
      activeRewards: activeRewards.filter((item) => item.id !== rewardId),
      claimedRewards: [...claimedRewards, { ...reward, claimedAt: new Date().toISOString(), status: 'used' }],
      updatedAt: FieldValue.serverTimestamp()
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc(`consume_${auditId}`), buildPointLedgerEntry({
      userId,
      type: 'reward_consumed',
      sourceId: rewardId,
      pointsDelta: 0,
      reason: `Validación de canje: ${reward.name}`,
      balanceBefore: user.points || 0,
      balanceAfter: user.points || 0,
      actor: { uid: auth.uid, email: auth.token.email || null, role },
      metadata: { auditId, rewardId, rewardName: reward.name, couponCode: reward.code || null },
      attributes: { rewardId, reward: reward.name, couponCode: reward.code || null }
    }));
    result = { userId, rewardId, consumed: true, auditId };
  });
  return result;
});

exports.adminCreateManualUser = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'cashier']);
  assertKnownKeys(request.data, ['name', 'email', 'phone', 'gender', 'birthday'], 'adminCreateManualUser');
  const name = String(request.data?.name || '').trim().slice(0, 120);
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Nombre y email valido son obligatorios');
  }
  const userId = `manual_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const profile = {
    uid: userId,
    name,
    firstName: name.split(' ')[0],
    lastName: name.split(' ').slice(1).join(' '),
    email,
    phone: String(request.data?.phone || '').trim().slice(0, 40),
    gender: String(request.data?.gender || '').trim().slice(0, 40),
    birthday: String(request.data?.birthday || '').trim().slice(0, 20),
    points: WELCOME_POINTS,
    stamps: 0,
    isVip: false,
    activeRewards: [],
    claimedRewards: [],
    createdAt: new Date().toISOString(),
    createdBy: auth.token.email || auth.uid
  };

  const userRef = db.doc(`users/${userId}`);
  await db.runTransaction(async (tx) => {
    tx.set(userRef, profile);
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc('welcome_bonus'), buildPointLedgerEntry({
      userId,
      type: 'welcome_bonus',
      sourceId: userId,
      pointsDelta: WELCOME_POINTS,
      reason: 'Bono de bienvenida',
      balanceBefore: 0,
      balanceAfter: WELCOME_POINTS,
      actor: { uid: auth.uid, email: auth.token.email || null, role },
      metadata: { manualUser: true }
    }));
    await writeAdminAudit(tx, auth, userRef, profile, WELCOME_POINTS, 0, 'Registro manual de cliente', {
      role,
      action: 'admin_create_manual_user'
    });
  });
  return { userId, profile };
});

exports.claimBirthdayBonus = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['birthday'], 'claimBirthdayBonus');
  const birthday = typeof request.data?.birthday === 'string' ? request.data.birthday.trim() : '';
  if (!/^\d{2}-\d{2}-\d{4}$/.test(birthday)) throw new HttpsError('invalid-argument', 'Fecha de cumpleaños invalida');
  const result = await creditUserPoints({
    userId: auth.uid,
    pointsDelta: 100,
    type: 'birthday_bonus',
    sourceId: 'birthday',
    reason: 'Regalo de Cumpleaños',
    extraUserUpdate: { birthday, birthdayClaimed: true },
    actor: { uid: auth.uid, email: auth.token.email || null, role: 'customer' },
    metadata: { birthday },
    dailyLimit: {
      action: 'bonus_claimed',
      maxCount: DAILY_BONUS_CLAIM_LIMIT
    }
  });
  return { ...result, success: true };
});

exports.claimInstagramFollowBonus = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, [], 'claimInstagramFollowBonus');
  const userRef = db.doc(`users/${auth.uid}`);
  let result;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    if (user.instagramClaimed === true) {
      throw new HttpsError('already-exists', 'Ya reclamaste este bono');
    }
    await enforceRateAndDailyLimit(
      tx,
      auth.uid,
      'claimInstagramFollowBonus',
      3000,
      'bonus_claimed',
      { maxCount: DAILY_BONUS_CLAIM_LIMIT }
    );
    const newPoints = (user.points || 0) + 50;
    tx.update(userRef, {
      points: newPoints,
      isVip: newPoints >= 100,
      instagramClaimed: true,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    writePointLedger(tx, db, userRef, userRef.collection('transactions').doc('instagram_follow_bonus'), buildPointLedgerEntry({
      userId: auth.uid,
      type: 'quest_reward',
      sourceId: 'instagram_follow',
      pointsDelta: 50,
      reason: 'Seguir en Instagram',
      balanceBefore: user.points || 0,
      balanceAfter: newPoints,
      actor: { uid: auth.uid, email: auth.token.email || null, role: 'customer' }
    }));
    result = { success: true, pointsDelta: 50, newPoints };
  });

  return result;
});

exports.getTierRewards = onCall(CALLABLE_OPTIONS, async (request) => {
  requireAuth(request);
  return { tiers: await getConfiguredTierRewards() };
});

exports.adminSaveTierReward = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['level', 'name', 'reward', 'emoji', 'color', 'textColor', 'cogs', 'active'], 'adminSaveTierReward');
  const level = assertIntegerInRange(request.data?.level, 'level', 1, DEFAULT_TIER_REWARDS.length);
  let tier;
  try {
    tier = normalizeTierReward({ ...request.data, level });
  } catch (err) {
    throw new HttpsError('invalid-argument', 'Configuracion de tier invalida');
  }
  const tierRef = db.collection('tierRewards').doc(String(level));
  let auditId;
  await db.runTransaction(async (tx) => {
    const beforeSnap = await tx.get(tierRef);
    tx.set(tierRef, {
      ...tier,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.token.email || auth.uid,
      updatedByRole: role
    }, { merge: true });
    auditId = writeConfigAudit(tx, {
      auth,
      role,
      action: 'admin_save_tier_reward',
      targetRef: tierRef,
      before: beforeSnap.exists ? beforeSnap.data() : null,
      after: tier,
      reason: `Actualizacion de recompensa de tier ${level}`
    });
  });
  logLoyalty('tier_reward_updated', { level, auditId, actorRole: role });
  return { tier, auditId };
});

exports.getLoyaltyCampaignSettings = onCall(CALLABLE_OPTIONS, async (request) => {
  await requireRole(request, ['superadmin', 'admin', 'marketing']);
  return { campaign: await getCurrentCampaign() };
});

exports.getActiveLoyaltyCampaigns = onCall(CALLABLE_OPTIONS, async (request) => {
  requireAuth(request);
  const campaign = await getActiveCampaign();
  return { campaigns: campaign ? [campaign] : [] };
});

exports.adminSaveLoyaltyCampaign = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin', 'marketing']);
  assertKnownKeys(request.data, ['active', 'name', 'pointsMultiplier', 'startsAt', 'endsAt'], 'adminSaveLoyaltyCampaign');
  const campaign = normalizeLoyaltyCampaign(request.data || {});
  if (campaign.active && !campaign.name) throw new HttpsError('invalid-argument', 'Nombre de campaña requerido');
  const campaignRef = db.collection('loyaltyCampaigns').doc('current');
  let auditId;
  await db.runTransaction(async (tx) => {
    const beforeSnap = await tx.get(campaignRef);
    tx.set(campaignRef, {
      ...campaign,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.token.email || auth.uid,
      updatedByRole: role
    }, { merge: true });
    auditId = writeConfigAudit(tx, {
      auth,
      role,
      action: 'admin_save_loyalty_campaign',
      targetRef: campaignRef,
      before: beforeSnap.exists ? beforeSnap.data() : null,
      after: campaign,
      reason: 'Actualizacion de campaña loyalty'
    });
  });
  logLoyalty('loyalty_campaign_updated', { auditId, active: campaign.active, pointsMultiplier: campaign.pointsMultiplier, actorRole: role });
  return { campaign, auditId };
});

function compactMetadata(value, depth = 0) {
  if (depth > 2 || value === undefined) return null;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 240);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactMetadata(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 20).reduce((acc, [key, item]) => {
      const safeKey = String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
      if (safeKey) acc[safeKey] = compactMetadata(item, depth + 1);
      return acc;
    }, {});
  }
  return null;
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

async function getPagedUsersForJob(jobName, pageSize) {
  const stateRef = db.collection(JOB_STATE_COLLECTION).doc(jobName);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  let query = db.collection('users').orderBy(FieldPath.documentId()).limit(pageSize);
  if (state.lastUserId) query = query.startAfter(state.lastUserId);
  let users = await query.get();

  if (users.empty && state.lastUserId) {
    await stateRef.set({
      lastUserId: null,
      completedCycleAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    users = await db.collection('users').orderBy(FieldPath.documentId()).limit(pageSize).get();
  }

  return { stateRef, state, users };
}

async function savePagedUsersJobState(stateRef, users, extra = {}) {
  const lastDoc = users.docs[users.docs.length - 1];
  await stateRef.set({
    lastUserId: lastDoc ? lastDoc.id : null,
    processedInLastRun: users.size,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra
  }, { merge: true });
}

function normalizeBackfillLimit(value, fallback, max) {
  const limit = Number(value || fallback);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, max) : fallback;
}

async function backfillLedgerForUserPage({ userId, txLimit = 100, afterTxId = null, backfillRunId = null }) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { userId, found: false, scanned: 0, created: 0, skipped: 0, invalid: 0, hasMore: false, nextAfterTxId: null };

  let query = userRef.collection('transactions').orderBy(FieldPath.documentId()).limit(txLimit);
  if (afterTxId) query = query.startAfter(afterTxId);
  const txSnap = await query.get();
  const batch = db.batch();
  let created = 0;
  let skipped = 0;
  let invalid = 0;
  let lastTxId = null;

  const candidates = [];
  for (const txDoc of txSnap.docs) {
    lastTxId = txDoc.id;
    try {
      const entry = buildLedgerEntryFromUserTransaction(userId, txDoc.id, txDoc.data(), { backfillRunId });
      const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerDocId(userId, entry.type, entry.sourceId));
      candidates.push({ txDoc, entry, ledgerRef });
    } catch (err) {
      invalid += 1;
      logLoyalty('loyalty_ledger_backfill_invalid_transaction', { userId, txId: txDoc.id, error: err.message });
    }
  }

  const existing = await Promise.all(candidates.map((item) => item.ledgerRef.get()));
  candidates.forEach((item, index) => {
    if (existing[index].exists) {
      skipped += 1;
      return;
    }
    batch.set(item.ledgerRef, {
      ...item.entry,
      transactionPath: item.txDoc.ref.path,
      userPath: userRef.path
    });
    created += 1;
  });

  if (created > 0) await batch.commit();

  return {
    userId,
    found: true,
    scanned: txSnap.size,
    created,
    skipped,
    invalid,
    hasMore: txSnap.size === txLimit,
    nextAfterTxId: txSnap.size === txLimit ? lastTxId : null
  };
}

exports.trackLoyaltyEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const auth = requireAuth(request);
  assertKnownKeys(request.data, ['event', 'surface', 'metadata'], 'trackLoyaltyEvent');
  const allowedEvents = new Set(['earn_view', 'redeem_view', 'referral_view', 'earn_submit', 'redeem_success', 'birthday_claim_success', 'wallet_deposit_success', 'purchase_points_success']);
  const event = typeof request.data?.event === 'string' ? request.data.event.trim() : '';
  if (!allowedEvents.has(event)) throw new HttpsError('invalid-argument', 'Evento de loyalty invalido');
  const eventRef = await db.collection('loyalty_events').add({
    uid: auth.uid,
    email: auth.token.email || '',
    event,
    surface: String(request.data?.surface || 'dashboard').slice(0, 60),
    metadata: compactMetadata(request.data?.metadata || {}),
    createdAt: FieldValue.serverTimestamp()
  });
  logLoyalty('loyalty_event_tracked', { eventId: eventRef.id, userId: auth.uid, event });
  return { ok: true, eventId: eventRef.id };
});

exports.adminListLoyaltyReconciliations = onCall(CALLABLE_OPTIONS, async (request) => {
  await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['status', 'limit'], 'adminListLoyaltyReconciliations');
  const status = typeof request.data?.status === 'string' ? request.data.status.trim() : '';
  const limit = normalizeBackfillLimit(request.data?.limit, 50, 100);
  const allowedStatuses = new Set(['', 'matched', 'mismatch', 'repaired']);
  if (!allowedStatuses.has(status)) throw new HttpsError('invalid-argument', 'status invalido');

  const snap = await db.collection(RECONCILIATION_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(status ? Math.min(limit * 3, 300) : limit)
    .get();

  const records = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (status && data.status !== status) return;
    if (records.length >= limit) return;
    records.push({
      id: doc.id,
      userId: data.userId || null,
      cachedPoints: Number(data.cachedPoints || 0),
      ledgerBalance: Number(data.ledgerBalance || 0),
      ledgerEntries: Number(data.ledgerEntries || 0),
      delta: Number(data.delta || 0),
      status: data.status || 'unknown',
      repaired: Boolean(data.repaired),
      createdAt: timestampToIso(data.createdAt)
    });
  });

  return { records };
});

exports.adminRetryComprobanteNotification = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['failureId'], 'adminRetryComprobanteNotification');
  const failureId = typeof request.data?.failureId === 'string' ? request.data.failureId.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(failureId)) throw new HttpsError('invalid-argument', 'failureId invalido');

  const failureRef = db.collection(NOTIFICATION_FAILURES_COLLECTION).doc(failureId);
  const failureSnap = await failureRef.get();
  if (!failureSnap.exists) throw new HttpsError('not-found', 'Fallo de notificacion no encontrado');
  const failure = failureSnap.data();
  if (failure.type !== 'deposit_comprobante') {
    throw new HttpsError('failed-precondition', 'Este tipo de notificacion no soporta reintento automatico');
  }
  if (failure.status === 'sent') {
    return { sent: true, alreadySent: true, failureId };
  }

  if (typeof sendComprobanteWhatsapp !== 'function') {
    await failureRef.set({
      status: 'blocked_missing_whatsapp_config',
      attempts: FieldValue.increment(1),
      lastAttemptBy: auth.token.email || auth.uid,
      lastAttemptByRole: role,
      lastAttemptAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    logLoyalty('comprobante_notification_retry_blocked', { failureId, actorRole: role, reason: 'sendComprobanteWhatsapp_not_configured' });
    return { sent: false, blocked: true, failureId, reason: 'sendComprobanteWhatsapp_not_configured' };
  }

  try {
    const result = await sendComprobanteWhatsapp(failure.payload || {});
    await failureRef.set({
      status: result.sent ? 'sent' : 'skipped',
      providerMessageId: result.providerMessageId || null,
      attempts: FieldValue.increment(1),
      lastAttemptBy: auth.token.email || auth.uid,
      lastAttemptByRole: role,
      lastAttemptAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    logLoyalty('comprobante_notification_retry_completed', { failureId, sent: result.sent, actorRole: role });
    return { ...result, failureId };
  } catch (err) {
    await failureRef.set({
      status: 'pending_retry',
      attempts: FieldValue.increment(1),
      lastError: compactMetadata(err.response?.data || err.message),
      lastAttemptBy: auth.token.email || auth.uid,
      lastAttemptByRole: role,
      lastAttemptAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    functions.logger.error('comprobante_notification_retry_failed', {
      component: 'loyalty_notifications',
      failureId,
      error: err.response?.data || err.message
    });
    throw new HttpsError('internal', 'No se pudo reenviar el comprobante');
  }
});

exports.adminBackfillLoyaltyLedger = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['userId', 'txLimit', 'afterTxId'], 'adminBackfillLoyaltyLedger');
  const txLimit = normalizeBackfillLimit(request.data?.txLimit, 100, 250);
  const userId = request.data?.userId ? assertUserId(request.data.userId) : null;
  const afterTxId = typeof request.data?.afterTxId === 'string' ? request.data.afterTxId.trim() : null;
  const backfillRunId = `admin_${auth.uid}_${Date.now()}`;

  if (userId) {
    const result = await backfillLedgerForUserPage({ userId, txLimit, afterTxId, backfillRunId });
    logLoyalty('loyalty_ledger_backfill_admin_user', { ...result, requestedByRole: role });
    return result;
  }

  const { stateRef, state } = await getPagedUsersForJob(BACKFILL_JOB, 1);
  let currentUserId = state.currentUserId || null;
  let currentAfterTxId = state.currentAfterTxId || null;

  if (!currentUserId) {
    let userQuery = db.collection('users').orderBy(FieldPath.documentId()).limit(1);
    if (state.lastUserId) userQuery = userQuery.startAfter(state.lastUserId);
    let userSnap = await userQuery.get();
    if (userSnap.empty && state.lastUserId) {
      await stateRef.set({ lastUserId: null, currentUserId: null, currentAfterTxId: null }, { merge: true });
      userSnap = await db.collection('users').orderBy(FieldPath.documentId()).limit(1).get();
    }
    currentUserId = userSnap.docs[0]?.id || null;
  }

  if (!currentUserId) {
    await stateRef.set({ completedCycleAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { found: false, scanned: 0, created: 0, skipped: 0, invalid: 0, hasMore: false };
  }

  const result = await backfillLedgerForUserPage({
    userId: currentUserId,
    txLimit,
    afterTxId: currentAfterTxId,
    backfillRunId
  });

  await stateRef.set({
    currentUserId: result.hasMore ? currentUserId : null,
    currentAfterTxId: result.hasMore ? result.nextAfterTxId : null,
    lastUserId: result.hasMore ? state.lastUserId || null : currentUserId,
    lastRunBy: auth.token.email || auth.uid,
    lastRunByRole: role,
    lastRunResult: result,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  logLoyalty('loyalty_ledger_backfill_admin_page', { ...result, requestedByRole: role });
  return result;
});

exports.backfillLoyaltyLedger = onSchedule('every 12 hours', async () => {
  const stateRef = db.collection(JOB_STATE_COLLECTION).doc(BACKFILL_JOB);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  let currentUserId = state.currentUserId || null;
  let currentAfterTxId = state.currentAfterTxId || null;

  if (!currentUserId) {
    let userQuery = db.collection('users').orderBy(FieldPath.documentId()).limit(1);
    if (state.lastUserId) userQuery = userQuery.startAfter(state.lastUserId);
    let userSnap = await userQuery.get();
    if (userSnap.empty && state.lastUserId) {
      await stateRef.set({
        lastUserId: null,
        currentUserId: null,
        currentAfterTxId: null,
        completedCycleAt: FieldValue.serverTimestamp()
      }, { merge: true });
      userSnap = await db.collection('users').orderBy(FieldPath.documentId()).limit(1).get();
    }
    currentUserId = userSnap.docs[0]?.id || null;
  }

  if (!currentUserId) {
    logLoyalty('loyalty_ledger_backfill_empty', {});
    return;
  }

  const result = await backfillLedgerForUserPage({
    userId: currentUserId,
    txLimit: 150,
    afterTxId: currentAfterTxId,
    backfillRunId: `scheduled_${Date.now()}`
  });

  await stateRef.set({
    currentUserId: result.hasMore ? currentUserId : null,
    currentAfterTxId: result.hasMore ? result.nextAfterTxId : null,
    lastUserId: result.hasMore ? state.lastUserId || null : currentUserId,
    lastRunResult: result,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  logLoyalty('loyalty_ledger_backfill_batch', result);
});

async function calculateLedgerBalanceInTransaction(tx, userId) {
  const snap = await tx.get(db.collection(LEDGER_COLLECTION).where('userId', '==', userId));
  let balance = 0;
  snap.forEach((doc) => {
    balance += Number(doc.data().pointsDelta || 0);
  });
  return { balance, entries: snap.size };
}

exports.adminReconcileUserLoyalty = onCall(CALLABLE_OPTIONS, async (request) => {
  const { auth, role } = await requireRole(request, ['superadmin', 'admin']);
  assertKnownKeys(request.data, ['userId', 'repair'], 'adminReconcileUserLoyalty');
  const userId = assertUserId(request.data?.userId);
  const repair = request.data?.repair === true;
  const userRef = db.collection('users').doc(userId);
  const reconciliationRef = db.collection(RECONCILIATION_COLLECTION).doc();
  let result;

  await db.runTransaction(async (tx) => {
    const [userSnap, ledger] = await Promise.all([
      tx.get(userRef),
      calculateLedgerBalanceInTransaction(tx, userId)
    ]);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');

    const user = userSnap.data();
    const cachedPoints = Number(user.points || 0);
    const delta = ledger.balance - cachedPoints;
    const status = delta === 0 ? 'matched' : (repair ? 'repaired' : 'mismatch');

    tx.set(reconciliationRef, {
      userId,
      cachedPoints,
      ledgerBalance: ledger.balance,
      ledgerEntries: ledger.entries,
      delta,
      status,
      repaired: repair && delta !== 0,
      requestedBy: auth.token.email || auth.uid,
      requestedByUid: auth.uid,
      requestedByRole: role,
      createdAt: FieldValue.serverTimestamp()
    });

    if (repair && delta !== 0) {
      tx.set(userRef, {
        points: ledger.balance,
        isVip: ledger.balance >= 100,
        reconciliationStatus: 'repaired',
        lastReconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await writeAdminAudit(tx, auth, userRef, user, ledger.balance, user.stamps || 0, 'Reconciliación de saldo PADRE contra ledger', {
        role,
        action: 'admin_reconcile_loyalty_balance',
        metadata: { cachedPoints, ledgerBalance: ledger.balance, delta, reconciliationId: reconciliationRef.id }
      });
    } else {
      tx.set(userRef, {
        reconciliationStatus: status,
        lastReconciledAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    result = {
      userId,
      cachedPoints,
      ledgerBalance: ledger.balance,
      ledgerEntries: ledger.entries,
      delta,
      status,
      repaired: repair && delta !== 0,
      reconciliationId: reconciliationRef.id
    };
  });

  logLoyalty('loyalty_balance_reconciled', result);
  return result;
});

exports.reconcileLoyaltyBalances = onSchedule('every 6 hours', async () => {
  const { stateRef, users } = await getPagedUsersForJob(RECONCILE_JOB, 200);
  const batch = db.batch();
  let checked = 0;
  let mismatches = 0;

  for (const doc of users.docs) {
    checked += 1;
    const user = doc.data();
    const cachedPoints = Number(user.points || 0);
    const ledger = await calculateLedgerBalance(db, doc.id);
    const delta = ledger.balance - cachedPoints;
    if (delta !== 0) {
      mismatches += 1;
      const reconciliationRef = db.collection(RECONCILIATION_COLLECTION).doc();
      batch.set(reconciliationRef, {
        userId: doc.id,
        cachedPoints,
        ledgerBalance: ledger.balance,
        ledgerEntries: ledger.entries,
        delta,
        status: 'mismatch',
        repaired: false,
        detectedBy: 'scheduled_reconcileLoyaltyBalances',
        createdAt: FieldValue.serverTimestamp()
      });
      batch.set(doc.ref, {
        reconciliationStatus: 'mismatch',
        lastReconciledAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      batch.set(doc.ref, {
        reconciliationStatus: 'matched',
        lastReconciledAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  await batch.commit();
  await savePagedUsersJobState(stateRef, users, { mismatchesInLastRun: mismatches });
  logLoyalty('loyalty_reconciliation_batch', { checked, mismatches, lastUserId: users.docs[users.docs.length - 1]?.id || null });
});

exports.expireLoyaltyPoints = onSchedule('every day 04:00', async () => {
  const now = Timestamp.now();
  const stateRef = db.collection(JOB_STATE_COLLECTION).doc(EXPIRE_JOB);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  let query = db.collection('users')
    .where('pointsExpiresAt', '<=', now)
    .orderBy('pointsExpiresAt')
    .orderBy(FieldPath.documentId())
    .limit(150);
  if (state.lastPointsExpiresAt && state.lastUserId) {
    query = query.startAfter(state.lastPointsExpiresAt, state.lastUserId);
  }
  let due = await query.get();

  if (due.empty && state.lastUserId) {
    await stateRef.set({
      lastPointsExpiresAt: null,
      lastUserId: null,
      completedCycleAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    due = await db.collection('users')
      .where('pointsExpiresAt', '<=', now)
      .orderBy('pointsExpiresAt')
      .orderBy(FieldPath.documentId())
      .limit(150)
      .get();
  }

  const batch = db.batch();
  let expired = 0;
  due.forEach((doc) => {
    const user = doc.data();
    const points = user.points || 0;
    if (points <= 0) return;
    expired += 1;
    const sourceId = `${doc.id}_${now.toMillis()}`;
    const txRef = doc.ref.collection('transactions').doc(transactionDocId('points_expired', sourceId));
    const entry = buildPointLedgerEntry({
      userId: doc.id,
      type: 'points_expired',
      sourceId,
      pointsDelta: -points,
      reason: 'Expiración por inactividad',
      balanceBefore: points,
      balanceAfter: 0,
      actor: { role: 'system' }
    });
    batch.set(doc.ref, {
      points: 0,
      isVip: false,
      pointsExpiredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(txRef, entry);
    batch.set(db.collection(LEDGER_COLLECTION).doc(ledgerDocId(doc.id, 'points_expired', sourceId)), {
      ...entry,
      transactionPath: txRef.path,
      userPath: doc.ref.path
    });
  });
  await batch.commit();
  const lastDoc = due.docs[due.docs.length - 1];
  await stateRef.set({
    lastPointsExpiresAt: lastDoc ? lastDoc.data().pointsExpiresAt || null : null,
    lastUserId: lastDoc ? lastDoc.id : null,
    processedInLastRun: due.size,
    expiredInLastRun: expired,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  logLoyalty('points_expired_batch', { expired, processed: due.size, lastUserId: lastDoc?.id || null });
});
