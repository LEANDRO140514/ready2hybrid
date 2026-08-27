# 0024 — Participant display name — local authoring evidence

```text
Unit: TEAM-ROSTER-0024-PARTICIPANT-NAME
Title: Add nullable name on public.participants
Mode: LOCAL MIGRATION AUTHORING ONLY — NOT APPLIED TO MAIN
Date: 2026-08-27 (America/Merida)
Actor: Cursor
Authority: Project Owner confirmation 2026-08-27 (team capture closed design)
Governance: Owner decision + this evidence (NO SPEC-032 revision)
Predecessor: 0001_minimal_sales_schema.sql
Migration: insforge/migrations/0024_participant-display-name.sql
Blocked number skipped: 0021 remains in docs/specs/holding/migrations-blocked/
```

## 1. Purpose

Give each `participants` row a durable display name so captain + teammates
can be printed on the **single team ticket** (Owner T1: one registration
carrier, N participants, one ticket / one QR / one email to captain buyer).

This unit is **DDL only** — same isolation pattern as `0022_buyer-contact-fields`.

## 2. Owner decisions (binding)

| # | Decision |
|---|---|
| 1 | Column: `participants.name text NULL`. One string = nombre y apellido. |
| 2 | No email/phone/tipo-ID on companions in this inventory. |
| 3 | Independent of `buyer_contacts.name` (payer may differ from competitor). |
| 4 | No automatic backfill. Existing rows remain `NULL`. |
| 5 | RLS: zero new policies. Deny-by-default + RPC unchanged. |
| 6 | **Out of this unit:** `checkout_start_tx`, fingerprint, `teammate_names`, ticket issuance T1, invites retirement. |
| 7 | Governance: Owner decision + evidence. No SPEC-032 revision. |

## 3. Classification — personal data (PII)

`participants.name` is **personal data (PII)** for ticket print list and
operational roster. It is **not** medical/emergency data
(`participant_sensitive_profiles` remains the restricted shell).

Browser roles must not read this column directly; access remains via
`project_admin` / `SECURITY DEFINER` RPCs under existing RLS FORCE + zero
policies + REVOKE from `anon`/`authenticated`.

## 4. What 0024 does

```text
ALTER TABLE public.participants
  ADD COLUMN name text;

COMMENT ON COLUMN public.participants.name …
COMMENT ON TABLE public.participants …
```

## 5. What 0024 does NOT do

- Apply to Main or sandbox
- Change `checkout_start_tx`, edge Zod, fingerprint, or landing
- Create `teammate_names` write path
- Change `team_members` / invitations / `team_roster_accept_tx`
- Change ticket issuance (still one-ticket-per-registration until a later unit)
- Backfill historical rows
- Add RLS policies or GRANT to browser roles
- Reuse or unblock migration number `0021`

## 6. Numbering

| Number | Path status |
|---|---|
| 0020 | `insforge/migrations/` (commercial successor) |
| 0021 | Blocked holding — do not collide |
| 0022 | Buyer contact fields (DDL) |
| 0023 | Buyer contact checkout write (`checkout_start_tx`) |
| **0024** | This migration (participant display name DDL) |

## 7. Gates (local)

```text
npm run typecheck  → PASS
npm test           → PASS (48 files / 583 tests)
npm run build      → PASS
```

## 8. Apply posture

```text
MAIN APPLY = NOT AUTHORIZED
SANDBOX APPLY = NOT AUTHORIZED by this unit
git push = NOT AUTHORIZED by this unit
```

Owner must explicitly authorize SQL apply later. Apply order when authorized:
**0022 → 0023 → 0024** (0024 is independent of 0022/0023 at DDL level, but
go-live write path for teams depends on buyer contact + this column).

## 9. Successor (not this unit)

`checkout_start_tx` + edge: `teammate_names` array, fingerprint include,
N participants with `name`, team_members COMPLETE, T1 ticket path — separate
authorized unit after this commit.
