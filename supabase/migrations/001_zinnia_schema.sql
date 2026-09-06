-- ==============================================================================
-- ZINNIA 2026 — CANONICAL DATABASE SCHEMA MIGRATION
-- Migration: 001_zinnia_schema.sql
-- Single Source of Truth for Participant Site & Admin Panel
-- ==============================================================================

-- 1. Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- DROP OBSOLETE TABLES & COLUMNS (Wristband removal & legacy cleanup)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS hand_bands CASCADE;

-- ------------------------------------------------------------------------------
-- TABLE: events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    mission_name TEXT NOT NULL,
    title TEXT NOT NULL,
    tagline TEXT,
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    clearance_level TEXT DEFAULT 'LEVEL 01',
    venue TEXT,
    schedule_time TEXT,
    duration TEXT,
    team_size_min INT NOT NULL DEFAULT 1,
    team_size_max INT NOT NULL DEFAULT 2, -- Option A: Enforce max 2 participants
    is_single_event_only BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    description TEXT,
    rules TEXT[] DEFAULT '{}',
    coordinators JSONB DEFAULT '[]'::jsonb,
    prizes JSONB DEFAULT '{}'::jsonb,
    registration_fee NUMERIC DEFAULT 250,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure column constraints and values if table already existed
ALTER TABLE events ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS mission_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS team_size_min INT DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS team_size_max INT DEFAULT 2;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_time TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS coordinators JSONB DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- TABLE: teams
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    team_id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    college TEXT NOT NULL,
    department TEXT NOT NULL,
    year TEXT NOT NULL,
    registered_events TEXT[] NOT NULL DEFAULT '{}',
    payment BOOLEAN NOT NULL DEFAULT false,
    payment_status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT' 
        CHECK (payment_status IN ('AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS payment BOOLEAN DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'AWAITING_PAYMENT';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS registered_events TEXT[] DEFAULT '{}';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- TABLE: team_members
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_leader BOOLEAN NOT NULL DEFAULT false,
    food_preference TEXT NOT NULL DEFAULT 'VEG' CHECK (food_preference IN ('VEG', 'NON_VEG')),
    passport_token TEXT NOT NULL,
    passport_issued_at TIMESTAMPTZ DEFAULT NOW(),
    passport_sent_at TIMESTAMPTZ,
    food_collected BOOLEAN NOT NULL DEFAULT false,
    food_collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema sync for existing team_members table
ALTER TABLE team_members DROP COLUMN IF EXISTS band_id CASCADE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS food_preference TEXT NOT NULL DEFAULT 'VEG';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS food_collected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS food_collected_at TIMESTAMPTZ;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS passport_issued_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS passport_sent_at TIMESTAMPTZ;

-- Database-level uniqueness constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_team_members_email'
    ) THEN
        ALTER TABLE team_members ADD CONSTRAINT uq_team_members_email UNIQUE (email);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_team_members_passport_token'
    ) THEN
        ALTER TABLE team_members ADD CONSTRAINT uq_team_members_passport_token UNIQUE (passport_token);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TABLE: event_registrations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registrations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_name TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_event_registration UNIQUE (team_id, event_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_team_event_registration'
    ) THEN
        ALTER TABLE event_registrations ADD CONSTRAINT uq_team_event_registration UNIQUE (team_id, event_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TABLE: team_payments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_payments (
    team_id TEXT PRIMARY KEY REFERENCES teams(team_id) ON DELETE CASCADE,
    expected_amount NUMERIC NOT NULL,
    submitted_amount NUMERIC,
    utr_number TEXT,
    payment_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK (payment_status IN ('AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
    rejection_reason TEXT,
    payment_submitted_at TIMESTAMPTZ,
    payment_verified_at TIMESTAMPTZ,
    verified_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS expected_amount NUMERIC;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS submitted_amount NUMERIC;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS utr_number TEXT;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING_VERIFICATION';
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE team_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique UTR index (ignoring nulls until submitted)
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_payments_utr_number 
    ON team_payments (utr_number) 
    WHERE utr_number IS NOT NULL AND utr_number <> '';

-- ------------------------------------------------------------------------------
-- TABLE: attendance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id TEXT REFERENCES teams(team_id) ON DELETE SET NULL,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    passport_token_used TEXT NOT NULL,
    participant_name TEXT,
    college TEXT,
    checkin_type TEXT NOT NULL CHECK (checkin_type IN ('ENTRY', 'EVENT', 'FOOD')),
    event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
    event_name TEXT,
    scanned_by TEXT,
    scanned_by_id TEXT,
    location TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique indexes to prevent double check-ins strictly in the DB
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_entry 
    ON attendance (member_id) 
    WHERE checkin_type = 'ENTRY';

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_event 
    ON attendance (member_id, event_id) 
    WHERE checkin_type = 'EVENT';

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_food 
    ON attendance (member_id) 
    WHERE checkin_type = 'FOOD';

-- ------------------------------------------------------------------------------
-- TABLE: passport_dispatch
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passport_dispatch (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'EMAIL',
    status TEXT NOT NULL DEFAULT 'PENDING',
    provider_ref TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABLE: admin_users (Role-based authenticated staff & coordinators)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'TREASURER', 'GATE_ADMIN', 'FOOD_ADMIN', 'EVENT_COORDINATOR')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABLE: event_coordinators (Mapping which coordinator can scan which event)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_coordinators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_event_coordinator UNIQUE (admin_user_id, event_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_admin_event_coordinator'
    ) THEN
        ALTER TABLE event_coordinators ADD CONSTRAINT uq_admin_event_coordinator UNIQUE (admin_user_id, event_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- SEED DATA: 9 Events (Enforcing team_size_max = 2 per Option A)
-- ------------------------------------------------------------------------------
INSERT INTO events (id, code, mission_name, title, tagline, category, event_type, venue, schedule_time, duration, team_size_min, team_size_max, is_single_event_only, status)
VALUES
    ('debugging', '01', 'DEBUGGING', 'Debugging', 'Find. Fix. Conquer.', 'TECHNICAL', 'TECH', 'Auditorium 1st floor', '11:00 AM - 12:30 PM', '1 hr 30 mins', 1, 2, false, 'AVAILABLE'),
    ('the-last-signal', '02', 'THE LAST SIGNAL', 'The Last Signal', 'Decode. Transmit. Survive.', 'TECHNICAL', 'TECH', '104 class room', '11:00 AM - 12:30 PM', '1 hr 30 mins', 1, 2, false, 'AVAILABLE'),
    ('lost-at-sql', '03', 'LOST AT SQL', 'Lost at SQL', 'Query. Navigate. Extract.', 'TECHNICAL', 'TECH', 'CC2 lab', '01:30 PM - 03:00 PM', '1 hr 30 mins', 1, 2, false, 'AVAILABLE'),
    ('gadget-codes', '04', 'GADGET CODES', 'Gadget Codes (Single event)', 'Program. Wire. Automate.', 'TECHNICAL', 'TECH', 'CC1 lab', '11:00 AM - 02:30 PM', '3 hrs 30 mins', 2, 2, true, 'AVAILABLE'),
    ('paper-presentation', '05', 'PAPER PRESENTATION', 'Paper Presentation', 'Ideas that speak. Impact that lasts.', 'TECHNICAL', 'TECH', 'IT & CSE Seminar Hall', '11:00 AM - 03:00 PM', '4 hrs', 1, 2, false, 'AVAILABLE'),
    ('borderland-at-gcee', '06', 'BORDERLAND @ GCEE', 'Borderland @ Gcee', 'Survive. Strategize. Dominate.', 'NON_TECHNICAL', 'NON_TECH', '101, 102 class room', '12:00 PM - 03:00 PM', '3 hrs', 2, 2, false, 'AVAILABLE'),
    ('think-strike-and-win', '07', 'THINK, STRIKE AND WIN', 'Think,Strike and Win', 'Think fast. Strike sharp. Win all.', 'NON_TECHNICAL', 'NON_TECH', '103 class room', '12:00 PM - 02:30 PM', '2 hrs 30 mins', 2, 2, false, 'AVAILABLE'),
    ('plot-twist', '08', 'PLOT TWIST', 'Plot twist', 'Expect the unexpected.', 'NON_TECHNICAL', 'NON_TECH', '103 class room', '01:30 PM - 03:00 PM', '1 hr 30 mins', 1, 2, false, 'AVAILABLE'),
    ('short-flim', '09', 'SHORT FILM', 'Short Film', 'Freeze moments. Frame stories.', 'NON_TECHNICAL', 'NON_TECH', 'Seminar Hall 2', '01:30 PM – 02:30 PM', '1 hr', 1, 2, false, 'AVAILABLE')
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    mission_name = EXCLUDED.mission_name,
    title = EXCLUDED.title,
    tagline = EXCLUDED.tagline,
    category = EXCLUDED.category,
    event_type = EXCLUDED.event_type,
    venue = EXCLUDED.venue,
    schedule_time = EXCLUDED.schedule_time,
    duration = EXCLUDED.duration,
    team_size_min = EXCLUDED.team_size_min,
    team_size_max = EXCLUDED.team_size_max,
    is_single_event_only = EXCLUDED.is_single_event_only,
    status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- SEED DATA: Admin Users (Pre-hashed bcrypt passwords)
-- Passwords:
--   superadmin: Admin@Zinnia2026
--   treasurer:  Treasurer@Zin26
--   gate1/2:    GatePass@Zin26
--   food1/2:    FoodPass@Zin26
--   coordinators: Coord@Zin26
-- ------------------------------------------------------------------------------
INSERT INTO admin_users (username, password_hash, name, phone, role)
VALUES
    ('superadmin', '$2b$12$ntA9ni7LOB9MglGNQqVOQe7c7VhrY1PLdrcprJOYQQziOnA.ZSEBi', 'System Administrator', '+91 99999 00000', 'SUPER_ADMIN'),
    ('treasurer',  '$2b$12$tHli2PSFjQeFM4sygBRKL.V7i8nJ3P8WWpWqaeHG4gKhG1XT79GJW', 'Main Treasurer',      '+91 99999 00001', 'TREASURER'),
    ('gate1',      '$2b$12$eO7L1ljlSNGYmtiCQuFsuemnmXM.eNXkRezvMQawXr925oTP4F46W', 'Main Gate Scanner 1', '+91 99999 00002', 'GATE_ADMIN'),
    ('gate2',      '$2b$12$eO7L1ljlSNGYmtiCQuFsuemnmXM.eNXkRezvMQawXr925oTP4F46W', 'Main Gate Scanner 2', '+91 99999 00003', 'GATE_ADMIN'),
    ('food1',      '$2b$12$avNSuVmeYDmDV/nUwq/PquHlf1KpAj/9MVRm/Kegb8fKFgUhr..DO', 'Food Counter 1',      '+91 99999 00004', 'FOOD_ADMIN'),
    ('food2',      '$2b$12$avNSuVmeYDmDV/nUwq/PquHlf1KpAj/9MVRm/Kegb8fKFgUhr..DO', 'Food Counter 2',      '+91 99999 00005', 'FOOD_ADMIN'),

    -- 18 Event Coordinators (2 per event)
    ('debugging1',  '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Prabakaran D',       '+91 63692 20453', 'EVENT_COORDINATOR'),
    ('debugging2',  '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Deepakala',          '+91 93425 60879', 'EVENT_COORDINATOR'),
    ('signal1',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Abdul Razith',       '+91 90470 57868', 'EVENT_COORDINATOR'),
    ('signal2',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Sri Karthika',       '+91 93618 40633', 'EVENT_COORDINATOR'),
    ('sql1',        '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Vignesh',            '+91 80154 91593', 'EVENT_COORDINATOR'),
    ('sql2',        '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Indhumathi',         '+91 80729 51205', 'EVENT_COORDINATOR'),
    ('gadget1',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Muhammed Umer',      '+91 94458 86230', 'EVENT_COORDINATOR'),
    ('gadget2',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Swathi',             '+91 93610 63211', 'EVENT_COORDINATOR'),
    ('paper1',      '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Kanishkar',          '+91 87787 84819', 'EVENT_COORDINATOR'),
    ('paper2',      '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Karishma',           '+91 84381 94881', 'EVENT_COORDINATOR'),
    ('borderland1', '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Praveenraja',        '+91 63822 79383', 'EVENT_COORDINATOR'),
    ('borderland2', '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Kaviyasri',          '+91 76393 67928', 'EVENT_COORDINATOR'),
    ('strike1',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Sivabalan',          '+91 63845 11989', 'EVENT_COORDINATOR'),
    ('strike2',     '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Yogeshwari',         '+91 90809 99795', 'EVENT_COORDINATOR'),
    ('plottwist1',  '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Hariharan',          '+91 88388 69405', 'EVENT_COORDINATOR'),
    ('plottwist2',  '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Akshaya',            '+91 63818 83013', 'EVENT_COORDINATOR'),
    ('film1',       '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Aswin Sanjeev Kumar', '+91 79040 98102', 'EVENT_COORDINATOR'),
    ('film2',       '$2b$12$BDdAMNLQx/R2WDCZB9PjbexYpAhtFUeWz8/WCXtZ4PznjGGA3hN3O', 'Harshini',           '+91 93634 52517', 'EVENT_COORDINATOR')
ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    is_active = true;

-- ------------------------------------------------------------------------------
-- SEED DATA: Event Coordinator Assignments
-- ------------------------------------------------------------------------------
INSERT INTO event_coordinators (admin_user_id, event_id)
SELECT u.id, m.event_id
FROM (
    VALUES 
        ('debugging1',  'debugging'),
        ('debugging2',  'debugging'),
        ('signal1',     'the-last-signal'),
        ('signal2',     'the-last-signal'),
        ('sql1',        'lost-at-sql'),
        ('sql2',        'lost-at-sql'),
        ('gadget1',     'gadget-codes'),
        ('gadget2',     'gadget-codes'),
        ('paper1',      'paper-presentation'),
        ('paper2',      'paper-presentation'),
        ('borderland1', 'borderland-at-gcee'),
        ('borderland2', 'borderland-at-gcee'),
        ('strike1',     'think-strike-and-win'),
        ('strike2',     'think-strike-and-win'),
        ('plottwist1',  'plot-twist'),
        ('plottwist2',  'plot-twist'),
        ('film1',       'short-flim'),
        ('film2',       'short-flim')
) AS m(username, event_id)
JOIN admin_users u ON u.username = m.username
ON CONFLICT (admin_user_id, event_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Service Role key automatically bypasses RLS.
-- Public anon key is restricted.
-- ------------------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_coordinators ENABLE ROW LEVEL SECURITY;

-- Allow public read on events
DROP POLICY IF EXISTS "Public can view events" ON events;
CREATE POLICY "Public can view events" ON events FOR SELECT USING (true);
