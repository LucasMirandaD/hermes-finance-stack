---
name: onboarding
description: "Guía conversacional inicial para configurar miembros, tarjetas, gastos fijos y presupuestos por Telegram"
---

# Onboarding — Hermes Finance Stack

Skill para la **primera configuración** del hogar desde Telegram o CLI. Activá este flujo cuando el usuario diga *"empecemos"*, *"primera vez"*, *"configurar"* o cuando `health_check` muestre 0 miembros y 0 gastos.

## Límites

- **No tenés acceso a terminal** desde Telegram: la infraestructura Docker y el `.env` ya deben estar levantados.
- Todo el setup funcional vive en PostgreSQL mediante las tools MCP de `expenses`.

## Flujo Guiado (una pregunta por turno)

1. **`health_check`** (en silencio) — verificá PostgreSQL (`database.connected: true`). Si `optionalServices.paperless.status === "disabled"`, es totalmente normal en stacks sin `--profile paperless`. Si hay error de conexión MCP, explicá revisar `docker compose ps` y `scripts/smoke-test.sh`.
2. **`list_members`** —
   - Si no hay miembros: preguntá nombres (y opcionalmente `@usuario` de Telegram) de las personas que van a usar el bot o compartir gastos → registralas con `create_member`.
   - Si ya hay miembros: saludá por nombre y continuá.
3. **`list_credit_cards`** — si no hay tarjetas, preguntá si quiere registrar sus tarjetas principales (banco, red, titular/extensión, día de cierre y vencimiento) → `register_credit_card`.
4. **Gastos Fijos (opcional)** — *"¿Querés cargar tus gastos fijos del mes (alquiler, internet, expensas, servicios) para saber qué falta pagar cada mes?"* → `create_recurring_expense`.
5. **Presupuestos (opcional)** — *"¿Querés definir algún tope mensual por categoría (ej. Supermercado, Comida y Salidas)?"* → `set_category_budget`.
6. **Primer gasto de prueba** — *"¿Registramos un gasto de prueba o ya querés mandar tu primer ticket/texto?"* → `register_expense`.
7. **Cierre breve** — recordá ejemplos útiles:
   - *"Gasté 45k en supermercado con débito Galicia"*
   - *"Pagué 80 mil de internet compartido entre los dos"*
   - *"¿Qué fijos faltan pagar este mes?"* / *"¿Cuánto nos debemos?"*
   - *"Mandame un gráfico de gastos por categoría"* / *"Exportá noviembre en CSV"*

## Tono y Reglas

- Español claro y breve, **una pregunta por turno**.
- No abrumes con el listado completo de 43 tools.
- Si el usuario hace una consulta directa (*"¿cuánto gasté este mes?"*), salí inmediatamente del onboarding y respondé lo pedido.
