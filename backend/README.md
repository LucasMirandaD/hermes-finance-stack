# NestJS Expenses API 🚀

API backend para registro, análisis, seguimiento y proyección de gastos financieros personales, con ingesta automática desde comprobantes OCR (**Paperless-ngx**), mensajes coloquiales y SMS bancarios orquestados por **Hermes Agent**, gestión de compras en múltiples cuotas (mensuales o aperiódicas con saltos de meses), y catálogo discriminado de tarjetas titulares y extensiones familiares.

Desarrollada bajo **Clean Architecture & DDD** con **NestJS 12**, **Node 26 LTS**, **TypeORM 11**, validación de variables de entorno con **Zod**, DTOs fuertemente tipados con **class-validator**, suite de pruebas unitarias con **Vitest**, y persistencia en **PostgreSQL 18** (reutilizando la instancia compartida en Proxmox).

---

## 🏛️ Arquitectura Global del Ecosistema

```mermaid
graph TD
    subgraph Cliente ["Canales de Entrada"]
        Usuario["👤 Usuario (Telegram / Chat / WhatsApp)"]
        Scanner["📸 Facturas / Tickets / Invoices"]
        SMS["📲 Notificaciones Bancarias / SMS"]
    end

    subgraph PaperlessStack ["Paperless-ngx (Puerto :8010)"]
        Paperless["📄 Paperless-ngx Core"]
        RedisBroker["⚡ Redis Broker"]
    end

    subgraph HermesStack ["Hermes Agent Orchestrator"]
        Hermes["🤖 Hermes Agent"]
        HermesSkill["🧠 Skill: Facturas & Gastos (SKILL.md)"]
        HermesTool["🛠️ Tool: expenses_tool.py"]
    end

    subgraph LLMGateway ["LLM Gateway (Puerto :4000)"]
        LiteLLM["🔀 LiteLLM Proxy"]
        GeminiFlash["⚡ Gemini 3.8 Flash (Antigravity Bridge)"]
        OpenRouterFree["🆓 OpenRouter Free Tier (Fallback)"]
    end

    subgraph NestJSBackend ["NestJS Expenses API (Puerto :3000)"]
        Controller["🎮 Presentation Layer (Controllers & DTOs)"]
        Service["⚙️ Domain Layer (Services & Result Pattern)"]
        PlanGen["🗓️ InstallmentPlanGenerator (Cuotas & Redondeo)"]
        Repo["💾 Data Layer (TypeORM Repositories)"]
    end

    subgraph Database ["PostgreSQL 18 (Shared Container: paperless-postgres)"]
        DBPaperless[("📦 DB paperless")]
        DBExpenses[("💰 DB expenses_db")]
    end

    Scanner -->|Upload| Paperless
    Paperless -->|OCR Extraído / Webhook| Hermes
    Usuario -->|Mensaje coloquial| Hermes
    SMS -->|Reenvío notificación| Hermes

    Hermes --> HermesSkill
    Hermes --> HermesTool
    Hermes -->|OpenAI Protocol| LiteLLM
    LiteLLM -->|Primario| GeminiFlash
    LiteLLM -.->|Fallback| OpenRouterFree

    HermesTool -->|HTTP REST| Controller
    Controller --> Service
    Service --> PlanGen
    Service --> Repo
    Repo -->|TCP 5432| DBExpenses
    Paperless -->|TCP 5432| DBPaperless
```

---

## 📊 Flujos de Datos e Interacción

### 1. Ingesta desde Mensajes Libres o SMS Bancarios (Cuotas e Intervalos)

El usuario escribe en lenguaje natural o reenvía un SMS del banco. Hermes extrae los campos semánticos y llama a la API persistiendo el gasto y su cronograma de cuotas:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Hermes as Hermes Agent
    participant LLM as LiteLLM (Gemini 3.8 Flash)
    participant NestJS as NestJS Backend (API)
    participant Postgres as PostgreSQL (expenses_db)

    Usuario->>Hermes: "Gasté 60.000 en 3 cuotas cada 2 meses con la Visa Santander de Mamá"
    Note over Hermes,LLM: 1. Inferencia Semántica y Normalización
    Hermes->>LLM: Infiere comercio, importe, cuotas, periodicidad y tarjeta
    LLM-->>Hermes: JSON: { totalAmount: 60000, totalInstallments: 3, intervalMonths: 2, cardBank: 'Santander', cardName: 'Visa', cardHolder: 'Mamá', isExtension: true }
    
    Note over Hermes,NestJS: 2. Validación y Persistencia en Capas
    Hermes->>NestJS: POST /api/expenses (CreateExpenseDto)
    NestJS->>NestJS: Valida DTO (class-validator)
    NestJS->>NestJS: Resuelve tarjeta (Santander Visa - Extensión Mamá)
    NestJS->>NestJS: InstallmentPlanGenerator: Cuotas Mes 0, Mes +2, Mes +4
    NestJS->>Postgres: INSERT INTO expenses + INSERT INTO expense_installments (3 registros)
    Postgres-->>NestJS: Confirmación de persistencia
    NestJS-->>Hermes: HTTP 201 Created (ExpenseResponseDto)
    
    Note over Hermes,Usuario: 3. Respuesta con Cronograma Desglosado
    Hermes->>Usuario: "✅ Gasto registrado en 3 cuotas de $20.000 (cada 2 meses)\n💳 Tarjeta: Santander Visa (Extensión de Mamá)\n🗓️ Vencimientos calculados:\n- Cuota 1/3: 2026-11-20 ($20.000)\n- Cuota 2/3: 2027-01-20 ($20.000)\n- Cuota 3/3: 2027-03-20 ($20.000)"
