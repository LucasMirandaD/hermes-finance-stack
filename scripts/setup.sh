#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================================"
echo "  Hermes Finance Stack — Interactive Setup Wizard"
echo "============================================================"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Error: Docker is not installed or not in PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Error: 'docker compose' plugin is not available."
  exit 1
fi

mkdir -p hermes/charts hermes/exports
chown -R "${HERMES_UID:-1000}:${HERMES_GID:-1000}" hermes/charts hermes/exports 2>/dev/null || true

if [[ -f .env ]]; then
  read -r -p "⚠️  .env already exists. Overwrite it? [y/N]: " OVERWRITE
  OVERWRITE="${OVERWRITE:-N}"
else
  OVERWRITE="y"
fi

if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
  cp .env.example .env

  read -r -p "🔑 OpenRouter API Key (sk-or-v1-...): " OPENROUTER_KEY
  read -r -p "🤖 Telegram Bot Token (from @BotFather): " TG_TOKEN
  read -r -p "👥 Telegram Allowed User IDs (comma-separated, or blank for pairing mode): " TG_USERS
  read -r -s -p "🗄️  PostgreSQL Password (default: change_me_strong_password_2026): " DB_PASS
  echo ""

  DB_PASS="${DB_PASS:-change_me_strong_password_2026}"

  python3 - <<PY
from pathlib import Path

env_path = Path(".env")
content = env_path.read_text(encoding="utf-8")

replacements = {
    "OPENROUTER_API_KEY": """${OPENROUTER_KEY}""",
    "TELEGRAM_BOT_TOKEN": """${TG_TOKEN}""",
    "TELEGRAM_ALLOWED_USERS": """${TG_USERS}""",
    "EXPENSES_DB_PASSWORD": """${DB_PASS}""",
}

lines = []
for line in content.splitlines():
    updated = False
    for key, val in replacements.items():
        if line.startswith(f"{key}=") and val != "":
            lines.append(f"{key}={val}")
            updated = True
            break
    if not updated:
        lines.append(line)

env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
  echo "✅ .env configured."
fi

echo ""
echo "Select deployment profile:"
echo "  1) Base stack (PostgreSQL + NestJS MCP + Hermes Agent)"
echo "  2) Base + Metabase BI (http://localhost:3005)"
echo "  3) Base + Paperless-ngx OCR (http://localhost:8010)"
echo "  4) Full stack (Base + Metabase + Paperless-ngx)"
read -r -p "Choice [1-4, default 1]: " PROFILE_CHOICE
PROFILE_CHOICE="${PROFILE_CHOICE:-1}"

COMPOSE_ARGS=()
case "$PROFILE_CHOICE" in
  2) COMPOSE_ARGS=(--profile metabase) ;;
  3) COMPOSE_ARGS=(--profile paperless) ;;
  4) COMPOSE_ARGS=(--profile full) ;;
  *) COMPOSE_ARGS=() ;;
esac

echo ""
echo "🚀 Starting Hermes Finance Stack..."
docker compose "${COMPOSE_ARGS[@]}" up -d --build

echo ""
echo "⏳ Waiting for API healthcheck..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${API_PORT:-3000}/api/health" >/dev/null 2>&1; then
    echo "✅ API is healthy!"
    break
  fi
  sleep 2
done

echo ""
echo "🎉 Setup complete! Next steps:"
echo "  1. Run smoke test: ./scripts/smoke-test.sh"
echo "  2. If TELEGRAM_ALLOWED_USERS was left empty, message your bot in Telegram and run:"
echo "     docker exec hermes-agent hermes pairing approve telegram <CODE>"
echo "  3. In Telegram, say 'Empecemos' to launch the conversational onboarding."
