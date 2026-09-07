const crypto = require('crypto');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
// TEMPORAL: ver notas de deploy - no requerir './notifications' evita que defineSecret()
// bloquee el analisis de deploy sin WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID en Secret Manager.
const sendComprobanteWhatsapp = null, waToken = null, waPhoneId = null;
const { _claimReferralForUser, _completeReferralForPurchase, _isAdmin } = require('./referrals');
const {
  WELCOME_POINTS,
  REWARD_CATALOG,
  DEFAULT_TIER_REWARDS,
  SOLANA_TREASURY_WALLET,
  transactionDocId,
  pointsForPurchase,
  pointsForDeposit,
  requiredLamportsForUsd,
  normalizeSolanaCluster,
  normalizeTierReward,
  mergeTierRewards,
  normalizeLoyaltyCampaign,
  nextPointsExpiry
} = require('./loyalty');

if (!getApps().length) initializeApp();

const db = getFirestore();

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return request.auth;
}

async function requireAdmin(request) {
  const auth = requireAuth(request);
  if (!await _isAdmin(request)) {
    throw new HttpsError('permission-denied', 'Solo administradores pueden ejecutar esta accion');
  }
  return auth;
}

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
  const ref = db.collection('rateLimits').doc(`${uid}_${action}`);
  const snap = await tx.get(ref);
  const now = Date.now();
  const lastAt = snap.exists ? Number(snap.data().lastAt || 0) : 0;
  if (lastAt && now - lastAt < intervalMs) {
    throw new HttpsError('resource-exhausted', 'Demasiadas solicitudes. Intenta nuevamente en unos segundos');
  }
  tx.set(ref, { uid, action, lastAt: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function creditUserPoints({ userId, pointsDelta, type, sourceId, reason, orderId, amountUsd, extraUserUpdate }) {
  const userRef = db.collection('users').doc(userId);
  const txRef = userRef.collection('transactions').doc(transactionDocId(type, sourceId));

  return db.runTransaction(async (tx) => {
    const [userSnap, txSnap] = await Promise.all([tx.get(userRef), tx.get(txRef)]);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    if (txSnap.exists) {
      return {
        alreadyProcessed: true,
        transactionId: txRef.id,
        pointsDelta: txSnap.data().pointsDelta || txSnap.data().amount || 0,
        newPoints: userSnap.data().points || 0
      };
    }

    const user = userSnap.data();
    const nextPoints = Math.max(0, (user.points || 0) + pointsDelta);
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

    tx.set(txRef, {
      type,
      sourceId: String(sourceId),
      orderId: orderId || null,
      amount: pointsDelta,
      pointsDelta,
      currency: 'PADRE',
      reason,
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });

    return { alreadyProcessed: false, transactionId: txRef.id, pointsDelta, newPoints: nextPoints };
  });
}

function clusterRpcUrl(cluster) {
  return cluster === 'devnet' ? 'https://api.devnet.solana.com' : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
}

async function verifySolanaTransfer({ signature, amountUsd, cluster }) {
  const txSignature = typeof signature === 'string' ? signature.trim() : '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(txSignature)) {
    throw new HttpsError('invalid-argument', 'Signature de Solana invalida');
  }

  const normalizedCluster = normalizeSolanaCluster(cluster);
  const requiredLamports = requiredLamportsForUsd(amountUsd);
  const response = await fetch(clusterRpcUrl(normalizedCluster), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'santopadre-rewards',
      method: 'getTransaction',
      params: [
        txSignature,
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0
        }
      ]
    })
  });

  if (!response.ok) throw new HttpsError('unavailable', 'No se pudo consultar Solana RPC');
  const body = await response.json();
  const tx = body.result;
  if (!tx || tx.meta?.err) {
    throw new HttpsError('failed-precondition', 'La transaccion Solana no esta confirmada correctamente');
  }

  const transfer = (tx.transaction?.message?.instructions || []).find((instruction) => {
    const parsed = instruction.parsed;
    if (instruction.program !== 'system' || parsed?.type !== 'transfer') return false;
    const info = parsed.info || {};
    return info.destination === SOLANA_TREASURY_WALLET && Number(info.lamports || 0) >= requiredLamports;
  });
  if (!transfer) {
    throw new HttpsError('failed-precondition', 'La transaccion no paga el monto esperado a la wallet SantoPadre');
  }

  return {
    signature: txSignature,
    cluster: normalizedCluster,
    lamports: Number(transfer.parsed.info.lamports || 0),
    source: transfer.parsed.info.source || null,
    destination: SOLANA_TREASURY_WALLET
  };
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

