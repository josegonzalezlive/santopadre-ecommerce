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
});
