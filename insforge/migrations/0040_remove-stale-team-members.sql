-- =====================================================================
-- 0040_remove-stale-team-members.sql
-- Purpose: Mark two leftover team_members as REMOVED. Prefixes given by
--          the owner: 5a38c5bc… and 1f30d06a…. Full ids are resolved
--          by prefix so the file stays readable; the UPDATE is
--          idempotent (already-REMOVED rows stay REMOVED).
--
-- Do NOT apply to Main without explicit owner authorization.
-- Does not rewrite payment apply SQL. Does not touch Openpay.
-- =====================================================================

UPDATE public.team_members
SET state = 'REMOVED',
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM public.team_members
  WHERE id::text LIKE '5a38c5bc%'
     OR id::text LIKE '1f30d06a%'
)
  AND state IS DISTINCT FROM 'REMOVED';
