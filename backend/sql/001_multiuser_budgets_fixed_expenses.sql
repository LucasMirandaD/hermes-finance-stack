-- =============================================================================
-- Migration 001: Multi-user Members, Shared Allocations, Budgets & Fixed Expenses
-- Safe to re-run (idempotent) on existing production PostgreSQL databases.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  telegram_username VARCHAR(100) UNIQUE,
  telegram_id VARCHAR(64) UNIQUE,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_telegram_username ON members (telegram_username);
CREATE INDEX IF NOT EXISTS idx_members_telegram_id ON members (telegram_id);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'IMPUESTOS_Y_SERVICIOS',
  estimated_amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  day_of_month SMALLINT NOT NULL DEFAULT 10,
  frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_name VARCHAR(100),
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
  paid_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  default_allocations JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_expenses (is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_merchant ON recurring_expenses (merchant_name);

CREATE TABLE IF NOT EXISTS category_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100) NOT NULL,
  monthly_amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  alert_threshold_pct SMALLINT NOT NULL DEFAULT 80,
  scope VARCHAR(20) NOT NULL DEFAULT 'ALL',
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_category_currency ON category_budgets (category, currency);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON category_budgets (is_active);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_scope ON expenses (scope);
CREATE INDEX IF NOT EXISTS idx_expenses_is_fixed ON expenses (is_fixed);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_member ON expenses (paid_by_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses (recurring_expense_id);

CREATE TABLE IF NOT EXISTS expense_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  percentage NUMERIC(5, 2) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_expense ON expense_allocations (expense_id);
CREATE INDEX IF NOT EXISTS idx_allocations_member ON expense_allocations (member_id);
