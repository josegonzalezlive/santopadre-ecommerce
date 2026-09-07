const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

exports.redeemReward = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const { rewardId, amount, currency } = request.data;
  const uid = request.auth.uid;
  const db = getFirestore();

  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const userDoc = await tx.get(userRef);

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    // Debe coincidir con js/modules/wallet.js: PADRE se guarda en el campo 'points',
    // cualquier otra moneda en '<moneda>Balance'.
    const field = currency.toUpperCase() === 'PADRE' ? 'points' : `${currency.toLowerCase()}Balance`;

    const balance = userDoc.data()[field] || 0;

    if (balance < amount) {
      throw new HttpsError('failed-precondition', 'Saldo insuficiente');
    }

    tx.update(userRef, { [field]: balance - amount });
    
    tx.set(db.collection(`users/${uid}/transactions`).doc(), {
      type: 'canje',
      rewardId,
      amount: -amount, // Negative amount for redemption
      currency,
      timestamp: new Date(),
      status: 'completed'
    });
  });

  return { success: true };
});
