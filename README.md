<div align="center">

# Hermes Finance Stack

**Autonomous personal & shared household finance assistant over Telegram, powered by Hermes Agent + NestJS MCP + PostgreSQL.**

[Español](docs/es/README.md) · [AI Install Guide](docs/en/TO-INSTALL.md)

</div>

A **single Hermes Agent** instance acts as your household financial interface via Telegram (direct messages or shared group chats), backed by a strongly-typed **NestJS 12 + TypeORM + PostgreSQL** MCP server with **43 tools**, native **PNG chart generation**, **CSV/JSON export**, **multi-user shared balances**, **group outings / event expense splitting**, **recurring fixed-expense tracking**, **category budgets**, **installment management**, optional **Metabase BI**, and optional **Paperless-ngx OCR & archival**.

- Hermes **never stores expenses in local memory** (`memory_enabled: false`) — PostgreSQL is the single source of truth.
- Works for **solo users, couples, or roommates** inside **one Hermes bot** (DM or Telegram group) using automatic sender detection (`**User:**` / `[sender name]`).

---

## Table of contents

- [Before you start](#before-you-start)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Core concepts](#core-concepts)
- [What you can ask (chat examples)](#what-you-can-ask-chat-examples)
- [Telegram UX & onboarding](#telegram-ux--onboarding)
- [Optional profiles (Metabase & Paperless-ngx)](#optional-profiles-metabase--paperless-ngx)
- [MCP tools reference (43 tools)](#mcp-tools-reference-43-tools)
- [Repo structure](#repo-structure)
- [Tests & migrations](#tests--migrations)
- [Troubleshooting](#troubleshooting)

---

## Before you start

All runtime services run via **Docker Compose** (no local Hermes CLI installation required on your host):

- **Docker Engine** + **Docker Compose v2** (`docker compose version`)
- An **OpenRouter API key** (supports `openrouter/free` at `$0` — remember to enable free endpoints in [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails))
- A **Telegram Bot token** from [@BotFather](https://t.me/BotFather)
- Optional for AI-assisted installation: [`docs/en/TO-INSTALL.md`](docs/en/TO-INSTALL.md) · Español: [`docs/es/PARA-INSTALAR.md`](docs/es/PARA-INSTALAR.md)

---

## Quick start

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
chmod +x scripts/setup.sh scripts/smoke-test.sh
./scripts/setup.sh
```

Or manually without the wizard:

```bash
cp .env.example .env
# Edit .env with OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN, EXPENSES_DB_PASSWORD
mkdir -p hermes/charts hermes/exports
docker compose up -d --build
```

Then verify & pair Telegram:

| Step | Command | Expected |
|---|---|---|
| 1. Check containers | `docker compose ps` | `expenses-postgres`, `expenses-api` (healthy), `hermes-agent` running |
| 2. Run smoke test | `./scripts/smoke-test.sh` | `/api/health` OK, 43 MCP tools verified, `✓ Connected` |
| 3. Pair Telegram | Send any message to your bot → `docker exec hermes-agent hermes pairing approve telegram <CODE>` | Bot replies in Telegram (skip if `TELEGRAM_ALLOWED_USERS` is set) |
| 4. Guided setup | Message the bot: *"Empecemos"* | Runs the `onboarding` skill step-by-step |
| 5. First expense | *"Gasté 45k en supermercado con débito Galicia"* | Structured `Listo ✅` confirmation |

---

## How it works

**Request path** (every message follows the same flow):

1. **Telegram (DM or Group)** — sends text, receipt screenshots, or PDF bills to `hermes-agent`.
2. **Hermes Agent (`nousresearch/hermes-agent`)** — loads `hermes/config.yaml`, `hermes/SOUL.md`, and `hermes/skills/finanzas/*`; reads digital PDFs with `read_file` or screenshots via vision.
3. **NestJS MCP Server (`expenses-api`)** — executes Streamable HTTP tools at `http://expenses-api:3000/api/mcp`, parses Argentine shorthand amounts, updates PostgreSQL, renders PNG charts (`@resvg/resvg-wasm`), and exports CSV/JSON.
4. **PostgreSQL (`expenses-postgres`)** — persists expenses, installments, credit cards, household members, shared allocations, budgets, and recurring fixed expenses.

| Layer | Role | Location |
|---|---|---|
| **Hermes Gateway** | Telegram UI, vision, PDF `anydoc`, silent reactions (`👀`/`👍`), `MEDIA:` file delivery | `./hermes/` |
| **SOUL + Skills** | Strict finance domain guardrails, mobile formatting, multi-user identification | `./hermes/SOUL.md`, `./hermes/skills/finanzas/` |
| **NestJS 12 Backend** | Modular Clean Architecture (`ExpensesModule`, `OutingsModule`, `McpModule`) + TypeORM + Chart/Export engines | `./backend/` |
| **PostgreSQL 17** | 10 relational tables (`expenses`, `expense_installments`, `credit_cards`, `members`, `expense_allocations`, `category_budgets`, `recurring_expenses`, `outings`, `outing_participants`, `outing_expenses`) | `postgres_data` volume |
| **Metabase BI (optional)** | Executive dashboards with 15 pre-calibrated SQL queries | `--profile metabase` (`:3005`) |
| **Paperless-ngx (optional)** | Async document archival & Tesseract OCR fallback (`disabled` safely in `health_check` when not enabled) | `--profile paperless` (`:8010`) |

---

## Core concepts

### 1. Multi-user & Shared Expenses in a Single Hermes

Unlike setups that spin up one Hermes container per person, **a single Hermes bot** handles multiple household members in both DMs and Telegram groups:

- Hermes Gateway injects the speaker's identity into context (`**User:** <name>` in DMs, `[sender name]` in groups).
- The `members` table maps each person (`slug`, `displayName`, `telegramUsername`, `telegramId`, `aliases`) to expenses (`paidByMemberId`) and split percentages (`expense_allocations`).
- **`PERSONAL` vs `SHARED` scope**:
  - Personal purchases default to `scope: "PERSONAL"`.
  - Shared expenses (*"compartido"*, *"mitad y mitad"*, *"del depto"*, or explicit `70/30` split) use `scope: "SHARED"` and store exact member allocations summing to `100%`.
- **Shared balance & settlements (`get_shared_balance`)**: computes each member's `totalPaid`, `totalAttributed`, `netBalance`, and minimal settlement transfers (*"who owes whom"*).

### 2. Group Outings / Event Expense Splitting ("Salidas")

Track one-off events (*"Asado sábado"*, *"Bariloche trip"*, *"Friends dinner"*) cleanly separated from your personal cashflow:

- **Multi-user or single-user entry**: works whether multiple people log their own spending in a group chat OR a single user dictates what everyone paid (*"Juan paid 45k for meat, Sofía paid 18k for drinks"*). Ad-hoc friends do **not** need Telegram accounts or household `members` records.
- **Flexible splitting**: split equally across all participants (`EQUAL`), only a subset (`splitBetween`, e.g. *"wine only between Juan and Sofía"*), or exact/percentage `customShares`.
- **Minimal settlements (`get_outing_balance`)**: computes each participant's paid vs. share and minimum transfers (*"X transfers $Y to Z"*).
- **Optional personal recording (`settle_outing`)**: settles the event and optionally records only your share into your personal `expenses`.

### 3. Fixed / Recurring Expenses

Define monthly, bimonthly, or yearly templates in `recurring_expenses` (rent, internet, utilities, subscriptions):

- Ask *"¿Qué fijos faltan pagar este mes?"* → `get_fixed_expenses_status` checks which templates are `PAID`, `PENDING`, or `OVERDUE`.
- Pay with inflation adjustment: *"Pagué internet 48 mil"* → `pay_recurring_expense` records the actual expense linked to the template with `isFixed: true`.
- `get_financial_summary` breaks down **Fixed vs Variable** spending automatically.

### 4. Installments & Card Extensions

- Supports multi-installment plans (`totalInstallments`, `intervalMonths`, `firstDueDate`) and credit card extensions (`credit_cards` with `isExtension`, `holderName`, `closingDay`, `dueDay`).
- `get_monthly_installments_summary` groups installments by `holderName` sorted descending by amount and flags finishing installments (`isLastInstallment: true` → `🏁`).
- Updating a single installment (`update_installment`) automatically recalculates the parent expense total; updating an expense total (`update_expense`) redistributes remaining balance across `PENDING` installments.

### 5. Category Budgets & Alerts

- Set monthly limits per category (`set_category_budget`) with customizable alert thresholds (default `80%`), optionally scoped to `ALL`, `PERSONAL`, `SHARED`, or a specific member.
- `get_financial_summary` automatically surfaces triggered `budgetAlerts`.

### 6. Multimodal OCR, Native PNG Charts & Exports

- **Screenshots without caption**: Hermes previews extracted fields (merchant, origin bank, amount, date, category) and asks confirmation before saving. With caption, it registers immediately.
- **Digital PDFs**: read instantaneously via `read_file` (`anydoc`); falls back to `extract_scanned_pdf_ocr` (Paperless Tesseract) only if extracted text is `<50` characters.
- **Native Telegram charts (`render_chart`)**: generates 800×480 PNG charts (`by_category`, `monthly_trend`, `top_expenses`, `fixed_vs_variable`, `by_holder`) into `/opt/data/charts` and delivers them inline via `MEDIA:`.
- **CSV / JSON exports (`export_expenses`)**: generates UTF-8 BOM CSV (Excel-ready) or JSON files into `/opt/data/exports` and sends them directly in chat.

---

## What you can ask (chat examples)

- *"Gasté 45k en supermercado con débito Galicia"*
- *"Pagué 889 mil a BBVA por transferencia desde Galicia"*
- *"Pagó Sofía 60 mil en Coto compartido entre los dos"*
- *"Compré zapatillas 300k en 3 cuotas con Visa"*
- *"Definí Alquiler como gasto fijo de 500 mil los días 5, compartido"*
- *"¿Qué fijos faltan pagar este mes?"* / *"Pagué el alquiler 520 mil"*
- *"¿Cuánto nos debemos este mes?"*
- *"Resumen de noviembre"* / *"¿Noviembre vs octubre?"*
- *"Top 5 gastos del mes"*
- *"Seteá presupuesto de 250 mil en supermercado"*
- *"Creá la salida Asado sábado con Juan, Sofía y yo"* → *"Juan pagó 45k de carne, el vino de 18k solo entre Juan y Sofía"* → *"¿Cómo dividimos el asado?"*
- *"Mandame un gráfico de gastos por categoría"* / *"Exportá noviembre en CSV"*
- *(Send a bank transfer screenshot or PDF bill directly in Telegram)*

---

## Telegram UX & onboarding

`hermes/config.yaml` is tuned for a clean, low-noise mobile chat experience:

| Setting | Effect |
|---|---|
| `display.tool_progress: "off"` | Hides internal MCP tool execution spam |
| `display.interim_assistant_messages: false` | Prevents mid-turn narration ("Let me check...") |
| `display.turn_completion_explainer: false` | Suppresses verbose turn summaries |
| `telegram.reactions: true` | Shows `👀` while processing and `👍` on completion |
| `memory.memory_enabled: false` | Forces PostgreSQL as the single source of truth |
| `skills.auto_load` | Preloads `facturas-ocr-gastos`, `monthly-summary-format`, and `onboarding` |
| `sessions.auto_archive: true` | Automatically archives idle sessions after 3 days |

The `monthly-summary-format` skill enforces **table-free** mobile formatting (Markdown tables wrap poorly on phones), grouping by holder with `🏁` for finishing installments and `📌` for fixed expenses.

---

## Optional profiles (Metabase & Paperless-ngx)

- **With Metabase BI** (`http://localhost:3005`):
  ```bash
  docker compose --profile metabase up -d --build
  ```
  Connect Metabase to PostgreSQL (`host: postgres`, `port: 5432`, `db: expenses_db`) and copy the 15 calibrated queries from [`docs/metabase-queries.sql`](docs/metabase-queries.sql).

- **With Paperless-ngx** (`http://localhost:8010`):
  ```bash
  docker compose --profile paperless up -d --build
  ```
  After first boot, generate an API token in Paperless (`My Profile -> Auth Token`), add it to `PAPERLESS_API_TOKEN` in `.env`, and run `docker compose up -d expenses-api`.

- **Full stack** (Base + Metabase + Paperless):
  ```bash
  docker compose --profile full up -d --build
  ```

---

## MCP tools reference (43 tools)

Served at `POST /api/mcp` via Streamable HTTP (`expenses` server):

| Group | Tools |
|---|---|
| **Health** (1) | `health_check` |
| **Expenses** (6) | `register_expense`, `search_expenses`, `list_recent_expenses`, `update_expense`, `delete_expense`, `extract_scanned_pdf_ocr` |
| **Installments & Cards** (8) | `get_upcoming_installments`, `get_monthly_installments_summary`, `search_pending_installments`, `pay_installment`, `update_installment`, `delete_installment`, `list_credit_cards`, `register_credit_card` |
| **Members & Shared** (5) | `create_member`, `update_member`, `list_members`, `delete_member`, `get_shared_balance` |
| **Outings / Events** (8) | `create_outing`, `list_outings`, `add_outing_participant`, `add_outing_expense`, `delete_outing_expense`, `get_outing_balance`, `settle_outing`, `delete_outing` |
| **Budgets** (4) | `set_category_budget`, `list_category_budgets`, `delete_category_budget`, `get_budget_status` |
| **Fixed / Recurring** (6) | `create_recurring_expense`, `list_recurring_expenses`, `update_recurring_expense`, `delete_recurring_expense`, `get_fixed_expenses_status`, `pay_recurring_expense` |
| **Summary & Analytics** (5) | `get_financial_summary`, `compare_months`, `top_expenses`, `export_expenses`, `render_chart` |

*(Total: 1 + 6 + 8 + 5 + 8 + 4 + 6 + 5 = **43 tools**.)*

---

## Repo structure

```text
hermes-finance-stack/
├── README.md                              # English documentation (canonical)
├── docker-compose.yml                     # Unified stack (profiles: metabase, paperless, full)
├── .env.example                           # Environment template without secrets
├── scripts/
│   ├── setup.sh                           # Interactive Docker setup wizard
│   └── smoke-test.sh                      # Health, 43-tool MCP JSON-RPC & container check
├── docs/
│   ├── metabase-queries.sql               # 15 calibrated SQL queries for Metabase BI
│   ├── en/TO-INSTALL.md                   # AI-agent installation guide (EN)
│   └── es/
│       ├── README.md                      # Documentación completa en Español
│       └── PARA-INSTALAR.md               # Guía de instalación para agentes IA (ES)
├── hermes/
│   ├── config.yaml                        # Silent UX, auto_load skills, memory off, MCP URL
│   ├── SOUL.md                            # Finance guardrails, multi-user rules, formatting
│   ├── charts/                            # PNG charts shared volume (rw in API, ro in Hermes)
│   ├── exports/                           # CSV/JSON exports shared volume
│   └── skills/finanzas/
│       ├── facturas-ocr/SKILL.md          # Complete operational finance skill
│       ├── monthly-summary-format/SKILL.md# Mobile table-free monthly summary skill
│       └── onboarding/SKILL.md            # Guided first-time setup flow
└── backend/                               # NestJS 12 + TypeORM + MCP server (TypeScript)
    ├── Dockerfile                         # Node 26 Alpine + font-dejavu for SVG->PNG
    ├── sql/
    │   ├── 001_multiuser_budgets_fixed_expenses.sql
    │   └── 002_outings.sql
    └── src/modules/
        ├── expenses/                      # Modular controllers (expenses, installments, cards, members, budgets, recurring, analytics)
        ├── outings/                       # Shared outings / group expense splitting
        └── mcp/                           # Modular Streamable HTTP MCP server (43 tools)
```

---

## Tests & migrations

### Run backend unit tests & build

```bash
cd backend
pnpm install
pnpm test    # Vitest (38 tests across 9 files, including outings, PNG charts & CSV/JSON exports)
pnpm build
```

### Idempotent PostgreSQL migration (upgrading from v1.x with `DB_SYNCHRONIZE=false`)

Use the automated migration script (takes a `pg_dump` backup first, runs `001` & `002`, and optionally normalizes legacy categories and backfills a default owner):

```bash
./scripts/migrate.sh --normalize-categories --backfill-owner "YourName"
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `openrouter/free` returns HTTP `404` | Enable free endpoints in [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails) |
| `hermes mcp test expenses` fails | Ensure `expenses-api` is healthy (`docker compose ps`) and both containers share `finance_net` |
| Telegram bot does not reply | Check `docker logs hermes-agent`; if `TELEGRAM_ALLOWED_USERS` is empty, approve pairing code |
| Charts or exports fail with `EACCES` | Verify `./hermes/charts` and `./hermes/exports` exist and match `HERMES_UID:HERMES_GID` (`1000:1000`) |
| Production DB missing new tables/columns | Run `backend/sql/001_multiuser_budgets_fixed_expenses.sql` when `DB_SYNCHRONIZE=false` |
| Paperless archival skipped | Generate a token in Paperless (`My Profile -> Auth Token`), set `PAPERLESS_API_TOKEN` in `.env`, and recreate `expenses-api` |
