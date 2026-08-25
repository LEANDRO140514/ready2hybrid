-- =====================================================================
-- 0017_operational-identity-assignments.sql
-- Purpose: Canonical operational identity, operational areas, and
--          operational assignments schema for Ready2Hybrid Event Entry
--          (SPEC-060 / R2H-T2-2B).
-- Authority: Project Owner approval of R2H-T2-2B definition and explicit
--            authorization of R2H-T2-2B1 — LOCAL SCHEMA AUTHORING only.
--
-- Scope of this migration:
--  · CREATE EXTENSION btree_gist (required for ACTIVE overlap EXCLUDE).
--  · Additive UNIQUE (id, event_code) on public.event_days for composite FKs.
--  · Tables: operational_operators, operational_areas, operational_assignments.
--  · Composite FKs to events(id, code) and event_days(id, event_code).
--  · EXCLUDE USING gist with tstzrange '[)' for ACTIVE non-overlap.
--  · Internal integrity trigger functions (area day-scope; supersession).
--  · RLS ENABLE + FORCE; REVOKE browser roles; zero policies.
--
-- THIS MIGRATION DOES NOT ACHIEVE TRUE LEAST PRIVILEGE.
-- TRUE LEAST PRIVILEGE = NOT CLAIMED
-- project_admin / BYPASSRLS = PLATFORM LIMITATION
-- (SPEC-060-R011 / RL-060-001)
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
--
-- Explicitly out of scope:
--  · Seeds, real auth_user_id, real doors/areas, OWNER bootstrap
--  · Business RPC / Edge Functions / admin commands
--  · activity_log writes
--  · Overlap fallback triggers / SELECT-EXISTS concurrency-unsafe checks
--  · Frontend integration, manifest, QR, check-in
--  · Main / production apply (not authorized by T2-2B1)
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Extension required for equality operators in GiST EXCLUDE
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- B. Additive catalog candidate key (event_days has no event_id column;
--    days relate to events only via event_code — see 0001/0002).
-- ---------------------------------------------------------------------
ALTER TABLE public.event_days
  ADD CONSTRAINT uq_event_days_id_event_code
  UNIQUE (id, event_code);

COMMENT ON CONSTRAINT uq_event_days_id_event_code ON public.event_days IS
  'R2H-T2-2B: candidate key enabling composite FKs (event_day_id, event_code). Additive; does not alter sales semantics.';

-- ---------------------------------------------------------------------
-- C/D. operational_operators
-- ---------------------------------------------------------------------
CREATE TABLE public.operational_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_operational_operators_auth_user_id UNIQUE (auth_user_id),
  CONSTRAINT ck_operational_operators_status
    CHECK (status IN ('ACTIVE', 'DISABLED')),
  CONSTRAINT ck_operational_operators_auth_user_id_nonempty
    CHECK (btrim(auth_user_id) <> ''),
  CONSTRAINT ck_operational_operators_display_name_nonempty
    CHECK (btrim(display_name) <> '')
);

COMMENT ON TABLE public.operational_operators IS
  'SPEC-060 operational identity; distinct from buyer/participant/medical/financial. RLS deny-by-default (R2H-T2-2B). TRUE LEAST PRIVILEGE = NOT CLAIMED; project_admin / BYPASSRLS = PLATFORM LIMITATION.';

COMMENT ON COLUMN public.operational_operators.auth_user_id IS
  'InsForge Auth user id (text). Not seeded in this migration; no hardcoded OWNER.';

