-- ============================================================================
-- Metabase BI Queries for Hermes Finance Stack
-- Connect Metabase to PostgreSQL: host=postgres, port=5432, db=expenses_db
-- ============================================================================

-- 1. Total Pagado Mes Actual (Cashflow Real Desembolsado)
-- Excluye cuotas pendientes futuras; suma gastos únicos + cuotas con status='PAID'.
WITH monthly_paid AS (
    SELECT COALESCE(SUM(total_amount), 0) AS monto
    FROM expenses
    WHERE is_installment = false
      AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
    UNION ALL
    SELECT COALESCE(SUM(amount), 0) AS monto
    FROM expense_installments
    WHERE status = 'PAID'
      AND (
        (paid_at IS NOT NULL AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE))
        OR (paid_at IS NULL AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE))
      )
)
SELECT COALESCE(SUM(monto), 0) AS total_pagado_mes
FROM monthly_paid;

-- 2. Cuotas Pendientes Mes Actual
SELECT COALESCE(SUM(amount), 0) AS cuotas_pendientes
FROM expense_installments
WHERE status = 'PENDING'
  AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE);

-- 3. Transferencias Bancarias (Mes Actual)
WITH monthly_transfers AS (
    SELECT COALESCE(SUM(total_amount), 0) AS monto
    FROM expenses
    WHERE payment_method = 'BANK_TRANSFER'
      AND is_installment = false
      AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
    UNION ALL
    SELECT COALESCE(SUM(i.amount), 0) AS monto
    FROM expense_installments i
    JOIN expenses e ON i.expense_id = e.id
    WHERE i.status = 'PAID'
      AND (
        e.payment_method = 'BANK_TRANSFER'
        OR i.notes ILIKE '%BANK_TRANSFER%'
        OR i.notes ILIKE '%transferencia%'
      )
      AND (
        (i.paid_at IS NOT NULL AND date_trunc('month', i.paid_at) = date_trunc('month', CURRENT_DATE))
        OR (i.paid_at IS NULL AND date_trunc('month', i.due_date) = date_trunc('month', CURRENT_DATE))
      )
)
SELECT COALESCE(SUM(monto), 0) AS transferencias_mes
FROM monthly_transfers;

-- 4. Gastos con Extensiones de Terceros (Mes Actual)
WITH extension_expenses AS (
    SELECT COALESCE(SUM(e.total_amount), 0) AS monto
    FROM expenses e
    JOIN credit_cards c ON e.credit_card_id = c.id
    WHERE c.is_extension = TRUE
      AND e.is_installment = FALSE
      AND date_trunc('month', e.expense_date) = date_trunc('month', CURRENT_DATE)
    UNION ALL
    SELECT COALESCE(SUM(i.amount), 0) AS monto
    FROM expense_installments i
    JOIN expenses e ON i.expense_id = e.id
    JOIN credit_cards c ON e.credit_card_id = c.id
    WHERE c.is_extension = TRUE
      AND date_trunc('month', i.due_date) = date_trunc('month', CURRENT_DATE)
)
SELECT COALESCE(SUM(monto), 0) AS gastos_extensiones
FROM extension_expenses;

-- 5. Evolución Mensual de Gastos / Vencimientos
WITH monthly_breakdown AS (
    SELECT 
        date_trunc('month', expense_date) AS mes,
        total_amount AS monto
    FROM expenses
    WHERE is_installment = false
    UNION ALL
    SELECT 
        date_trunc('month', due_date) AS mes,
        amount AS monto
    FROM expense_installments
)
SELECT 
    TO_CHAR(mes, 'YYYY-MM') AS "Mes",
    SUM(monto) AS "Total"
FROM monthly_breakdown
GROUP BY 1
ORDER BY 1 ASC;

-- 6. Distribución por Banco / Tarjeta
WITH bank_expenses AS (
    SELECT 
      COALESCE(c.bank, e.bank_name, 'Sin Banco') AS banco,
      e.total_amount AS monto
    FROM expenses e
    LEFT JOIN credit_cards c ON e.credit_card_id = c.id
    WHERE e.is_installment = FALSE
    UNION ALL
    SELECT 
      COALESCE(c.bank, e.bank_name, SUBSTRING(i.notes FROM '\((.*?)\)'), 'Sin Banco') AS banco,
      i.amount AS monto
    FROM expense_installments i
    JOIN expenses e ON i.expense_id = e.id
    LEFT JOIN credit_cards c ON e.credit_card_id = c.id
)
SELECT 
  banco AS "Banco / Medio",
  SUM(monto) AS "Total"
FROM bank_expenses
GROUP BY 1
ORDER BY "Total" DESC;

-- 7. Gastos por Categoría
WITH cat_expenses AS (
    SELECT 
      category AS categoria,
      total_amount AS monto
    FROM expenses
    WHERE is_installment = FALSE
    UNION ALL
    SELECT 
      e.category AS categoria,
      i.amount AS monto
    FROM expense_installments i
    JOIN expenses e ON i.expense_id = e.id
)
SELECT 
  categoria AS "Categoría",
  SUM(monto) AS "Total"
FROM cat_expenses
GROUP BY 1
ORDER BY "Total" DESC;

-- 8. Próximos Vencimientos de Cuotas (Pendientes)
SELECT 
  i.due_date AS "Vencimiento",
  e.merchant_name AS "Comercio",
  e.description AS "Detalle",
  i.installment_number || '/' || i.total_installments AS "Cuota",
  i.amount AS "Monto",
  COALESCE(c.bank, e.bank_name, 'Directo') AS "Banco",
  CASE WHEN c.is_extension THEN c.holder_name ELSE 'Titular' END AS "Responsable",
  i.status AS "Estado"
FROM expense_installments i
JOIN expenses e ON i.expense_id = e.id
LEFT JOIN credit_cards c ON e.credit_card_id = c.id
WHERE i.status = 'PENDING'
ORDER BY i.due_date ASC;

-- 9. Detalle de Transferencias Bancarias
SELECT 
  e.expense_date AS "Fecha",
  e.merchant_name AS "Destino",
  e.description AS "Detalle",
  e.bank_name AS "Banco Emisor",
  e.total_amount AS "Monto",
  e.currency AS "Moneda"
FROM expenses e
WHERE e.payment_method = 'BANK_TRANSFER' AND e.is_installment = false
UNION ALL
SELECT 
  COALESCE(i.paid_at::date, i.due_date) AS "Fecha",
  e.merchant_name AS "Destino",
  e.description || ' (Cuota ' || i.installment_number || '/' || i.total_installments || ')' AS "Detalle",
  COALESCE(e.bank_name, SUBSTRING(i.notes FROM '\((.*?)\)'), 'Transferencia') AS "Banco Emisor",
  i.amount AS "Monto",
  e.currency AS "Moneda"
FROM expense_installments i
JOIN expenses e ON i.expense_id = e.id
WHERE i.status = 'PAID'
  AND (e.payment_method = 'BANK_TRANSFER' OR i.notes ILIKE '%BANK_TRANSFER%' OR i.notes ILIKE '%transferencia%')
ORDER BY "Fecha" DESC;

-- 10. Facturas y Comprobantes Archivados en Paperless
SELECT 
  e.expense_date AS "Fecha",
  e.merchant_name AS "Emisor / Comercio",
  e.description AS "Concepto",
  e.total_amount AS "Monto",
  e.paperless_document_id AS "ID Paperless",
  'http://localhost:8010/documents/' || e.paperless_document_id || '/preview' AS "Enlace Paperless"
FROM expenses e
WHERE e.paperless_document_id IS NOT NULL
ORDER BY e.expense_date DESC;
