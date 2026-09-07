# Handoff para Claude - Backend Loyalty Rewards SantoPadre

Fecha: 2026-09-07
Rama: `feature-rewards-admin`
Repo local: `/Users/josegonzalez/Documents/Codex/2026-06-25/quiero-que-clones-este-repositorio-de/santopadre-ecommerce`

## Estado de rama

La rama remota ya tiene estos commits de Codex:

```text
809cd51 feat(loyalty): ledger contable global, roles admin y reconciliacion
cb6a288 feat(loyalty): implement Codex rewards backend tasks
```

Después de `809cd51`, Codex inició una tercera pasada técnica basada en
`docs/backend-loyalty-foda-checklist.md`. Esta pasada está en cambios locales hasta
que se haga commit/push.

## Ya integrado

- T06: compras verificadas server-side antes de acreditar PADRE.
- T07: bono de bienvenida desde Auth `onCreate`.
- T09: depósitos Solana verificados on-chain antes de acreditar.
- T11: comprobante WhatsApp conectado al depósito real.
- T12: rate limiting server-side en flujos sensibles.
- T14: tests base de Firestore Rules.
- T16: panel admin real para misiones, canjes y ajustes.
- T17: referidos con bloqueo de auto-referido y reuso.
- T19: documentación de monitoreo.
- T21: expiración TTL con scheduler.
- T24: tiers/campañas configurables.
- T27: estados loading/empty/error en Actividad.
- T30: tracking base del embudo loyalty.
- Ledger global `loyaltyLedger` y reconciliación contra `users/{uid}.points`.
- Roles admin en Functions: `superadmin`, `admin`, `cashier`, `marketing`.
- App Check preparado con `ENFORCE_APP_CHECK=true`.

## Tercera pasada técnica en progreso

- `adminBackfillLoyaltyLedger({ userId?, txLimit?, afterTxId? })`: callable admin
  idempotente para migrar transacciones históricas de `users/{uid}/transactions` a
  `loyaltyLedger`.
- `backfillLoyaltyLedger`: scheduler cada 12 horas con checkpoint en
  `loyaltyJobState/backfillLoyaltyLedger`.
- `adminListLoyaltyReconciliations({ status?, limit? })`: callable admin para listar
  discrepancias/reparaciones recientes.
- `reconcileLoyaltyBalances`: ahora pagina por `users` usando
  `loyaltyJobState/reconcileLoyaltyBalances`.
- `expireLoyaltyPoints`: ahora pagina vencimientos usando
  `loyaltyJobState/expireLoyaltyPoints`.
- `reward_consumed`: ahora escribe evento global no monetario en `loyaltyLedger`.
- `package.json`: agrega `check:functions` y `test:all`.
- `firestore.rules`: protege `loyaltyJobState`.
- `docs/backend-loyalty-foda-checklist.md`: FODA y checklist dividido entre Codex,
  Claude Code y humano.

## Validaciones corridas por Codex

Pasaron:

```bash
npm run check:functions
git diff --check
npm test
npx firebase-tools deploy --only firestore:rules --dry-run
npx firebase-tools deploy --only functions --dry-run
```

Resultado actual de `npm test`:

```text
21 tests, 21 pass, 0 fail
```

No pasó por dependencia de entorno:

```bash
npm run test:rules
```

Motivo:

```text
Unable to locate a Java Runtime.
```

## Revisión recomendada para Claude

1. Revisar el diff local antes de continuar, especialmente:
   - `functions/rewards.js`
   - `functions/ledger.js`
   - `firestore.rules`
   - `test/loyalty.test.js`
2. Validar en emulador o staging:
   - backfill de ledger
   - reconciliación con y sin `repair`
   - expiración paginada
   - consumo de recompensa con evento global `pointsDelta: 0`
3. Revisar si conviene mover la lógica nueva de `functions/rewards.js` a servicios
   pequeños antes de crecer más.
4. Endurecer roles también en `firestore.rules` y UI admin si se quiere separación
   real entre caja, marketing y admin.
5. Revisar upgrade de `firebase-functions >=5.1.0` y runtime posterior a Node.js 20.

## Pendiente sin intervención humana

- UI admin para ejecutar `adminReconcileUserLoyalty`.
- UI admin para ejecutar `adminBackfillLoyaltyLedger`.
- Panel de salud backend: mismatches, depósitos pendientes, notificaciones fallidas,
  jobs y abuso bloqueado.
- Más tests de payloads y roles.
- CI con `check:functions`, `npm test`, rules dry-run y emuladores.
- Refactor gradual de `functions/rewards.js` en servicios.

## Pendiente con intervención humana

- Configurar secrets reales:
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
- Confirmar plantilla WhatsApp aprobada para comprobantes.
- Configurar Firebase App Check en consola/frontend.
- Decidir cuándo activar `ENFORCE_APP_CHECK=true`.
- Instalar Java local o correr tests de reglas en un entorno con Java.
- Autorizar deploy real de Functions.
- Autorizar merge/cherry-pick a `main`.
- Crear alert policies reales en Cloud Monitoring.
