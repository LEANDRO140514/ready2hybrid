-- =====================================================================
-- 0024_participant-display-name.sql
-- Purpose: Add display name on public.participants for captain + teammates
--          printed on the single team ticket (T1: one registration carrier,
--          N participants, one ticket per team order).
-- Predecessor: 0001_minimal_sales_schema.sql (participants shell)
-- Authority: Project Owner confirmation 2026-08-27 (America/Merida) —
--            team capture closed design: name (nombre y apellido as one
--            string) per integrante; no invite path for this go-live flow.
-- Governance: Owner decision + evidence (NO SPEC-032 revision required).
--
-- Columns:
--  · name  text NULLABLE  — full display name (given + family as one string).
--                          Write path is a later successor (checkout_start_tx
--                          teammate_names + captain participant name).
--
-- Explicitly out of scope:
--  · email / phone / document type-ID on participants
--  · checkout_start_tx / edge Zod / fingerprint / teammate_names payload
--  · team_members / teams / invitation RPCs / ticket issuance changes
--  · Automatic backfill of existing rows (remain NULL)
--  · New RLS policies (deny-by-default + RPC unchanged)
--  · Apply to Main / sandbox (not authorized by this unit)
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

ALTER TABLE public.participants
  ADD COLUMN name text;

COMMENT ON COLUMN public.participants.name IS
  'PII: participant display name (nombre y apellido as one string) for team ticket print list and operational roster. NULLABLE until checkout successor always writes it for paid team/individual competitors. Independent of buyer_contacts.name (payer/contact may differ from competitor).';

COMMENT ON TABLE public.participants IS
  'SPEC-032 Participant shell; display name inventory closed by Owner 2026-08-27 for go-live team capture (T1). Not medical/emergency data. buyer_contact_id remains optional relation; name is not automatically copied from buyer_contacts.';
