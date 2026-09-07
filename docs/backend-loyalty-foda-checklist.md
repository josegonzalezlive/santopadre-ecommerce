# FODA y Checklist - Backend Loyalty Rewards SantoPadre

Fecha: 2026-09-07
Rama: `main` (PR #1 mergeado en `ef361c0`; `feature-rewards-admin` borrada tras el merge)

> Actualizado por Claude Code tras cerrar Fase 1/2/4/5, ejecutar el deploy real de
> Functions, mergear el PR #1 a `main`, y resolver las decisiones de negocio de Fase 6
> (App Check, expiración de puntos, límites diarios). Ver "Changelog de esta
> actualización" al final.

## FODA del backend

### Fortalezas

- El saldo PADRE ya no depende solo del cliente: compras, canjes, bonos, referidos y depósitos pasan por Cloud Functions.
- Existe verificación server-side para compras y depósitos Solana antes de acreditar puntos.
- El bono de bienvenida se inicializa con trigger de Firebase Auth, no con escritura del cliente.
- Firestore Rules bloquea escrituras directas a campos sensibles como `points`, `stamps`, `isVip`, `activeRewards`, `claimedRewards`, `referralStatus` y saldos; cashier/marketing ya no tienen escritura directa a `users/{uid}` (deben pasar por Functions con `requireRole`).
- Hay rate limiting server-side en flujos sensibles, más límites diarios por usuario (compras, depósitos, bonos).
- Referidos ya bloquean auto-referido y reuso de código.
- Roles granulares (`superadmin`, `admin`, `cashier`, `marketing`) centralizados en `functions/authz.js` y reflejados tanto en `firestore.rules` como en el panel `admin.html`, que ahora bloquea en cliente cualquier acción que el backend vaya a rechazar por rol.
- Hay 56 tests automatizados corriendo en CI (`npm run test:all`): 30 unitarios, 12 de reglas contra el emulador real, y 14 de integración completa (Firestore+Functions+Auth) que ejercitan compra, canje, ascenso de nivel, referidos, misiones sociales, bonos y ajustes admin de punta a punta.
- **Un bug crítico de producción fue encontrado y corregido**: 6 Cloud Functions (`redeemReward`, `claimTierReward`, `adminQuickAddStamp`, `adminAdjustUserLoyalty`, `adminApproveSocialQuest`, `claimInstagramFollowBonus`) violaban el orden lectura-antes-de-escritura de Firestore y truenan siempre; invisible a tests unitarios y de reglas, solo lo detectó la suite de integración con emulador completo.
- El upgrade de runtime (Node 22, `firebase-functions@7.3.2`, `firebase-admin@14.3.0`) ya está **desplegado y verificado en producción real** (`sound-bee-495502-i0`), incluyendo el fix del conflicto Gen1/Gen2 para `generateGooglePassUrl`/`generateApplePass`.
- CI configurado en GitHub Actions (`.github/workflows/tests.yml`) y verificado corriendo en verde en un PR real.
- La segunda pasada backend dejó preparado un modelo más maduro con ledger global, reconciliación, backfill histórico, roles admin y App Check opcional.

### Debilidades

- `users/{uid}.points` sigue siendo el saldo visible principal; el backfill server-side ya existe (`adminBackfillLoyaltyLedger` + scheduler cada 12h) pero **no se ha ejecutado sobre los 3 usuarios reales existentes** — correrlo antes de usar `adminReconcileUserLoyalty({repair:true})` en cualquiera de ellos.
- **No hay UI admin para ejecutar reconciliaciones ni revisar discrepancias del ledger** (Fase 3, pendiente) — los callables ya existen (`adminListLoyaltyReconciliations`, `adminRetryComprobanteNotification`) pero nada en `admin.html` los consume todavía.
- `js/dashboard.js` no distingue el código de error `resource-exhausted` (nuevos límites diarios de Codex) del resto de errores — cae en un mensaje genérico en vez de uno específico. Cosmético, no bloquea al usuario.
- Las fixtures de usuarios por rol (`superadmin`/`admin`/`cashier`/`marketing`/normal) existen ad-hoc dentro de `test/loyalty.flows.integration.test.mjs`, no como módulo reutilizable.
- El flujo de Wallet passes Apple/Google se verificó a nivel de código (carga sin errores bajo el SDK nuevo, API v1 intacta) pero no de punta a punta — depende de certificados/credenciales reales que no existen en este entorno.
- `confirmSolanaDeposit` y `expireLoyaltyPoints` no están cubiertas por la suite de integración (solo por revisión de código); tampoco la rama de verificación Solana de `confirmPurchaseAndAwardPoints`.
- El deploy grande (~33 funciones) tropezó una vez con cuota de CPU de Cloud Run por región durante el rollout — se resolvió reintentando en tandas más chicas, pero puede repetirse en deploys futuros igual de grandes.
- El stub `TEMPORAL` que excluye `notifications.js`/WhatsApp del deploy sigue activo en `functions/rewards.js` e `functions/index.js` — hay que revertirlo en cuanto existan credenciales reales de WhatsApp.

### Oportunidades

- Convertir `loyaltyLedger` en la fuente contable principal y usar `users/{uid}.points` solo como cache.
- Ejecutar y monitorear el backfill controlado de transacciones históricas al ledger global para los 3 usuarios reales.
- Construir el panel admin de salud: discrepancias, depósitos pendientes, notificaciones fallidas, órdenes sin confirmar, abuso bloqueado — los callables backend ya están listos, solo falta la UI.
- Activar App Check cuando el frontend esté listo, reduciendo llamadas desde clientes falsos.
- Añadir alertas automáticas en Cloud Monitoring para errores y mismatches de reconciliación (el doc de métricas ya existe: `docs/loyalty-cloud-monitoring-metrics.md`).
- Incorporar métricas financieras: puntos emitidos, puntos canjeados, liability estimado, puntos expirados y fraude bloqueado.
- Mejorar el backend como API reusable para futuros canales: POS, WhatsApp commerce, wallet passes, campañas y referidos B2B.
- Preparar i18n y configuración remota de textos/recompensas para evitar hardcoding en frontend.
- Pedir aumento de cuota de "Total Allowable CPU" en `us-central1` si los deploys grandes se vuelven frecuentes.
- Formalizar las fixtures de roles como módulo reutilizable para acelerar tests futuros.

### Amenazas

- Sin App Check activo, un atacante autenticado puede intentar abusar callables aunque existan validaciones y rate limits.
- Si el ledger y el saldo cacheado divergen, el cliente puede ver un balance incorrecto hasta reconciliar — **riesgo real y actual**: un `repair:true` antes del backfill borraría el historial de puntos pre-ledger de los 3 usuarios reales.
- Si Solana RPC falla o cambia disponibilidad, confirmaciones de depósito pueden quedar bloqueadas.
- Si los secrets de WhatsApp no se configuran, las notificaciones de comprobante siguen sin funcionar (aunque ya no bloquean el deploy del resto del backend, gracias al stub `TEMPORAL`).
- **Confirmado en este deploy**: un upgrade mayor de `firebase-functions` puede cambiar el comportamiento por defecto de Gen1 vs Gen2 para funciones HTTP existentes y romper el deploy sin tocar la lógica de negocio — mitigado aquí fijando el import a `firebase-functions/v1`, pero hay que revisarlo en cualquier futuro upgrade de major version.
- Deploys grandes (~30+ funciones) pueden tropezar transitoriamente con cuota de CPU de Cloud Run por región.
- Falta de pruebas de integración para depósito Solana y expiración de puntos puede permitir regresiones no detectadas en esos dos flujos.
- Si los checkpoints de scheduler se corrompen o quedan atascados, usuarios pueden tardar en reconciliar/expirar hasta que se repare `loyaltyJobState`.

## Checklist dividido entre Codex y Claude Code

### Fase 1 - Cierre técnico sin intervención humana

- [x] Codex: revisar el commit actual y confirmar que `functions/ledger.js` quedó integrado en la rama remota.
- [x] Codex: crear o completar backfill server-side para migrar `users/{uid}/transactions` existentes a `loyaltyLedger`.
- [x] Codex: añadir tests unitarios para `ledgerDocId`, `buildPointLedgerEntry`, roles admin y validación de payloads.
- [x] Codex: añadir callable/admin job para listar discrepancias recientes de `loyaltyReconciliations`.
- [x] Codex: agregar paginación a `reconcileLoyaltyBalances` usando cursor/checkpoint.
- [x] Codex: agregar paginación a `expireLoyaltyPoints` usando cursor/checkpoint.
- [x] Codex: registrar `reward_consumed` también como evento global no monetario o documentar explícitamente por qué queda solo en historial de usuario.
- [x] Claude Code: revisar todo el diff backend de Codex con foco en riesgos, idempotencia y compatibilidad con frontend. **Encontró y arregló el bug crítico de orden lectura/escritura en 6 funciones.**
- [x] Claude Code: probar flujos manuales en emulador: compra, canje, referido, misión y bonos cubiertos por 14 tests de integración end-to-end. Depósito Solana y expiración de puntos solo revisados por código, no ejercitados en emulador.
- [x] Claude Code: revisar `js/dashboard.js`, `admin.html` y `js/user-profile.js` contra los contratos nuevos de Functions. `admin.html` corregido (roles); `dashboard.js` tiene un gap menor de manejo de errores (`resource-exhausted`) documentado en Debilidades.

### Fase 2 - Seguridad y permisos

- [x] Codex: endurecer `firestore.rules` para roles granulares si se decide mantener lecturas/escrituras directas desde admin.
- [x] Codex: centralizar permisos de Functions en un helper único: `requireRole(['admin'])`, `requireRole(['cashier'])`, etc.
- [x] Codex: añadir auditoría obligatoria para cambios en `tierRewards`, `loyaltyCampaigns` y reparaciones de reconciliación.
- [x] Codex: añadir límites diarios por usuario para bonos, depósitos y confirmaciones de compra.
- [x] Claude Code: revisar que ninguna ruta cliente pueda volver a mutar `points`, `stamps` o transacciones. Confirmado: campos protegidos bloqueados, cashier/marketing sin escritura directa a `users/{uid}`.
- [x] Claude Code: validar que los roles del panel admin no muestren acciones que el backend va a rechazar. `admin.html` ahora resuelve el rol real y bloquea en cliente las 8 acciones administrativas por rol.
- [ ] Claude Code: preparar fixtures de usuarios `superadmin`, `admin`, `cashier`, `marketing` y usuario normal como módulo reutilizable (existen ad-hoc en los tests de integración, falta formalizar).

### Fase 3 - Observabilidad y operación

- [x] Codex: crear documento de métricas operativas exactas para Cloud Monitoring.
- [x] Codex: añadir logs estructurados con `eventId`, `uid`, `orderId`, `signature`, `ledgerId` y `reconciliationId`.
- [x] Codex: crear colección `failedJobs` o `notificationFailures` para reintentos manuales.
- [x] Codex: añadir callable admin para reintentar notificaciones WhatsApp fallidas.
- [ ] Claude Code: construir panel admin de salud backend: errores, mismatches, depósitos pendientes y notificaciones fallidas. **Pendiente — siguiente tarea.**
- [ ] Claude Code: conectar el panel admin a `loyaltyReconciliations`, `loyaltyLedger` y logs operativos disponibles en Firestore. **Pendiente, depende de la anterior.**

### Fase 4 - Tests y CI

- [x] Codex: ampliar `npm test` con pruebas de helpers backend sin emulador.
- [x] Codex: crear script `npm run test:all` que agrupe unit tests, rules tests y checks de sintaxis.
- [x] Codex: documentar prerequisito Java para `npm run test:rules`.
- [x] Claude Code: instalar/configurar Java en el entorno donde corran los tests de reglas.
- [x] Claude Code: correr `npm run test:rules` y corregir cualquier regresión de Firestore Rules. 12/12 pasando.
- [x] Claude Code: configurar CI para ejecutar tests antes de merge a `main`. `.github/workflows/tests.yml` creado y **verificado corriendo en verde** en el PR #1.

### Fase 5 - Deuda técnica backend

- [x] Codex: actualizar `firebase-functions` a una versión compatible moderna y resolver breaking changes.
- [x] Codex: evaluar upgrade de runtime posterior a Node.js 20.
- [ ] Codex: separar `functions/rewards.js` en servicios pequeños: `ledgerService`, `solanaService`, `rateLimitService`, `adminService`, `campaignService`.
- [x] Codex: extraer `solanaService` inicial (`functions/solana.js`) con tests unitarios y sin llamadas RPC reales en test.
- [x] Claude Code: revisar impacto del upgrade de SDK/runtime en deploy real. **Encontró y arregló el conflicto Gen1/Gen2 de `generateGooglePassUrl`/`generateApplePass`; deploy real completado y verificado.**
- [x] Claude Code: validar compatibilidad de Wallet passes Apple/Google después del upgrade. Verificado a nivel de código (API v1 intacta, carga sin errores); verificación funcional completa pendiente de credenciales reales.

### Fase 6 - Requiere intervención humana

- [ ] Humano: proveer `WHATSAPP_TOKEN` real. **Pospuesto a propósito — se hace de último.**
- [ ] Humano: proveer `WHATSAPP_PHONE_NUMBER_ID` real. **Pospuesto a propósito — se hace de último.**
- [ ] Humano: confirmar plantilla WhatsApp aprobada para comprobantes. **Pospuesto a propósito — se hace de último.**
- [x] Humano: decidir cuándo activar Firebase App Check. **Decidido: activar registro ahora en modo solo-monitoreo (`enforceAppCheck` queda en `false`), observar 1-2 semanas de métricas reales, y recién ahí activar el bloqueo.**
- [ ] Humano: configurar App Check en Firebase Console. **Único paso que falta: registrar la app web con reCAPTCHA v3 en [Firebase Console → App Check](https://console.firebase.google.com/project/sound-bee-495502-i0/appcheck) y pasarle a Claude Code el site key generado — con eso se completa la integración en el frontend.**
- [x] Humano: autorizar deploy real de Functions. **Hecho — deploy completado y verificado en `sound-bee-495502-i0`.**
- [x] Humano: autorizar merge del PR #1 (`feature-rewards-admin` → `main`) — **Hecho, mergeado (`ef361c0`).**
- [x] Humano: definir política final de expiración de puntos. **Decidido: mantener el default actual de 365 días desde la última actividad — sin cambios de código.**
- [x] Humano: definir responsabilidad financiera del programa. **Decidido: mantener los límites actuales — 1 PADRE = 1 USD gastado, $5,000/día en compras confirmadas y $1,000/día en depósitos Solana por usuario — sin cambios de código.**

## Reparto recomendado

Codex debería tomar las tareas backend puras: ledger, reconciliación, reglas, validaciones,
tests unitarios, jobs scheduler, SDK/runtime y documentación técnica.

Claude Code debería tomar revisión cruzada, pruebas integradas, compatibilidad frontend,
panel admin, CI y preparación de lanzamiento, porque ya venía trabajando ramas y flujos
del dashboard/admin.

El humano debe quedar solo para credenciales, decisiones de lanzamiento, App Check en
consola, política de negocio y aprobación de deploy/merge.

## Changelog de esta actualización (2026-09-07, Claude Code)

- Marcadas como completadas las 8 tareas de Fase 1/2/4/5 asignadas a Claude Code que ya se ejecutaron en esta sesión.
- Documentado el bug crítico de producción encontrado y corregido (orden lectura/escritura en transacciones).
- Documentado el deploy real completado y verificado, incluyendo el fix del conflicto Gen1/Gen2.
- Documentado el CI verificado corriendo en verde sobre un PR real (#1).
- Actualizadas Fortalezas/Debilidades/Amenazas para reflejar el estado real post-deploy en vez del estado pre-deploy.
- Fase 3 (panel de salud admin) permanece sin empezar — es el bloque de trabajo más grande que queda del lado de Claude Code.

## Actualización 2 (2026-09-07, mismo día, Claude Code)

- PR #1 mergeado a `main` (`ef361c0`) — autorizado por el humano. Rama `feature-rewards-admin` borrada local y remotamente tras el merge.
- Decisiones de Fase 6 resueltas: App Check se activa ahora en modo solo-monitoreo (sin bloquear todavía), expiración de puntos se mantiene en 365 días, y los límites diarios financieros se mantienen en sus valores default ($5,000/día compras, $1,000/día depósitos, 1 PADRE = 1 USD). Ninguna requirió cambio de código porque ya eran el comportamiento vigente.
- Único pendiente de Fase 6 fuera de WhatsApp: registrar la app en Firebase Console → App Check (reCAPTCHA v3) y compartir el site key para completar la integración del frontend.
- WhatsApp (token, phone number ID, plantilla aprobada) queda pospuesto a propósito para el final, por decisión explícita del humano.
