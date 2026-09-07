const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { nanoid } = require('nanoid');

const REFERRAL_BONUS_POINTS = 200;
const REFERRAL_DOMAIN = 'https://www.santopadre.store';

async function _isAdmin(request) {
  const email = request.auth?.token?.email;
  if (!email) return false;
  if (email === 'josegonzalez.private@gmail.com' || email === 'santopadrevzla@gmail.com') return true;
  const db = getFirestore();
  const snap = await db.doc(`admins/${email}`).get();
  return snap.exists;
}

async function _claimReferralForUser(referredUid, codeOrUid) {
  if (!referredUid || !codeOrUid) return null;
  const db = getFirestore();
  const referredRef = db.doc(`users/${referredUid}`);
  const claimRef = db.doc(`referralClaims/${referredUid}`);

  return db.runTransaction(async (tx) => {
    const [referredSnap, claimSnap] = await Promise.all([
      tx.get(referredRef),
      tx.get(claimRef)
    ]);
    if (!referredSnap.exists) throw new HttpsError('not-found', 'Usuario referido no encontrado');
    if (claimSnap.exists) throw new HttpsError('already-exists', 'Este usuario ya uso un referido');

    const code = String(codeOrUid).trim();
    const codeQuery = db.collection('users').where('referralCode', '==', code).limit(1);
    const codeSnap = await tx.get(codeQuery);
    const referrerDoc = codeSnap.empty ? await tx.get(db.doc(`users/${code}`)) : codeSnap.docs[0];
    if (!referrerDoc.exists) throw new HttpsError('not-found', 'Codigo de referido invalido');

    const referrerId = referrerDoc.id;
    if (referrerId === referredUid) {
      throw new HttpsError('failed-precondition', 'No puedes usar tu propio codigo de referido');
    }

    tx.set(claimRef, {
      referredUid,
      referrerId,
      code,
      status: 'pending_purchase',
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(referredRef, {
      referredBy: referrerId,
      referralStatus: 'pending_purchase',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { referredUid, referrerId, status: 'pending_purchase' };
  });
}

async function _completeReferralForPurchase(referredUid, orderId) {
  const db = getFirestore();
  const claimRef = db.doc(`referralClaims/${referredUid}`);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists || claimSnap.data().status === 'completed') return null;

  const claim = claimSnap.data();
  const referrerRef = db.doc(`users/${claim.referrerId}`);
  const referredRef = db.doc(`users/${referredUid}`);
  const txRef = referrerRef.collection('transactions').doc(`referral_${referredUid}`);

  await db.runTransaction(async (tx) => {
    const [referrerSnap, txSnap] = await Promise.all([
      tx.get(referrerRef),
      tx.get(txRef)
    ]);
    if (!referrerSnap.exists || txSnap.exists) return;

    const nextPoints = (referrerSnap.data().points || 0) + REFERRAL_BONUS_POINTS;
    tx.set(referrerRef, {
      points: nextPoints,
      isVip: nextPoints >= 100,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(txRef, {
      type: 'referral_bonus',
      sourceId: referredUid,
      orderId,
      amount: REFERRAL_BONUS_POINTS,
      pointsDelta: REFERRAL_BONUS_POINTS,
      currency: 'PADRE',
      timestamp: FieldValue.serverTimestamp(),
      status: 'completed'
    });
    tx.set(claimRef, {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      completedOrderId: orderId
    }, { merge: true });
    tx.set(referredRef, {
      referralStatus: 'completed',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  console.info('referral_completed', {
    component: 'loyalty_referrals',
    referrerId: claim.referrerId,
    referredUid,
    orderId
  });

  return { completed: true, referrerId: claim.referrerId, pointsAwarded: REFERRAL_BONUS_POINTS };
}

exports.generateReferralLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const uid = request.auth.uid;
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();

  if (snap.data()?.referralCode) {
    const code = snap.data().referralCode;
    return { code, url: `${REFERRAL_DOMAIN}/ref?id=${code}` };
  }

  const code = nanoid(8);
  await userRef.set({ referralCode: code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { code, url: `${REFERRAL_DOMAIN}/ref?id=${code}` };
});

exports.claimReferral = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return _claimReferralForUser(request.auth.uid, request.data?.code || request.data?.referrerId);
});

exports._claimReferralForUser = _claimReferralForUser;
exports._completeReferralForPurchase = _completeReferralForPurchase;
exports._isAdmin = _isAdmin;
