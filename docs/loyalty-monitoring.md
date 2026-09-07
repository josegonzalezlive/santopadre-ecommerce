# Loyalty Rewards - Monitoreo y Alertas

## Prerrequisitos

1. Habilitar Secret Manager API en el proyecto Firebase/Google Cloud.
2. Crear `WHATSAPP_TOKEN`.
3. Crear `WHATSAPP_PHONE_NUMBER_ID`.
4. Confirmar que existe una plantilla aprobada de WhatsApp para `comprobante_recibido` o configurar `WHATSAPP_COMPROBANTE_TEMPLATE`.
5. Configurar Firebase App Check en consola/frontend antes de activar `ENFORCE_APP_CHECK=true`.

```bash
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
firebase deploy --only functions
```

## Logs Estructurados

Componentes:

- `component="loyalty_rewards"`
- `component="loyalty_referrals"`
- `component="loyalty_notifications"`

Eventos principales:

- `welcome_bonus_initialized`
- `purchase_confirmed`
- `solana_deposit_confirmed`
- `reward_redeemed`
- `referral_completed`
- `comprobante_notification_sent`
- `comprobante_notification_skipped`
- `comprobante_notification_failed`
- `points_expired_batch`
- `loyalty_reconciliation_batch`
- `loyalty_balance_reconciled`

## Filtros Recomendados

Errores de loyalty:

```text
resource.type="cloud_function"
severity>=ERROR
(
  jsonPayload.component="loyalty_rewards" OR
  jsonPayload.component="loyalty_referrals" OR
  jsonPayload.component="loyalty_notifications"
)
```

Fallos de comprobantes:

```text
resource.type="cloud_function"
jsonPayload.component="loyalty_notifications"
jsonPayload.message="comprobante_notification_failed"
```

## Metricas con gcloud

```bash
gcloud logging metrics create loyalty_rewards_function_errors \
  --description="Errores en Cloud Functions de loyalty rewards" \
  --log-filter='resource.type="cloud_function" AND severity>=ERROR AND (jsonPayload.component="loyalty_rewards" OR jsonPayload.component="loyalty_referrals" OR jsonPayload.component="loyalty_notifications")'

gcloud logging metrics create loyalty_comprobante_failures \
  --description="Fallos al notificar comprobantes de deposito" \
  --log-filter='resource.type="cloud_function" AND jsonPayload.component="loyalty_notifications" AND jsonPayload.message="comprobante_notification_failed"'
```

Crear alert policies en Cloud Monitoring sobre:

- `logging.googleapis.com/user/loyalty_rewards_function_errors` > 0 durante 5 minutos.
- `logging.googleapis.com/user/loyalty_comprobante_failures` > 0 durante 5 minutos.
- `loyalty_reconciliation_batch` con `mismatches > 0` debe abrir revisión operativa.

## Reconciliación

`loyaltyLedger` es la fuente auditable de movimientos PADRE. `users/{uid}.points` es
un saldo cacheado para lectura rápida de dashboard.

- Job automático: `reconcileLoyaltyBalances`, cada 6 horas, revisa hasta 200 usuarios
  por ejecución y escribe diferencias en `loyaltyReconciliations`.
- Reparación manual: `adminReconcileUserLoyalty({ userId, repair: true })`, disponible
  solo para `admin`/`superadmin`.
- La reparación ajusta el saldo cacheado contra el ledger y registra `audit_logs`; no
  crea un movimiento artificial en el ledger.

## Analitica de Embudo

`trackLoyaltyEvent` escribe en `loyalty_events`.

KPIs base:

- `earn_view`: usuarios que abren Ganar.
- `earn_submit`: usuarios que envian evidencia.
- `redeem_view`: usuarios que abren Canjear.
- `redeem_success`: canjes exitosos.
- `purchase_points_success`: compras verificadas con puntos.
