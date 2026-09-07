const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const axios = require('axios');

const waToken = defineSecret('WHATSAPP_TOKEN');
const waPhoneId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');

exports.sendComprobanteNotification = onCall(
  { secrets: [waToken, waPhoneId] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }

    const { recipientPhone, userName, amount } = request.data;

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
      await axios.post(
        `https://graph.facebook.com/v19.0/${waPhoneId.value()}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'template',
          template: {
            name: 'comprobante_recibido', // ⚙️ CONFIGURE: approved template name
            language: { code: 'es' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: userName },
                  { type: 'text', text: String(amount) }
                ]
              }
            ]
          }
        },
        { 
          headers: { 
            Authorization: `Bearer ${waToken.value()}` 
          } 
        }
      );
      
      return { sent: true };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw new HttpsError('internal', 'Failed to send notification');
    }
  }
);
