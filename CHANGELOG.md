# Changelog

All notable changes to **Hermes Finance Stack** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-23

### Added
- **Multi-User & Shared Expenses in a Single Hermes**: `members` and `expense_allocations` tables, `scope` (`PERSONAL` | `SHARED`), automatic Telegram sender identification (`**User:**` in DMs, `[sender]` in groups), and `get_shared_balance` with minimal settlement transfers.
- **Group Outings / Event Expense Splitting ("Salidas")**: standalone `OutingsModule` (`outings`, `outing_participants`, `outing_expenses`) supporting multi-user or single-user entry, ad-hoc friends, equal/subset/exact/percentage splits, minimal settlements (`get_outing_balance`), and optional personal expense recording on close (`settle_outing`).
- **Fixed / Recurring Expenses**: `recurring_expenses` templates (`MONTHLY`, `BIMONTHLY`, `YEARLY`), `is_fixed` flag on `expenses`, pending/overdue status checks (`get_fixed_expenses_status`), and inflation-friendly monthly payment recording (`pay_recurring_expense`).
- **Category Budgets & Alerts**: `category_budgets` with configurable alert thresholds (`set_category_budget`, `get_budget_status`) surfaced automatically in `get_financial_summary`.
- **Native PNG Charts & CSV/JSON Exports for Telegram**: `render_chart` (`@resvg/resvg-wasm` + `font-dejavu` in Docker, zero native C++ build) and `export_expenses` (UTF-8 BOM CSV / JSON) delivered via Hermes `MEDIA:` shared volumes (`/opt/data/{charts,exports}`).
- **Analytics & Quick Wins**: `health_check`, `register_credit_card`, `get_monthly_installments_summary` (grouped by `byHolder` with `isLastInstallment`), `compare_months`, and `top_expenses`.
- **Hermes Silent Telegram UX & Skills**: `interim_assistant_messages: false`, `turn_completion_explainer: false`, `telegram.reactions: true`, `memory_enabled: false`, `sessions.auto_archive: true`, `skills.auto_load`, mobile table-free `monthly-summary-format` skill, and conversational `onboarding` skill.
- **Scripts & Bilingual Documentation**: interactive `scripts/setup.sh`, `scripts/smoke-test.sh`, `scripts/migrate.sh`, bilingual `README.md` (EN) + `docs/es/README.md` (ES), AI install guides (`TO-INSTALL.md` / `PARA-INSTALAR.md`), and 5 new Metabase SQL queries (#11–#15).

### Changed
- **Modular NestJS Architecture (Breaking REST Routes)**: split monolithic `ExpensesController` into dedicated controllers (`/api/expenses`, `/api/installments`, `/api/credit-cards`, `/api/members`, `/api/budgets`, `/api/recurring-expenses`, `/api/analytics`, `/api/outings`) and extracted `McpModule` with 7 modular tool registrars (**43 MCP tools** total).
- **Variable Stack & Optional Paperless**: `health_check` reports `optionalServices.paperless: { enabled, status }` (`disabled` when `PAPERLESS_API_TOKEN` is unset) without probing or degrading overall API health.
- **Extension Card Grouping**: `getHolderLabel` prioritizes extension card `holderName` so extension purchases remain grouped under the extension holder even when `paidByMember` is the primary card owner.

## [1.0.0] - 2026-11-11

### Added
- Initial unified `hermes-finance-stack` monorepo with PostgreSQL, NestJS 12 + TypeORM backend (13 MCP tools), NousResearch Hermes Agent, optional Metabase BI (10 SQL queries), and optional Paperless-ngx OCR archival.