```

---

### 2. Ingesta Documental vía Paperless-ngx OCR

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Paperless as Paperless-ngx (:8010)
    participant Hermes as Hermes Agent
    participant NestJS as NestJS Backend (:3000)
    participant Postgres as PostgreSQL (expenses_db)

    Usuario->>Paperless: Sube PDF / Foto de Factura o Ticket
    Paperless->>Paperless: Procesa OCR (Tesseract Español) y almacena archivo
    Paperless->>Hermes: Webhook / Evento de nuevo documento fiscal
    Hermes->>Hermes: Extrae CUIT, Razón Social, Fecha, Total y Tipo de Comprobante
    Hermes->>NestJS: POST /api/expenses (source='PAPERLESS_OCR', paperlessDocumentId=142)
    NestJS->>Postgres: INSERT INTO expenses (asociando paperless_document_id)
    Postgres-->>NestJS: OK
    NestJS-->>Hermes: HTTP 201 Created
    Hermes->>Usuario: "📄 Factura de Coto archivada en Paperless y registrada en finanzas por $15.420 ARS"
```

---

### 3. Consulta de Cuotas Pendientes y Vencimientos del Mes

Permite auditar los compromisos financieros de un mes específico, discriminando entre tarjetas propias (titular) y compras hechas por extensiones:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Hermes as Hermes Agent
    participant NestJS as NestJS Backend (API)
    participant Postgres as PostgreSQL (expenses_db)

    Usuario->>Hermes: "¿Cuáles son las cuotas que vencen en Diciembre 2026?"
    Hermes->>NestJS: GET /api/expenses/installments/summary?month=2026-12
    NestJS->>Postgres: SELECT * FROM expense_installments JOIN expenses JOIN credit_cards WHERE dueDate BETWEEN '2026-12-01' AND '2026-12-31'
    Postgres-->>NestJS: Cuotas encontradas
    NestJS-->>Hermes: HTTP 200 OK (MonthlyInstallmentsSummaryDto)
    
    Hermes->>Usuario: "📅 En Diciembre 2026 tenés a vencer:\n\n🔵 Mis Tarjetas (Titular):\n- Galicia Mastercard: $25.000 (Cuota 2/6 - Auriculares Sony)\n\n🟠 Extensiones:\n- Santander Visa (Mamá): $20.000 (Cuota 1/3 - Fravega)\n\n💰 Total a pagar en Diciembre: $45.000 ARS"
