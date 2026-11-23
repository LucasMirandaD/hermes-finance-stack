# Deployment, Operations & Upgrades

Operational runbook for deploying, verifying, backing up, and upgrading **Hermes Finance Stack** in self-hosted Docker environments.

---

## 1. Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- OpenRouter API key (`OPENROUTER_API_KEY`) — if using `openrouter/free`, enable `:free` models in [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails)
- Telegram Bot token (`TELEGRAM_BOT_TOKEN`) from `@BotFather`

---

## 2. Fresh Installation

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
mkdir -p hermes/charts hermes/exports
chown -R 1000:1000 hermes/charts hermes/exports 2>/dev/null || true
chmod +x scripts/*.sh
```

Run the interactive wizard or configure `.env` manually:

```bash
./scripts/setup.sh
```

### Optional Profiles

- **Base only**: `docker compose up -d --build`
- **Metabase BI (`:3005`)**: `docker compose --profile metabase up -d --build`
  - Connect to PostgreSQL (`host: postgres`, `port: 5432`, `db: expenses_db`) and import queries from [`metabase-queries.sql`](metabase-queries.sql).
- **Paperless-ngx (`:8010`)**: `docker compose --profile paperless up -d --build`
  - After first boot, generate an Auth Token under Paperless `My Profile`, set `PAPERLESS_API_TOKEN` in `.env`, and run `docker compose up -d expenses-api`.
- **Full stack**: `docker compose --profile full up -d --build`

> **Note on variable stacks**: `health_check` only requires PostgreSQL. When `PAPERLESS_API_TOKEN` is unset, Paperless is reported as `{ "enabled": false, "status": "disabled" }` without probing or degrading service health.

---

## 3. Verification & Telegram Pairing

Run the automated smoke test:

```bash
./scripts/smoke-test.sh
```

It validates:
1. `GET /api/health` returns `200 OK`
2. `POST /api/mcp` discovers all **43 tools** and `health_check` reports `database.connected: true`
3. `docker exec hermes-agent hermes mcp test expenses` connects cleanly inside the Docker network

If `TELEGRAM_ALLOWED_USERS` was left empty, message your Telegram bot and approve the pairing code:

```bash
docker exec hermes-agent hermes pairing approve telegram <CODE>
```

For multi-user access in a single Hermes instance, either approve each user's pairing code or set comma-separated Telegram numeric IDs in `TELEGRAM_ALLOWED_USERS`.

---

## 4. Upgrading from v1.x to v2.0.0 (`DB_SYNCHRONIZE=false`)

When running in production with `DB_SYNCHRONIZE=false`, apply the idempotent schema migrations before restarting the backend:

```bash
git pull origin main
mkdir -p hermes/charts hermes/exports
./scripts/migrate.sh --normalize-categories --backfill-owner "YourName"
docker compose up -d --build
./scripts/smoke-test.sh
```

`scripts/migrate.sh` automatically:
1. Creates a timestamped `pg_dump` backup in `/tmp`
2. Runs `backend/sql/001_multiuser_budgets_fixed_expenses.sql` and `backend/sql/002_outings.sql`
3. Optionally normalizes legacy categories (`SUPERMERCADOS`, `GASTRONOMIA`, `PRESTAMOS_Y_CUOTAS`)
4. Optionally creates a default member and backfills `paid_by_member_id` for existing expenses

---

## 5. Backups & Permissions

- **Database backup**:
  ```bash
  docker exec expenses-postgres pg_dump -U expenses_user expenses_db > backup_$(date +%Y%m%d).sql
  ```
- **Shared artifact volumes**: `expenses-api` runs as non-root `node` (`1000:1000`) and mounts `./hermes:/opt/data:ro` alongside writable `./hermes/charts:/opt/data/charts:rw` and `./hermes/exports:/opt/data/exports:rw`. Keep both directories owned by `HERMES_UID:HERMES_GID` (`1000:1000`).
