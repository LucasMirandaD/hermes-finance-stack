# Changelog

Notable changes to **Hermes Finance Stack** follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2026-11-23

### Fixed
- **Installment Amount vs. Purchase Total Disambiguation**: Added `installmentAmount` and `amountType` (`'TOTAL' | 'PER_INSTALLMENT'`) to `CreateExpenseDto`, `ExpensesService.registerExpense`, and the `register_expense` MCP tool so phrases like *"12 cuotas de 2000"* compute `totalAmount = 24000` (with 12 × `$2.000` installments) instead of dividing `2000 / 12`.
- **Shared Installment Allocations**: `SHARED` allocation amounts are now computed against the resolved `totalAmount` when `installmentAmount` or `PER_INSTALLMENT` is supplied.
- **Hermes Prompt Rules (`SOUL.md`)**: Added explicit rules to distinguish per-installment amounts vs. purchase totals, ask a single clarifying question if ambiguous, and display both total and per-installment amounts in confirmations.

### Tests
- Added 4 Vitest unit tests in `expenses.service.spec.ts` covering `installmentAmount`, `amountType: 'PER_INSTALLMENT'`, `amountType: 'TOTAL'`, and `SHARED` installment allocations (**42/42 tests passing** across 9 suites).

## [2.0.1] - 2026-11-23

### Changed
- **PostgreSQL 18 Upgrade**: Updated `docker-compose.yml` from `postgres:17-alpine` to `postgres:18-alpine` using the official PostgreSQL 18+ volume mount path (`postgres_data:/var/lib/postgresql`).
- **Flagship Bilingual Documentation**: Expanded `README.md` and `README.es.md` with full capability matrices, 6 end-to-end Telegram scenarios, 10-table Mermaid ER schema, LLM model/cost guide, security architecture, and full visible MCP/REST references.
- **Onboarding Skill Polish**: Updated tool count reference in `hermes/skills/finanzas/onboarding/SKILL.md` to 43 tools.

### Added
- **Real Native PNG Chart Previews**: Rendered and embedded 3 authentic `@resvg/resvg-wasm` charts (`docs/assets/chart-by-category.png`, `chart-monthly-trend.png`, `chart-top-expenses.png`) directly in both READMEs.
- **PostgreSQL 17 → 18 Upgrade Runbook**: Documented dump/restore steps and volume mount changes in `docs/DEPLOYMENT.md`.

## [2.0.0] - 2026-11-23

### Added
- **Single-Hermes Multi-User & Shared Balances**: `members` and `expense_allocations` tables, `PERSONAL`/`SHARED` scopes, automatic Telegram sender identification (DMs and groups), and `get_shared_balance` with minimal settlement transfers.
- **Group Outings (`OutingsModule`)**: Isolated event splitting (`outings`, `outing_participants`, `outing_expenses`) supporting multi-user or single-user entry for ad-hoc friends, equal/subset/exact/percentage splits, minimal transfers (`get_outing_balance`), and optional personal expense recording on close (`settle_outing`).
- **Fixed / Recurring Expenses**: `recurring_expenses` templates (`MONTHLY`, `BIMONTHLY`, `YEARLY`), `is_fixed` expense flag, monthly pending/overdue tracking (`get_fixed_expenses_status`), and inflation-adjusted payment logging (`pay_recurring_expense`).
- **Category Budgets & Alerts**: `category_budgets` with configurable warning thresholds integrated into `get_financial_summary`.
- **Native PNG Charts & CSV/JSON Exports**: `@resvg/resvg-wasm` + `font-dejavu` chart renderer (`render_chart`) and UTF-8 BOM CSV/JSON exporter (`export_expenses`) delivered directly in Telegram via `MEDIA:` shared volumes.
- **Analytics & Card Onboarding**: `health_check`, `register_credit_card`, `get_monthly_installments_summary` (grouped by holder with `isLastInstallment`), `compare_months`, and `top_expenses`.
- **Hermes Silent UX & Mobile Skills**: Silent tool execution, `👀`/`👍` Telegram reactions, `memory_enabled: false`, `sessions.auto_archive`, `skills.auto_load`, table-free `monthly-summary-format` skill, and conversational `onboarding` skill.
- **Operations Tooling**: `scripts/setup.sh`, `scripts/migrate.sh`, `scripts/smoke-test.sh`, `docs/DEPLOYMENT.md`, bilingual `README.md` / `README.es.md`, and 5 new Metabase SQL queries (#11–#15).

### Changed
- **Modular NestJS 12 Controllers (Breaking REST Routes)**: Split `ExpensesController` into 8 resource controllers (`/api/expenses`, `/api/installments`, `/api/credit-cards`, `/api/members`, `/api/budgets`, `/api/recurring-expenses`, `/api/analytics`, `/api/outings`) and extracted `McpModule` with 7 domain registrars (**43 MCP tools**).
- **Optional Stack Health Check**: `health_check` reports `optionalServices.paperless: { enabled, status }` (`disabled` when `PAPERLESS_API_TOKEN` is unset) without probing or degrading core health.
- **Extension Card Grouping**: Preserves extension `holderName` grouping in monthly summaries even when `paidByMember` is set to the primary cardholder.

## [1.0.0] - 2026-11-11

### Added
- Initial Docker Compose stack with PostgreSQL, NestJS 12 + TypeORM (13 MCP tools), NousResearch Hermes Agent, optional Metabase BI (10 SQL queries), and optional Paperless-ngx archival.
