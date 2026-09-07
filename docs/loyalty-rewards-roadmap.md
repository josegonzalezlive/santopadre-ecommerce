# Loyalty Rewards SantoPadre - Roadmap por Fases

## Fase 1 - Debilidades

Objetivo: cerrar las rutas donde el cliente podia acreditar saldo, sellos o premios sin validacion.

Estado: implementado a nivel codigo.

- T06: `confirmPurchaseAndAwardPoints` valida orden real. Usuarios solo pueden confirmar Phantom con signature verificada; otras compras las confirma admin.
- T07: `initializeUserRewards` inicializa Auth onCreate con `points: 10`, `stamps: 0`, `isVip: false` y ledger de bienvenida.
- T09: `confirmSolanaDeposit` verifica signature/monto on-chain antes de acreditar.
- T11: `confirmSolanaDeposit` invoca `sendComprobanteWhatsapp` tras acreditar deposito verificado.
- Canjes: `redeemReward` usa catalogo server-side, no montos enviados por cliente.

## Fase 2 - Amenazas

Objetivo: reducir fraude, replay, abuso operativo y fallos silenciosos.

Estado: implementado a nivel codigo; requiere activar secrets/alertas en Google Cloud para produccion.

- T12: rate limiting server-side para canjes, ascensos, ajustes admin y bonos.
- T17: referidos bloquean auto-referido y reuso de codigo por cuenta mediante `referralClaims/{uid}`.
- T19: logs estructurados y runbook de Cloud Monitoring en `docs/loyalty-monitoring.md`.
- Reglas: balances, sellos, recompensas, ledger, rateLimits, referralClaims y analytics son server-side.
- Idempotencia: compras por `orderId`, depositos por `signature` y referidos por usuario referido.

## Fase 3 - Oportunidades

Objetivo: convertir la base segura en crecimiento medible.

Estado: base implementada.

- T21: politica TTL definida por `POINTS_TTL_DAYS` y scheduler `expireLoyaltyPoints`.
- T24: `TIER_REWARDS` tiene respaldo Firestore (`tierRewards/{level}`) y UI en `admin.html > Ajustes`.
- T27: Actividad muestra carga, vacio y error.
- T30: `trackLoyaltyEvent` guarda el embudo Ganar -> Canjear en `loyalty_events`.
- Campañas: `loyaltyCampaigns/current` permite multiplicador temporal de compras verificadas.

## Pendientes que Requieren Decision o Credenciales

- T28: i18n completo requiere una sesion dedicada para extraer strings sin romper copy de marca.
- T29: wallet passes reales aun dependen de llaves/certificados de Apple/Google y despliegue completo de Functions.
- WhatsApp Business: crear `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` antes de desplegar Functions.
