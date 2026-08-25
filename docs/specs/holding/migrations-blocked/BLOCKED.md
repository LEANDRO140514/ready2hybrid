# HOLDING — blocked migrations (do not apply)

```text
STATUS: BLOCKED
        NOT_IN_ACTIVE_MIGRATION_DISCOVERY_PATH
        DO_NOT_APPLY_TO_MAIN_OR_SANDBOX
```

Captured: 2026-08-25 America/Merida  
Branch: `main`  
Purpose: keep hazardous SQL out of `insforge/migrations/` so InsForge CLI
`db migrations up` cannot discover or apply it.

---

## `0021_multi_provider_canonical_tx_neutralization.sql`

**Location (this folder):** `0021_multi_provider_canonical_tx_neutralization.sql`  
**Former path:** `insforge/migrations/0021_multi_provider_canonical_tx_neutralization.sql`  
**Predecessor declared:** `0009_fix_webhook_payment_verification_order.sql`  
**Main status:** NOT APPLIED

### Why blocked

Forward-only `CREATE OR REPLACE` of `public.webhook_apply_payment_tx(p jsonb)`.
It **requires** `p->>'provider'`. Missing provider returns
`INVALID_REQUEST` / `MISSING_PROVIDER` (fail-closed; no Mercado Pago default).

The **deployed** Main edge `mp-webhook` (last mutated 2026-07-25) does **not**
send `provider` in the RPC payload. Applying 0021 while that webhook remains
unchanged would break payment apply and therefore ticket issuance for live
Mercado Pago webhooks.

### Unblock requirements (all must be true)

1. Lane A updates `mp-webhook` to pass explicit contract `provider`
   (`MERCADO_PAGO` for current path) into `webhook_apply_payment_tx`.
2. Authorized deploy of that webhook to Main (separate unit).
3. Explicit Project Owner approval to apply 0021 only (not `--all`).
4. Evidence that missing-provider fail-closed is intentional and that MP
   path still completes PAID → ticket issue.

Do not reintroduce this file into `insforge/migrations/` until the above gate.

---

## `0018_staged-commercial-pricing.sql`

**Location (already holding):**  
`docs/specs/holding/migrations-superseded-wip-2026-08-23/0018_staged-commercial-pricing.sql`  
**Main status:** NOT APPLIED (never applied)

### Why blocked

Local Pricing-A foundation that:

- resolves commercial stage as `max(calendar, high-water, quota threshold)`;
- uses 30% / 45% / 25% of `cupo` as quantity-driven stage authority;
- returns `SOLD_OUT` when `consumed >= cupo` and/or when
  `active_holds + units > cupo` inside `checkout_start_tx`.

SPEC-030 v0.4.0 **forbids** quantity-driven price stages and auto-`SOLD_OUT`
from configured cupo (R203, R214–R217). Successor commercial authority on Main
is migration **0020** (already applied), which uses organizer `sale_state` and
does not gate checkout on cupo.

### Unblock requirements

0018 must **not** be applied in its current form. Any future staged-price SQL
requires a **new** authorized migration that:

1. Uses calendar-only stage windows (SPEC-030 R201–R205 / R215);
2. Does not use cupo / 30-45-25 as commercial SOLD_OUT or price authority;
3. Is reviewed against Main already at 0020 (no silent overwrite of v0.4 TX).

See also `docs/specs/holding/migrations-superseded-wip-2026-08-23/HOLDING.md`
for byte-preservation notes on 0018 / 0019.

---

## Related pending (safe to leave in tree; not applied here)

| File | Notes |
|---|---|
| `insforge/migrations/0017_operational-identity-assignments.sql` | T2 ops identity; pending; **not** applied in this unit |
| `insforge/migrations/0020_v04-commercial-authority-successor.sql` | **Applied on Main**; do not re-apply; do not edit |
| `0019` (superseded holding) | Relaunch WIP; not in discovery path |

## Rule

Never copy blocked files into repo-root `migrations/` or
`insforge/migrations/` for CLI discovery until an authorized unit removes the
blocker and moves a reviewed successor.
