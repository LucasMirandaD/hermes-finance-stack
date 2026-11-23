<div align="center">

# Hermes Finance Stack

**Asistente financiero personal y compartido del hogar por Telegram, basado en Hermes Agent + NestJS MCP + PostgreSQL.**

[English](../../README.md) · [Guía para Agentes IA](PARA-INSTALAR.md)

</div>

Una **única instancia de Hermes Agent** actúa como tu interfaz conversacional por Telegram (chats privados o grupos compartidos), conectada a un servidor **MCP en NestJS 12 + TypeORM + PostgreSQL** con **43 herramientas tipadas**, generación nativa de **gráficos PNG**, exportación **CSV/JSON**, **multi-usuario con balance de gastos compartidos**, **salidas y eventos grupales**, **control de gastos fijos recurrentes**, **presupuestos por categoría**, **cuotas y extensiones**, tableros opcionales en **Metabase BI** y archivado opcional con OCR en **Paperless-ngx**.

- Hermes **no guarda gastos en memoria local** (`memory_enabled: false`): PostgreSQL es la única fuente de verdad.
- Funciona para **uso individual, parejas o roommates** dentro de **un solo bot de Telegram** (DM o grupo), identificando automáticamente quién habla (`**User:**` / `[nombre]`).

---

## Tabla de contenidos

