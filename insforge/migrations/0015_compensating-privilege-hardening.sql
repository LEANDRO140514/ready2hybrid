-- =====================================================================
-- 0015_compensating-privilege-hardening.sql
-- Purpose: COMPENSATING privilege hardening for the shared `project_admin`
--          runtime identity used by all IMPL-14A Edge Functions, and for
--          the `anon`/`authenticated` roles on the 24 canonical domain
--          tables. This migration implements exactly the Group R1
--          revocation candidates from OD-040-002-B1 (see
--          docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md,
--          section "OD-040-002-B1", section B1.9).
-- Authority: Explicit Project Owner authorization for
--            OD-040-002-B2 — Compensating privilege hardening — local
--            implementation (2026-07-30, EXECUTE — LOCAL ONLY);
--            and OD-040-002-B5-FIX1 — Runner-compatible correction of
--            migration 0015 (2026-07-31, EXECUTE — LOCAL CORRECTION ONLY).
--
-- TRANSACTION CONTROL (OD-040-002-B5-FIX1):
--   No explicit transaction-control statements are included because
--   the InsForge migration runner manages the migration transaction
--   and rejects executable BEGIN/COMMIT.
--   Historical local source (pre-B5-FIX1) hash
--   A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
--   contained BEGIN;/COMMIT; wrappers only; DCL (29 REVOKEs) unchanged.
--   Runner wrap atomicity after apply is PLATFORM_MANAGED /
--   CONFIRMED_BY_DOCUMENTATION; not re-asserted as observed here.
--
-- THIS MIGRATION DOES NOT ACHIEVE TRUE LEAST PRIVILEGE.
-- It is COMPENSATING LEAST-PRIVILEGE HARDENING only: the maximum privilege
-- reduction that is safe, evidence-backed, and self-service-achievable
-- today, without a distinct PostgreSQL role or scoped credential per
-- Edge Function (which OD-040-002-A/B1 confirmed is BLOCKED_BY_PLATFORM_
-- CAPABILITY — `project_admin` lacks CREATEROLE on both Main and the
-- impl-14a-expiry sandbox, and InsForge does not expose a self-service
-- primitive to provision one).
--
-- OWNERSHIP CAVEAT (do not remove, do not weaken):
--   `project_admin` OWNS every table touched by this migration
--   (confirmed via pg_tables.tableowner on both Main and sandbox).
--   Per PostgreSQL's documented privilege model, an object owner CAN
--   revoke their own ordinary privileges (this migration relies on
--   exactly that: "PostgreSQL allows an object owner to revoke their
--   own ordinary privileges: for example, a table owner can make the
--   table read-only to themselves by revoking their own INSERT, UPDATE,
--   DELETE, and TRUNCATE privileges" — PostgreSQL GRANT reference).
--   The REVOKE statements below are therefore expected to be
--   IMMEDIATELY EFFECTIVE against `project_admin` itself, not merely
--   cosmetic. However: "owners are always treated as holding all grant
--   options, so they can always re-grant their own privileges" — the
--   SAME `project_admin` identity that is restricted here retains the
--   structural, permanent right to GRANT itself the privilege back at
--   any time. This migration is therefore a COMPENSATING control
--   (it blocks accidental/buggy direct writes from Edge Function code
--   today) and NOT a tamper-proof boundary against a compromised or
--   malicious use of the `project_admin` identity itself — that would
--   require a distinct, non-owning role, which is platform-blocked.
--   OD-040-002-B3 must verify effectiveness empirically via
--   has_table_privilege('project_admin', '<schema>.<table>', '<priv>')
--   before and after applying this migration in the sandbox. If that
--   check ever shows a privilege still TRUE after this migration's
--   corresponding REVOKE, classify the finding
--   INEFFECTIVE_DUE_TO_OWNERSHIP / PLATFORM BLOCKED and do not assume
--   this migration achieved its intent without that confirmation.
--
-- Ownership is NOT changed by this migration (no ALTER ... OWNER TO).
-- No PostgreSQL role is created, altered, or dropped.
-- No RLS is enabled/disabled/forced/changed; no policy is created,
--   altered, or dropped (all 24 tables already have RLS ENABLED+FORCE
--   with zero policies, unchanged since 0003).
-- No function is created, replaced, or altered.
-- No new privilege is granted anywhere in the executable portion of
--   this migration (GRANT statements below appear only inside the
--   documented, non-executed ROLLBACK block at the end of this file).
--
-- Depends on:
--   0001_minimal_sales_schema.sql .. 0014_payment-pending-expiry-run-lease.sql
--   (all 24 tables and all `anon`/`authenticated` default table grants
--   already exist; this migration only narrows them)
--
-- Scope (exactly Group R1 from OD-040-002-B1, section B1.9 — no more,
-- no less):
--   1. `anon`   REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--               REFERENCES, TRIGGER on all 24 domain tables.
--   2. `authenticated` REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--               REFERENCES, TRIGGER on all 24 domain tables.
--   3. `project_admin` REVOKE INSERT, UPDATE, DELETE, TRUNCATE on
--               `events` and `products` (SELECT is retained — required
--               directly by `mp-create-checkout` and by
--               `checkout_start_tx`/`ticket_issue_one_registration`/
--               `team_apply_payment_outcome`).
--   4. `project_admin` REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
--               on `event_days` and `participant_sensitive_profiles`
--               (zero references in any RPC body across 0001–0014;
--               `UNUSED_AND_REVOCABLE` per OD-040-002-B1).
--   5. `project_admin` REVOKE UPDATE on `activity_log` (append-only
--               audit trail by design; INSERT is retained — every
--               business RPC inserts into this table).
--
-- Explicitly OUT of scope for this migration (Group R2/R3 from
-- OD-040-002-B1 — deferred, not revoked here):
--   - DELETE/TRUNCATE on the other 20 `project_admin`-write-bearing
--     tables (registrations, teams, team_members, capability_credentials,
--     waiver_documents, waiver_acceptances, orders, order_items,
--     capacity_holds, payments, payment_verification_records,
--     webhook_events, idempotency_records, tickets,
--     ticket_credential_generations, access_entitlements,
--     outbox_delivery_jobs, buyer_contacts, participants) — unused
--     today per the same grep evidence, but deliberately excluded from
--     this first, narrowly-scoped migration pending explicit Project
--     Owner sign-off on a broader blast radius (Group R2).
--   - `outbox_delivery_jobs` UPDATE/DELETE — reserved for a future
--     outbox worker that does not exist yet in this repository.
--   - `EXECUTE` on `ticket_issue_after_payment`,
--     `ticket_issue_after_team_eligible`, `team_apply_payment_outcome`
--     (callers NOT_OBSERVABLE per OD-040-002-B1 §B1.5).
--   - Any new RPC, any new role, any new policy.
--
-- REVOKE ALL PRIVILEGES ON TABLE ... FROM anon/authenticated could have
-- been used to express items 1–2 more tersely, but this migration lists
-- every privilege explicitly by name, on every table by qualified name,
-- to keep the executable SQL auditable line-by-line against the
-- OD-040-002-B1 grant matrix without relying on the reader trusting
-- what "ALL" expands to on a given PostgreSQL version.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. anon / authenticated: remove all direct table privileges on the
--    24 canonical domain tables. Defense-in-depth alongside the
--    existing RLS ENABLED+FORCE+zero-policies fail-closed pattern
--    (0003): today these roles are already denied at the row level by
--    RLS; after this migration they are additionally denied at the
--    table-grant level, so a future accidental policy addition cannot
--    silently re-expose these tables to `anon`/`authenticated`.
-- ---------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.event_days FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.products FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.buyer_contacts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participants FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participant_sensitive_profiles FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.registrations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.teams FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.team_members FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capability_credentials FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_documents FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_acceptances FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orders FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_items FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capacity_holds FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_verification_records FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.webhook_events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.idempotency_records FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tickets FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ticket_credential_generations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.access_entitlements FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_log FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.outbox_delivery_jobs FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. project_admin: revoke the Group R1 unused direct-DML surface
--    confirmed by exhaustive grep of every RPC body in 0001–0014
--    (OD-040-002-B1, sections B1.3 and B1.7). SELECT is preserved
--    wherever any Edge Function or RPC actually reads the table.
-- ---------------------------------------------------------------------

-- events / products: catalog tables. SELECT is required directly by
-- mp-create-checkout and by checkout_start_tx / ticket_issue_one_
-- registration / team_apply_payment_outcome (v_product/v_event lookups).
-- INSERT/UPDATE/DELETE/TRUNCATE have zero occurrences anywhere in
-- 0001-0014 against these two tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;

-- event_days / participant_sensitive_profiles: zero references (read or
-- write) in any RPC body across 0001-0014. Classified
-- UNUSED_AND_REVOCABLE in OD-040-002-B1 for all of SELECT, INSERT,
-- UPDATE, DELETE, TRUNCATE (REFERENCES/TRIGGER are retained per the
-- uniform R3 DDL-privilege rule documented in OD-040-002-B1 section
-- B1.7 footnote: they are unreachable via the @insforge/sdk DML surface
-- and are needed by whichever role runs future migrations under this
-- same shared identity).
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;

-- activity_log: append-only audit trail by design. Every RPC that
-- mutates a business table also INSERTs into activity_log in the same
-- transaction; zero UPDATE/DELETE against activity_log exists anywhere
-- in 0001-0014. Revoking UPDATE here makes the audit trail's
-- insert-only guarantee enforceable at the engine level, not only by
-- code review, for the project_admin identity itself.
REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;

-- =====================================================================
-- ROLLBACK (documented only — NOT executed by this migration file).
-- If OD-040-002-B3 sandbox validation fails, or the Project Owner
-- otherwise decides to revert, run exactly the statements below as a
-- separate, explicitly-authorized operation. This restores exactly the
-- privileges this migration revoked — nothing more (no new privilege
-- is introduced by this rollback that did not already exist
-- immediately before 0015 was applied).
--
-- After running the rollback, confirm restoration with:
--   SELECT has_table_privilege('anon', 'public.<table>', '<priv>');
--   SELECT has_table_privilege('authenticated', 'public.<table>', '<priv>');
--   SELECT has_table_privilege('project_admin', 'public.<table>', '<priv>');
-- for every (table, privilege) pair listed below; each must return
-- true after the rollback, matching the pre-0015 baseline captured in
-- OD-040-002-B1/B2.
--
-- BEGIN;
--
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.events TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.event_days TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.products TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.buyer_contacts TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participants TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participant_sensitive_profiles TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.registrations TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.teams TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.team_members TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capability_credentials TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_documents TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_acceptances TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orders TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_items TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capacity_holds TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_verification_records TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.webhook_events TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.idempotency_records TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tickets TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ticket_credential_generations TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.access_entitlements TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_log TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.outbox_delivery_jobs TO anon, authenticated;
--
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events TO project_admin;
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products TO project_admin;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days TO project_admin;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles TO project_admin;
-- GRANT UPDATE ON TABLE public.activity_log TO project_admin;
--
-- COMMIT;
-- =====================================================================
