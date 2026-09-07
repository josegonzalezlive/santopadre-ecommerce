const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { nanoid } = require('nanoid');

exports.generateReferralLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();

  const domain = "https://www.santopadre.store";

  if (snap.data() && snap.data().referralCode) {
    const code = snap.data().referralCode;
    return { code, url: `${domain}/ref?id=${code}` };
  }

  const code = nanoid(8);
  await userRef.set({ referralCode: code }, { merge: true });

  // Debe coincidir con el formato que ya muestra la UI (cuenta.html / signup.html): /ref?id=<code>
  return {
    code,
    url: `${domain}/ref?id=${code}`
  };
});