function auditPayload({ auth, userId, user, prevPoints, newPoints, prevStamps, newStamps, reason }) {
  return {
    adminEmail: auth.token.email || auth.uid,
    userId,
    userName: user.name || user.email || 'Cliente SantoPadre',
    prevPoints,
    newPoints,
    oldPoints: prevPoints,
    oldStamps: prevStamps,
    prevStamps,
    newStamps,
    reason,
    timestamp: new Date().toISOString()
  };
}

exports.initializeUserRewards = functions.auth.user().onCreate(async (user) => {
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
      tx.set(txRef, {
        type: 'welcome_bonus',
        sourceId: user.uid,
        amount: WELCOME_POINTS,
        pointsDelta: WELCOME_POINTS,
        currency: 'PADRE',
        reason: 'Bono de bienvenida',
        timestamp: FieldValue.serverTimestamp(),
        status: 'completed'
      });
    }
  });

  logLoyalty('welcome_bonus_initialized', { userId: user.uid, pointsAwarded: WELCOME_POINTS });
});

exports.syncUserProfile = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
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
    tx.set(userRef.collection('transactions').doc('welcome_bonus'), {
      type: 'welcome_bonus',
      sourceId: auth.uid,
      amount: WELCOME_POINTS,
      pointsDelta: WELCOME_POINTS,
      currency: 'PADRE',
      reason: 'Bono de bienvenida',
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
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

exports.confirmPurchaseAndAwardPoints = onCall({ maxInstances: 5 }, async (request) => {
  const auth = requireAuth(request);
  const orderId = typeof request.data?.orderId === 'string' ? request.data.orderId.trim() : '';
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId es requerido');

  const adminCaller = await _isAdmin(request);
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
    orderId
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
  logLoyalty('purchase_confirmed', { orderId, userId: orderUserId, pointsAwarded: result.pointsDelta || points, alreadyProcessed: result.alreadyProcessed });
  return { ...result, success: true, orderId, pointsAwarded: result.pointsDelta || points, referral };
});

exports.confirmSolanaDeposit = onCall({ maxInstances: 5 }, async (request) => {
  const auth = requireAuth(request);
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
    amountUsd
  });

  let notification = null;
  if (!result.alreadyProcessed) {
    try {
      const profileSnap = await db.collection('users').doc(auth.uid).get();
      const profile = profileSnap.exists ? profileSnap.data() : {};
      notification = await sendComprobanteWhatsapp({
        recipientPhone: profile.phone || auth.token.phone_number || '',
        userName: profile.name || auth.token.name || 'Cliente SantoPadre',
        amount: amountUsd,
        pointsAwarded: points,
        signature: verification.signature
      });
    } catch (err) {
      notification = { sent: false, error: err.message };
      functions.logger.error('comprobante_notification_failed', {
        component: 'loyalty_notifications',
        userId: auth.uid,
        error: err.response?.data || err.message
      });
    }
  }

  logLoyalty('solana_deposit_confirmed', { userId: auth.uid, amountUsd, pointsAwarded: points, signature: verification.signature, alreadyProcessed: result.alreadyProcessed });
  return { ...result, success: true, amountUsd, pointsAwarded: points, solana: verification, notification };
});

exports.redeemReward = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
  const rewardId = request.data?.rewardId;
  const catalogEntry = REWARD_CATALOG[rewardId];
  if (!catalogEntry) throw new HttpsError('invalid-argument', 'Recompensa inválida');

  const uid = auth.uid;
  const userRef = db.doc(`users/${uid}`);
  const rewardDocId = crypto.randomBytes(10).toString('hex');
  const couponCode = 'SP-PT-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const result = await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, uid, 'redeemReward', 3000);
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado');

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
    tx.set(userRef.collection('transactions').doc(`redeem_${rewardDocId}`), {
      type: 'canje',
      rewardId,
      amount: -catalogEntry.cost,
      pointsDelta: -catalogEntry.cost,
      currency: 'PADRE',
      reward: catalogEntry.name,
      couponCode,
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
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

exports.claimTierReward = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
  const uid = auth.uid;
  const userRef = db.doc(`users/${uid}`);
  let response;

  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, uid, 'claimTierReward', 3000);
    const [userDoc, tiersSnap] = await Promise.all([tx.get(userRef), tx.get(db.collection('tierRewards'))]);
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuario no encontrado');

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

async function writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason) {
  const auditRef = db.collection('audit_logs').doc();
  tx.set(auditRef, auditPayload({
    auth,
    userId: userRef.id,
    user,
    prevPoints: user.points || 0,
    newPoints,
    prevStamps: user.stamps || 0,
    newStamps,
    reason
  }));
  return auditRef.id;
}

