# T1 Team Ticket Issuance (Migration 0026)

```text
Unit: T1-TEAM-TICKET-ISSUANCE
Mode: LOCAL DEVELOPMENT ONLY
Date: 2026-08-31 America/Merida
Authorization: Project Owner explicit (design approval)
Prior gate: GO-LIVE-MIGRATIONS-0022-0025 (APPLIED TO MAIN)
Gate out: READY_FOR_0026_REVIEW
```

## A. Purpose

Enable ticket issuance for T1 teams (full roster captured at checkout via
0025, no invitation flow). After payment webhook, T1 teams transition
directly to ELIGIBLE and receive their ticket in the same transaction.

## B. T1 Discriminator

```sql
NOT EXISTS (
  SELECT 1 FROM public.team_members
  WHERE team_id = v_team.id AND state = 'INVITED'
)
```

- **T1:** Zero members in `INVITED` state → roster complete from checkout
- **Legacy:** At least one member in `INVITED` state → invitation path

## C. Changes

### C.1 team_apply_payment_outcome

**Before (0007):**
```sql
roster_state = CASE
  WHEN slots_complete >= required_size AND roster_state = 'ELIGIBLE' THEN 'ELIGIBLE'
  WHEN slots_complete >= required_size THEN 'PAID_ROSTER_COMPLETE'
  ELSE 'PAID_ROSTER_INCOMPLETE'
END
```

**After (0026):**
```sql
roster_state = CASE
  WHEN roster_state = 'ELIGIBLE' THEN 'ELIGIBLE'
  WHEN slots_complete >= required_size AND NOT v_has_invited THEN 'ELIGIBLE'
  WHEN slots_complete >= required_size THEN 'PAID_ROSTER_COMPLETE'
  ELSE 'PAID_ROSTER_INCOMPLETE'
END
```

**Change:** T1 teams (no INVITED members) now transition to ELIGIBLE on payment.

### C.2 ticket_issue_after_payment

**Before (0008):**
```sql
IF FOUND AND v_product.team_size > 1 THEN
  -- Unconditional skip for all team products
  CONTINUE;
END IF;
```

**After (0026):**
```sql
IF FOUND AND v_product.team_size > 1 THEN
  SELECT * INTO v_team FROM public.teams WHERE id = v_reg.team_id;
  IF NOT FOUND OR v_team.roster_state IS DISTINCT FROM 'ELIGIBLE' THEN
    -- Skip only if NOT ELIGIBLE
    CONTINUE;
  END IF;
  -- ELIGIBLE → proceed to issue
END IF;
```

**Change:** Team products with roster_state = ELIGIBLE now proceed to ticket issuance.

### C.3 ticket_issue_one_registration

**NO CHANGE.** The existing function already:
1. Validates `roster_state = ELIGIBLE` for team products
2. Validates `team_member.state = COMPLETE`
3. Creates ticket linked to registration_id

The ticket does NOT store team member names. Email worker resolves at PDF time.

## D. Email Worker Name Resolution (Contract)

```sql
SELECT p.name
FROM public.team_members tm
JOIN public.participants p ON p.id = tm.participant_id
WHERE tm.team_id = (
  SELECT team_id FROM public.registrations WHERE id = ticket.registration_id
)
ORDER BY tm.position
```

Names are resolved at email/PDF generation time, not stored in the ticket.

## E. Individual Path Unchanged

The discriminator `v_product.team_size > 1` ensures:
- `team_size = 1` (individual competitor) → NEVER enters team block
- `team_size = NULL` (spectator/press) → NEVER enters team block
- Only `team_size > 1` enters team logic

Individual ticket issuance is BYTE-IDENTICAL in behavior before/after 0026.

## F. Transaction Atomicity

All changes occur within `webhook_apply_payment_tx`:

```
BEGIN (implicit)
  1. orders.state → PAID
  2. registrations.state → PAYMENT_CONFIRMED
  3. team_apply_payment_outcome() → roster_state = ELIGIBLE (T1)
  4. ticket_issue_after_payment() → ticket created (T1)
COMMIT (implicit)
```

No intermediate state possible:
- ❌ Team ELIGIBLE without ticket → impossible (same TX)
- ❌ Ticket without team ELIGIBLE → impossible (gate in step 4)

## G. Tests

| Test File | Coverage |
|---|---|
| `t1-team-ticket-issuance.test.ts` | T1 flow: payment → ELIGIBLE → ticket |
| `individual-ticket-unchanged.test.ts` | Individual path BYTE-IDENTICAL |
| `legacy-invitation-path.test.ts` | Legacy teams stay PAID_ROSTER_INCOMPLETE |

## H. Files Modified

- `insforge/migrations/0026_t1-team-ticket-issuance.sql` (new)
- `tests/unit/tickets/t1-team-ticket-issuance.test.ts` (new)
- `tests/unit/tickets/individual-ticket-unchanged.test.ts` (new)
- `tests/unit/tickets/legacy-invitation-path.test.ts` (new)
- `docs/implementation/evidence/T1-TEAM-TICKET-ISSUANCE-0026.md` (this file)

## I. NOT Authorized

- Apply to Main or sandbox
- Email worker implementation
- Push to remote
- Changes to ticket_issue_one_registration

## J. Gate Status

```text
READY_FOR_0026_REVIEW
```

Pending: Owner review of migration SQL before apply authorization.
