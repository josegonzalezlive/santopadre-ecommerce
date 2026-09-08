const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { requireRole } = require('./authz');

if (!getApps().length) initializeApp();

const db = getFirestore();
const CALLABLE_OPTIONS = { maxInstances: 10, ...(process.env.ENFORCE_APP_CHECK === 'true' ? { enforceAppCheck: true } : {}) };
const PRODUCT_STATS_COLLECTION = 'productStats';

// Compara el array wishlist de un usuario antes/despues de un write y devuelve
// que productIds se agregaron y cuales se quitaron. Pura, sin I/O - testeable
// sin emulador.
function diffWishlistArrays(before = [], after = []) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((id) => !beforeSet.has(id));
  const removed = before.filter((id) => !afterSet.has(id));
  return { added, removed };
}

// Trigger de Firestore: se dispara en CADA write a users/{userId} (puntos,
// perfil, sellos, etc. - no solo wishlist), asi que lo primero es diffear el
// array wishlist y salir de inmediato si no cambio, para no gastar escrituras
// de mas en productStats por cambios que no le competen.
exports.onUserWishlistChanged = onDocumentWritten(
  { document: 'users/{userId}', maxInstances: 10 },
  async (event) => {
    const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
    const afterData = event.data?.after?.exists ? event.data.after.data() : null;
    const before = beforeData?.wishlist || [];
    const after = afterData?.wishlist || [];

    const { added, removed } = diffWishlistArrays(before, after);
    if (!added.length && !removed.length) return;

    const batch = db.batch();
    added.forEach((productId) => {
      batch.set(
        db.collection(PRODUCT_STATS_COLLECTION).doc(productId),
        { wishlistCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    removed.forEach((productId) => {
      batch.set(
        db.collection(PRODUCT_STATS_COLLECTION).doc(productId),
        { wishlistCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    await batch.commit();
  }
);

// Recalcula productStats desde cero escaneando users/*.wishlist - corrige
// cualquier drift acumulado (ej. de datos previos a que este trigger
// existiera) y sirve como reconciliacion manual si algo se desincroniza.
// Escala unica (no paginada): a la escala actual del negocio (decenas de
// usuarios) una sola pasada entra sobrado en el timeout de 60s de la funcion;
// si el catalogo de usuarios crece mucho, paginar como adminBackfillLoyaltyLedger.
exports.adminBackfillProductStats = onCall(CALLABLE_OPTIONS, async (request) => {
  await requireRole(request, ['superadmin', 'admin']);

  const usersSnap = await db.collection('users').select('wishlist').limit(5000).get();
  const counts = new Map();
  usersSnap.forEach((doc) => {
    const wishlist = doc.data().wishlist || [];
    wishlist.forEach((productId) => {
      counts.set(productId, (counts.get(productId) || 0) + 1);
    });
  });

  const statsSnap = await db.collection(PRODUCT_STATS_COLLECTION).select().get();
  statsSnap.forEach((doc) => {
    if (!counts.has(doc.id)) counts.set(doc.id, 0);
  });

  const entries = Array.from(counts.entries());
  const BATCH_LIMIT = 400;
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    entries.slice(i, i + BATCH_LIMIT).forEach(([productId, count]) => {
      batch.set(
        db.collection(PRODUCT_STATS_COLLECTION).doc(productId),
        { wishlistCount: count, updatedAt: FieldValue.serverTimestamp(), lastBackfillAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    await batch.commit();
  }

  return { usersScanned: usersSnap.size, productsUpdated: entries.length };
});

module.exports.PRODUCT_STATS_COLLECTION = PRODUCT_STATS_COLLECTION;
module.exports.diffWishlistArrays = diffWishlistArrays;
