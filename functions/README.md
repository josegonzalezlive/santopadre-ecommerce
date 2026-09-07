# Sistema de Fidelidad SantoPadre® — Arquitectura

Documento breve para no repetir la confusión `users` vs `usuarios` (bug de T01) o
`padreBalance` vs `points` (bug de T02) que costó horas de auditoría.

## Colecciones de Firestore

Una sola fuente de verdad: **`users/{uid}`**. No usar `usuarios/{uid}` (existió en un
borrador del feature de wallet, nunca se conectó a nada real, se eliminó de
`firestore.rules`).

### `users/{uid}`

| Campo | Tipo | Quién lo escribe | Notas |
|---|---|---|---|
| `points` | number | Cloud Functions / admin | La moneda "$PADRE" vive en este campo, **no** en `padreBalance` (bug histórico de `functions/rewards.js`, corregido). Es un saldo cacheado; el ledger global auditable vive en `loyaltyLedger`. |
| `usdcBalance`, `<moneda>Balance` | number | Cloud Functions / admin | Convención: `currencyToField()` en `js/modules/wallet.js` — `PADRE` → `points`, cualquier otra moneda → `<moneda_en_minuscula>Balance`. |
| `isVip` | boolean | Igual que `points` | `true` cuando `points >= 100`. |
| `stamps` | number | **Solo admin/Cloud Functions** (`admin.html` tras una compra real verificada) | El cliente NUNCA puede escribir este campo (`firestore.rules`). Antes existían `simulateStampPurchase()`/`resetStamps()` en el cliente — eliminados. |
| `claimedRewards`, `activeRewards` | array | **Solo Cloud Functions** (`functions/rewards.js` → `redeemReward`, `claimTierReward`) | El cliente tampoco puede escribirlos directamente. |
| `birthdayClaimed`, `instagramClaimed` | boolean | Cloud Functions | Flags de bonos reclamados. El cliente solicita el bono por callable, pero no muta saldo directamente. |
| `reviewStatus`, `igStoryStatus`, `igPostStatus`, `tiktokStatus` | string (`pending`/`approved`/`rejected`) | Cliente pone `pending`; solo admin cambia a `approved`/`rejected` (`admin.html` → `approveSocialQuest`/`rejectSocialQuest`, con registro en `audit_logs`). |
| `referralCode` | string | `functions/referrals.js` (`generateReferralLink`) | Formato del link: `https://www.santopadre.store/ref?id=<code>`. |
| `referredBy`, `referralStatus` | string | Cloud Functions | `pending_purchase` hasta la primera compra verificada. La función bloquea auto-referido y reuso. |
| `reconciliationStatus`, `lastReconciledAt` | string / timestamp | Cloud Functions | Estado operativo del saldo cacheado contra `loyaltyLedger`. |

Subcolección **`users/{uid}/transactions`**: historial de recargas/canjes
(`js/modules/wallet.js`). El cliente puede leer su historial, pero no escribirlo.
Cada movimiento de puntos debe pasar por Cloud Functions.

### `loyaltyLedger/{entryId}`

Ledger global server-only para todos los movimientos de PADRE. Duplica los movimientos
de `users/{uid}/transactions` con campos de auditoría (`balanceBefore`, `balanceAfter`,
`actorUid`, `actorEmail`, `actorRole`, `metadata`) y permite reconciliar el saldo
cacheado de `users/{uid}.points`.

### `loyaltyReconciliations/{entryId}`

Resultados de reconciliación. `reconcileLoyaltyBalances` detecta diferencias cada 6
horas y `adminReconcileUserLoyalty({ userId, repair })` permite revisar o reparar el
saldo cacheado contra el ledger.

### `loyaltyJobState/{jobId}`

Checkpoints internos de jobs paginados. Lo usan `backfillLoyaltyLedger`,
`reconcileLoyaltyBalances` y `expireLoyaltyPoints` para no procesar siempre los mismos
usuarios. Server-only.

### `loyaltyDailyLimits/{limitId}`

Contadores diarios server-only por usuario y acción. Lo usan confirmaciones de compra,
depósitos Solana y bonos para limitar abuso aunque el cliente salte los delays del UI.

### `notificationFailures/{failureId}`

Fallos recuperables de notificación, especialmente comprobantes WhatsApp de depósitos.
Los documentos quedan en `pending_retry` o `blocked_missing_whatsapp_config` hasta que
un admin use `adminRetryComprobanteNotification({ failureId })`.

### `orders/{orderId}`

Historial de "pedidos" — incluye compras reales del checkout Y entradas sintéticas
para cada punto ganado/canjeado (`pointsEarned`, `orderType: "quest_reward"`), que es
lo que llena la pestaña Actividad. Cliente solo puede crear las suyas; update/delete
son admin-only.

### `audit_logs/{logId}`

Registro de cada ajuste manual de un admin sobre `points`/`stamps`/estado de misiones
de un cliente (`admin.html`). Admin-only en lectura y escritura. Incluye actor, rol,
acción, valores anteriores/nuevos y metadata contextual.

### `config/marketing`

Un solo doc con `{ webhookUrl }` para la integración con n8n/Google Sheets. Admin lo
edita desde `admin.html`; `js/dashboard.js` lo lee al cargar (con `localStorage` como
caché y un literal como último recurso si Firestore no responde).

### `admins/{email}`

