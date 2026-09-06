-- ==============================================================================
-- ZINNIA 2026 — 003: ATOMIC PROMOTION FUNCTION
-- ==============================================================================
-- PURPOSE:
--   Atomically promotes an unverified registration from pending_registrations
--   to the canonical production tables (teams, team_members, event_registrations, team_payments).
--   Executed in ONE single PL/pgSQL transaction.
--   If ANY step or constraint fails, the entire transaction automatically rolls back,
--   leaving the staging record and production tables 100% clean and intact.

CREATE OR REPLACE FUNCTION promote_pending_team(
    p_team_id TEXT,
    p_admin TEXT DEFAULT 'Treasurer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pending RECORD;
    v_member RECORD;
    v_member_id TEXT;
    v_passport_token TEXT;
    v_event_id TEXT;
    v_idx INT := 0;
    v_created_members JSONB := '[]'::jsonb;
    v_member_obj JSONB;
    v_existing_name TEXT;
    v_expected_amount NUMERIC;
    v_submitted_amount NUMERIC;
    v_clean_team_num TEXT;
BEGIN
    -- 1. Fetch the pending staging registration row (locking row for transaction)
    SELECT * INTO v_pending
    FROM pending_registrations
    WHERE team_id = p_team_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending registration not found for team %', p_team_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Verify not already promoted to teams
    IF EXISTS (SELECT 1 FROM teams WHERE team_id = p_team_id) THEN
        RAISE EXCEPTION 'Team % has already been promoted to official symposium records', p_team_id
            USING ERRCODE = '23505';
    END IF;

    -- 3. Re-check every member email against production team_members
    FOR v_member IN 
        SELECT 
            (m->>'name')::text AS name,
            lower(trim(m->>'email'))::text AS email,
            (m->>'phone')::text AS phone,
            COALESCE((m->>'is_leader')::boolean, false) AS is_leader,
            COALESCE(m->>'food_preference', 'VEG')::text AS food_preference
        FROM jsonb_array_elements(v_pending.members) AS m
    LOOP
        SELECT tm.name INTO v_existing_name
        FROM team_members tm
        WHERE lower(trim(tm.email)) = v_member.email
        LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot promote team: Email "%" is already registered by attendee "%"', 
                v_member.email, v_existing_name
                USING ERRCODE = '23505';
        END IF;
    END LOOP;

    -- 4. Insert into teams table
    INSERT INTO teams (
        team_id,
        team_name,
        college,
        department,
        year,
        registered_events,
        payment,
        payment_status,
        created_at,
        updated_at
    ) VALUES (
        v_pending.team_id,
        v_pending.team_name,
        v_pending.college,
        v_pending.department,
        v_pending.year,
        COALESCE(v_pending.registered_events, '{}'),
        TRUE,
        'VERIFIED',
        v_pending.created_at,
        NOW()
    );

    -- Format clean team identifier for member IDs (e.g. ZIN-2026-6092 -> 2026-6092)
    v_clean_team_num := replace(v_pending.team_id, 'ZIN-', '');

    -- 5. Insert each member into team_members table
    FOR v_member IN 
        SELECT 
            (m->>'name')::text AS name,
            lower(trim(m->>'email'))::text AS email,
            (m->>'phone')::text AS phone,
            COALESCE((m->>'is_leader')::boolean, (row_number() OVER () = 1)) AS is_leader,
            COALESCE(m->>'food_preference', 'VEG')::text AS food_preference
        FROM jsonb_array_elements(v_pending.members) AS m
    LOOP
        v_idx := v_idx + 1;
        -- Globally unique, non-colliding member ID (Task 5: ATT-2026-XXXX-N)
        v_member_id := 'ATT-' || v_clean_team_num || '-' || v_idx;
        
        -- Crypto-random 32-hex passport token
        v_passport_token := encode(gen_random_bytes(16), 'hex');

        INSERT INTO team_members (
            id,
            team_id,
            name,
            email,
            phone,
            is_leader,
            food_preference,
            passport_token,
            passport_issued_at,
            created_at
        ) VALUES (
            v_member_id,
            v_pending.team_id,
            v_member.name,
            v_member.email,
            v_member.phone,
            v_member.is_leader,
            v_member.food_preference,
            v_passport_token,
            NOW(),
            NOW()
        );

        -- Build member object for return JSONB
        v_member_obj := jsonb_build_object(
            'id', v_member_id,
            'team_id', v_pending.team_id,
            'name', v_member.name,
            'email', v_member.email,
            'phone', v_member.phone,
            'is_leader', v_member.is_leader,
            'food_preference', v_member.food_preference,
            'passport_token', v_passport_token
        );
        v_created_members := v_created_members || v_member_obj;
    END LOOP;

    -- 6. Insert into event_registrations table
    IF v_pending.registered_events IS NOT NULL THEN
        FOREACH v_event_id IN ARRAY v_pending.registered_events
        LOOP
            INSERT INTO event_registrations (
                team_id,
                event_id,
                team_name,
                registered_at
            ) VALUES (
                v_pending.team_id,
                v_event_id,
                v_pending.team_name,
                NOW()
            )
            ON CONFLICT (team_id, event_id) DO NOTHING;
        END LOOP;
    END IF;

    -- 7. Insert into team_payments table
    v_expected_amount := COALESCE(v_pending.expected_amount, v_idx * 250);
    v_submitted_amount := COALESCE(v_pending.submitted_amount, v_expected_amount);

    INSERT INTO team_payments (
        team_id,
        expected_amount,
        submitted_amount,
        utr_number,
        payment_status,
        payment_submitted_at,
        payment_verified_at,
        verified_by,
        created_at,
        updated_at
    ) VALUES (
        v_pending.team_id,
        v_expected_amount,
        v_submitted_amount,
        v_pending.utr_number,
        'VERIFIED',
        v_pending.updated_at,
        NOW(),
        p_admin,
        v_pending.created_at,
        NOW()
    )
    ON CONFLICT (team_id) DO UPDATE SET
        payment_status = 'VERIFIED',
        payment_verified_at = NOW(),
        verified_by = p_admin,
        updated_at = NOW();

    -- 8. Delete from staging table (cascades to pending_registration_emails)
    DELETE FROM pending_registrations
    WHERE team_id = p_team_id;

    -- 9. Return success payload with all created member records
    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_pending.team_id,
        'team_name', v_pending.team_name,
        'members', v_created_members,
        'registered_events', to_jsonb(v_pending.registered_events),
        'expected_amount', v_expected_amount,
        'submitted_amount', v_submitted_amount,
        'utr_number', v_pending.utr_number,
        'payment_status', 'VERIFIED'
    );
END;
$$;
