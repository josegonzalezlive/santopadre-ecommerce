const { FieldValue } = require('firebase-admin/firestore');
const { transactionDocId } = require('./loyalty');

const LEDGER_COLLECTION = 'loyaltyLedger';
const RECONCILIATION_COLLECTION = 'loyaltyReconciliations';

function compactLedgerMetadata(value, depth = 0) {
  if (depth > 2 || value === undefined) return null;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 240);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactLedgerMetadata(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 20).reduce((acc, [key, item]) => {
      const safeKey = String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
      if (safeKey) acc[safeKey] = compactLedgerMetadata(item, depth + 1);
      return acc;
    }, {});
  }
  return null;
}

function assertLedgerPointsDelta(value) {
  const pointsDelta = Number(value);
  if (!Number.isInteger(pointsDelta) || Math.abs(pointsDelta) > 1000000) {
    throw new Error('Invalid ledger points delta');
  }
  return pointsDelta;
}

function ledgerDocId(userId, type, sourceId) {
  const safeUserId = String(userId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return transactionDocId(safeUserId, `${type}_${sourceId}`);
}

function buildPointLedgerEntry({
  userId,
  type,
  sourceId,
  pointsDelta,
  reason,
  orderId = null,
  balanceBefore = null,
  balanceAfter = null,
  actor = {},
  metadata = {},
  attributes = {}
}) {
  const safeDelta = assertLedgerPointsDelta(pointsDelta);
  const safeType = String(type || '').trim().slice(0, 80);
  const safeSourceId = String(sourceId || '').trim().slice(0, 160);
  if (!userId || !safeType || !safeSourceId) throw new Error('Invalid ledger identity');

  return {
    ...(compactLedgerMetadata(attributes || {}) || {}),
    ledgerVersion: 1,
    userId: String(userId),
    type: safeType,
    sourceId: safeSourceId,
    orderId: orderId || null,
    amount: safeDelta,
    pointsDelta: safeDelta,
    currency: 'PADRE',
    reason: String(reason || safeType).trim().slice(0, 240),
    balanceBefore,
    balanceAfter,
    actorUid: actor.uid || null,
    actorEmail: actor.email || null,
    actorRole: actor.role || null,
    metadata: compactLedgerMetadata(metadata || {}),
    status: 'completed',
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  };
}

function writePointLedger(tx, db, userRef, txRef, entry) {
  const ledgerId = ledgerDocId(entry.userId, entry.type, entry.sourceId);
  tx.set(txRef, entry);
  tx.set(db.collection(LEDGER_COLLECTION).doc(ledgerId), {
    ...entry,
    transactionPath: txRef.path,
    userPath: userRef.path
  });
  return ledgerId;
}

async function calculateLedgerBalance(db, userId) {
  const snap = await db.collection(LEDGER_COLLECTION).where('userId', '==', userId).get();
  let balance = 0;
  snap.forEach((doc) => {
    balance += Number(doc.data().pointsDelta || 0);
  });
  return { balance, entries: snap.size };
}

module.exports = {
  LEDGER_COLLECTION,
  RECONCILIATION_COLLECTION,
  compactLedgerMetadata,
  assertLedgerPointsDelta,
  ledgerDocId,
  buildPointLedgerEntry,
  writePointLedger,
  calculateLedgerBalance
};
