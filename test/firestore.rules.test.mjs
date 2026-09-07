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

function authedDb(uid, email = `${uid}@example.com`) {
  return testEnv.authenticatedContext(uid, { email }).firestore();
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
  });

  test('allows admins to read global ledger and reconciliation records', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'loyaltyLedger', 'entry1'), { userId: 'alice', pointsDelta: 100 });
      await setDoc(doc(context.firestore(), 'loyaltyReconciliations', 'entry1'), { userId: 'alice', delta: 0 });
    });
    const adminDb = authedDb('admin', 'josegonzalez.private@gmail.com');
    const userDb = authedDb('alice');

    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyLedger', 'entry1')));
    await assertSucceeds(getDoc(doc(adminDb, 'loyaltyReconciliations', 'entry1')));
    await assertFails(getDoc(doc(userDb, 'loyaltyLedger', 'entry1')));
    await assertFails(getDoc(doc(userDb, 'loyaltyReconciliations', 'entry1')));
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