- [Antes de empezar](#antes-de-empezar)
- [Inicio rápido](#inicio-rápido)
- [Cómo funciona](#cómo-funciona)
- [Conceptos principales](#conceptos-principales)
- [Qué podés pedirle (ejemplos de chat)](#qué-podés-pedirle-ejemplos-de-chat)
- [UX silenciosa en Telegram y onboarding](#ux-silenciosa-en-telegram-y-onboarding)
- [Perfiles opcionales (Metabase y Paperless-ngx)](#perfiles-opcionales-metabase-y-paperless-ngx)
- [Referencia de tools MCP (43 tools)](#referencia-de-tools-mcp-43-tools)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Tests y migraciones](#tests-y-migraciones)
- [Troubleshooting](#troubleshooting)

---

## Antes de empezar

Todo el stack corre sobre **Docker Compose** (no necesitás instalar Hermes CLI en tu host):

- **Docker Engine** + **Docker Compose v2** (`docker compose version`)
- Una **API Key de OpenRouter** (soporta `openrouter/free` a `$0` — recordá habilitar modelos `:free` en [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails))
- Un **Bot Token de Telegram** creado con [@BotFather](https://t.me/BotFather)
- Para instalación guiada por otra IA: [`PARA-INSTALAR.md`](PARA-INSTALAR.md) · English: [`docs/en/TO-INSTALL.md`](../en/TO-INSTALL.md)

---

## Inicio rápido

```bash
git clone https://github.com/LucasMirandaD/hermes-finance-stack.git
cd hermes-finance-stack
chmod +x scripts/setup.sh scripts/smoke-test.sh
./scripts/setup.sh
```

O manualmente sin el wizard:

```bash
cp .env.example .env
# Editá .env con OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN y EXPENSES_DB_PASSWORD
mkdir -p hermes/charts hermes/exports
docker compose up -d --build
```

Luego verificá y emparejá Telegram:

| Paso | Comando | Esperado |
|---|---|---|
| 1. Verificar contenedores | `docker compose ps` | `expenses-postgres`, `expenses-api` (healthy) y `hermes-agent` corriendo |
| 2. Smoke test | `./scripts/smoke-test.sh` | `/api/health` OK, 43 tools MCP verificadas, `✓ Connected` |
| 3. Emparejar Telegram | Mandale un mensaje al bot → `docker exec hermes-agent hermes pairing approve telegram <CODIGO>` | El bot responde (omitir si definiste `TELEGRAM_ALLOWED_USERS`) |
| 4. Configuración guiada | Escribile al bot: *"Empecemos"* | Activa la skill `onboarding` paso a paso |
| 5. Primer gasto | *"Gasté 45k en supermercado con débito Galicia"* | Confirmación estructurada `Listo ✅` |

---

## Cómo funciona

**Camino de cada mensaje:**

1. **Telegram (DM o Grupo)** — enviás texto, capturas de transferencias o boletas PDF a `hermes-agent`.
2. **Hermes Agent (`nousresearch/hermes-agent`)** — carga `hermes/config.yaml`, `hermes/SOUL.md` y `hermes/skills/finanzas/*`; lee PDFs digitales con `read_file` o capturas por visión.
3. **Servidor MCP NestJS (`expenses-api`)** — ejecuta las tools Streamable HTTP en `http://expenses-api:3000/api/mcp`, normaliza montos argentinos (`"45k"`, `"889 mil"`, `"1.5m"`), actualiza PostgreSQL, genera gráficos PNG (`@resvg/resvg-wasm`) y exporta CSV/JSON.
4. **PostgreSQL (`expenses-postgres`)** — persiste gastos, cuotas, tarjetas, miembros del hogar, repartos compartidos, presupuestos y gastos fijos recurrentes.

| Capa | Rol | Ubicación |
|---|---|---|
| **Hermes Gateway** | Telegram, visión, PDF `anydoc`, reacciones silenciosas (`👀`/`👍`), envío de archivos `MEDIA:` | `./hermes/` |
| **SOUL + Skills** | Reglas estrictas de dominio, formato móvil sin tablas, identificación multi-usuario | `./hermes/SOUL.md`, `./hermes/skills/finanzas/` |
| **Backend NestJS 12** | Arquitectura Modular (`ExpensesModule`, `OutingsModule`, `McpModule`) + TypeORM + Chart/Export | `./backend/` |
| **PostgreSQL 17** | 10 tablas (`expenses`, `expense_installments`, `credit_cards`, `members`, `expense_allocations`, `category_budgets`, `recurring_expenses`, `outings`, `outing_participants`, `outing_expenses`) | Volumen `postgres_data` |
| **Metabase BI (opcional)** | Tablero ejecutivo con 15 consultas SQL pre-calibradas | `--profile metabase` (`:3005`) |
| **Paperless-ngx (opcional)** | Archivado documental asíncrono + OCR Tesseract (`disabled` limpio en `health_check` si no se levanta) | `--profile paperless` (`:8010`) |

---

## Conceptos principales

### 1. Multi-Usuario y Gastos Compartidos en un Solo Hermes

A diferencia de arquitecturas que levantan un bot por persona, **un único bot de Hermes** atiende a todos los miembros del hogar en DM o en un grupo de Telegram:

- Hermes Gateway inyecta automáticamente quién escribe (`**User:** <nombre>` en DM, `[nombre]` en grupo).
- La tabla `members` mapea cada integrante (`slug`, `displayName`, `telegramUsername`, `telegramId`, `aliases`) con quién pagó (`paidByMemberId`) y los porcentajes de reparto (`expense_allocations`).
- **Alcance `PERSONAL` vs `SHARED`**:
  - Compras individuales → `scope: "PERSONAL"`.
  - Gastos compartidos (*"compartido"*, *"mitad y mitad"*, *"del depto"*, o reparto `70/30`) → `scope: "SHARED"` y guardado de `allocations` sumando `100%`.
- **Balance compartido (`get_shared_balance`)**: calcula `totalPaid`, `totalAttributed`, `netBalance` y las transferencias mínimas de liquidación (*"quién le debe a quién"*).

### 2. Salidas / Eventos Compartidos

Cargá eventos puntuales (*"Asado sábado"*, *"Viaje a Bariloche"*, *"Cena amigos"*) aislados del cashflow personal:

- **Varios usuarios o un solo usuario**: funciona tanto si cada participante escribe desde el grupo como si una sola persona le dicta al bot lo que gastó cada amigo (*"Juan pagó 45k de carne, Sofía pagó 18k de bebidas"*). No hace falta que los amigos tengan cuenta de Telegram ni estén en `members`.
- **División flexible**: equitativa entre todos (`EQUAL`), solo entre un subconjunto (`splitBetween`, ej. *"el vino solo entre Juan y Sofía"*), o por montos/porcentajes personalizados (`customShares`).
- **Liquidación mínima (`get_outing_balance`)**: muestra total, pagado vs parte de cada uno y quién le transfiere cuánto a quién.
- **Cierre opcional (`settle_outing`)**: cierra la salida y permite registrar solo tu parte en tus gastos personales (`recordPersonalExpenseFor`).

### 3. Gastos Fijos / Recurrentes

Definí plantillas mensuales, bimestrales o anuales en `recurring_expenses` (alquiler, internet, expensas, seguros, suscripciones):

- Consultá *"¿Qué fijos faltan pagar este mes?"* → `get_fixed_expenses_status` indica cuáles están `PAID`, `PENDING` o `OVERDUE`.
- Registrá el pago ajustando por inflación si varió: *"Pagué internet 48 mil"* → `pay_recurring_expense` registra el gasto real vinculado a la plantilla con `isFixed: true`.
- `get_financial_summary` separa automáticamente **Gastos Fijos vs Variables**.

### 4. Cuotas y Extensiones Familiares

- Soporta planes en cuotas (`totalInstallments`, `intervalMonths`, `firstDueDate`) y extensiones de tarjeta (`credit_cards` con `isExtension`, `holderName`, `closingDay`, `dueDay`).
- `get_monthly_installments_summary` agrupa las cuotas por `holderName` ordenadas de mayor a menor y marca las que finalizan ese mes (`isLastInstallment: true` → `🏁`).
- Editar una cuota puntual (`update_installment`) recalcula el total de la deuda padre; editar el total padre (`update_expense`) redistribuye el saldo pendiente entre cuotas `PENDING`.

### 5. Presupuestos por Categoría y Alertas

- Configurá topes mensuales por categoría (`set_category_budget`) con umbral de alerta configurable (default `80%`), aplicables a `ALL`, `PERSONAL`, `SHARED` o a un miembro particular.
- `get_financial_summary` incluye automáticamente las `budgetAlerts` disparadas en el período.

### 6. Visión Multimodal, Gráficos PNG y Exportación

- **Capturas sin caption**: Hermes muestra una vista previa con comercio, banco origen, monto, fecha y categoría, y pide confirmación antes de guardar. Con texto, registra directo.
- **PDFs digitales**: lectura instantánea con `read_file` (`anydoc`); solo recurre a `extract_scanned_pdf_ocr` (Paperless Tesseract) si el PDF es un escaneo con `<50` caracteres.
- **Gráficos PNG nativos (`render_chart`)**: genera imágenes 800×480 (`by_category`, `monthly_trend`, `top_expenses`, `fixed_vs_variable`, `by_holder`) en `/opt/data/charts` y las envía por Telegram vía `MEDIA:`.
- **Exportación CSV / JSON (`export_expenses`)**: genera archivos CSV (UTF-8 con BOM para Excel) o JSON en `/opt/data/exports` y los adjunta directo en Telegram.

---

## Qué podés pedirle (ejemplos de chat)

- *"Gasté 45k en supermercado con débito Galicia"*
- *"Pagué 889 mil a BBVA con transferencia desde Galicia"*
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
- *(Enviá una captura de transferencia o una factura PDF directamente en Telegram)*

---

## UX silenciosa en Telegram y onboarding

`hermes/config.yaml` viene optimizado para un chat móvil rápido y sin ruido:

| Setting | Efecto |
|---|---|
| `display.tool_progress: "off"` | Oculta mensajes técnicos de ejecución de tools MCP |
| `display.interim_assistant_messages: false` | Evita narraciones intermedias ("Voy a buscar...") |
| `display.turn_completion_explainer: false` | Evita resúmenes verbosos de cierre de turno |
| `telegram.reactions: true` | Muestra `👀` mientras procesa y `👍` al finalizar |
| `memory.memory_enabled: false` | Obliga a usar PostgreSQL como única fuente de verdad |
| `skills.auto_load` | Precarga `facturas-ocr-gastos`, `monthly-summary-format` y `onboarding` |
| `sessions.auto_archive: true` | Archiva sesiones inactivas automáticamente a los 3 días |

La skill `monthly-summary-format` garantiza resúmenes mensuales **sin tablas Markdown** (ilegibles en celular), agrupados por titular con `🏁` para cuotas que finalizan y `📌` para gastos fijos.

---

## Perfiles opcionales (Metabase y Paperless-ngx)

- **Con Metabase BI** (`http://localhost:3005`):
  ```bash
  docker compose --profile metabase up -d --build
  ```
  Conectá Metabase a PostgreSQL (`host: postgres`, `puerto: 5432`, `db: expenses_db`) y copiá las 15 consultas calibradas de [`docs/metabase-queries.sql`](../metabase-queries.sql).

- **Con Paperless-ngx** (`http://localhost:8010`):
  ```bash
  docker compose --profile paperless up -d --build
  ```
  Luego de iniciar por primera vez, generá un API Token en Paperless (`My Profile -> Auth Token`), cargalo en `PAPERLESS_API_TOKEN` dentro de `.env` y ejecutá `docker compose up -d expenses-api`.

- **Stack completo** (Base + Metabase + Paperless):
  ```bash
  docker compose --profile full up -d --build
  ```

---

## Referencia de tools MCP (43 tools)

Expuestas en `POST /api/mcp` vía Streamable HTTP (servidor `expenses`):

| Grupo | Tools |
|---|---|
| **Salud** (1) | `health_check` |
| **Gastos** (6) | `register_expense`, `search_expenses`, `list_recent_expenses`, `update_expense`, `delete_expense`, `extract_scanned_pdf_ocr` |
| **Cuotas y Tarjetas** (8) | `get_upcoming_installments`, `get_monthly_installments_summary`, `search_pending_installments`, `pay_installment`, `update_installment`, `delete_installment`, `list_credit_cards`, `register_credit_card` |
| **Miembros y Compartidos** (5) | `create_member`, `update_member`, `list_members`, `delete_member`, `get_shared_balance` |
| **Salidas / Eventos** (8) | `create_outing`, `list_outings`, `add_outing_participant`, `add_outing_expense`, `delete_outing_expense`, `get_outing_balance`, `settle_outing`, `delete_outing` |
| **Presupuestos** (4) | `set_category_budget`, `list_category_budgets`, `delete_category_budget`, `get_budget_status` |
| **Gastos Fijos / Recurrentes** (6) | `create_recurring_expense`, `list_recurring_expenses`, `update_recurring_expense`, `delete_recurring_expense`, `get_fixed_expenses_status`, `pay_recurring_expense` |
| **Resúmenes, Gráficos y Export** (5) | `get_financial_summary`, `compare_months`, `top_expenses`, `export_expenses`, `render_chart` |

---

## Estructura del repositorio

```text
hermes-finance-stack/
├── README.md                              # Documentación principal en inglés
├── docker-compose.yml                     # Orquestación (perfiles: metabase, paperless, full)
├── .env.example                           # Plantilla de variables sin secretos
├── scripts/
│   ├── setup.sh                           # Wizard interactivo de despliegue
│   └── smoke-test.sh                      # Verificación REST, MCP (43 tools) y contenedor Hermes
├── docs/
│   ├── metabase-queries.sql               # 15 consultas SQL listas para Metabase
│   ├── en/TO-INSTALL.md                   # Guía para agentes IA (EN)
│   └── es/
│       ├── README.md                      # Documentación completa en Español
│       └── PARA-INSTALAR.md               # Guía para agentes IA (ES)
├── hermes/
│   ├── config.yaml                        # UX silenciosa, auto_load skills, memoria off, MCP URL
│   ├── SOUL.md                            # Guardrails financieros, reglas multi-usuario y formato
│   ├── charts/                            # Volumen compartido para gráficos PNG
│   ├── exports/                           # Volumen compartido para CSV/JSON
│   └── skills/finanzas/
│       ├── facturas-ocr/SKILL.md          # Skill operativa completa
│       ├── monthly-summary-format/SKILL.md# Formato móvil sin tablas por titular
│       └── onboarding/SKILL.md            # Onboarding guiado por Telegram
└── backend/                               # NestJS 12 + TypeORM + MCP Server (TypeScript)
    ├── Dockerfile                         # Node 26 Alpine + font-dejavu para SVG->PNG
    ├── sql/
    │   ├── 001_multiuser_budgets_fixed_expenses.sql
    │   └── 002_outings.sql
    └── src/modules/
        ├── expenses/                      # Controladores modulares (expenses, installments, cards, members, budgets, recurring, analytics)
        ├── outings/                       # Salidas / eventos compartidos
        └── mcp/                           # Servidor MCP modular (43 tools)
```

---

## Tests y migraciones

### Tests unitarios y compilación local

```bash
cd backend
pnpm install
pnpm test    # Vitest (38 tests en 9 archivos, incluyendo salidas, PNG charts y export CSV/JSON)
pnpm build
```

### Migración PostgreSQL idempotente (actualizando desde v1.x con `DB_SYNCHRONIZE=false`)

Usá el script automatizado de migración (toma backup `pg_dump`, aplica `001` y `002`, y opcionalmente normaliza categorías viejas y asigna un titular por defecto):

```bash
./scripts/migrate.sh --normalize-categories --backfill-owner "TuNombre"
```

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `openrouter/free` devuelve HTTP `404` | Habilitá modelos gratuitos (`:free`) en [OpenRouter Guardrails](https://openrouter.ai/workspaces/default/guardrails) |
| `hermes mcp test expenses` falla | Verificá `docker compose ps` (`expenses-api` healthy) y que ambos compartan `finance_net` |
| El bot en Telegram no responde | Revisá `docker logs hermes-agent`; si `TELEGRAM_ALLOWED_USERS` está vacío, aprobá el código de pairing |
| Error `EACCES` al crear gráficos o exports | Verificá que `./hermes/charts` y `./hermes/exports` tengan dueño `1000:1000` (`HERMES_UID:HERMES_GID`) |
| Faltan tablas nuevas en producción | Aplicá `backend/sql/001_multiuser_budgets_fixed_expenses.sql` si usás `DB_SYNCHRONIZE=false` |
| No archiva en Paperless | Generá el token en Paperless (`My Profile -> Auth Token`), ponelo en `PAPERLESS_API_TOKEN` y recreá `expenses-api` |
