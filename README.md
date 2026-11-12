# Hermes Finance Stack 🤖💳📊

Asistente financiero personal autónomo por **Telegram** basado en **Hermes Agent (NousResearch)** conectado vía **MCP (Model Context Protocol)** a una API **NestJS 12 + PostgreSQL**, con soporte multimodal para capturas bancarias y facturas PDF, dashboards ejecutivos en **Metabase** y archivado documental opcional en **Paperless-ngx**.

---

## 🏗️ Arquitectura

```text
Telegram (texto / foto / PDF)
   │
   ▼
Hermes Agent Oficial (nousresearch/hermes-agent -> gateway run)
   ├── Config declarativa: hermes/config.yaml + SOUL.md + skills/
   ├── LLM: OpenRouter directo (`openrouter/free` por defecto, $0)
   ├── Lectura rápida de PDFs digitales (`anydoc`) + Visión multimodal nativa
   └── MCP Streamable HTTP ──▶ http://expenses-api:3000/api/mcp
                                    │
                                    ▼
                        NestJS 12 Backend (`./backend`)
                           ├── Clean Architecture + TypeORM + Zod
                           ├── PostgreSQL (`expenses`, `expense_installments`, `credit_cards`)
                           └── Archivado asíncrono opcional en Paperless-ngx
                                    │
                                    ▼
                        Metabase (`http://localhost:3005`)
```

---

## ✨ Funcionalidades Principales

- **Registro natural por chat**: *"Pagué 889 mil a BBVA con transferencia desde Galicia"*, *"Gasté 1.5m en 6 cuotas con Visa"*, *"45k en supermercado"*.
- **Lectura de imágenes / capturas de transferencias**: Enviá una captura de homebanking o ticket; Hermes extrae destinatario, banco origen, monto, fecha y categoría, y pide confirmación antes de guardar si va sin caption.
- **Facturas PDF con vencimientos y cuotas**: Lee PDFs digitales al instante (`<0.1s` con `anydoc`) y cae a Paperless OCR solo si el PDF es un escaneo sin texto.
- **Gestión de deudas y cuotas**:
  - Resúmenes de cashflow real desembolsado vs. compromisos pendientes por mes o rango de fechas.
  - Búsqueda por comercio/rubro y próximos vencimientos.
  - Pago de cuotas pendientes sin necesidad de repetir el monto.
  - Edición de montos de cuotas puntuales (recalculando el total padre) o de deudas enteras, y borrado seguro.

---

## 🚀 Despliegue Rápido (1 Comando)

### 1. Clonar e inicializar variables de entorno

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
cp .env.example .env
```

Editá `.env` con tus credenciales reales:
- **`OPENROUTER_API_KEY`**: Tu API Key de [OpenRouter](https://openrouter.ai/keys).
  > ⚠️ **Importante si usás `openrouter/free`**: En [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails) debés permitir modelos gratuitos (`:free`), de lo contrario OpenRouter responderá HTTP 404.
- **`TELEGRAM_BOT_TOKEN`**: Token obtenido desde `@BotFather`.
- **`EXPENSES_DB_PASSWORD`**: Contraseña segura para PostgreSQL.

### 2. Levantar el Stack Base (Postgres + NestJS MCP + Hermes)

```bash
docker compose up -d --build
```

Perfiles opcionales disponibles:
- **Con tablero BI Metabase** (`http://localhost:3005`):
  ```bash
  docker compose --profile metabase up -d --build
  ```
- **Con Paperless-ngx** (`http://localhost:8010`, archivado + OCR de PDFs escaneados):
  ```bash
  docker compose --profile paperless up -d --build
  ```
- **Stack completo** (Base + Metabase + Paperless):
  ```bash
  docker compose --profile full up -d --build
  ```

*(Si levantás Paperless por primera vez, generá un API Token en tu perfil en `http://localhost:8010` y cargalo en `PAPERLESS_API_TOKEN` dentro de `.env`, seguido de `docker compose up -d expenses-api`).*

### 3. Emparejar tu usuario de Telegram (Primera vez)

Si dejaste `TELEGRAM_ALLOWED_USERS` vacío en `.env`, Hermes arranca en modo pairing seguro:
1. Mandale cualquier mensaje a tu bot en Telegram.
2. El bot te responderá con un código de 8 caracteres.
3. Aprobalo ejecutando:
   ```bash
   docker exec hermes-agent hermes pairing approve telegram <CODIGO>
   ```
   *(Opcionalmente, agregá tu ID numérico de Telegram a `TELEGRAM_ALLOWED_USERS` en `.env` para futuros despliegues).*

---

## 📊 Configurar Metabase

1. Ingresá a `http://localhost:3005` y completá el asistente inicial.
2. Conectá la base de datos PostgreSQL:
   - **Host**: `postgres`
   - **Puerto**: `5432`
   - **Base de datos**: `expenses_db` *(o el valor de `EXPENSES_DB_NAME`)*
   - **Usuario / Password**: los definidos en `.env`.
3. Creá tus tarjetas ejecutivas copiando las consultas calibradas en [`docs/metabase-queries.sql`](./docs/metabase-queries.sql) *(separan correctamente cashflow pagado de cuotas pendientes futuras)*.

---

## 🛠️ Desarrollo y Tests Locales

```bash
cd backend
pnpm install
pnpm test
pnpm build
```

Para verificar la conexión MCP de Hermes contra NestJS dentro de Docker:

```bash
docker exec hermes-agent hermes mcp test expenses
```

---

## 📁 Estructura del Repositorio

```text
hermes-finance-stack/
├── backend/                 # API REST + MCP Server HTTP en NestJS 12 (TypeScript)
├── hermes/                  # Configuración oficial de Hermes Agent (config.yaml, SOUL.md, skills/)
├── docs/
│   └── metabase-queries.sql # Consultas SQL listas para el tablero financiero
├── docker-compose.yml       # Orquestación unificada (profile opcional: paperless)
├── .env.example             # Plantilla de variables sin secretos
└── README.md
```