exports.adminQuickAddStamp = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
  const userId = assertUserId(request.data?.userId);
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, auth.uid, 'adminQuickAddStamp', 3000);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    const newStamps = (user.stamps || 0) + 1;
    if (newStamps > 25) throw new HttpsError('failed-precondition', 'El cliente ya alcanzo el limite de 25 sellos');
    const newPoints = (user.points || 0) + 100;
    const reason = 'Escaneo de tarjeta de sellos rápido (+1 sello, +100 PTS)';
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason);
    tx.update(userRef, {
      points: newPoints,
      stamps: newStamps,
      isVip: newPoints >= 100,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(userRef.collection('transactions').doc(`quick_stamp_${auditId}`), {
      type: 'stamp_scan',
      amount: 100,
      pointsDelta: 100,
      currency: 'PADRE',
      reason,
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    result = { userId, points: newPoints, stamps: newStamps, auditId };
  });
  return result;
});

exports.adminAdjustUserLoyalty = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
  const userId = assertUserId(request.data?.userId);
  const newPoints = assertIntegerInRange(request.data?.points, 'points', 0, 100000);
  const newStamps = assertIntegerInRange(request.data?.stamps, 'stamps', 0, 25);
  const reason = assertReason(request.data?.reason);
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, auth.uid, 'adminAdjustUserLoyalty', 3000);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    const pointsDelta = newPoints - (user.points || 0);
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, newStamps, reason);
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
      tx.set(userRef.collection('transactions').doc(`admin_adjust_${auditId}`), {
        type: 'admin_adjustment',
        amount: pointsDelta,
        pointsDelta,
        currency: 'PADRE',
        reason: `Ajuste Admin: ${reason}`,
        timestamp: FieldValue.serverTimestamp(),
        status: 'completed'
      });
    }
    result = { userId, points: newPoints, stamps: newStamps, pointsDelta, auditId };
  });
  return result;
});

exports.adminApproveSocialQuest = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
  const userId = assertUserId(request.data?.userId);
  const quest = SOCIAL_QUESTS[request.data?.questType];
  if (!quest) throw new HttpsError('invalid-argument', 'Mision invalida');
  const userRef = db.doc(`users/${userId}`);
  let result;

  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, auth.uid, `adminApprove_${request.data.questType}`, 3000);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    if (user[quest.claimedField] === true) {
      result = { userId, alreadyClaimed: true, pointsDelta: 0 };
      return;
    }
    const newPoints = (user.points || 0) + quest.points;
    const auditId = await writeAdminAudit(tx, auth, userRef, user, newPoints, user.stamps || 0, quest.reason);
    tx.update(userRef, {
      points: newPoints,
      isVip: newPoints >= 100,
      [quest.statusField]: 'approved',
      [quest.claimedField]: true,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(userRef.collection('transactions').doc(`social_${request.data.questType}_${auditId}`), {
      type: 'quest_reward',
      amount: quest.points,
      pointsDelta: quest.points,
      currency: 'PADRE',
      reason: quest.reason,
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    result = { userId, points: newPoints, pointsDelta: quest.points, auditId };
  });
  return result;
});

exports.adminRejectSocialQuest = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
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
    const auditId = await writeAdminAudit(tx, auth, userRef, user, user.points || 0, user.stamps || 0, reason);
    tx.update(userRef, { [quest.statusField]: 'rejected', updatedAt: FieldValue.serverTimestamp() });
    result = { userId, rejected: true, auditId };
  });
  return result;
});

exports.adminConsumeReward = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
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
    const auditId = await writeAdminAudit(tx, auth, userRef, user, user.points || 0, user.stamps || 0, `Validación de canje: ${reward.name}`);
    tx.update(userRef, {
      activeRewards: activeRewards.filter((item) => item.id !== rewardId),
      claimedRewards: [...claimedRewards, { ...reward, claimedAt: new Date().toISOString(), status: 'used' }],
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(userRef.collection('transactions').doc(`consume_${auditId}`), {
      type: 'reward_consumed',
      rewardId,
      amount: 0,
      pointsDelta: 0,
      currency: 'PADRE',
      reason: `Validación de canje: ${reward.name}`,
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    result = { userId, rewardId, consumed: true, auditId };
  });
  return result;
});

exports.adminCreateManualUser = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
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
    tx.set(userRef.collection('transactions').doc('welcome_bonus'), {
      type: 'welcome_bonus',
      sourceId: userId,
      amount: WELCOME_POINTS,
      pointsDelta: WELCOME_POINTS,
      currency: 'PADRE',
      reason: 'Bono de bienvenida',
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    await writeAdminAudit(tx, auth, userRef, profile, WELCOME_POINTS, 0, 'Registro manual de cliente');
  });
  return { userId, profile };
});

