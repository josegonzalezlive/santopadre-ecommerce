# FODA y Checklist - Backend Loyalty Rewards SantoPadre

Fecha: 2026-09-07
Rama: `feature-rewards-admin`

## FODA del backend

### Fortalezas

- El saldo PADRE ya no depende solo del cliente: compras, canjes, bonos, referidos y depósitos pasan por Cloud Functions.
- Existe verificación server-side para compras y depósitos Solana antes de acreditar puntos.
- El bono de bienvenida se inicializa con trigger de Firebase Auth, no con escritura del cliente.
- Firestore Rules bloquea escrituras directas a campos sensibles como `points`, `stamps`, `isVip`, `activeRewards`, `claimedRewards`, `referralStatus` y saldos.
- Hay rate limiting server-side en flujos sensibles.
- Referidos ya bloquean auto-referido y reuso de código.
- WhatsApp Business usa Secrets Manager y está conectado al flujo real de depósito.
- Hay tests unitarios base y pruebas de reglas preparadas con `@firebase/rules-unit-testing`.
- El backend ya tiene documentación operativa inicial en `functions/README.md` y `docs/loyalty-monitoring.md`.
- La segunda pasada backend dejó preparado un modelo más maduro con ledger global, reconciliación, roles admin y App Check opcional.

### Debilidades

- `users/{uid}.points` sigue siendo el saldo visible principal; aunque hay ledger y backfill, falta correr la migración histórica en producción y verificar resultados.
- No hay UI admin para ejecutar reconciliaciones ni revisar discrepancias del ledger.
- Los roles granulares existen en Functions, pero Firestore Rules y algunas lecturas del admin todavía tratan `admins/{email}` como admin genérico.
- Los jobs scheduler ya tienen checkpoint, pero falta observarlos en producción con volumen real.
- Las pruebas de reglas no corren localmente sin Java.
- Falta cobertura de integración real con emuladores para Auth + Firestore + Functions.
- El deploy de Functions está bloqueado por secrets reales de WhatsApp.
- La versión de `firebase-functions` está vieja y Firebase advierte sobre compatibilidad futura.
- Runtime Node.js 20 está marcado como deprecated por Firebase; hay que planificar upgrade.
- El flujo de Wallet passes Apple/Google todavía depende de credenciales/certificados y puede caer a mock.

### Oportunidades

- Convertir `loyaltyLedger` en la fuente contable principal y usar `users/{uid}.points` solo como cache.
- Ejecutar y monitorear el backfill controlado de transacciones históricas al ledger global.
- Crear panel admin de salud: discrepancias, depósitos pendientes, notificaciones fallidas, órdenes sin confirmar, abuso bloqueado.
- Activar App Check cuando el frontend esté listo, reduciendo llamadas desde clientes falsos.
- Separar roles reales: `superadmin`, `admin`, `cashier`, `marketing`.
- Añadir alertas automáticas en Cloud Monitoring para errores y mismatches de reconciliación.
- Incorporar métricas financieras: puntos emitidos, puntos canjeados, liability estimado, puntos expirados y fraude bloqueado.
- Mejorar el backend como API reusable para futuros canales: POS, WhatsApp commerce, wallet passes, campañas y referidos B2B.
- Preparar i18n y configuración remota de textos/recompensas para evitar hardcoding en frontend.
- Crear suite CI que corra tests unitarios, rules dry-run y emuladores antes de merge.

### Amenazas

- Sin App Check activo, un atacante autenticado puede intentar abusar callables aunque existan validaciones y rate limits.
- Si el ledger y el saldo cacheado divergen, el cliente puede ver un balance incorrecto hasta reconciliar.
- Si Solana RPC falla o cambia disponibilidad, confirmaciones de depósito pueden quedar bloqueadas.
- Si los secrets de WhatsApp no se configuran, el deploy real de Functions queda detenido.
- Node.js 20 decommission puede bloquear futuros deploys si no se actualiza runtime/SDK.
- Firestore Rules demasiado permisivas para admins genéricos pueden ampliar el daño de una cuenta admin comprometida.
- Falta de pruebas de integración puede permitir regresiones entre frontend, callables y reglas.
- Si los checkpoints de scheduler se corrompen o quedan atascados, usuarios pueden tardar en reconciliar/expirar hasta que se repare `loyaltyJobState`.
- Las alertas todavía no están creadas en Cloud Monitoring; errores pueden pasar desapercibidos.
- Mezclar cambios de Claude y Codex en la misma rama sin handoff claro puede provocar duplicidad, conflictos o regresiones.

## Checklist dividido entre Codex y Claude Code

### Fase 1 - Cierre técnico sin intervención humana

