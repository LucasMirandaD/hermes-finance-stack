---
name: facturas-ocr-gastos
description: >-
  Skill financiera integral para gestionar gastos, facturas PDF, capturas de transferencias
  bancarias, tarjetas con cuotas, resúmenes de cashflow y edición/borrado de deudas
  mediante las herramientas MCP del servidor expenses.
---

# Gestión Financiera Personal con MCP `expenses`

## 1. Categorías Estándar (`category`)
Usá siempre una de estas categorías normalizadas:
- `IMPUESTOS_Y_SERVICIOS` (Aysam/Agua, Ecogas, Edemsa/Luz, Municipalidad, Internet, Celular)
- `SUPERMERCADO` (Coto, Carrefour, Vea, Changomas, almacén)
- `TRANSPORTE_Y_AUTO` (nafta/YPF/Shell, peajes, patente, seguro auto, mecánico)
- `PRESTAMOS_Y_SEGUROS` (préstamos bancarios, créditos, cuotas personales, Cencopay, financiación)
- `ALQUILER_Y_EXPENSAS` (alquiler, expensas, inmobiliaria)
- `SALUD` (obra social, farmacia, consultas médicas)
- `COMIDA_Y_SALIDAS` (restaurantes, PedidosYa, cafés)
- `TECNOLOGIA_Y_HOGAR` (electrodomésticos, tecnología, hogar, suscripciones digitales)
- `OTROS` (transferencias entre personas sin concepto claro, varios)

---

## 2. Flujo según Tipo de Solicitud

### A. Registro por Texto Libre o SMS Bancario
1. Extraé `merchantName`, `description`, `totalAmount` (soporta `"889 mil"`, `"1.5m"`, `"2 millones"`, `"45k"`), `expenseDate` (`YYYY-MM-DD`), `paymentMethod` (`CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `MERCADO_PAGO`, `CASH`), `bankName` (solo banco **origen**, nunca destinatario), y datos de tarjeta/cuotas si aplican.
2. Si el usuario menciona tarjeta ambigua o extensión familiar (`"la de mamá"`, `"extensión hermano"`), podés consultar `list_credit_cards()` antes de registrar.
3. Si dice *"cuota"* junto con un monto específico (ej: *"Pagué 889 mil a BBVA por cuota del auto"*), consultá primero `search_pending_installments(search="BBVA")`. Si no hay coincidencia, registrá directamente el gasto nuevo con `register_expense`.
4. Respondé con un comprobante limpio (comercio, concepto, monto formateado en ARS, fecha, categoría, medio/banco, y cuotas si corresponde).

### B. Capturas de Pantalla / Fotos de Transferencias o Tickets
1. Analizá la imagen adjunta (por ejemplo, comprobante Galicia, BBVA, Santander o Mercado Pago):
   - `"Para:"` / destinatario ➔ `merchantName` (ej: `Santos Luis Ignacio`).
   - `"De:"` / cuenta origen ➔ `bankName` (ej: `Galicia`) y `paymentMethod: "BANK_TRANSFER"`.
   - Recordá que `$ 89.000` en formato argentino es `89000` (ochenta y nueve mil).
2. **Si el usuario envió la imagen SIN texto**: presentale los datos detectados en una vista previa clara y pedile confirmación antes de guardar. Cuando responda `"sí"` / `"dale"` / `"confirmar"`, llamá a `register_expense(..., filePath="<ruta_imagen>")`.
3. **Si envió la imagen CON texto** (ej: *"alquiler noviembre"*): llamá directamente a `register_expense(..., filePath="<ruta_imagen>")`. NestJS archivará la imagen en Paperless en segundo plano sin demorar tu respuesta.

### C. Facturas / Boletas en PDF
1. Leé el PDF inmediatamente con `read_file(path)` (`anydoc` extrae el texto digital en milisegundos).
2. **Solo si `read_file` devuelve vacío o `<50` caracteres** (escaneo sin capa de texto), invocá `extract_scanned_pdf_ocr(filePath=path)` para obtener el OCR de Paperless.
3. Si el usuario indica vencimientos futuros o pago en cuotas (ej: *"no está paga, pagar en mes 11 y 12 con Visa Galicia"*), pasá `isInstallment: true`, `totalInstallments`, `firstDueDate`, `filePath` a `register_expense`.

### D. Resúmenes, Búsquedas y Vencimientos
- **Resúmenes** (*"¿cuánto gasté este mes?"*, *"resumen de octubre"*, *"gastos de la semana"*): llamá a `get_financial_summary(month=..., startDate=..., endDate=...)` y presentá:
  1. Total Efectivamente Pagado (cashflow desembolsado).
  2. Compromisos / Cuotas Pendientes del período.
  3. Variación contra el período anterior.
  4. Desglose por categoría y banco.
  5. Enlace opcional al tablero Metabase (`http://localhost:3005`).
- **Búsquedas por comercio/rubro** (*"¿cuánto le pagué a Aysam?"*, *"gastos en auto"*): llamá a `search_expenses(query=..., category=...)`.
- **Próximos vencimientos**: llamá a `get_upcoming_installments(days=30)`. Si no hay en 30 días, revisá `search_pending_installments()` para avisar cuál es la próxima cuota más cercana.

### E. Pago de Cuotas Existentes, Edición de Montos y Borrado de Deudas
- **Pagar cuota**: `search_pending_installments` ➔ si falta banco origen preguntalo, si no invocá `pay_installment`.
- **Editar monto de una cuota puntual** (*"cambiá la cuota 2 de Aysam a 15 mil"*): `search_pending_installments` ➔ `update_installment(installmentId, amount="15 mil")` (recalcula el total padre automáticamente).
- **Editar monto de deuda/gasto entero**: `search_expenses` / `list_recent_expenses` ➔ `update_expense(expenseId, totalAmount=...)`.
- **Borrar deuda o cuota**: identificá el registro exacto con `search_expenses` / `search_pending_installments`, confirmá brevemente con el usuario si hay riesgo de error y ejecutá `delete_expense` o `delete_installment`.
