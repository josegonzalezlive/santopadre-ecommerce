# Cloud Monitoring - Metricas Backend Loyalty

Fecha: 2026-09-07

Este documento define las metricas de logs recomendadas para operar el backend de
loyalty rewards. Las alert policies deben crearse en Google Cloud Monitoring despues
del deploy real.

## Metricas de errores

```bash
gcloud logging metrics create loyalty_rewards_function_errors \
  --description="Errores en Cloud Functions de loyalty rewards" \
  --log-filter='resource.type="cloud_function" AND severity>=ERROR AND (jsonPayload.component="loyalty_rewards" OR jsonPayload.component="loyalty_referrals" OR jsonPayload.component="loyalty_notifications")'
```

Alerta recomendada:

- Condicion: `logging.googleapis.com/user/loyalty_rewards_function_errors > 0`
- Ventana: 5 minutos
- Severidad: Critical

## Fallos de WhatsApp

```bash
gcloud logging metrics create loyalty_comprobante_failures \
  --description="Fallos al enviar comprobantes WhatsApp de depositos" \
  --log-filter='resource.type="cloud_function" AND (jsonPayload.component="loyalty_rewards" OR jsonPayload.component="loyalty_notifications") AND (jsonPayload.message="comprobante_notification_failed" OR jsonPayload.message="comprobante_notification_retry_failed" OR jsonPayload.message="comprobante_notification_retry_blocked")'
```

Alerta recomendada:

- Condicion: `logging.googleapis.com/user/loyalty_comprobante_failures > 0`
- Ventana: 5 minutos
- Severidad: High
- Accion operativa: revisar `notificationFailures` y usar `adminRetryComprobanteNotification`.

## Mismatches de reconciliacion

```bash
gcloud logging metrics create loyalty_reconciliation_mismatches \
  --description="Diferencias entre users.points y loyaltyLedger" \
  --log-filter='resource.type="cloud_function" AND jsonPayload.component="loyalty_rewards" AND jsonPayload.message="loyalty_reconciliation_batch" AND jsonPayload.mismatches>0'
```

Alerta recomendada:

- Condicion: `logging.googleapis.com/user/loyalty_reconciliation_mismatches > 0`
- Ventana: 15 minutos
- Severidad: High
- Accion operativa: listar `loyaltyReconciliations` y usar `adminReconcileUserLoyalty`.

## Transacciones invalidas en backfill

```bash
gcloud logging metrics create loyalty_backfill_invalid_transactions \
  --description="Transacciones historicas que no pudieron migrarse al ledger global" \
  --log-filter='resource.type="cloud_function" AND jsonPayload.component="loyalty_rewards" AND jsonPayload.message="loyalty_ledger_backfill_invalid_transaction"'
```

Alerta recomendada:

- Condicion: `logging.googleapis.com/user/loyalty_backfill_invalid_transactions > 0`
- Ventana: 1 hora
- Severidad: Medium

## Rate limits y limites diarios

```bash
gcloud logging metrics create loyalty_resource_exhausted_errors \
  --description="Solicitudes bloqueadas por rate limit o limites diarios" \
  --log-filter='resource.type="cloud_function" AND ((jsonPayload.component="loyalty_rewards" AND jsonPayload.message="loyalty_daily_limit_exceeded") OR (severity>=ERROR AND textPayload:"resource-exhausted"))'
```

Alerta recomendada:

- Condicion: crecimiento anomalo frente a linea base.
- Severidad: Medium.
- Accion operativa: revisar `rateLimits` y `loyaltyDailyLimits`.

## Campos clave para logs

Los eventos nuevos deben incluir cuando aplique:

- `eventId`
- `userId` o `uid`
- `orderId`
- `signature`
- `ledgerId`
- `reconciliationId`
- `failureId`
- `actorRole`
