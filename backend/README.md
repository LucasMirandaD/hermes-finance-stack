# Expenses Backend API & MCP Server (NestJS 12) 🚀

Backend desarrollado con **Clean Architecture & DDD** sobre **NestJS 12**, **Node 26 LTS**, **TypeORM** y **PostgreSQL**, que expone:
1. **API REST** (`/api/expenses/*`, `/api/health`)
2. **Servidor MCP Streamable HTTP** (`/api/mcp`) para **Hermes Agent**, con **35 herramientas** tipadas mediante **Zod** (`@modelcontextprotocol/sdk`).
3. **Generación de Gráficos PNG** (`@resvg/resvg-wasm` + `font-dejavu`) y **Exportación CSV/JSON** en `/opt/data/{charts,exports}`.
4. **Archivado asíncrono y OCR fallback** en **Paperless-ngx** (`PaperlessService`).

---

## 🗄️ Modelo de Datos (7 Tablas PostgreSQL)

- `expenses`: gastos, alcance (`PERSONAL` / `SHARED`), flag `is_fixed`, `paid_by_member_id`, `recurring_expense_id`, cuotas y `paperless_document_id`.
- `expense_installments`: plan de cuotas con estados `PENDING`, `PAID`, `CANCELLED`.
- `credit_cards`: tarjetas titulares y extensiones familiares (`closing_day`, `due_day`, `holder_name`).
- `members`: miembros del hogar (`slug`, `display_name`, `telegram_username`, `telegram_id`, `aliases`).
- `expense_allocations`: reparto porcentual y en monto por miembro para gastos compartidos.
- `category_budgets`: presupuestos mensuales por categoría, moneda, alcance y umbral de alerta.
- `recurring_expenses`: plantillas de gastos fijos (`MONTHLY`, `BIMONTHLY`, `YEARLY`) con día de vencimiento y monto estimado.

Migración SQL idempotente para entornos con `DB_SYNCHRONIZE=false`: [`sql/001_multiuser_budgets_fixed_expenses.sql`](./sql/001_multiuser_budgets_fixed_expenses.sql).

---

## 🛠️ Herramientas MCP Disponibles (`/api/mcp` — 35 Tools)

- **Salud**: `health_check`
- **Gastos**: `register_expense`, `search_expenses`, `list_recent_expenses`, `update_expense`, `delete_expense`, `extract_scanned_pdf_ocr`
- **Cuotas y Tarjetas**: `get_upcoming_installments`, `get_monthly_installments_summary`, `search_pending_installments`, `pay_installment`, `update_installment`, `delete_installment`, `list_credit_cards`, `register_credit_card`
- **Miembros y Compartidos**: `create_member`, `update_member`, `list_members`, `delete_member`, `get_shared_balance`
- **Presupuestos**: `set_category_budget`, `list_category_budgets`, `delete_category_budget`, `get_budget_status`
- **Gastos Fijos / Recurrentes**: `create_recurring_expense`, `list_recurring_expenses`, `update_recurring_expense`, `delete_recurring_expense`, `get_fixed_expenses_status`, `pay_recurring_expense`
- **Analítica, Gráficos y Export**: `get_financial_summary`, `compare_months`, `top_expenses`, `export_expenses`, `render_chart`

---

## 🔌 Endpoints REST Principales (`/api`)

- `GET /api/health` — Estado del servicio
- `POST /api/expenses` | `GET /api/expenses` — Alta y listado de gastos
- `GET /api/expenses/summary` — Resumen ejecutivo (`month`, `startDate`, `endDate`, `scope`, `memberRef`, `isFixed`)
- `GET /api/expenses/search` — Búsqueda por `q`, `category`, fechas
- `GET /api/expenses/compare` | `GET /api/expenses/top` | `GET /api/expenses/export` | `GET /api/expenses/charts/render`
- `GET / POST /api/expenses/members` | `PATCH / DELETE /api/expenses/members/:ref` | `GET /api/expenses/shared/balance`
- `GET / POST /api/expenses/budgets` | `GET /api/expenses/budgets/status` | `DELETE /api/expenses/budgets/:id`
- `GET / POST /api/expenses/recurring` | `GET /api/expenses/recurring/status` | `POST /api/expenses/recurring/:ref/pay` | `PATCH / DELETE /api/expenses/recurring/:id`
- `GET /api/expenses/installments/{upcoming,summary,pending}` | `POST /api/expenses/installments/:id/pay` | `PATCH / DELETE /api/expenses/installments/:id`
- `GET / POST /api/expenses/cards` — Tarjetas registradas
- `POST /api/mcp` — Endpoint Streamable HTTP de MCP

---

## 🧪 Tests y Compilación

```bash
pnpm install --frozen-lockfile
pnpm test     # Vitest (29 tests unitarios en 6 archivos)
pnpm build    # Compilación NestJS / TypeScript
```
