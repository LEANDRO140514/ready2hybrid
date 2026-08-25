# 0022 — Buyer contact fields (PII) — local authoring evidence

```text
Unit: BUYER-CONTACT-0022-FIELDS
Title: Add email, name, phone on public.buyer_contacts
Mode: LOCAL MIGRATION AUTHORING ONLY — NOT APPLIED TO MAIN
Date: 2026-08-25 (America/Merida)
Actor: Cursor
Authority: Project Owner decisions (explicit) 2026-08-25
Governance: Owner decision + this evidence (NO SPEC-032 revision)
Predecessor: 0001_minimal_sales_schema.sql
Migration: insforge/migrations/0022_buyer-contact-fields.sql
Blocked number skipped: 0021 remains in docs/specs/holding/migrations-blocked/
```

## 1. Purpose

Close the open personal-field decision on the SPEC-032 `BuyerContact` shell
so ticket delivery and operational contact have a durable place for buyer
PII. This unit is **DDL only**.

## 2. Owner decisions (binding)

| # | Decision |
|---|---|
| 1 | Columns in 0022: `email`, `name`, `phone`. No `participants` jsonb on this table. |
| 2 | `email` **NULLABLE**. Harden to `NOT NULL` in a successor after checkout always writes it. |
| 3 | **No automatic backfill.** Existing Main rows (~10) remain `NULL`; Owner may fill real rows by hand later. |
| 4 | Validation both layers: Zod on edge (**later unit**) + loose SQL `CHECK` `POSITION('@' IN email) > 1` when present. No RFC regex. |
| 5 | RLS: **zero new policies**. Deny-by-default + RPC unchanged. |
| 6 | Governance: Owner decision + evidence. **No SPEC-032 revision** (open decision closed here). |

## 3. Classification — personal data (PII)

`buyer_contacts.email`, `buyer_contacts.name`, and `buyer_contacts.phone` are
**personal data (PII)**. Intended use:

- ticket / QR delivery to the buyer;
- operational contact by the organizer.

They are **not** medical or emergency data (`participant_sensitive_profiles`
remains the restricted shell). Browser roles must not read these columns
directly; access remains via `project_admin` / `SECURITY DEFINER` RPCs under
existing RLS FORCE + zero policies + REVOKE from `anon`/`authenticated`.

## 4. What 0022 does

```text
ALTER TABLE public.buyer_contacts
  ADD COLUMN email text,
  ADD COLUMN name text,
  ADD COLUMN phone text;

CONSTRAINT ck_buyer_contacts_email_has_at
  CHECK (email IS NULL OR POSITION('@' IN email) > 1);

COMMENT updates on table + columns (PII / delivery purpose).
```

## 5. What 0022 does NOT do

- Apply to Main or sandbox
- Change `checkout_start_tx` or any edge function
- Add Zod / landing / Resend / outbox worker
- Backfill historical rows
- Add RLS policies or GRANT to browser roles
- Touch `participants` table or jsonb contact blobs
- Reuse or unblock migration number `0021`

## 6. Numbering

| Number | Path status |
|---|---|
| 0020 | `insforge/migrations/` (commercial successor) |
| 0021 | Blocked holding — do not collide |
| **0022** | This migration |

## 7. Gates (local)

```text
npm run typecheck  → PASS
npm test           → PASS (48 files / 582 tests)
npm run build      → PASS
HEAD at gate run:  2e255e7 (pre-commit)
```

Filename note: first draft used underscores (`0022_buyer_contact_fields.sql`);
renamed to canonical InsForge runner form `0022_buyer-contact-fields.sql`
(`^\d{4}_[a-z0-9]+(?:-[a-z0-9]+)*\.sql$`) so the 0011 static naming gate passes.

## 8. Apply posture

```text
MAIN APPLY = NOT AUTHORIZED
SANDBOX APPLY = NOT AUTHORIZED by this unit
git push = NOT AUTHORIZED by this unit
```

Owner must explicitly authorize SQL apply later. Existing NULL emails are
expected and valid under the CHECK until checkout writes values.
