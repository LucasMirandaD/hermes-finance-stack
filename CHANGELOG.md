# Changelog

Notable changes to **Hermes Finance Stack** follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
