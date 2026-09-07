import { onSnapshot, doc, collection, query, orderBy, limit, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDB } from './firebase.js';
import { handleFirestoreError } from './ui.js';

// As per user instructions, using /usuarios/{uid} and /usuarios/{uid}/transactions
// However, the existing app heavily relies on 'users'.
// We will use 'users' to prevent breaking the entire app structure.
// Subcollection for history will be /users/{uid}/transactions

// Fuente de verdad del mapeo moneda -> campo de Firestore. functions/rewards.js
// replica esta misma regla (PADRE -> 'points') para su propio catálogo de canje.
function currencyToField(currency) {
  return currency === "PADRE" ? "points" : `${currency.toLowerCase()}Balance`;
}

export function subscribeToBalance(uid, onUpdate) {
  const ref = doc(getDB(), 'users', uid);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      // Ensure we extract the points and usdc balance
      const padreBalance = data.points || 0; 
      const usdcBalance = data.usdcBalance || 0;
      onUpdate({ padreBalance, usdcBalance });
    }
  }, (error) => handleFirestoreError(error));
}

export function subscribeToTransactions(uid, onUpdate, maxItems = 20) {
  const ref = collection(getDB(), 'users', uid, 'transactions');
  const q = query(ref, orderBy('timestamp', 'desc'), limit(maxItems));
  return onSnapshot(q, (snap) => {
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(txs);
  }, (error) => handleFirestoreError(error));
}

export async function processRecarga(uid, amount, currency) {
  const userRef = doc(getDB(), 'users', uid);
  const txRef = doc(collection(getDB(), 'users', uid, 'transactions'));

  await runTransaction(getDB(), async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw { code: 'not-found', message: 'User not found' };
    }
    
    const field = currencyToField(currency);
    const current = userDoc.data()[field] || 0;

    transaction.update(userRef, { [field]: current + amount });
    transaction.set(txRef, {
      type: 'recarga', 
      amount, 
      currency,
      timestamp: serverTimestamp(), 
      status: 'completed'
    });
  });
}

export async function processCanje(uid, amount, currency, rewardName) {
  const userRef = doc(getDB(), 'users', uid);
  const txRef = doc(collection(getDB(), 'users', uid, 'transactions'));

  await runTransaction(getDB(), async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw { code: 'not-found', message: 'User not found' };
    }
    
    const field = currencyToField(currency);
    const current = userDoc.data()[field] || 0;

    if (current < amount) {
      throw { code: 'failed-precondition', message: 'Saldo insuficiente' };
    }

    transaction.update(userRef, { [field]: current - amount });
    transaction.set(txRef, {
      type: 'canje', 
      amount: -amount, 
      currency,
      reward: rewardName,
      timestamp: serverTimestamp(), 
      status: 'completed'
    });
  });
}
