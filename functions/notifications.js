const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const axios = require('axios');

const waToken = defineSecret('WHATSAPP_TOKEN');
const waPhoneId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const CALLABLE_OPTIONS = { maxInstances: 10, ...(process.env.ENFORCE_APP_CHECK === 'true' ? { enforceAppCheck: true } : {}) };

function normalizeWhatsappTo(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

async function sendComprobanteWhatsapp({ recipientPhone, userName, amount, pointsAwarded, signature }) {
  const to = normalizeWhatsappTo(recipientPhone);
  if (!to) {
    console.warn('comprobante_notification_skipped', {
      component: 'loyalty_notifications',
      reason: 'missing_customer_phone'
    });
    return { sent: false, skipped: true };
  }

  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0';
  const response = await axios.post(
    `https://graph.facebook.com/${graphVersion}/${waPhoneId.value()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: process.env.WHATSAPP_COMPROBANTE_TEMPLATE || 'comprobante_recibido',
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: String(userName || 'Cliente SantoPadre') },
              { type: 'text', text: Number(amount || 0).toFixed(2) },
              { type: 'text', text: String(pointsAwarded || 0) },
              { type: 'text', text: signature ? String(signature).slice(0, 12) : 'verificada' }
            ]
          }
        ]
      }
    },
    {
      headers: {
        Authorization: `Bearer ${waToken.value()}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.info('comprobante_notification_sent', {
    component: 'loyalty_notifications',
    to,
    amount,
    pointsAwarded
  });

  return { sent: true, providerMessageId: response.data?.messages?.[0]?.id || null };
}

exports.sendComprobanteNotification = onCall(
  { ...CALLABLE_OPTIONS, secrets: [waToken, waPhoneId] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }

    const { recipientPhone, userName, amount, pointsAwarded, signature } = request.data;

    if (typeof recipientPhone !== 'string' || !/^\+?[0-9]{7,15}$/.test(recipientPhone)) {
      throw new HttpsError('invalid-argument', 'Número de teléfono inválido');
    }
    if (typeof userName !== 'string' || userName.trim().length === 0 || userName.length > 100) {
      throw new HttpsError('invalid-argument', 'Nombre de usuario inválido');
    }
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Monto inválido');
    }

    try {
      return await sendComprobanteWhatsapp({ recipientPhone, userName, amount, pointsAwarded, signature });
    } catch (error) {
      console.error('comprobante_notification_failed', {
        component: 'loyalty_notifications',
        error: error.response?.data || error.message
      });
      throw new HttpsError('internal', 'Failed to send notification');
    }
  }
);

exports.sendComprobanteWhatsapp = sendComprobanteWhatsapp;
exports.waToken = waToken;
exports.waPhoneId = waPhoneId;
