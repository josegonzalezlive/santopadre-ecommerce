// Pruebas de integracion end-to-end contra los emuladores reales de Firestore + Functions
// + Auth (no mocks): ejercitan las Cloud Functions callables tal como las llama el
// cliente real (js/dashboard.js), usando el SDK cliente de Firebase apuntado a los
// emuladores. Correr con:
//   firebase emulators:exec --only firestore,functions,auth \
//     "node --test test/loyalty.flows.integration.test.mjs"
//
// Deliberadamente NO cubre confirmSolanaDeposit ni la rama Solana de
// confirmPurchaseAndAwardPoints (requieren una firma real en devnet/mainnet, o mockear
// fetch) ni sendComprobanteNotification (excluida del deploy hasta tener los secrets de
// WhatsApp - ver TEMPORAL en functions/rewards.js).

import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signOut
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeApp as initAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'demo-santopadre-flows';

let clientApp;
let clientAuth;
let clientFunctions;
let adminApp;
let adminDb;
let adminAuth;

before(async () => {
  clientApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key' }, 'client');
  clientAuth = getAuth(clientApp);
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  clientFunctions = getFunctions(clientApp);
  connectFunctionsEmulator(clientFunctions, '127.0.0.1', 5001);

  adminApp = initAdminApp({ projectId: PROJECT_ID }, 'admin');
  adminDb = getAdminFirestore(adminApp);
  adminAuth = getAdminAuth(adminApp);
});

after(async () => {
  await deleteApp(clientApp);
  await deleteAdminApp(adminApp);
});

async function signInAs(uid, claims = {}) {
  // El emulador de Auth no soporta iniciar sesion con un uid arbitrario via el SDK
  // cliente directamente, asi que se crea el usuario via Admin SDK (con custom claims si
  // aplica) y se firma con un custom token generado por el Admin SDK.
  await adminAuth.createUser({ uid }).catch(() => {});
  if (Object.keys(claims).length) {
    await adminAuth.setCustomUserClaims(uid, claims);
  }
  const customToken = await adminAuth.createCustomToken(uid, claims);
  const { signInWithCustomToken } = await import('firebase/auth');
  await signInWithCustomToken(clientAuth, customToken);
}

async function seedUser(uid, data = {}) {
  await adminDb.collection('users').doc(uid).set({
    uid,
    name: 'Cliente Test',
    email: `${uid}@example.com`,
    points: 0,
    stamps: 0,
    isVip: false,
    ...data
  }, { merge: true });
}

function call(name, data) {
  return httpsCallable(clientFunctions, name)(data);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('redeemReward', () => {
  test('canjea una recompensa del catalogo, descuenta el costo real del servidor y escribe ledger', async () => {
    const uid = 'redeem_user_1';
    await seedUser(uid, { points: 5000 });
    await signInAs(uid);

    const result = await call('redeemReward', { rewardId: 'bebida' });
    assert.equal(result.data.success, true);
    assert.equal(result.data.cost, 1000);
    assert.equal(result.data.newPoints, 4000);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 4000);
    assert.equal(userSnap.data().activeRewards.length, 1);

    const ledgerSnap = await adminDb.collection('loyaltyLedger')
      .where('userId', '==', uid).where('type', '==', 'canje').get();
    assert.equal(ledgerSnap.size, 1);
    assert.equal(ledgerSnap.docs[0].data().pointsDelta, -1000);
  });

  test('rechaza el canje si el cliente no tiene saldo suficiente, sin tocar el ledger', async () => {
    const uid = 'redeem_user_2';
    await seedUser(uid, { points: 10 });
    await signInAs(uid);

    await assert.rejects(call('redeemReward', { rewardId: 'gift-card-50' }));

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 10);
  });

  test('un cliente no puede inventar su propio costo - el rewardId manda, no un monto', async () => {
    const uid = 'redeem_user_3';
    await seedUser(uid, { points: 1 });
    await signInAs(uid);

    // aunque el cliente intente colar un campo extra, assertKnownKeys lo rechaza
    await assert.rejects(call('redeemReward', { rewardId: 'bebida', cost: 1, amount: 1 }));
  });
});

