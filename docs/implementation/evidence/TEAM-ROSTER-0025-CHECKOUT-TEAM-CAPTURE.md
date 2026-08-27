# 0025 — Checkout team roster capture — local authoring evidence

```text
Unit: TEAM-ROSTER-0025-CHECKOUT-TEAM-CAPTURE
Title: checkout_start_tx + edge — captain_name + teammate_names (no invites)
Mode: LOCAL AUTHORING ONLY — NOT APPLIED TO MAIN / NOT DEPLOYED
Date: 2026-08-27 (America/Merida)
Actor: Cursor
Authority: Project Owner 2026-08-27 (T1 team capture; captain_name default = buyer.name)
Predecessor DDL: 0022, 0023, 0024
Migration: insforge/migrations/0025_checkout-team-roster-capture.sql
```

## 1. Purpose

Replace invite-based team shell with **full roster capture at checkout**:
captain + teammate display names, N `participants` with `name`, all
`team_members` populated (`COMPLETE` for teammates; captain `COMPLETE` when
waiver accepted), `roster_state = PAYMENT_PENDING`, **empty**
`invitation_tokens`.

**Out of this unit:** T1 one-ticket issuance, webhook → ELIGIBLE, landing,
email worker, Main apply, edge deploy.

## 2. Owner decisions (binding)

| # | Decision |
|---|---|
| 1 | `captain_name` optional; default `buyer.name`; editable in UI |
| 2 | `teammate_names: string[]` length = `team_size - 1`; names only |
| 3 | Non-team + non-empty `teammate_names` → `INVALID_REQUEST` |
| 4 | Fingerprint includes `captain_name` + `teammate_names` |
| 5 | No invitation mint; no `TEAM_INVITATION_TTL` required for J2/J3 |
| 6 | T1 ticket emission = **later** unit |

## 3. Files

| Path | Change |
|---|---|
| `insforge/migrations/0025_checkout-team-roster-capture.sql` | `CREATE OR REPLACE checkout_start_tx` |
| `insforge/functions/_shared/checkout/validate.ts` | Zod + helpers |
| `insforge/functions/_shared/checkout/orchestrate.ts` | fingerprint + payload; drop invite TTL gate |
| `insforge/functions/mp-create-checkout/index.ts` | RPC fields |
| `insforge/functions/mp-create-checkout/handler.deploy.js` | regenerated |
| `tests/unit/checkout/checkout-start.test.ts` | teammate / captain cases |
| `tests/unit/expiry/logical-capacity-exclusion.test.ts` | canonical = 0025 |
| `tests/integration/local-db/pricing-a-fix1.local.test.ts` | comment retarget |

## 4. Gates

```text
npm run bundle:checkout → PASS
npm run typecheck       → PASS
npm test                → PASS (48 files / 587 tests)
npm run build           → PASS
```

## 5. Apply posture

```text
MAIN APPLY = NOT AUTHORIZED
DEPLOY mp-create-checkout = NOT AUTHORIZED
git push = NOT AUTHORIZED
```

Apply order when authorized: **0022 → 0023 → 0024 → 0025**, then deploy
bundled `handler.deploy.js` from this commit.
