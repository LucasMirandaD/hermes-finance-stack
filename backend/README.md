# Expenses Backend API & MCP Server (NestJS 12) 🚀

Backend desarrollado con **Clean Architecture & DDD** sobre **NestJS 12**, **Node 26 LTS**, **TypeORM** y **PostgreSQL**, que expone:
1. **API REST** (`/api/expenses/*`, `/api/health`)
2. **Servidor MCP Streamable HTTP** (`/api/mcp`) para **Hermes Agent**, con 13 herramientas tipadas mediante **Zod** (`@modelcontextprotocol/sdk`).
3. **Archivado asíncrono y OCR fallback** en **Paperless-ngx** (`PaperlessService`).

---

## 🛠️ Herramientas MCP Disponibles (`/api/mcp`)

- `register_expense`: Alta de gasto único, transferencia o plan en cuotas (con normalización de montos en español como `"889 mil"`, `"1.5m"`, `"45k"` y archivado asíncrono de `filePath` en Paperless).
- `get_financial_summary`: Cashflow desembolsado, cuotas pendientes, desglose por rubro/banco y comparativa con período anterior.
- `search_expenses`: Búsqueda por comercio, concepto, categoría o rango de fechas (incluye resolución de alias).
- `list_recent_expenses`: Últimos movimientos cargados.
- `get_upcoming_installments` / `search_pending_installments`: Consulta de vencimientos próximos o pendientes.
- `pay_installment`: Marca una cuota pendiente como pagada con banco y medio de pago.
- `update_expense` / `update_installment`: Modifica montos de deudas o cuotas puntuales recalculando saldos automáticamente.
- `delete_expense` / `delete_installment`: Elimina deudas o cuotas con recálculo o cascada.
- `list_credit_cards`: Catálogo de tarjetas y extensiones.
- `extract_scanned_pdf_ocr`: Fallback OCR en Paperless solo cuando un PDF es un escaneo sin texto legible.

---

## 🔌 Endpoints REST Principales (`/api`)

- `GET /api/health` — Estado del servicio
- `POST /api/expenses` — Registrar gasto / cuotas
- `GET /api/expenses` — Listar gastos recientes
- `GET /api/expenses/summary` — Resumen ejecutivo por `month` o `startDate`/`endDate`
- `GET /api/expenses/search` — Búsqueda por `q`, `category`, fechas
- `GET /api/expenses/installments/upcoming` — Próximos vencimientos (`?days=30`)
- `GET /api/expenses/installments/pending` — Cuotas pendientes
- `POST /api/expenses/installments/:id/pay` — Pagar cuota
- `PATCH /api/expenses/:id` | `DELETE /api/expenses/:id` — Editar / borrar gasto o deuda
- `PATCH /api/expenses/installments/:id` | `DELETE /api/expenses/installments/:id` — Editar / borrar cuota
- `GET /api/expenses/cards` | `POST /api/expenses/cards` — Tarjetas registradas
- `POST /api/mcp` — Endpoint Streamable HTTP de MCP

---

## 🧪 Tests y Compilación

```bash
pnpm install --frozen-lockfile
pnpm test     # Vitest (19 tests unitarios)
pnpm build    # Compilación NestJS / TypeScript
```
