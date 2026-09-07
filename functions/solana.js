const { HttpsError } = require('firebase-functions/v2/https');
const {
  SOLANA_TREASURY_WALLET,
  requiredLamportsForUsd,
  normalizeSolanaCluster
} = require('./loyalty');

function clusterRpcUrl(cluster) {
  return cluster === 'devnet' ? 'https://api.devnet.solana.com' : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
}

function assertSolanaSignature(signature) {
  const txSignature = typeof signature === 'string' ? signature.trim() : '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(txSignature)) {
    throw new HttpsError('invalid-argument', 'Signature de Solana invalida');
  }
  return txSignature;
}

function findTreasuryTransfer(tx, requiredLamports) {
  return (tx.transaction?.message?.instructions || []).find((instruction) => {
    const parsed = instruction.parsed;
    if (instruction.program !== 'system' || parsed?.type !== 'transfer') return false;
    const info = parsed.info || {};
    return info.destination === SOLANA_TREASURY_WALLET && Number(info.lamports || 0) >= requiredLamports;
  });
}

async function verifySolanaTransfer({ signature, amountUsd, cluster, fetchImpl = fetch }) {
  const txSignature = assertSolanaSignature(signature);
  const normalizedCluster = normalizeSolanaCluster(cluster);
  const requiredLamports = requiredLamportsForUsd(amountUsd);
  const response = await fetchImpl(clusterRpcUrl(normalizedCluster), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'santopadre-rewards',
      method: 'getTransaction',
      params: [
        txSignature,
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0
        }
      ]
    })
  });

  if (!response.ok) throw new HttpsError('unavailable', 'No se pudo consultar Solana RPC');
  const body = await response.json();
  const tx = body.result;
  if (!tx || tx.meta?.err) {
    throw new HttpsError('failed-precondition', 'La transaccion Solana no esta confirmada correctamente');
  }

  const transfer = findTreasuryTransfer(tx, requiredLamports);
  if (!transfer) {
    throw new HttpsError('failed-precondition', 'La transaccion no paga el monto esperado a la wallet SantoPadre');
  }

  return {
    signature: txSignature,
    cluster: normalizedCluster,
    lamports: Number(transfer.parsed.info.lamports || 0),
    source: transfer.parsed.info.source || null,
    destination: SOLANA_TREASURY_WALLET
  };
}

module.exports = {
  assertSolanaSignature,
  clusterRpcUrl,
  findTreasuryTransfer,
  verifySolanaTransfer
};