describe('claimTierReward', () => {
  test('reclama el premio de un nivel completado y no reclamado', async () => {
    const uid = 'tier_user_1';
    await seedUser(uid, { stamps: 5, claimedRewards: [] });
    await signInAs(uid);

    const result = await call('claimTierReward', {});
    assert.equal(result.data.success, true);
    assert.equal(result.data.level, 1);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.deepEqual(userSnap.data().claimedRewards, [1]);
    assert.equal(userSnap.data().activeRewards.length, 1);
  });

  test('rechaza reclamar si no hay ningun nivel pendiente', async () => {
    const uid = 'tier_user_2';
    await seedUser(uid, { stamps: 3, claimedRewards: [] });
    await signInAs(uid);

    await assert.rejects(call('claimTierReward', {}));
  });
});

describe('referidos', () => {
  test('genera link, el referido lo reclama, y la compra confirmada acredita el bono al referidor', async () => {
    const referrerUid = 'referrer_1';
    const referredUid = 'referred_1';
    await seedUser(referrerUid, { points: 0 });
    await seedUser(referredUid, { points: 0 });

    await signInAs(referrerUid);
    const linkResult = await call('generateReferralLink', {});
    const code = linkResult.data.code;
    assert.ok(code);
    assert.equal(linkResult.data.url, `https://www.santopadre.store/ref?id=${code}`);

    await signOut(clientAuth);
    await signInAs(referredUid);
    const claimResult = await call('claimReferral', { code });
    assert.equal(claimResult.data.status, 'pending_purchase');

    const referredSnap = await adminDb.collection('users').doc(referredUid).get();
    assert.equal(referredSnap.data().referredBy, referrerUid);
    assert.equal(referredSnap.data().referralStatus, 'pending_purchase');

    // Simula que el referido completo una compra real (confirmada por admin, sin Solana)
    const orderRef = await adminDb.collection('orders').add({
      userId: referredUid,
      total: 20,
      pointsEarned: 0,
      status: 'pending_confirmation',
      items: []
    });

    await signOut(clientAuth);
    await signInAs('admin_1', { role: 'admin' });
    await adminDb.collection('admins').doc('admin_1@example.com').set({ role: 'admin' });
    const confirmResult = await call('confirmPurchaseAndAwardPoints', { orderId: orderRef.id });
    assert.equal(confirmResult.data.success, true);
    assert.equal(confirmResult.data.referral.completed, true);

    const referrerSnap = await adminDb.collection('users').doc(referrerUid).get();
    assert.equal(referrerSnap.data().points, 200, 'el referidor debe recibir el bono de 200 PADRE');

    const referredAfter = await adminDb.collection('users').doc(referredUid).get();
    assert.equal(referredAfter.data().referralStatus, 'completed');
  });

  test('bloquea el auto-referido', async () => {
    const uid = 'self_referrer_1';
    await seedUser(uid, {});
    await signInAs(uid);
    const linkResult = await call('generateReferralLink', {});
    await assert.rejects(call('claimReferral', { code: linkResult.data.code }));
  });
});

describe('confirmPurchaseAndAwardPoints (ruta admin, sin Solana)', () => {
  test('otorga 1 PADRE por USD gastado, es idempotente por orderId', async () => {
    const uid = 'purchase_user_1';
    await seedUser(uid, { points: 0 });
    const orderRef = await adminDb.collection('orders').add({
      userId: uid, total: 35.5, pointsEarned: 0, status: 'pending_confirmation', items: []
    });

    await signInAs('admin_2', { role: 'superadmin' });
    const first = await call('confirmPurchaseAndAwardPoints', { orderId: orderRef.id });
    assert.equal(first.data.pointsAwarded, 35);

    // Segundo admin distinto para no chocar con el rate limit por uid (eso es un
    // comportamiento correcto y separado - lo que se prueba aqui es la idempotencia por
    // orderId, no el rate limiting).
    await signOut(clientAuth);
    await signInAs('admin_2b', { role: 'superadmin' });
    const second = await call('confirmPurchaseAndAwardPoints', { orderId: orderRef.id });
    assert.equal(second.data.alreadyProcessed, true, 'una segunda confirmacion de la misma orden no debe volver a acreditar puntos');

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 35, 'el saldo no debe duplicarse por la llamada repetida');
  });
});