- [x] Codex: revisar el commit actual y confirmar que `functions/ledger.js` quedó integrado en la rama remota.
- [x] Codex: crear o completar backfill server-side para migrar `users/{uid}/transactions` existentes a `loyaltyLedger`.
- [x] Codex: añadir tests unitarios para `ledgerDocId`, `buildPointLedgerEntry`, roles admin y validación de payloads.
- [x] Codex: añadir callable/admin job para listar discrepancias recientes de `loyaltyReconciliations`.
- [x] Codex: agregar paginación a `reconcileLoyaltyBalances` usando cursor/checkpoint.
- [x] Codex: agregar paginación a `expireLoyaltyPoints` usando cursor/checkpoint.
- [x] Codex: registrar `reward_consumed` también como evento global no monetario o documentar explícitamente por qué queda solo en historial de usuario.
- [ ] Claude Code: revisar todo el diff backend de Codex con foco en riesgos, idempotencia y compatibilidad con frontend.
- [ ] Claude Code: probar flujos manuales en emulador o staging si el entorno lo permite: compra, depósito, canje, referido, misión y expiración.
- [ ] Claude Code: revisar `js/dashboard.js`, `admin.html` y `js/user-profile.js` contra los contratos nuevos de Functions.

### Fase 2 - Seguridad y permisos

- [x] Codex: endurecer `firestore.rules` para roles granulares si se decide mantener lecturas/escrituras directas desde admin.
- [x] Codex: centralizar permisos de Functions en un helper único: `requireRole(['admin'])`, `requireRole(['cashier'])`, etc.
- [x] Codex: añadir auditoría obligatoria para cambios en `tierRewards`, `loyaltyCampaigns` y reparaciones de reconciliación.
- [x] Codex: añadir límites diarios por usuario para bonos, depósitos y confirmaciones de compra.
- [ ] Claude Code: revisar que ninguna ruta cliente pueda volver a mutar `points`, `stamps` o transacciones.
- [ ] Claude Code: validar que los roles del panel admin no muestren acciones que el backend va a rechazar.
- [ ] Claude Code: preparar fixtures de usuarios `superadmin`, `admin`, `cashier`, `marketing` y usuario normal.

### Fase 3 - Observabilidad y operación

- [x] Codex: crear documento de métricas operativas exactas para Cloud Monitoring.
- [x] Codex: añadir logs estructurados con `eventId`, `uid`, `orderId`, `signature`, `ledgerId` y `reconciliationId`.
- [x] Codex: crear colección `failedJobs` o `notificationFailures` para reintentos manuales.
- [x] Codex: añadir callable admin para reintentar notificaciones WhatsApp fallidas.
- [ ] Claude Code: construir panel admin de salud backend: errores, mismatches, depósitos pendientes y notificaciones fallidas.
- [ ] Claude Code: conectar el panel admin a `loyaltyReconciliations`, `loyaltyLedger` y logs operativos disponibles en Firestore.

### Fase 4 - Tests y CI

- [x] Codex: ampliar `npm test` con pruebas de helpers backend sin emulador.
- [x] Codex: crear script `npm run test:all` que agrupe unit tests, rules tests y checks de sintaxis.
- [x] Codex: documentar prerequisito Java para `npm run test:rules`.
- [ ] Claude Code: instalar/configurar Java en el entorno donde corran los tests de reglas.
- [ ] Claude Code: correr `npm run test:rules` y corregir cualquier regresión de Firestore Rules.
- [ ] Claude Code: configurar CI para ejecutar tests antes de merge a `main`.

### Fase 5 - Deuda técnica backend

- [ ] Codex: actualizar `firebase-functions` a una versión compatible moderna y resolver breaking changes.
- [ ] Codex: evaluar upgrade de runtime posterior a Node.js 20.
- [ ] Codex: separar `functions/rewards.js` en servicios pequeños: `ledgerService`, `solanaService`, `rateLimitService`, `adminService`, `campaignService`.
- [ ] Claude Code: revisar impacto del upgrade de SDK/runtime en deploy real.
- [ ] Claude Code: validar compatibilidad de Wallet passes Apple/Google después del upgrade.

### Fase 6 - Requiere intervención humana

- [ ] Humano: proveer `WHATSAPP_TOKEN` real.
- [ ] Humano: proveer `WHATSAPP_PHONE_NUMBER_ID` real.
- [ ] Humano: confirmar plantilla WhatsApp aprobada para comprobantes.
- [ ] Humano: decidir cuándo activar Firebase App Check.
- [ ] Humano: configurar App Check en Firebase Console.
- [ ] Humano: autorizar deploy real de Functions.
- [ ] Humano: autorizar merge/cherry-pick de `feature-rewards-admin` a `main`.
- [ ] Humano: definir política final de expiración de puntos si cambia el default actual.
- [ ] Humano: definir responsabilidad financiera del programa: valor estimado de PADRE, límites y liability máximo.

## Reparto recomendado

Codex debería tomar las tareas backend puras: ledger, reconciliación, reglas, validaciones,
tests unitarios, jobs scheduler, SDK/runtime y documentación técnica.

Claude Code debería tomar revisión cruzada, pruebas integradas, compatibilidad frontend,
panel admin, CI y preparación de lanzamiento, porque ya venía trabajando ramas y flujos
del dashboard/admin.

El humano debe quedar solo para credenciales, decisiones de lanzamiento, App Check en
consola, política de negocio y aprobación de deploy/merge.
