# Control de costos y presupuesto de IA (S-5)

Documento operativo del kill-switch de presupuesto y la alerta de Cloud Billing.
Sección 35 del master plan: "Alerta de presupuesto | Cloud Monitoring alerta al 80%".

## 1. Kill-switch en código (bloqueo solo de generación)

`functions/index.js` mantiene un acumulador mensual por documento de Firestore:

- **Colección:** `budget-usage/{YYYY-MM}` con campo `totalCost` (USD).
- **Config:** `MONTHLY_BUDGET_USD` (env, default 100) y `BUDGET_SOFT_LIMIT_PCT = 0.8`.
- **Antes de generar:** `getMonthlyBudgetUsage()` + `isOverBudget()` → si `totalCost >= budget * 0.8`
  se lanza `PRESUPUESTO_ALCANZADO` y **solo se bloquea la generación** (el resto de la app sigue).
- **Después de generar:** `recordBudgetUsage(cost)` suma el costo de forma transaccional.

El deploy escribe `MONTHLY_BUDGET_USD` desde el secreto de GitHub Actions
(`MONTHLY_BUDGET_USD`, default `100`) a `functions/.env`.

## 2. Alerta de Cloud Billing (80%)

Para configurar la alerta del presupuesto mensual de GCP:

1. Consola GCP → **Billing** → **Budgets & alerts** → **Create budget**.
2. Alcance: proyecto `planificacion-con-ia`.
3. Monto: el presupuesto mensual deseado (ej. 100 USD).
4. Umbrales de alerta:
   - **80%** del presupuesto → notificar por email.
   - **100%** → notificar (opcional).
5. Destinatarios: email del dueño del proyecto (y opcionalmente un canal de Slack/webhook).

> Nota: la alerta de Cloud Billing es **informativa** (notifica al 80%). El
> **bloqueo** real de generación lo aplica el kill-switch del punto 1, que actúa
> sobre el acumulador `budget-usage` escrito por las Cloud Functions. Ambos
> mecanismos son complementarios.

## 3. Monitoreo del uso

- Consultar el acumulador actual:
  ```
  node scripts/verify-budget.mjs
  ```
  (script auxiliar; si no existe, leer el doc `budget-usage/{mes-actual}` en Firestore
  con el Admin SDK usando `GOOGLE_APPLICATION_CREDENTIALS`).
- Los costos por generación quedan además en `ai-costs` (userId, date, provider,
  cost, qualityScore) y en `audit-logs` (durationMs).

## 4. Reglas Firestore

`budget-usage` es de **escritura exclusiva desde Cloud Functions** (`allow write: if false`)
y lectura solo admin. No hay acceso directo desde el cliente.
