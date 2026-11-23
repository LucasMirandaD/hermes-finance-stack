# AI Agent Installation Guide — Hermes Finance Stack

Follow these exact steps when installing or upgrading **Hermes Finance Stack** on a Linux/macOS/WSL2 host.

## 1. Prerequisites Check

Verify Docker and Docker Compose v2 are available:

```bash
docker --version
docker compose version
```

If missing, ask the user to install Docker Engine + Compose plugin before proceeding.

## 2. Clone & Prepare Directories

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
mkdir -p hermes/charts hermes/exports
chmod +x scripts/setup.sh scripts/smoke-test.sh
```

Ensure `hermes/charts` and `hermes/exports` are writable by UID/GID `1000:1000` (the non-root `node` user in `expenses-api` and `HERMES_UID`/`HERMES_GID` in `hermes-agent`).

## 3. Environment Configuration (`.env`)

Never invent secrets or overwrite an existing `.env` without user confirmation.

```bash
cp .env.example .env
```

Ask the user for:
1. `OPENROUTER_API_KEY` (remind them to allow `:free` endpoints in OpenRouter Guardrails if using `openrouter/free`)
2. `TELEGRAM_BOT_TOKEN` (from `@BotFather`)
3. `EXPENSES_DB_PASSWORD` (strong database password)
4. Optional `TELEGRAM_ALLOWED_USERS` (comma-separated numeric Telegram IDs; leave empty to use secure pairing mode)

## 4. Launch Stack

- Base stack: `docker compose up -d --build`
- With Metabase BI: `docker compose --profile metabase up -d --build`
- With Paperless-ngx OCR: `docker compose --profile paperless up -d --build`
- Full stack: `docker compose --profile full up -d --build`

### Upgrading an existing database with `DB_SYNCHRONIZE=false`

Always take a `pg_dump` backup first and apply the idempotent migration before restarting `expenses-api`:

```bash
docker exec expenses-postgres pg_dump -U expenses_user expenses_db > backup_before_migration.sql
docker exec -i expenses-postgres psql -U expenses_user -d expenses_db \
  < backend/sql/001_multiuser_budgets_fixed_expenses.sql
docker exec -i expenses-postgres psql -U expenses_user -d expenses_db \
  < backend/sql/002_outings.sql
```

## 5. Verification

Run the smoke test script:

```bash
./scripts/smoke-test.sh
```

Expected output:
- `GET /api/health` returns `{"status":"ok",...}`
- `POST /api/mcp` `tools/list` returns `43` tools
- `tools/call` `health_check` reports `database.connected: true` (`optionalServices.paperless.status` will be `"disabled"` when running without `--profile paperless`, which is expected)
- `docker exec hermes-agent hermes mcp test expenses` succeeds with 43 tools connected

## 6. Post-Install Telegram Pairing

If `TELEGRAM_ALLOWED_USERS` was left empty:
1. Ask the user to send a message to their Telegram bot.
2. Take the 8-character pairing code returned by the bot and run:
   ```bash
   docker exec hermes-agent hermes pairing approve telegram <CODE>
   ```
3. Tell the user to message **"Empecemos"** in Telegram to run the conversational `onboarding` skill (members, cards, fixed expenses, budgets).
