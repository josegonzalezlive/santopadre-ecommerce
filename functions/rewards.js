const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

// Catálogo de recompensas canjeables por puntos ($PADRE). Fuente de verdad del precio:
// el cliente NUNCA decide el costo (antes se aceptaba `amount` desde request.data, lo
// que permitía canjear cualquier premio por cualquier costo inventado en el cliente).
// Debe mantenerse en sync con los botones de cuenta.html/signup.html (js/wallet-bindings.js).
const REWARD_CATALOG = {
  'bebida': { name: 'Bebida Refrescante Gratis', cost: 1000 },
  'tacos-pastor': { name: 'Tacos al Pastor Gratis', cost: 2800 },
  'nachos': { name: 'Nachos Clásicos Gratis', cost: 3500 },
  'birria-ramen': { name: 'Birria Ramen Gratis', cost: 6500 },
  'tacos-birria': { name: 'Tacos de Birria Gratis', cost: 6500 },
  'burritos': { name: 'Burrito El Santo Gratis', cost: 7200 },
  'flautas-pollo': { name: 'Flautas de Pollo Gratis', cost: 7500 },
  'tacos-carne': { name: 'Tacos de Asada Gratis', cost: 8500 },
  'cap-trucker': { name: 'Gorra Trucker La Parroquia', cost: 9000 },
  'tshirt-logo': { name: 'Camiseta Classic SantoPadre', cost: 12500 },
  'gift-card-25': { name: 'Gift Card SantoPadre $25', cost: 12500 },
  'gift-card-50': { name: 'Gift Card SantoPadre $50', cost: 25000 }
};

exports.redeemReward = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const { rewardId } = request.data;
  const catalogEntry = REWARD_CATALOG[rewardId];
  if (!catalogEntry) {
    throw new HttpsError('invalid-argument', 'Recompensa inválida');
  }

  const cost = catalogEntry.cost;
  const uid = request.auth.uid;
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const couponCode = 'SP-PT-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    const balance = userDoc.data().points || 0;
    if (balance < cost) {
      throw new HttpsError('failed-precondition', 'Saldo insuficiente');
    }

    const newPoints = balance - cost;
    const isVip = newPoints >= 100;
    const activeRewards = [...(userDoc.data().activeRewards || []), {
      id: Date.now().toString(),
      name: catalogEntry.name,
      code: couponCode,
      date: new Date().toISOString()
    }];

    tx.update(userRef, { points: newPoints, isVip, activeRewards });

    tx.set(db.collection(`users/${uid}/transactions`).doc(), {
      type: 'canje',
      rewardId,
      amount: -cost,
      currency: 'PADRE',
      timestamp: new Date(),
      status: 'completed'
    });

    tx.set(db.collection('orders').doc(), {
      userId: uid,
      items: [{ name: `Canje: ${catalogEntry.name} (Código: ${couponCode})`, quantity: 1, price: 0 }],
      total: 0,
      pointsEarned: -cost,
      createdAt: new Date().toISOString(),
      status: 'canjeado'
    });
  });

  return { success: true, rewardName: catalogEntry.name, couponCode, cost };
});

// Premios de ascenso de nivel (tarjeta de sellos). 'stamps' solo lo puede escribir un
// administrador (firestore.rules) tras una compra real verificada; esta función valida
// que exista un nivel realmente completado y no reclamado antes de entregar el premio.
const TIER_REWARDS = [
  { level: 1, name: 'El Iniciado', reward: 'Bebida Premium Gratis' },
  { level: 2, name: 'El Fiel', reward: 'Postre Sorpresa del Chef' },
  { level: 3, name: 'El Discípulo', reward: 'Nachos PEQ + Bebida Gratis' },
  { level: 4, name: 'El Profeta', reward: 'Tacos (3U) + Bebida Gratis' },
  { level: 5, name: 'El Santo', reward: 'Cena Secreta para 2 + 2 Bebidas' }
];

exports.claimTierReward = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  let response;

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    const data = userDoc.data();
    const totalStamps = data.stamps || 0;
    const claimedRewards = data.claimedRewards || [];
    const completedTiers = Math.floor(totalStamps / 5);

    if (claimedRewards.length >= completedTiers) {
      throw new HttpsError('failed-precondition', 'No tienes premios de ascenso pendientes');
    }

    const tierIndex = Math.min(claimedRewards.length, TIER_REWARDS.length - 1);
    const tier = TIER_REWARDS[tierIndex];
    const level = tierIndex + 1;
    const couponCode = 'SP-ASCENSO-' + level + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    const newClaimed = [...claimedRewards, level];
    const newActive = [...(data.activeRewards || []), {
      id: Date.now().toString(),
      name: tier.reward,
      code: couponCode,
      date: new Date().toISOString()
    }];

    tx.update(userRef, { claimedRewards: newClaimed, activeRewards: newActive });

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
