-- =====================================================================
-- 0047_remove-stale-team-members.sql
-- Purpose: Mark two leftover team_members as REMOVED. Prefixes given by
--          the owner: 5a38c5bc… and 1f30d06a…. 0045 is already applied;
--          0046 is the Openpay migration, so this file is 0047.
--
-- The two prefixes must match exactly two rows. The UPDATE then changes
-- 2 rows, or 0 when both are already REMOVED. Any other count aborts.
-- Does not rewrite payment apply SQL. Does not touch Openpay.
-- =====================================================================

DO $$
DECLARE
  v_matched integer;
  v_updated integer;
BEGIN
  SELECT count(*) INTO v_matched
  FROM public.team_members
  WHERE id::text LIKE '5a38c5bc%'
     OR id::text LIKE '1f30d06a%';

  IF v_matched <> 2 THEN
    RAISE EXCEPTION 'expected exactly 2 team_members for the stale prefixes, found %', v_matched;
  END IF;

  UPDATE public.team_members
  SET state = 'REMOVED',
      updated_at = now()
  WHERE (id::text LIKE '5a38c5bc%' OR id::text LIKE '1f30d06a%')
    AND state IS DISTINCT FROM 'REMOVED';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 0 AND v_updated <> 2 THEN
    RAISE EXCEPTION 'expected 0 or 2 team_members updated, got %', v_updated;
  END IF;
END $$;
