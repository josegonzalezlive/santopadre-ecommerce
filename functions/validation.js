const { HttpsError } = require('firebase-functions/v2/https');

function assertKnownKeys(data, allowedKeys, operation) {
  const payload = data || {};
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new HttpsError('invalid-argument', `Campos no permitidos en ${operation}: ${unknown.join(', ')}`);
  }
  return payload;
}

module.exports = {
  assertKnownKeys
};