```

---

## 🗓️ Lógica Matemática de Cuotas e Intervalos (`intervalMonths`)

Cuando un gasto se divide en cuotas, el generador determinístico [`InstallmentPlanGenerator`](file:///home/lucasm/Code/nest-expenses-api/src/modules/expenses/domain/services/installment-plan-generator.ts) ejecuta:

1. **Cálculo de Fechas con Saltos Aperiódicos**:
   $$\text{Fecha Cuota } k = \text{Fecha Inicial} + ((k - 1) \times \text{intervalMonths})$$
   - Si `intervalMonths = 1` (mensual estándar): meses consecutivos.
   - Si `intervalMonths = 2` (bimestral / cada 2 meses): Noviembre 2026 $\rightarrow$ Enero 2027 $\rightarrow$ Marzo 2027.
   - Ajusta automáticamente fines de mes variables (ej. 31 de Enero $\rightarrow$ 28 de Febrero $\rightarrow$ 31 de Marzo).

2. **Compensación Exacta de Centavos (Rounding Loss Prevention)**:
   - Para evitar pérdida o desfasaje de centavos al dividir importes (ej. $\$100 / 3$ cuotas), calcula:
     $$\text{Base} = \lfloor \frac{\text{Total}}{N} \rfloor = 33.33$$
     $$\text{Resto} = \text{Total} - (\text{Base} \times N) = 100.00 - 99.99 = 0.01$$
   - El resto se imputa íntegramente a la **primera cuota**:
     - Cuota 1: $\$33.34$
     - Cuota 2: $\$33.33$
     - Cuota 3: $\$33.33$
     - **Suma exacta garantizada**: $\$100.00$.

---

## 🧩 Modelo Relacional de Datos (PostgreSQL 18)

```mermaid
erDiagram
    credit_cards ||--o{ expenses : "asociada a"
    expenses ||--o{ expense_installments : "genera"

    credit_cards {
        uuid id PK
        varchar bank "Banco emisor (Santander, Galicia)"
        varchar card_name "Nombre/Marca (Visa Black, Mastercard)"
        varchar last_four_digits "Últimos 4 dígitos"
        boolean is_extension "false=Titular, true=Extensión"
        varchar holder_name "Nombre titular o adicional (Mamá, Lucas)"
        smallint closing_day "Día de cierre mensual (1..31)"
        smallint due_day "Día de vencimiento resumen (1..31)"
        boolean is_active "Estado activo"
        timestamptz created_at
        timestamptz updated_at
    }

    expenses {
        uuid id PK
        varchar description "Descripción del gasto"
        varchar merchant_name "Comercio / Razón Social"
        decimal total_amount "Monto total del gasto"
        varchar currency "Moneda (ARS, USD)"
        date expense_date "Fecha de compra (YYYY-MM-DD)"
        enum payment_method "CASH, CREDIT_CARD, DEBIT_CARD, etc."
        uuid credit_card_id FK "Tarjeta vinculada"
        boolean is_installment "true si es en cuotas"
        int total_installments "Cantidad total de cuotas"
        int interval_months "Salto de meses entre cuotas (default 1)"
        varchar category "Categoría del gasto"
        enum source "PAPERLESS_OCR, CHAT_MESSAGE, SMS, MANUAL"
        text raw_source_text "Texto crudo original"
        int paperless_document_id "ID en Paperless-ngx"
        jsonb metadata "Metadatos adicionales"
        timestamptz created_at
        timestamptz updated_at
    }

    expense_installments {
        uuid id PK
        uuid expense_id FK "Gasto padre"
        smallint installment_number "Número de cuota (1..N)"
        smallint total_installments "Total de cuotas del plan"
        decimal amount "Importe exacto de la cuota"
        date due_date "Fecha de vencimiento estimada"
        enum status "PENDING, PAID, CANCELLED"
        timestamptz paid_at "Fecha de pago efectivo"
        varchar notes "Notas o aclaraciones"
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 🧱 Arquitectura en Capas (Clean Architecture & DDD)

El proyecto está organizado siguiendo separación estricta de responsabilidades:

```text
src/
├── common/
│   └── errors/
│       ├── errors.ts             # Errores canónicos (NotFound, InvalidOperation, CouldNotSave)
│       ├── result.mapper.ts      # Patrón Result<T, BaseError>
│       └── error.mapper.ts       # Mapeo determinístico de BaseError a HttpException
├── infraestructure/
│   ├── config/
│   │   └── env.schema.ts         # Validación estricta de ENVs con ZOD (exclusivo para envs)
│   └── database/
│       └── typeorm.config.ts     # Configuración asíncrona de TypeORM para PostgreSQL 18
└── modules/
    └── expenses/
        ├── domain/
        │   ├── interfaces/       # Contratos puros de dominio (IExpense, ICreditCard, etc.)
        │   └── services/         # IExpensesService (abstract token) e InstallmentPlanGenerator
        ├── data/
        │   ├── entities/         # Entidades TypeORM con índices B-Tree
        │   └── repositories/     # IExpensesRepository (abstract token) y ExpensesRepository
        └── presentation/
            ├── dtos/             # DTOs validados con class-validator y class-transformer
            ├── mappers/          # Mappers estáticos (ExpenseMapper)
            └── controllers/      # ExpensesController evaluando Result y excepciones
```

---

## 🔌 Especificación de Endpoints REST

### 1. Registrar Nuevo Gasto
`POST /api/expenses`

**Payload (Compra en 3 cuotas cada 2 meses con extensión):**
```json
{
  "merchantName": "Fravega",
  "description": "Smart TV 55 Pulgadas",
  "totalAmount": 300000.00,
  "currency": "ARS",
  "expenseDate": "2026-11-08",
  "paymentMethod": "CREDIT_CARD",
  "cardBank": "Santander",
  "cardName": "Visa Black",
  "cardHolder": "Mamá",
  "isInstallment": true,
  "totalInstallments": 3,
  "intervalMonths": 2,
  "category": "TECNOLOGIA",
  "source": "CHAT_MESSAGE",
  "rawSourceText": "gasté 300k en fravega en 3 cuotas cada 2 meses con la visa santander extensión de mamá"
}
```

**Respuesta Exitosa (`201 Created`):**
```json
{
  "id": "e674a9cf-936d-472e-8fa9-906fb3684a22",
  "description": "Smart TV 55 Pulgadas",
  "merchantName": "Fravega",
  "totalAmount": 300000,
  "currency": "ARS",
  "expenseDate": "2026-11-08",
  "paymentMethod": "CREDIT_CARD",
  "isInstallment": true,
  "totalInstallments": 3,
  "intervalMonths": 2,
  "category": "TECNOLOGIA",
  "source": "CHAT_MESSAGE",
  "creditCard": {
    "id": "18cf3b2a-6d1a-4d32-9cb7-7f9a12e83120",
    "bank": "Santander",
    "cardName": "Visa Black",
    "isExtension": true,
    "holderName": "Mamá"
  },
  "installments": [
    {
      "id": "inst-uuid-1",
      "installmentNumber": 1,
      "totalInstallments": 3,
      "amount": 100000,
      "dueDate": "2026-11-20",
      "status": "PENDING"
    },
    {
      "id": "inst-uuid-2",
      "installmentNumber": 2,
      "totalInstallments": 3,
      "amount": 100000,
      "dueDate": "2027-01-20",
      "status": "PENDING"
    },
    {
      "id": "inst-uuid-3",
      "installmentNumber": 3,
      "totalInstallments": 3,
      "amount": 100000,
      "dueDate": "2027-03-20",
      "status": "PENDING"
    }
  ],
  "createdAt": "2026-11-08T19:20:00.000Z"
}
```

---

### 2. Resumen de Cuotas por Mes
`GET /api/expenses/installments/summary?month=2026-12`

**Respuesta Exitosa (`200 OK`):**
```json
{
  "month": "2026-12",
  "totalAmountDue": 45000,
  "installmentsCount": 2,
  "items": [
    {
      "installmentId": "inst-1",
      "expenseId": "exp-1",
      "merchantName": "MercadoLibre",
      "description": "Auriculares Sony",
      "installmentNumber": 2,
      "totalInstallments": 6,
      "amount": 25000,
      "dueDate": "2026-12-10",
      "status": "PENDING",
      "cardBank": "Galicia",
      "cardName": "Mastercard",
      "isExtension": false,
      "holderName": "Lucas M"
    },
    {
      "installmentId": "inst-2",
      "expenseId": "exp-2",
      "merchantName": "Fravega",
      "description": "Smart TV",
      "installmentNumber": 1,
      "totalInstallments": 3,
      "amount": 20000,
      "dueDate": "2026-12-20",
      "status": "PENDING",
      "cardBank": "Santander",
      "cardName": "Visa Black",
      "isExtension": true,
      "holderName": "Mamá"
    }
  ]
}
```

---

### 3. Catálogo de Tarjetas
`GET /api/expenses/cards` / `POST /api/expenses/cards`

Permite listar y dar de alta tarjetas principales y adicionales para asociar gastos y conocer sus días de cierre y vencimiento.

---

### 4. Healthcheck
`GET /api/health`

```json
{
  "status": "ok",
  "service": "nest-expenses-api",
  "timestamp": "2026-11-08T19:25:00.000Z",
  "nodeVersion": "v26.0.0"
}
```

---

## 🧪 Pruebas Unitarias con Vitest

El proyecto utiliza **Vitest** con **unplugin-swc** para ejecución de pruebas a alta velocidad y bajo el patrón **Arrange-Act-Assert (AAA)**:

```bash
# Ejecutar suite completa de tests unitarios
npm test
# o con pnpm
pnpm test

# Modo interactivo con hot reload
npm run test:watch

# Generar reporte de cobertura
npm run test:cov
```

---

## ⚙️ Configuración de Variables de Entorno

Creá tu archivo `.env` en la raíz copiando la plantilla [`env.example`](file:///home/lucasm/Code/nest-expenses-api/.env.example):

```env
# Servidor
PORT=3000
NODE_ENV=production

# Base de datos (PostgreSQL 18 reutilizado en Docker network paperless_default)
DB_HOST=paperless-postgres
DB_PORT=5432
DB_USER=expenses_user
DB_PASSWORD=your_secure_expenses_db_password_here
DB_NAME=expenses_db
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Paperless-ngx
PAPERLESS_BASE_URL=http://paperless:8000
PAPERLESS_API_TOKEN=your_paperless_token_here
```

> **Seguridad**: Nunca incluyas contraseñas reales en archivos versionados. El archivo `.env` está expresamente ignorado en `.gitignore`.

---

## 🐳 Despliegue con Docker

Construcción y ejecución del contenedor multi-stage sobre **Node 26 Alpine**:

```bash
# Compilar imagen de producción
docker build -t nest-expenses-api:latest .

# Ejecutar conectándolo a la red compartida de Paperless
docker run -d \
  --name nest-expenses-api \
  --network paperless_default \
  -p 3000:3000 \
  --env-file .env \
  nest-expenses-api:latest
```