Lista extendida de administradores más allá de los dos emails hardcodeados en
`isAdmin()` (`firestore.rules`) y `ALLOWED_ADMIN_EMAILS` (`admin.html`). Un doc
existente en `admins/<email>` = ese email es admin. Puede incluir `role` con uno de:
`superadmin`, `admin`, `cashier`, `marketing`. Si no hay `role`, se trata como `admin`.
También se soportan custom claims `role` o `roles`.

## Cloud Functions (`functions/`)

Todas con Admin SDK — no están sujetas a `firestore.rules`, por eso son el único lugar
seguro para mutar `stamps`/`activeRewards`/`claimedRewards`, o para decidir montos que
el cliente no debe controlar.

Runtime/dependencias actuales:

- Node.js `22`.
- `firebase-functions` `^7.3.2`.
- `firebase-admin` `^14.3.0`.

- **`rewards.js` → `redeemReward({ rewardId })`**: canjea una recompensa del catálogo
  de puntos. El costo y el nombre viven en `REWARD_CATALOG` **del servidor** — el
  cliente nunca envía el monto (antes sí lo hacía, era canjeable cualquier premio por
  cualquier costo inventado).
- **`rewards.js` → `claimTierReward()`**: reclama el premio de ascenso de nivel de la
  tarjeta de sellos. Valida server-side que exista un tier completado y no reclamado
  antes de tocar `activeRewards`.
- **`rewards.js` → `confirmPurchaseAndAwardPoints({ orderId, solanaSignature?, cluster? })`**:
  confirma una orden real antes de acreditar puntos. Clientes solo pueden confirmar su
  propia orden Phantom con verificación Solana; admins/caja pueden confirmar flujos
  operativos.
- **`rewards.js` → `confirmSolanaDeposit({ amountUsd, signature, cluster? })`**:
  verifica on-chain el pago a la wallet SantoPadre antes de acreditar saldo. Si la
  función WhatsApp está disponible, dispara notificación de comprobante; si falta la
  configuración real, registra `notificationFailures` sin revertir el depósito
  verificado.
- **`solana.js` → `verifySolanaTransfer({ signature, amountUsd, cluster })`**:
  servicio aislado para validar firma, consultar RPC, detectar el transfer `system`
  hacia la treasury y devolver metadata on-chain.
- **`rewards.js` → `adminReconcileUserLoyalty({ userId, repair })`**:
  compara `users/{uid}.points` contra `loyaltyLedger`. Con `repair: true`, corrige el
  saldo cacheado sin crear un movimiento artificial de puntos.
- **`rewards.js` → `adminListLoyaltyReconciliations({ status?, limit? })`**:
  lista discrepancias/reparaciones recientes para construir un panel operativo.
- **`rewards.js` → `adminBackfillLoyaltyLedger({ userId?, txLimit?, afterTxId? })`**:
  migra transacciones históricas de `users/{uid}/transactions` a `loyaltyLedger`.
  Es idempotente: si la entrada global ya existe, la salta.
- **`rewards.js` → `adminRetryComprobanteNotification({ failureId })`**:
  reintenta una notificación WhatsApp fallida o marca el fallo como bloqueado si aún
  no existen las credenciales/función real de WhatsApp.
- **`rewards.js` → `backfillLoyaltyLedger`**:
  scheduler cada 12 horas para avanzar el backfill histórico por páginas usando
  `loyaltyJobState/backfillLoyaltyLedger`.
- **`referrals.js` → `generateReferralLink()`**: genera/devuelve el código de referido
  del usuario autenticado.
- **`notifications.js` → `sendComprobanteNotification({ recipientPhone, userName, amount })`**:
  envía un mensaje de WhatsApp Business (Graph API, credenciales vía Secrets Manager).
  Valida formato de los campos. Sigue dependiendo de `WHATSAPP_TOKEN` y
  `WHATSAPP_PHONE_NUMBER_ID` reales antes de deploy completo.

## Límites diarios configurables

Variables opcionales:

- `DAILY_PURCHASE_CONFIRM_LIMIT`: cantidad máxima diaria de confirmaciones de compra
  por usuario. Default: `20`.
- `DAILY_PURCHASE_USD_LIMIT`: monto máximo diario confirmado por usuario. Default:
  `5000`.
- `DAILY_DEPOSIT_CONFIRM_LIMIT`: cantidad máxima diaria de depósitos Solana por
  usuario. Default: `10`.
- `DAILY_DEPOSIT_USD_LIMIT`: monto máximo diario de depósitos Solana por usuario.
  Default: `1000`.
- `DAILY_BONUS_CLAIM_LIMIT`: cantidad máxima diaria de bonos por usuario. Default: `5`.

## App Check

Las callables aceptan `ENFORCE_APP_CHECK=true` para activar `enforceAppCheck` en el
backend. No está activado por defecto para no romper clientes hasta que Firebase App
Check esté configurado en la consola y en el frontend.

## Tests

```bash
npm run check:functions
npm test
npm run test:rules
npm run test:flows
npm run test:all
```

`npm run test:rules`, `npm run test:flows` y `npm run test:all` requieren Java porque
levantan emuladores de Firebase.

## Pendiente conocido (no arreglado en esta pasada)

- `window.loadReferrals()` (`js/dashboard.js`) consulta `users` filtrando por
  `referredBy == uid` — Firestore rechaza esa consulta bajo un modelo de reglas
  por-documento como el actual (no hay forma de que pase `firestore.rules` sin
  reestructurar cómo se guardan los referidos, ej. una colección `referrals/{code}`
  separada). Falla con `permission-denied`, capturado y logueado, no rompe la página.
- Activar `ENFORCE_APP_CHECK=true` queda pendiente hasta configurar Firebase App Check
  en consola y cliente.
