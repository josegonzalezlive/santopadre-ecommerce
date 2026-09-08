import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-santopadre-rules',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

// RulesTestContext.firestore() no es idempotente: la segunda vez que se llama para el
// mismo contexto autenticado, el SDK lanza "Firestore has already been started and its
// settings can no longer be changed" (visto al reutilizar el mismo uid/email en mas de
// un test, ej. el admin 'josegonzalez.private@gmail.com'). Se cachea por uid+email para
// llamar .firestore() una sola vez por contexto y reutilizar la instancia despues.
const dbCache = new Map();
function authedDb(uid, email = `${uid}@example.com`) {
  const key = `${uid}::${email}`;
  if (!dbCache.has(key)) {
    dbCache.set(key, testEnv.authenticatedContext(uid, { email }).firestore());
  }
  return dbCache.get(key);
}

async function seedUser(uid, data = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), {
      uid,
      email: `${uid}@example.com`,
      name: 'Cliente',
      points: 10,
      stamps: 0,
      isVip: false,
      ...data
    });
  });
}

describe('users/{uid}', () => {
  test('allows a user to create only non-monetary profile fields', async () => {
    const db = authedDb('alice');
    await assertSucceeds(setDoc(doc(db, 'users', 'alice'), {
      uid: 'alice',
      name: 'Alice',
      email: 'alice@example.com'
    }));
  });

  test('blocks client profile creation with points', async () => {
    const db = authedDb('alice');
    await assertFails(setDoc(doc(db, 'users', 'alice'), {
      uid: 'alice',
      name: 'Alice',
      points: 500
    }));
  });

  test('allows safe profile edits but blocks balance edits', async () => {
    await seedUser('alice');
    const db = authedDb('alice');
    await assertSucceeds(updateDoc(doc(db, 'users', 'alice'), { phone: '+584120000000' }));
    await assertFails(updateDoc(doc(db, 'users', 'alice'), { points: 9999 }));
  });

  test('blocks self-service referral mutation', async () => {
    await seedUser('alice');
    const db = authedDb('alice');
    await assertFails(updateDoc(doc(db, 'users', 'alice'), {
      referredBy: 'alice',
      referralStatus: 'completed'
    }));
  });
});

describe('orders', () => {
  test('allows user-created pending orders without awarded points', async () => {
    const db = authedDb('alice');
    await assertSucceeds(addDoc(collection(db, 'orders'), {
      userId: 'alice',
      total: 18.5,
      pointsEarned: 0,
      status: 'pending_confirmation',
      items: []
    }));
  });

  test('blocks user-created completed orders with awarded points', async () => {
    const db = authedDb('alice');
    await assertFails(addDoc(collection(db, 'orders'), {
      userId: 'alice',
      total: 18.5,
      pointsEarned: 18,
      status: 'Completado',
      items: []
    }));
  });
});

describe('internal loyalty collections', () => {
  test('blocks client writes to the transaction ledger', async () => {
    await seedUser('alice');
    const db = authedDb('alice');
    await assertFails(setDoc(doc(db, 'users', 'alice', 'transactions', 'manual'), {
      type: 'manual',
      pointsDelta: 9999
    }));
  });

  test('allows admins to read audit logs but blocks web writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs', 'log1'), { reason: 'seed' });
    });
    const adminDb = authedDb('admin', 'josegonzalez.private@gmail.com');
    await assertSucceeds(getDoc(doc(adminDb, 'audit_logs', 'log1')));
    await assertFails(setDoc(doc(adminDb, 'audit_logs', 'log2'), { reason: 'forged' }));
  });

  test('blocks web writes to referral claims, rate limits and analytics', async () => {
    const adminDb = authedDb('admin', 'josegonzalez.private@gmail.com');
    await assertFails(setDoc(doc(adminDb, 'referralClaims', 'alice'), { referrerId: 'admin' }));
    await assertFails(setDoc(doc(adminDb, 'rateLimits', 'alice_redeemReward'), { lastAt: Date.now() }));
    await assertFails(addDoc(collection(adminDb, 'loyalty_events'), { event: 'redeem_success' }));
    await assertFails(setDoc(doc(adminDb, 'loyaltyLedger', 'entry1'), { userId: 'alice', pointsDelta: 100 }));
    await assertFails(setDoc(doc(adminDb, 'loyaltyReconciliations', 'entry1'), { userId: 'alice', delta: 100 }));
    await assertFails(setDoc(doc(adminDb, 'loyaltyJobState', 'backfillLoyaltyLedger'), { lastUserId: 'alice' }));
    await assertFails(setDoc(doc(adminDb, 'loyaltyDailyLimits', 'alice_bonus_2026-09-07'), { count: 99 }));
    await assertFails(setDoc(doc(adminDb, 'notificationFailures', 'failure1'), { status: 'sent' }));
  });

  test('allows admins to read internal backend records', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // OJO: context.firestore() tampoco es idempotente - llamarlo dos veces en el mismo
      // callback lanza "Firestore has already been started...". Se llama una sola vez.
      const seedDb = context.firestore();
      await setDoc(doc(seedDb, 'loyaltyLedger', 'entry1'), { userId: 'alice', pointsDelta: 100 });
      await setDoc(doc(seedDb, 'loyaltyReconciliations', 'entry1'), { userId: 'alice', delta: 0 });
      await setDoc(doc(seedDb, 'loyaltyJobState', 'backfillLoyaltyLedger'), { lastUserId: 'alice' });
      await setDoc(doc(seedDb, 'loyaltyDailyLimits', 'alice_bonus_2026-09-07'), { count: 1 });
      await setDoc(doc(seedDb, 'notificationFailures', 'failure1'), { status: 'pending_retry' });
    });
    const adminDb = authedDb('admin', 'josegonzalez.private@gmail.com');
    const userDb = authedDb('alice');

    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyLedger', 'entry1')));
    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyReconciliations', 'entry1')));
    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyJobState', 'backfillLoyaltyLedger')));
    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyDailyLimits', 'alice_bonus_2026-09-07')));
    await assertSucceeds(getDoc(doc(adminDb, 'notificationFailures', 'failure1')));
    await assertFails(getDoc(doc(userDb, 'loyaltyLedger', 'entry1')));
    await assertFails(getDoc(doc(userDb, 'loyaltyReconciliations', 'entry1')));
    await assertFails(getDoc(doc(userDb, 'loyaltyJobState', 'backfillLoyaltyLedger')));
    await assertFails(getDoc(doc(userDb, 'loyaltyDailyLimits', 'alice_bonus_2026-09-07')));
    await assertFails(getDoc(doc(userDb, 'notificationFailures', 'failure1')));
  });

  test('allows anyone (even without login) to read product wishlist stats but never write', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'productStats', 'agua'), { wishlistCount: 12 });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const userDb = authedDb('alice');

    await assertSucceeds(getDoc(doc(anonDb, 'productStats', 'agua')));
    await assertSucceeds(getDoc(doc(userDb, 'productStats', 'agua')));
    await assertFails(setDoc(doc(anonDb, 'productStats', 'agua'), { wishlistCount: 9999 }));
    await assertFails(setDoc(doc(userDb, 'productStats', 'agua'), { wishlistCount: 9999 }));
  });

  test('allows tier reads but blocks direct writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tierRewards', '1'), { level: 1, reward: 'Bebida' });
    });
    const db = authedDb('alice');
    await assertSucceeds(getDoc(doc(db, 'tierRewards', '1')));
    await assertFails(setDoc(doc(db, 'tierRewards', '1'), { level: 1, reward: 'Forjado' }));
  });
});

test('sanity', () => {
  assert.ok(testEnv);
});
