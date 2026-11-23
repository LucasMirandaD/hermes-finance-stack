---
name: monthly-summary-format
description: "Formato móvil limpio sin tablas para resúmenes mensuales de cuotas y gastos agrupados por titular"
---

# Formato de Resumen Mensual (Cuotas y Gastos)

Usá este formato optimizado para lectura rápida en celular cada vez que te pidan el resumen mensual de cuotas (`get_monthly_installments_summary`) o el detalle mensual por titular (`get_financial_summary`).

## Reglas obligatorias

1. **Bloque superior (Resumen rápido)**: Líneas cortas arriba con el subtotal por cada titular + total general (ej. usando `byHolder` de `get_monthly_installments_summary` o `get_financial_summary`).
2. **Una línea por movimiento**: `[Descripción / Comercio] ([Cuota]) - $[Monto] ([DD/MM])`
3. **Sin repeticiones**: Si comercio y concepto son iguales, mostrá uno solo. Si el concepto agrega detalle útil, ponelo entre paréntesis (ej: `Tienda Z (zapatillas y medias)`).
4. **Orden por impacto**: Dentro de cada titular, ordená siempre de mayor a menor monto (ya viene ordenado en `byHolder`).
5. **Alertas visuales**: Agregá el emoji `🏁` al lado de las cuotas que terminan ese mes (`isLastInstallment: true`, ej: `3/3 🏁`). Agregá `📌` si es gasto fijo (`isFixed: true`).
6. **Cierre limpio**: Sin preguntas genéricas innecesarias. Solo si hay movimientos bajo `Sin titular`, sumá al final una línea: `¿A quién asignamos los gastos sin titular?`
7. **NUNCA usar tablas Markdown** (se rompen en pantalla de celular).

## Ejemplo de Salida

```text
📊 Resumen Cuotas Noviembre 2026

👤 Titular: $420.000
👥 Pareja / Extensión: $185.000
⚠️ Sin titular: $35.000
💰 Total del mes: $640.000

👤 Titular
• Tienda Hogar (heladera) (3/3 🏁) - $250.000 (10/11)
• Seguro Auto (📌) - $170.000 (05/11)

👥 Pareja / Extensión
• Moov (zapatillas y medias) (2/6) - $185.000 (12/11)

⚠️ Sin titular
• Farmacia Central (1/3) - $35.000 (15/11)

¿A quién asignamos los gastos sin titular?
```
