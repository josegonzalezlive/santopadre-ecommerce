const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  WELCOME_POINTS,
  REWARD_CATALOG,
  DEFAULT_TIER_REWARDS,
  transactionDocId,
  pointsForPurchase,
  pointsForDeposit,
  requiredLamportsForUsd,
  normalizeSolanaCluster,
  mergeTierRewards,
  normalizeTierReward,
  normalizeLoyaltyCampaign
} = require('../functions/loyalty');
const {
  assertLedgerPointsDelta,
  ledgerDocId,
  compactLedgerMetadata,
  buildPointLedgerEntry,
  buildLedgerEntryFromUserTransaction
} = require('../functions/ledger');
const {
  _getAdminRole,
  _hasAdminRole
} = require('../functions/referrals');
const { assertKnownKeys } = require('../functions/validation');

describe('loyalty config', () => {
  test('uses the server-side welcome bonus required by the program', () => {
    assert.equal(WELCOME_POINTS, 10);
  });

  test('keeps reward ids mapped to positive costs', () => {
    for (const [id, reward] of Object.entries(REWARD_CATALOG)) {
      assert.match(id, /^[a-z0-9-]+$/);
      assert.equal(typeof reward.name, 'string');
      assert.ok(Number.isInteger(reward.cost));
      assert.ok(reward.cost > 0);
    }
  });

  test('keeps five configurable tier rewards with bounded COGS', () => {
    assert.equal(DEFAULT_TIER_REWARDS.length, 5);
    for (const tier of DEFAULT_TIER_REWARDS) {
      assert.ok(tier.level >= 1 && tier.level <= 5);
      assert.ok(tier.name);
      assert.ok(tier.reward);
      assert.ok(tier.cogs >= 0 && tier.cogs <= 100);
    }
  });

  test('merges tier reward overrides by level', () => {
    const merged = mergeTierRewards([{ level: 2, reward: 'Promo Admin', cogs: 99.999 }]);
    assert.equal(merged[1].reward, 'Promo Admin');
    assert.equal(merged[1].cogs, 100);
    assert.equal(merged[0].reward, DEFAULT_TIER_REWARDS[0].reward);
  });

  test('normalizes invalid numeric tier fields to defaults', () => {
    const normalized = normalizeTierReward({ level: 1, cogs: 'abc' });
    assert.equal(normalized.cogs, DEFAULT_TIER_REWARDS[0].cogs);
  });

  test('normalizes loyalty campaign settings', () => {
    const campaign = normalizeLoyaltyCampaign({ active: true, name: 'Doble PADRE', pointsMultiplier: 9 });
    assert.equal(campaign.active, true);
    assert.equal(campaign.name, 'Doble PADRE');
    assert.equal(campaign.pointsMultiplier, 5);
  });
});

describe('admin role helpers', () => {
  test('recognizes hardcoded superadmin emails', async () => {
    const role = await _getAdminRole({ auth: { token: { email: 'santopadrevzla@gmail.com' } } });
    assert.equal(role, 'superadmin');
  });

  test('recognizes role and roles custom claims before reading Firestore', async () => {
    assert.equal(await _getAdminRole({ auth: { token: { role: 'cashier' } } }), 'cashier');
    assert.equal(await _getAdminRole({ auth: { token: { roles: ['marketing'] } } }), 'marketing');
  });

  test('checks allowed roles', async () => {
    const request = { auth: { token: { role: 'cashier' } } };
    assert.equal(await _hasAdminRole(request, ['cashier', 'admin']), true);
    assert.equal(await _hasAdminRole(request, ['marketing']), false);
  });
});

describe('payload validation helpers', () => {
  test('allows only known payload keys', () => {
    const payload = { rewardId: 'bebida' };
    assert.equal(assertKnownKeys(payload, ['rewardId'], 'redeemReward'), payload);
  });

  test('rejects unknown payload keys with an invalid-argument error', () => {
    assert.throws(() => assertKnownKeys({ rewardId: 'bebida', cost: 1 }, ['rewardId'], 'redeemReward'), (err) => {
      assert.equal(err.code, 'invalid-argument');
      assert.match(err.message, /cost/);
      return true;
    });
  });
});

