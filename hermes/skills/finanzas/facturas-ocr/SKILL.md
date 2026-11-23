---
name: facturas-ocr-gastos
description: >-
  Skill financiera integral para gestionar gastos personales y compartidos, múltiples
  miembros, gastos fijos recurrentes, presupuestos, facturas PDF, capturas bancarias,
  cuotas, resúmenes, gráficos PNG y exportaciones mediante MCP expenses.
---

# Gestión Financiera Personal y del Hogar con MCP `expenses`

## 1. Categorías Estándar (`category`)
Usá siempre una de estas categorías normalizadas:
- `IMPUESTOS_Y_SERVICIOS` (Aysam/Agua, Ecogas, Edemsa/Luz, Municipalidad, Internet, Celular)
- `SUPERMERCADO` (Coto, Carrefour, Vea, Changomas, almacén)
- `TRANSPORTE_Y_AUTO` (nafta/YPF/Shell, peajes, patente, seguro auto, mecánico)
- `PRESTAMOS_Y_SEGUROS` (préstamos bancarios, créditos, cuotas personales, financiación)
- `ALQUILER_Y_EXPENSAS` (alquiler, expensas, inmobiliaria)
- `SALUD` (obra social, farmacia, consultas médicas)
- `COMIDA_Y_SALIDAS` (restaurantes, PedidosYa, cafés)
- `TECNOLOGIA_Y_HOGAR` (electrodomésticos, tecnología, hogar, suscripciones digitales)
- `OTROS` (transferencias entre personas sin concepto claro, varios)

---

## 2. Flujos según Tipo de Solicitud

### A. Registro por Texto Libre o SMS Bancario
1. Identificá quién escribe usando el contexto del mensaje (`**User:**` o `[sender]`) y resolvé `paidBy` con `list_members()` si hay miembros configurados.
2. Extraé `merchantName`, `description`, `totalAmount` (soporta `"889 mil"`, `"1.5m"`, `"45k"`), `expenseDate` (`YYYY-MM-DD`), `paymentMethod` (`CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `MERCADO_PAGO`, `CASH`), `bankName` (solo banco **origen**, nunca destinatario), `scope` (`PERSONAL` o `SHARED`), `isFixed` y `allocations` si aplica.
3. Si el usuario menciona tarjeta ambigua o extensión familiar, consultá `list_credit_cards()` antes de registrar (o creala con `register_credit_card()` si te la piden registrar).
4. Si dice *"cuota"* con monto específico, consultá primero `search_pending_installments(search=...)`; si no hay coincidencia, registrá directamente con `register_expense`.
5. Confirmá directo con el bloque `Listo ✅` + bullets definido en `SOUL.md`.

### B. Multi-Usuario, Gastos Compartidos y Balances
- **Miembros**: `create_member`, `update_member`, `list_members`, `delete_member`.
- **Gasto compartido**: *"Pagó Sofía 60k de supermercado compartido entre los dos"* → `register_expense(..., scope="SHARED", paidBy="sofia")` (si se omite `allocations`, se divide en partes iguales entre miembros activos; si indican `70/30`, pasar `allocations=[{"member":"ana","percentage":70},{"member":"sofia","percentage":30}]`).
- **Balance / Liquidación**: *"¿Cuánto nos debemos?"* / *"Balance del mes"* → `get_shared_balance(month=...)` y mostrale total compartido, pagado vs atribuido por persona y transferencias sugeridas (`settlements`).

### C. Gastos Fijos / Recurrentes
- **Definir plantilla fija**: *"Internet es un gasto fijo de 45 mil los días 10"* → `create_recurring_expense(...)`.
- **Consultar pendientes**: *"¿Qué fijos faltan pagar este mes?"* → `get_fixed_expenses_status(month=...)`.
- **Registrar pago del mes**: *"Pagué internet 48 mil"* → `pay_recurring_expense(recurringRef="Internet", amount=48000)` (marca `isFixed=true` y vincula la plantilla).

### D. Capturas de Pantalla / Fotos de Transferencias o Tickets
1. Analizá la imagen adjunta:
   - `"Para:"` / destinatario ➔ `merchantName`.
   - `"De:"` / cuenta origen ➔ `bankName` y `paymentMethod: "BANK_TRANSFER"`.
   - Recordá que `$ 89.000` en formato argentino es `89000`.
2. **Imagen SIN texto/caption**: mostrá vista previa clara y pedí confirmación antes de `register_expense`. Cuando confirme, pasá `filePath="<ruta_imagen>"`.
3. **Imagen CON texto/caption**: ejecutá `register_expense(..., filePath="<ruta_imagen>")` directamente (NestJS archiva en Paperless en segundo plano).

### E. Facturas / Boletas en PDF
1. Leé el PDF inmediatamente con `read_file(path)`.
2. **Solo si `read_file` devuelve vacío o `<50` caracteres**, invocá `extract_scanned_pdf_ocr(filePath=path)`.
3. Si tiene vencimientos futuros o cuotas, pasá `isInstallment: true`, `totalInstallments`, `firstDueDate`, `filePath` a `register_expense`.

### F. Presupuestos por Categoría
- **Configurar tope**: `set_category_budget(category="SUPERMERCADO", monthlyAmount="250 mil", alertThresholdPct=80)`.
- **Consultar alertas/estado**: `get_budget_status(month=..., alertsOnly=...)`, `list_category_budgets()`, `delete_category_budget(budgetId)`.

### G. Resúmenes, Comparativas, Gráficos PNG y Exportaciones
- **Resúmenes**: `get_financial_summary(month=..., scope=..., memberRef=..., isFixed=...)` → incluye cashflow pagado, cuotas pendientes, desglose por categoría, banco, titular (`byHolder`), fijos vs variables, top 5, alertas de presupuesto y comparativa.
- **Cuotas del mes (formato móvil)**: `get_monthly_installments_summary(month="YYYY-MM")` siguiendo la skill `monthly-summary-format`.
- **Comparar meses**: `compare_months(monthA="2026-10", monthB="2026-11")`.
- **Top gastos**: `top_expenses(month=..., limit=10)`.
- **Búsquedas y vencimientos**: `search_expenses(query=..., category=...)`, `get_upcoming_installments(days=30)`.
- **Gráficos PNG para Telegram**: `render_chart(chartType="by_category" | "monthly_trend" | "top_expenses" | "fixed_vs_variable" | "by_holder", month=...)` → incluí la línea `MEDIA:<filePath>` sola (sin backticks) en tu respuesta final.
- **Exportar CSV / JSON**: `export_expenses(format="csv"|"json", month=...)` → incluí `MEDIA:<filePath>` sola (sin backticks) para adjuntar el archivo en Telegram.

### H. Pago de Cuotas Existentes, Edición y Borrado
- **Pagar cuota**: `search_pending_installments` ➔ si falta banco origen preguntalo, si no invocá `pay_installment`.
- **Editar cuota o gasto**: `update_installment` / `update_expense`.
- **Borrar**: identificá el registro exacto con `search_expenses` / `search_pending_installments`, pedí confirmación breve si hay riesgo de error y ejecutá `delete_expense` o `delete_installment`.
