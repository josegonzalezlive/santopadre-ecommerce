# Handoff para Claude - Backend Loyalty Rewards SantoPadre

Fecha: 2026-09-07
Rama: `feature-rewards-admin`
Repo local: `/Users/josegonzalez/Documents/Codex/2026-06-25/quiero-que-clones-este-repositorio-de/santopadre-ecommerce`

## Estado de rama

La rama remota ya tiene el commit de Codex:

```text
cb6a288 feat(loyalty): implement Codex rewards backend tasks
```

Después de ese commit, Codex empezó una segunda pasada de mejora backend. Esa segunda
pasada está en cambios locales sin commit al momento de escribir este handoff.

Cambios locales esperados:

- `functions/ledger.js` nuevo.
- `functions/rewards.js` modificado.
- `functions/referrals.js` modificado.
- `functions/notifications.js` modificado.
- `firestore.rules` modificado.
- `test/loyalty.test.js` modificado.
- `test/firestore.rules.test.mjs` modificado.
- `functions/README.md` modificado.
- `docs/loyalty-monitoring.md` modificado.

## Lo que ya implementó Codex en el commit `cb6a288`

- T06: `confirmPurchaseAndAwardPoints` valida una orden real antes de acreditar PADRE.
- T07: `initializeUserRewards` en Auth `onCreate` inicializa usuario con `points: 10`, `stamps: 0`, `isVip: false`.
- T09: `confirmSolanaDeposit` verifica signature/monto on-chain antes de acreditar.
- T11: el flujo real de depósito invoca WhatsApp comprobante.
- T12: rate limiting server-side en canjes y acciones sensibles.
- T14: tests base de `firestore.rules`.
- T16: panel admin real para aprobar misiones, consumir premios y ajustar loyalty.
- T17: referidos bloquean auto-referido y reuso.
- T19: documentación de monitoreo.
- T21: expiración TTL con scheduler.
- T24: `tierRewards` y campaña loyalty configurables desde Firestore/admin.
- T27: estados loading/empty/error en Actividad.
- T30: tracking básico del embudo loyalty.

## Segunda pasada backend de Codex pendiente de revisar/terminar

Objetivo: pasar de saldo mutable a modelo auditable y operable.

### Ledger global

Nuevo archivo: `functions/ledger.js`.

Agrega helpers para:

- `loyaltyLedger/{entryId}` como ledger global server-only.
- `buildPointLedgerEntry(...)` con `balanceBefore`, `balanceAfter`, `actorUid`, `actorEmail`, `actorRole`, `metadata`.
- `writePointLedger(...)` para escribir en una sola transacción:
  - `users/{uid}/transactions/{txId}`
  - `loyaltyLedger/{entryId}`
- `calculateLedgerBalance(...)` para reconciliar.

Punto importante: `users/{uid}.points` queda como saldo cacheado para UI. La fuente
auditable pasa a ser `loyaltyLedger`.

### Reconciliación

En `functions/rewards.js` se agregó:

- `adminReconcileUserLoyalty({ userId, repair })`
  - `admin`/`superadmin` solamente.
  - Calcula `ledgerBalance` vs `users/{uid}.points`.
  - Con `repair: true`, corrige el saldo cacheado y escribe `audit_logs`.
- `reconcileLoyaltyBalances`
  - Scheduler cada 6 horas.
  - Revisa hasta 200 usuarios por ejecución.
  - Escribe diferencias en `loyaltyReconciliations`.
  - No repara automáticamente.

### Roles admin

En `functions/referrals.js` se agregó:

- `_getAdminRole(request)`
- `_hasAdminRole(request, allowedRoles)`

Roles soportados:

- `superadmin`
- `admin`
- `cashier`
- `marketing`

Compatibilidad:

- Los emails hardcodeados siguen como `superadmin`.
- `admins/{email}` sin `role` se trata como `admin`.
- También soporta custom claims `role` o `roles`.

Uso previsto:

- `cashier`: sellos, canjes operativos, registro manual básico.
- `marketing`: campañas y misiones sociales.
- `admin`/`superadmin`: operaciones completas.