exports.claimBirthdayBonus = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
  const birthday = typeof request.data?.birthday === 'string' ? request.data.birthday.trim() : '';
  if (!/^\d{2}-\d{2}-\d{4}$/.test(birthday)) throw new HttpsError('invalid-argument', 'Fecha de cumpleaños invalida');
  const result = await creditUserPoints({
    userId: auth.uid,
    pointsDelta: 100,
    type: 'birthday_bonus',
    sourceId: 'birthday',
    reason: 'Regalo de Cumpleaños',
    extraUserUpdate: { birthday, birthdayClaimed: true }
  });
  return { ...result, success: true };
});

exports.claimInstagramFollowBonus = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
  const userRef = db.doc(`users/${auth.uid}`);
  let result;

  await db.runTransaction(async (tx) => {
    await enforceRateLimit(tx, auth.uid, 'claimInstagramFollowBonus', 3000);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Usuario no encontrado');
    const user = snap.data();
    if (user.instagramClaimed === true) {
      throw new HttpsError('already-exists', 'Ya reclamaste este bono');
    }
    const newPoints = (user.points || 0) + 50;
    tx.update(userRef, {
      points: newPoints,
      isVip: newPoints >= 100,
      instagramClaimed: true,
      pointsLastActivityAt: FieldValue.serverTimestamp(),
      pointsExpiresAt: Timestamp.fromDate(nextPointsExpiry()),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(userRef.collection('transactions').doc('instagram_follow_bonus'), {
      type: 'quest_reward',
      sourceId: 'instagram_follow',
      amount: 50,
      pointsDelta: 50,
      currency: 'PADRE',
      reason: 'Seguir en Instagram',
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    result = { success: true, pointsDelta: 50, newPoints };
  });

  return result;
});

exports.getTierRewards = onCall({ maxInstances: 10 }, async (request) => {
  requireAuth(request);
  return { tiers: await getConfiguredTierRewards() };
});

exports.adminSaveTierReward = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
  const level = assertIntegerInRange(request.data?.level, 'level', 1, DEFAULT_TIER_REWARDS.length);
  let tier;
  try {
    tier = normalizeTierReward({ ...request.data, level });
  } catch (err) {
    throw new HttpsError('invalid-argument', 'Configuracion de tier invalida');
  }
  await db.collection('tierRewards').doc(String(level)).set({
    ...tier,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: auth.token.email || auth.uid
  }, { merge: true });
  return { tier };
});

exports.getLoyaltyCampaignSettings = onCall({ maxInstances: 10 }, async (request) => {
  await requireAdmin(request);
  return { campaign: await getCurrentCampaign() };
});

exports.getActiveLoyaltyCampaigns = onCall({ maxInstances: 10 }, async (request) => {
  requireAuth(request);
  const campaign = await getActiveCampaign();
  return { campaigns: campaign ? [campaign] : [] };
});

exports.adminSaveLoyaltyCampaign = onCall({ maxInstances: 10 }, async (request) => {
  const auth = await requireAdmin(request);
  const campaign = normalizeLoyaltyCampaign(request.data || {});
  if (campaign.active && !campaign.name) throw new HttpsError('invalid-argument', 'Nombre de campaña requerido');
  await db.collection('loyaltyCampaigns').doc('current').set({
    ...campaign,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: auth.token.email || auth.uid
  }, { merge: true });
  return { campaign };
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

exports.trackLoyaltyEvent = onCall({ maxInstances: 10 }, async (request) => {
  const auth = requireAuth(request);
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
  return { ok: true, eventId: eventRef.id };
});

exports.expireLoyaltyPoints = onSchedule('every day 04:00', async () => {
  const now = Timestamp.now();
  const due = await db.collection('users').where('pointsExpiresAt', '<=', now).limit(500).get();
  const batch = db.batch();
  let expired = 0;
  due.forEach((doc) => {
    const user = doc.data();
    const points = user.points || 0;
    if (points <= 0) return;
    expired += 1;
    batch.set(doc.ref, {
      points: 0,
      isVip: false,
      pointsExpiredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(doc.ref.collection('transactions').doc(`points_expired_${Date.now()}`), {
      type: 'points_expired',
      amount: -points,
      pointsDelta: -points,
      currency: 'PADRE',
      reason: 'Expiración por inactividad',
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
  });
  await batch.commit();
  logLoyalty('points_expired_batch', { expired });
});