describe('points calculations', () => {
  test('awards purchase points by whole USD with a minimum of one', () => {
    assert.equal(pointsForPurchase(0.25), 1);
    assert.equal(pointsForPurchase(19.99), 19);
    assert.equal(pointsForPurchase(20), 20);
  });

  test('awards deposit points at 100 PADRE per USD', () => {
    assert.equal(pointsForDeposit(1), 100);
    assert.equal(pointsForDeposit(12.34), 1234);
  });
});

describe('solana helpers', () => {
  test('normalizes unsupported clusters to mainnet-beta', () => {
    assert.equal(normalizeSolanaCluster('devnet'), 'devnet');
    assert.equal(normalizeSolanaCluster('testnet'), 'mainnet-beta');
    assert.equal(normalizeSolanaCluster(undefined), 'mainnet-beta');
  });

  test('calculates required lamports from configured USD rate', () => {
    assert.equal(requiredLamportsForUsd(150), 1000000000);
    assert.equal(requiredLamportsForUsd(75), 500000000);
  });
});

describe('ledger helpers', () => {
  test('sanitizes source ids for transaction document ids', () => {
    assert.equal(transactionDocId('purchase', 'order/123 abc'), 'purchase_order_123_abc');
  });

  test('caps generated transaction ids to firestore-friendly length', () => {
    const id = transactionDocId('deposit', 'x'.repeat(300));
    assert.ok(id.length <= 'deposit_'.length + 120);
  });

  test('creates stable ledger ids per user, type and source', () => {
    assert.equal(ledgerDocId('user/1', 'purchase', 'order/123'), 'user_1_purchase_order_123');
  });

  test('rejects non-integer or oversized point deltas', () => {
    assert.equal(assertLedgerPointsDelta(100), 100);
    assert.throws(() => assertLedgerPointsDelta(1.5), /Invalid ledger points delta/);
    assert.throws(() => assertLedgerPointsDelta(1000001), /Invalid ledger points delta/);
  });

  test('compacts ledger metadata without preserving unsafe keys', () => {
    const metadata = compactLedgerMetadata({ 'bad.key': 'x'.repeat(300), nested: { ok: true } });
    assert.equal(metadata.bad_key.length, 240);
    assert.deepEqual(metadata.nested, { ok: true });
  });

  test('builds point ledger entries with immutable accounting fields', () => {
    const entry = buildPointLedgerEntry({
      userId: 'alice',
      type: 'purchase',
      sourceId: 'order-1',
      pointsDelta: 25,
      reason: 'Compra verificada',
      balanceBefore: 10,
      balanceAfter: 35,
      actor: { uid: 'admin-1', email: 'admin@example.com', role: 'admin' },
      attributes: { couponCode: 'SP-PT-ABC123' }
    });

    assert.equal(entry.userId, 'alice');
    assert.equal(entry.pointsDelta, 25);
    assert.equal(entry.amount, 25);
    assert.equal(entry.currency, 'PADRE');
    assert.equal(entry.balanceBefore, 10);
    assert.equal(entry.balanceAfter, 35);
    assert.equal(entry.actorRole, 'admin');
    assert.equal(entry.couponCode, 'SP-PT-ABC123');
  });

  test('builds backfill entries from legacy user transactions', () => {
    const entry = buildLedgerEntryFromUserTransaction('alice', 'redeem_1', {
      type: 'canje',
      pointsDelta: -1000,
      rewardId: 'bebida',
      reward: 'Bebida gratis',
      couponCode: 'SP-PT-123',
      reason: 'Canje legacy'
    }, { backfillRunId: 'run-1' });

    assert.equal(entry.userId, 'alice');
    assert.equal(entry.type, 'canje');
    assert.equal(entry.sourceId, 'redeem_1');
    assert.equal(entry.pointsDelta, -1000);
    assert.equal(entry.rewardId, 'bebida');
    assert.equal(entry.couponCode, 'SP-PT-123');
    assert.equal(entry.actorRole, 'legacy_backfill');
    assert.equal(entry.metadata.backfillRunId, 'run-1');
  });

  test('rejects backfill entries without a valid points delta', () => {
    assert.throws(() => buildLedgerEntryFromUserTransaction('alice', 'bad_tx', {
      type: 'manual',
      pointsDelta: 'abc'
    }), /Invalid ledger points delta/);
  });
});