Advertencia para Claude: `firestore.rules` todavía considera admin a cualquier doc en
`admins/{email}` sin validar `role`; si quieres cerrar seguridad end-to-end, actualiza
reglas y UI admin para respetar roles también en lecturas/escrituras directas.

### App Check preparado

Se agregó `CALLABLE_OPTIONS` en:

- `functions/rewards.js`
- `functions/referrals.js`
- `functions/notifications.js`

Si `ENFORCE_APP_CHECK=true`, las callables se registran con `enforceAppCheck: true`.
No está activado por defecto para no romper clientes mientras App Check no esté
configurado en Firebase Console y frontend.

### Validación estricta de payloads

`functions/rewards.js` ahora tiene `assertKnownKeys(...)` y se aplica a callables
sensibles para rechazar campos inesperados.

### Rate limit antes de llamadas caras

Se agregó `enforceCallableRateLimit(...)` antes de:

- `confirmPurchaseAndAwardPoints`
- `confirmSolanaDeposit`

Esto reduce abuso antes de consultar Solana RPC.

### Firestore rules

Se agregó protección para:

- `loyaltyLedger/{entryId}`
- `loyaltyReconciliations/{entryId}`
- nuevos campos protegidos en `users/{uid}`:
  - `reconciliationStatus`
  - `lastReconciledAt`

## Validaciones ya corridas por Codex

Pasaron:

```bash
node --check functions/ledger.js
node --check functions/referrals.js
node --check functions/notifications.js
node --check functions/rewards.js
node --check functions/index.js
git diff --check
npm test
npx firebase-tools deploy --only firestore:rules --dry-run
```

`npm test` quedó en:

```text
16 tests, 16 pass, 0 fail
```

`firebase deploy --only functions --dry-run` cargó y analizó el código, pero se detuvo
por falta de secrets:

```text
Error: In non-interactive mode but have no value for the secret: WHATSAPP_TOKEN
Set this secret before deploying:
firebase functions:secrets:set WHATSAPP_TOKEN
```

`npm run test:rules` no pudo correr por falta de Java local:

```text
Unable to locate a Java Runtime.
```

## Revisión recomendada para Claude antes de continuar

1. Revisar cuidadosamente el diff local de:
   - `functions/ledger.js`
   - `functions/rewards.js`
   - `functions/referrals.js`
   - `firestore.rules`
2. Confirmar que todos los movimientos PADRE relevantes escriben también en
   `loyaltyLedger`.
3. Verificar si `reward_consumed` debe quedarse como transacción de monto `0` solo en
   `users/{uid}/transactions` o también conviene duplicarlo al ledger global como evento
   contable no monetario. Codex lo dejó como historial local de usuario.
4. Endurecer roles en `firestore.rules` si se quiere separar admin/caja/marketing no
   solo en Functions sino también en accesos directos del frontend admin.
5. Considerar paginación real en `reconcileLoyaltyBalances`; hoy revisa los primeros
   200 usuarios por ejecución para no exceder límite de batch.
6. Revisar compatibilidad del upgrade `firebase-functions >=5.1.0` y runtime posterior
   a Node 20. Firebase avisó que Node.js 20 fue deprecated el 2026-04-30 y será
   decommissioned el 2026-10-30.

## Pendiente sin intervención humana inmediata

- Terminar revisión y commit de la segunda pasada backend.
- Añadir tests unitarios de roles/admin payloads si se quiere más cobertura sin Java.
- Añadir UI admin para ejecutar `adminReconcileUserLoyalty`.
- Añadir backfill/migración controlada para crear `loyaltyLedger` de transacciones
  históricas existentes.
- Diseñar paginación robusta para jobs scheduler si la base de usuarios crece.
- Actualizar `firestore.rules` para roles granulares.

## Pendiente que requiere intervención humana

- Configurar secrets reales:
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
- Decidir cuándo activar `ENFORCE_APP_CHECK=true`.
- Configurar Firebase App Check en consola y frontend antes de activar enforcement.
- Instalar Java local o correr tests de reglas en un entorno que tenga Java.
- Autorizar deploy real de Functions.
- Autorizar merge/cherry-pick a `main` cuando se lance loyalty en producción.
- Revisar/crear alert policies reales en Cloud Monitoring.
