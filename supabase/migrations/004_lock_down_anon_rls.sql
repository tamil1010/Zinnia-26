-- =============================================================================
-- 004_lock_down_anon_rls.sql
--
-- WHY THIS EXISTS
-- The publishable ("anon") key is compiled into the public JavaScript bundle,
-- so anyone who opens the site can read it and call the REST API with it.
-- That is by design and is only safe when Row Level Security actually blocks
-- the anon role.
--
-- On this project it did NOT. With the anon key alone the following succeeded:
--   GET    /rest/v1/teams               -> 200, full participant rows
--   GET    /rest/v1/team_members        -> 200, names + email addresses
--   GET    /rest/v1/event_registrations -> 200
--   DELETE /rest/v1/teams               -> 204 (authorised)
--   DELETE /rest/v1/team_members        -> 204 (authorised)
--   PATCH  /rest/v1/teams               -> 204 (authorised)
--
-- i.e. any visitor could read every registrant's contact details and delete
-- or alter the whole registration set.
--
-- This migration removes all anon access except the public events listing.
-- The Flask backend uses the service_role key, which bypasses RLS, so every
-- server-side flow keeps working.
-- =============================================================================

-- 1. Drop every existing policy on the protected tables ------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'teams', 'team_members', 'event_registrations', 'team_payments',
        'attendance', 'passport_dispatch', 'admin_users', 'admin_profiles',
        'event_coordinators', 'pending_registrations'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2. Force RLS on every table that holds participant or admin data ------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teams', 'team_members', 'event_registrations', 'team_payments',
    'attendance', 'passport_dispatch', 'admin_users', 'admin_profiles',
    'event_coordinators', 'pending_registrations'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- FORCE also applies RLS to the table owner, so a permissive owner
      -- context cannot silently re-open access.
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3. Revoke the default table grants from the browser-facing roles -------------
--    RLS with zero policies already denies everything, but revoking the grant
--    means the request is rejected before any policy evaluation.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teams', 'team_members', 'event_registrations', 'team_payments',
    'attendance', 'passport_dispatch', 'admin_users', 'admin_profiles',
    'event_coordinators', 'pending_registrations'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 4. The one thing the public site legitimately needs: the events listing ------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.events TO anon, authenticated;

-- =============================================================================
-- VERIFY AFTER APPLYING (replace <ANON_KEY> / <PROJECT>):
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     'https://<PROJECT>.supabase.co/rest/v1/team_members?select=*&limit=1' \
--     -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>'
--   expect 401 or 404  (was 200)
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     'https://<PROJECT>.supabase.co/rest/v1/events?select=*&limit=1' \
--     -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <ANON_KEY>'
--   expect 200
-- =============================================================================