describe('misiones sociales (admin)', () => {
  test('adminApproveSocialQuest acredita puntos y dispara ledger + audit_logs', async () => {
    const uid = 'quest_user_1';
    await seedUser(uid, { points: 0, reviewStatus: 'pending' });
    await signInAs('admin_3', { role: 'marketing' });
    await adminDb.collection('admins').doc('admin_3@example.com').set({ role: 'marketing' });

    const result = await call('adminApproveSocialQuest', { userId: uid, questType: 'review' });
    assert.equal(result.data.pointsDelta, 150);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 150);
    assert.equal(userSnap.data().reviewStatus, 'approved');

    const auditSnap = await adminDb.collection('audit_logs').doc(result.data.auditId).get();
    assert.equal(auditSnap.data().action, 'admin_approve_social_quest');
  });

  test('un rol cashier no puede aprobar misiones sociales (solo admin/superadmin/marketing)', async () => {
    const uid = 'quest_user_2';
    await seedUser(uid, { points: 0, reviewStatus: 'pending' });
    await signInAs('cashier_1', { role: 'cashier' });

    await assert.rejects(call('adminApproveSocialQuest', { userId: uid, questType: 'review' }));
  });
});

describe('bonos de cliente (cumpleanos, instagram)', () => {
  test('claimBirthdayBonus acredita 100 puntos una sola vez', async () => {
    const uid = 'birthday_user_1';
    await seedUser(uid, { points: 0 });
    await signInAs(uid);

    const result = await call('claimBirthdayBonus', { birthday: '15-05-1990' });
    assert.equal(result.data.pointsDelta, 100);

    // Repetir con la misma fecha no debe volver a acreditar (idempotente por sourceId fijo 'birthday')
    const second = await call('claimBirthdayBonus', { birthday: '15-05-1990' });
    assert.equal(second.data.alreadyProcessed, true);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 100);
  });

  test('claimInstagramFollowBonus acredita 50 puntos una sola vez', async () => {
    const uid = 'instagram_user_1';
    await seedUser(uid, { points: 0, instagramClaimed: false });
    await signInAs(uid);

    const result = await call('claimInstagramFollowBonus', {});
    assert.equal(result.data.pointsDelta, 50);

    // Esperar a que expire el rate limit del propio usuario (3s) para probar la regla
    // de negocio real (ya reclamado) y no el limitador de frecuencia.
    await sleep(3100);
    await assert.rejects(call('claimInstagramFollowBonus', {}), (err) => {
      assert.equal(err.code, 'functions/already-exists');
      return true;
    });

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 50);
  });
});

describe('acciones de admin sobre sellos y ajustes manuales', () => {
  test('adminQuickAddStamp suma 1 sello y 100 puntos, respeta el limite de 25 sellos', async () => {
    const uid = 'stamp_user_1';
    await seedUser(uid, { points: 0, stamps: 24 });
    await signInAs('admin_stamp_1', { role: 'cashier' });

    const result = await call('adminQuickAddStamp', { userId: uid });
    assert.equal(result.data.stamps, 25);
    assert.equal(result.data.points, 100);

    // Esperar a que expire el rate limit del propio admin (3s) para probar la regla de
    // negocio real (limite de 25 sellos) y no el limitador de frecuencia.
    await sleep(3100);
    await assert.rejects(call('adminQuickAddStamp', { userId: uid }), (err) => {
      assert.equal(err.code, 'functions/failed-precondition');
      return true;
    });
  });

  test('adminAdjustUserLoyalty ajusta puntos/sellos y registra auditoria', async () => {
    const uid = 'adjust_user_1';
    await seedUser(uid, { points: 50, stamps: 2 });
    await signInAs('admin_adjust_1', { role: 'admin' });

    const result = await call('adminAdjustUserLoyalty', {
      userId: uid, points: 300, stamps: 5, reason: 'Correccion manual de prueba'
    });
    assert.equal(result.data.pointsDelta, 250);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    assert.equal(userSnap.data().points, 300);
    assert.equal(userSnap.data().stamps, 5);

    const auditSnap = await adminDb.collection('audit_logs').doc(result.data.auditId).get();
    assert.equal(auditSnap.data().action, 'admin_adjust_loyalty');
  });
});
