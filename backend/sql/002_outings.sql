-- =============================================================================
-- Migration 002: Shared Outings / Group Event Expenses ("Salidas")
-- Safe to re-run (idempotent) on existing PostgreSQL databases.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS outings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outings_status ON outings (status);

CREATE TABLE IF NOT EXISTS outing_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outing_id UUID NOT NULL REFERENCES outings(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idx_outing_participants_unique UNIQUE (outing_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_outing_participants_outing ON outing_participants (outing_id);

CREATE TABLE IF NOT EXISTS outing_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outing_id UUID NOT NULL REFERENCES outings(id) ON DELETE CASCADE,
  paid_by_participant_id UUID NOT NULL REFERENCES outing_participants(id) ON DELETE RESTRICT,
  description VARCHAR(255) NOT NULL,
  merchant_name VARCHAR(150),
  amount NUMERIC(14, 2) NOT NULL,
  expense_date DATE NOT NULL,
  split_mode VARCHAR(20) NOT NULL DEFAULT 'EQUAL',
  shares JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outing_expenses_outing ON outing_expenses (outing_id);
CREATE INDEX IF NOT EXISTS idx_outing_expenses_payer ON outing_expenses (paid_by_participant_id);
