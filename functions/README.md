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
| `points` | number | Cliente (solo +100 cumpleaños, +50 Instagram) / Cloud Functions / admin | La moneda "$PADRE" vive en este campo, **no** en `padreBalance` (bug histórico de `functions/rewards.js`, corregido). |
| `usdcBalance`, `<moneda>Balance` | number | Cloud Functions / admin | Convención: `currencyToField()` en `js/modules/wallet.js` — `PADRE` → `points`, cualquier otra moneda → `<moneda_en_minuscula>Balance`. |
| `isVip` | boolean | Igual que `points` | `true` cuando `points >= 100`. |
| `stamps` | number | **Solo admin/Cloud Functions** (`admin.html` tras una compra real verificada) | El cliente NUNCA puede escribir este campo (`firestore.rules`). Antes existían `simulateStampPurchase()`/`resetStamps()` en el cliente — eliminados. |
| `claimedRewards`, `activeRewards` | array | **Solo Cloud Functions** (`functions/rewards.js` → `redeemReward`, `claimTierReward`) | El cliente tampoco puede escribirlos directamente. |
| `birthdayClaimed`, `instagramClaimed` | boolean | Cliente, una sola vez | Flags que las reglas usan para permitir el `+100`/`+50` exactamente una vez. |
| `reviewStatus`, `igStoryStatus`, `igPostStatus`, `tiktokStatus` | string (`pending`/`approved`/`rejected`) | Cliente pone `pending`; solo admin cambia a `approved`/`rejected` (`admin.html` → `approveSocialQuest`/`rejectSocialQuest`, con registro en `audit_logs`). |
| `referralCode` | string | `functions/referrals.js` (`generateReferralLink`) | Formato del link: `https://www.santopadre.store/ref?id=<code>`. |
| `referredBy`, `referralStatus` | string | Cliente (al crear cuenta con `?ref=` o `?id=` en la URL) | `pending_purchase` hasta la primera compra. |

Subcolección **`users/{uid}/transactions`**: historial de recargas/canjes
(`js/modules/wallet.js`). El cliente puede leer/escribir la suya propia (usado por
`processRecarga`/`processCanje`, que también corren client-side vía `runTransaction`
directo — a diferencia de `redeemReward`, que sí pasa por Cloud Function).

### `orders/{orderId}`

Historial de "pedidos" — incluye compras reales del checkout Y entradas sintéticas
para cada punto ganado/canjeado (`pointsEarned`, `orderType: "quest_reward"`), que es
lo que llena la pestaña Actividad. Cliente solo puede crear las suyas; update/delete
son admin-only.

### `audit_logs/{logId}`

Registro de cada ajuste manual de un admin sobre `points`/`stamps`/estado de misiones
de un cliente (`admin.html`). Admin-only en lectura y escritura. Cobertura verificada
(T15): `quickAddStamp`, `saveUserPointsAndStamps`, `approveSocialQuest`,
`rejectSocialQuest` y `consumeReward` registran aquí.

### `config/marketing`

Un solo doc con `{ webhookUrl }` para la integración con n8n/Google Sheets. Admin lo
edita desde `admin.html`; `js/dashboard.js` lo lee al cargar (con `localStorage` como
caché y un literal como último recurso si Firestore no responde).

### `admins/{email}`

Lista extendida de administradores más allá de los dos emails hardcodeados en
`isAdmin()` (`firestore.rules`) y `ALLOWED_ADMIN_EMAILS` (`admin.html`). Un doc
existente en `admins/<email>` = ese email es admin. Se gestiona a mano (no hay UI que
escriba aquí todavía).

## Cloud Functions (`functions/`)

Todas con Admin SDK — no están sujetas a `firestore.rules`, por eso son el único lugar
seguro para mutar `stamps`/`activeRewards`/`claimedRewards`, o para decidir montos que
el cliente no debe controlar.

- **`rewards.js` → `redeemReward({ rewardId })`**: canjea una recompensa del catálogo
  de puntos. El costo y el nombre viven en `REWARD_CATALOG` **del servidor** — el
  cliente nunca envía el monto (antes sí lo hacía, era canjeable cualquier premio por
  cualquier costo inventado).
- **`rewards.js` → `claimTierReward()`**: reclama el premio de ascenso de nivel de la
  tarjeta de sellos. Valida server-side que exista un tier completado y no reclamado
  antes de tocar `activeRewards`.
- **`referrals.js` → `generateReferralLink()`**: genera/devuelve el código de referido
  del usuario autenticado.
- **`notifications.js` → `sendComprobanteNotification({ recipientPhone, userName, amount })`**:
  envía un mensaje de WhatsApp Business (Graph API, credenciales vía Secrets Manager).
  Valida formato de los 3 campos — no está conectada a ningún flujo del frontend
  todavía (pendiente, ver checklist T11).

## Pendiente conocido (no arreglado en esta pasada)

- `window.loadReferrals()` (`js/dashboard.js`) consulta `users` filtrando por
  `referredBy == uid` — Firestore rechaza esa consulta bajo un modelo de reglas
  por-documento como el actual (no hay forma de que pase `firestore.rules` sin
  reestructurar cómo se guardan los referidos, ej. una colección `referrals/{code}`
  separada). Falla con `permission-denied`, capturado y logueado, no rompe la página.
- No hay verificación real de que exista una compra antes de otorgar sellos/puntos de
  recarga (`processRecarga`, `quickAddStamp` en `admin.html` dependen del criterio del
  admin/cliente). Ver checklist T06/T07/T09 — trabajo de Codex.
