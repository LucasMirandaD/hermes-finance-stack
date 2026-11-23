# Expenses Backend API & MCP Server (NestJS 12) 🚀

Backend desarrollado con **Clean Architecture & DDD** sobre **NestJS 12**, **Node 26 LTS**, **TypeORM** y **PostgreSQL**, organizado en 3 módulos independientes:
1. **`ExpensesModule`**: gastos, cuotas, tarjetas, miembros del hogar, presupuestos, gastos fijos recurrentes, gráficos PNG (`@resvg/resvg-wasm`), exportación CSV/JSON y archivado opcional en Paperless-ngx.
2. **`OutingsModule`**: salidas y eventos compartidos (multi-usuario o dictado por un solo usuario), participantes ad-hoc o vinculados, división equitativa/subconjunto/porcentual/exacta y cálculo de liquidaciones.
3. **`McpModule`**: servidor **MCP Streamable HTTP** (`/api/mcp`) con **43 herramientas** registradas de forma modular por dominio.

---

## 🗄️ Modelo de Datos (10 Tablas PostgreSQL)

- **Expenses**: `expenses`, `expense_installments`, `credit_cards`, `members`, `expense_allocations`, `category_budgets`, `recurring_expenses`
- **Outings (Salidas)**: `outings`, `outing_participants`, `outing_expenses`

Migraciones SQL idempotentes para entornos con `DB_SYNCHRONIZE=false`:
- [`sql/001_multiuser_budgets_fixed_expenses.sql`](./sql/001_multiuser_budgets_fixed_expenses.sql)
- [`sql/002_outings.sql`](./sql/002_outings.sql)

---

## 🛠️ Herramientas MCP Disponibles (`/api/mcp` — 43 Tools)

- **Core y Salud** (7): `health_check`, `register_expense`, `search_expenses`, `list_recent_expenses`, `update_expense`, `delete_expense`, `extract_scanned_pdf_ocr`
- **Cuotas y Tarjetas** (8): `get_upcoming_installments`, `get_monthly_installments_summary`, `search_pending_installments`, `pay_installment`, `update_installment`, `delete_installment`, `list_credit_cards`, `register_credit_card`
- **Miembros y Compartidos** (5): `create_member`, `update_member`, `list_members`, `delete_member`, `get_shared_balance`
- **Presupuestos** (4): `set_category_budget`, `list_category_budgets`, `delete_category_budget`, `get_budget_status`
- **Gastos Fijos / Recurrentes** (6): `create_recurring_expense`, `list_recurring_expenses`, `update_recurring_expense`, `delete_recurring_expense`, `get_fixed_expenses_status`, `pay_recurring_expense`
- **Analítica, Gráficos y Export** (5): `get_financial_summary`, `compare_months`, `top_expenses`, `export_expenses`, `render_chart`
- **Salidas / Eventos Compartidos** (8): `create_outing`, `list_outings`, `add_outing_participant`, `add_outing_expense`, `delete_outing_expense`, `get_outing_balance`, `settle_outing`, `delete_outing`

---

## 🔌 Controladores REST Modulares (`/api`)

- `GET /api/health` (`AppController`)
- `/api/expenses` (`ExpensesController`): `POST /`, `GET /`, `GET /search`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- `/api/installments` (`InstallmentsController`): `GET /upcoming`, `GET /summary`, `GET /pending`, `POST /:id/pay`, `PATCH /:id`, `DELETE /:id`
- `/api/credit-cards` (`CreditCardsController`): `GET /`, `POST /`
- `/api/members` (`MembersController`): `GET /`, `POST /`, `GET /shared/balance`, `PATCH /:ref`, `DELETE /:ref`
- `/api/budgets` (`BudgetsController`): `GET /`, `POST /`, `GET /status`, `DELETE /:id`
- `/api/recurring-expenses` (`RecurringExpensesController`): `GET /`, `POST /`, `GET /status`, `POST /:ref/pay`, `PATCH /:id`, `DELETE /:id`
- `/api/analytics` (`AnalyticsController`): `GET /summary`, `GET /compare`, `GET /top`, `GET /export`, `GET /charts/render`
- `/api/outings` (`OutingsController`): `POST /`, `GET /`, `GET /:ref/balance`, `POST /:ref/participants`, `POST /:ref/expenses`, `DELETE /expenses/:expenseId`, `POST /:ref/settle`, `DELETE /:ref`
- `POST /api/mcp` (`McpController`) — Endpoint Streamable HTTP de MCP

---

## 🧪 Tests y Compilación

```bash
pnpm install --frozen-lockfile
pnpm test     # Vitest (38 tests unitarios en 9 archivos)
pnpm build    # Compilación NestJS / TypeScript
```