-- ---------------------------------------------------------------------
-- E. operational_areas
-- ---------------------------------------------------------------------
CREATE TABLE public.operational_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  event_code text NOT NULL,
  event_day_id uuid NULL,
  code text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_operational_areas_event_code UNIQUE (event_id, code),
  CONSTRAINT uq_operational_areas_id_event UNIQUE (id, event_id, event_code),
  CONSTRAINT ck_operational_areas_status
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT ck_operational_areas_code_nonempty
    CHECK (btrim(code) <> ''),
  CONSTRAINT ck_operational_areas_display_name_nonempty
    CHECK (btrim(display_name) <> ''),
  CONSTRAINT fk_operational_areas_event_id_code
    FOREIGN KEY (event_id, event_code)
    REFERENCES public.events (id, code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_operational_areas_event_day_id_code
    FOREIGN KEY (event_day_id, event_code)
    REFERENCES public.event_days (id, event_code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.operational_areas IS
  'SPEC-060 minimal operational area/door catalog. No real venue layout seeds in T2-2B1. Maps to T2-1B doorOrAreaId. TRUE LEAST PRIVILEGE = NOT CLAIMED.';

-- ---------------------------------------------------------------------
-- F. operational_assignments
-- ---------------------------------------------------------------------
CREATE TABLE public.operational_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  role text NOT NULL,
  event_id uuid NOT NULL,
  event_code text NOT NULL,
  event_day_id uuid NOT NULL,
  area_id uuid NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  status text NOT NULL,
  source_version bigint NOT NULL DEFAULT 1,
  supersedes_assignment_id uuid NULL,
  created_by_actor_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_actor_ref text NULL,
  revoked_at timestamptz NULL,
  status_reason text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_operational_assignments_role
    CHECK (role IN (
      'OWNER',
      'OPERATIONS_MANAGER',
      'CHECKIN_STAFF',
      'SOLUTION_DESK'
    )),
  CONSTRAINT ck_operational_assignments_status
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT ck_operational_assignments_valid_window
    CHECK (valid_until > valid_from),
  CONSTRAINT ck_operational_assignments_source_version
    CHECK (source_version >= 1),
  CONSTRAINT ck_operational_assignments_created_by_nonempty
    CHECK (btrim(created_by_actor_ref) <> ''),
  CONSTRAINT ck_operational_assignments_revoked_by_nonempty
    CHECK (revoked_by_actor_ref IS NULL OR btrim(revoked_by_actor_ref) <> ''),
  CONSTRAINT ck_operational_assignments_status_reason_nonempty
    CHECK (status_reason IS NULL OR btrim(status_reason) <> ''),
  CONSTRAINT ck_operational_assignments_revoke_fields
    CHECK (
      (
        status = 'REVOKED'
        AND revoked_at IS NOT NULL
        AND revoked_by_actor_ref IS NOT NULL
      )
      OR (
        status IN ('ACTIVE', 'SUSPENDED')
        AND revoked_at IS NULL
        AND revoked_by_actor_ref IS NULL
      )
    ),
  CONSTRAINT ck_operational_assignments_role_area
    CHECK (
      (
        role IN ('CHECKIN_STAFF', 'SOLUTION_DESK')
        AND area_id IS NOT NULL
      )
      OR (
        role IN ('OWNER', 'OPERATIONS_MANAGER')
      )
    ),
  CONSTRAINT ck_operational_assignments_no_self_supersede
    CHECK (
      supersedes_assignment_id IS NULL
      OR supersedes_assignment_id <> id
    ),
  CONSTRAINT fk_operational_assignments_operator
    FOREIGN KEY (operator_id)
    REFERENCES public.operational_operators (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_operational_assignments_event_id_code
    FOREIGN KEY (event_id, event_code)
    REFERENCES public.events (id, code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_operational_assignments_event_day_id_code
    FOREIGN KEY (event_day_id, event_code)
    REFERENCES public.event_days (id, event_code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_operational_assignments_area_event
    FOREIGN KEY (area_id, event_id, event_code)
    REFERENCES public.operational_areas (id, event_id, event_code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_operational_assignments_supersedes
    FOREIGN KEY (supersedes_assignment_id)
    REFERENCES public.operational_assignments (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT ex_operational_assignments_no_active_overlap
    EXCLUDE USING gist (
      operator_id WITH =,
      event_id WITH =,
      event_day_id WITH =,
      tstzrange(valid_from, valid_until, '[)') WITH &&
    )
    WHERE (status = 'ACTIVE')
);

COMMENT ON TABLE public.operational_assignments IS
  'SPEC-060 canonical operational assignment. EXPIRED is projection-only (now >= valid_until), not a persisted status. ACTIVE overlap prevented by GiST EXCLUDE with semi-open range [). TRUE LEAST PRIVILEGE = NOT CLAIMED.';

COMMENT ON COLUMN public.operational_assignments.source_version IS
  'Canonical monotonic version (bigint). T2-2C increments on mutation; frontend projection may stringify for T2-1B sourceVersion.';

COMMENT ON COLUMN public.operational_assignments.supersedes_assignment_id IS
  'Optional predecessor assignment id. Inverse via query. Same-operator/same-event enforced by trigger; business revoke/create in T2-2C.';

-- Reserved activity_log named_action values for T2-2C (documentation only; no writes here):
-- OPS_IDENTITY_CREATE, OPS_ASSIGNMENT_CREATE, OPS_ASSIGNMENT_SUSPEND,
-- OPS_ASSIGNMENT_REVOKE, OPS_ASSIGNMENT_RESTORE, OPS_ASSIGNMENT_SUPERSEDE,
-- OPS_OWNER_BOOTSTRAP (sandbox-only; never Main/prod), OPS_AREA_CREATE.

-- ---------------------------------------------------------------------
-- H. Internal integrity guards (NOT overlap enforcement)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.operational_assignments_area_day_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_area_event_day_id uuid;
BEGIN
  IF NEW.area_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.event_day_id
  INTO v_area_event_day_id
  FROM public.operational_areas AS a
  WHERE a.id = NEW.area_id
    AND a.event_id = NEW.event_id
    AND a.event_code = NEW.event_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'operational_assignments: area_id % is not an operational_areas row for event_id % / event_code %',
      NEW.area_id, NEW.event_id, NEW.event_code
      USING ERRCODE = '23514';
  END IF;

  IF v_area_event_day_id IS NOT NULL
     AND v_area_event_day_id IS DISTINCT FROM NEW.event_day_id THEN
    RAISE EXCEPTION
      'operational_assignments: day-scoped area % requires event_day_id %, got %',
      NEW.area_id, v_area_event_day_id, NEW.event_day_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.operational_assignments_supersede_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_operator_id uuid;
  v_event_id uuid;
  v_event_code text;
BEGIN
  IF NEW.supersedes_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.operator_id, s.event_id, s.event_code
  INTO v_operator_id, v_event_id, v_event_code
  FROM public.operational_assignments AS s
  WHERE s.id = NEW.supersedes_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'operational_assignments: supersedes_assignment_id % does not exist',
      NEW.supersedes_assignment_id
      USING ERRCODE = '23503';
  END IF;

  IF v_operator_id IS DISTINCT FROM NEW.operator_id THEN
    RAISE EXCEPTION
      'operational_assignments: supersedes_assignment_id % belongs to a different operator',
      NEW.supersedes_assignment_id
      USING ERRCODE = '23514';
  END IF;

  IF v_event_id IS DISTINCT FROM NEW.event_id
     OR v_event_code IS DISTINCT FROM NEW.event_code THEN
    RAISE EXCEPTION
      'operational_assignments: supersedes_assignment_id % belongs to a different event',
      NEW.supersedes_assignment_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.operational_assignments_area_day_guard() IS
  'Internal integrity trigger function only. Not a business RPC. No data writes.';

COMMENT ON FUNCTION public.operational_assignments_supersede_guard() IS
  'Internal integrity trigger function only. Not a business RPC. No data writes.';

CREATE TRIGGER trg_operational_assignments_area_day_guard
  BEFORE INSERT OR UPDATE OF area_id, event_day_id, event_id, event_code
  ON public.operational_assignments
  FOR EACH ROW
  EXECUTE PROCEDURE public.operational_assignments_area_day_guard();

CREATE TRIGGER trg_operational_assignments_supersede_guard
  BEFORE INSERT OR UPDATE OF supersedes_assignment_id, operator_id, event_id, event_code
  ON public.operational_assignments
  FOR EACH ROW
  EXECUTE PROCEDURE public.operational_assignments_supersede_guard();

REVOKE ALL ON FUNCTION public.operational_assignments_area_day_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operational_assignments_area_day_guard() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.operational_assignments_supersede_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operational_assignments_supersede_guard() FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- J. RLS deny-by-default + browser revoke (zero permissive policies)
-- ---------------------------------------------------------------------
ALTER TABLE public.operational_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_operators FORCE ROW LEVEL SECURITY;

ALTER TABLE public.operational_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_areas FORCE ROW LEVEL SECURITY;

ALTER TABLE public.operational_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_assignments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_operators FROM PUBLIC;
REVOKE ALL ON TABLE public.operational_operators FROM anon, authenticated;

REVOKE ALL ON TABLE public.operational_areas FROM PUBLIC;
REVOKE ALL ON TABLE public.operational_areas FROM anon, authenticated;

REVOKE ALL ON TABLE public.operational_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.operational_assignments FROM anon, authenticated;
