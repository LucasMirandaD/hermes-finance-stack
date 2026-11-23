# Guía de Instalación para Agentes IA — Hermes Finance Stack

Seguí estos pasos en orden cuando instales o actualices **Hermes Finance Stack** en un servidor o máquina con Docker.

## 1. Verificar Prerequisitos

Confirmá que Docker y Docker Compose v2 estén instalados:

```bash
docker --version
docker compose version
```

Si falta alguno, pedile al usuario que los instale antes de continuar.

## 2. Clonar y Preparar Carpetas Compartidas

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
mkdir -p hermes/charts hermes/exports
chmod +x scripts/setup.sh scripts/smoke-test.sh
```

Asegurate de que `hermes/charts` y `hermes/exports` tengan permisos de escritura para `1000:1000` (usuario `node` no-root en `expenses-api` y `HERMES_UID`/`HERMES_GID` en `hermes-agent`).

## 3. Configurar `.env`

Nunca inventes secretos ni pises un `.env` existente sin confirmar con el usuario.

```bash
cp .env.example .env
```

Solicitá al usuario:
1. `OPENROUTER_API_KEY` (recordale habilitar endpoints `:free` en OpenRouter Guardrails si usa `openrouter/free`)
2. `TELEGRAM_BOT_TOKEN` (de `@BotFather`)
3. `EXPENSES_DB_PASSWORD` (contraseña segura para PostgreSQL)
4. Opcional `TELEGRAM_ALLOWED_USERS` (IDs numéricos separados por coma para multi-usuario, o vacío para modo pairing seguro)

## 4. Levantar el Stack

- Stack base: `docker compose up -d --build`
- Con Metabase BI: `docker compose --profile metabase up -d --build`
- Con Paperless-ngx OCR: `docker compose --profile paperless up -d --build`
- Stack completo: `docker compose --profile full up -d --build`

### Actualización sobre base existente con `DB_SYNCHRONIZE=false`

Hacé siempre un backup `pg_dump` previo y corré la migración idempotente antes de levantar el nuevo backend:

```bash
docker exec expenses-postgres pg_dump -U expenses_user expenses_db > backup_antes_migracion.sql
docker exec -i expenses-postgres psql -U expenses_user -d expenses_db \
  < backend/sql/001_multiuser_budgets_fixed_expenses.sql
```

## 5. Verificación

Ejecutá el smoke test:

```bash
./scripts/smoke-test.sh
```

Salida esperada:
- `GET /api/health` responde `{"status":"ok",...}`
- `POST /api/mcp` `tools/list` devuelve `35` herramientas
- `tools/call` `health_check` reporta `database.connected: true`
- `docker exec hermes-agent hermes mcp test expenses` reporta 35 tools conectadas

## 6. Pairing Inicial en Telegram

Si `TELEGRAM_ALLOWED_USERS` quedó vacío:
1. Pedile al usuario que envíe cualquier mensaje a su bot en Telegram.
2. Tomá el código de 8 caracteres y aprobá:
   ```bash
   docker exec hermes-agent hermes pairing approve telegram <CODIGO>
   ```
3. Indicá al usuario que escriba **"Empecemos"** en Telegram para iniciar la skill conversacional `onboarding` (miembros, tarjetas, gastos fijos y presupuestos).
