-- ==============================================================================
-- ZINNIA 2026 — 002: PENDING REGISTRATIONS STAGING SCHEMA
-- ==============================================================================
-- PURPOSE
--   Staging table for unverified / awaiting payment symposium registrations.
--   The main tables (teams, team_members, event_registrations, team_payments)
--   strictly contain ONLY teams verified by the treasurer.

CREATE TABLE IF NOT EXISTS pending_registrations (
    team_id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    college TEXT NOT NULL,
    department TEXT NOT NULL,
    year TEXT NOT NULL,
    registered_events TEXT[] NOT NULL,
    members JSONB NOT NULL, -- list of {name, email, phone, is_leader, food_preference}
    utr_number TEXT,
    submitted_amount NUMERIC,
    expected_amount NUMERIC NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT'
        CHECK (payment_status IN ('AWAITING_PAYMENT','PENDING_VERIFICATION','REJECTED')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomically enforce unique email across pending registrations
CREATE TABLE IF NOT EXISTS pending_registration_emails (
    email TEXT PRIMARY KEY, -- lowercased email
    team_id TEXT NOT NULL REFERENCES pending_registrations(team_id) ON DELETE CASCADE
);

-- Fast lookup and uniqueness indexes
CREATE INDEX IF NOT EXISTS idx_pending_reg_status ON pending_registrations(payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_reg_utr ON pending_registrations(utr_number)
  WHERE utr_number IS NOT NULL AND utr_number <> '';
CREATE INDEX IF NOT EXISTS idx_pending_emails_team_id ON pending_registration_emails(team_id);

-- Enable RLS (Backend uses SERVICE ROLE key; no public anon access)
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registration_emails ENABLE ROW LEVEL SECURITY;
