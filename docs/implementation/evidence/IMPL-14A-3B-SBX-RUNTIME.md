# IMPL-14A-3B-SBX-RUNTIME — Payment Pending Expiry Transaction — Sandbox Runtime Validation

```text
unit: IMPL-14A-3B-SBX-RUNTIME-1 + FIX-2-SBX-RETEST + ARTIFACT FINALIZATION
date: 2026-07-29
status: EVIDENCE CAPTURED — CTO RUNTIME REVIEW PASSED
authority: Project Owner authorization for sandbox-only apply + synthetic fixtures
```

## 1. Autoridad

```text
SPEC-040 v0.1.1 = APPROVED
IMPL-14A-2 v0.2.0 = PLAN / APPROVED
IMPL-14A-3B = IMPLEMENTING / LOCAL ONLY
IMPL-14A-3B-FIX-1 = FIXED LOCALLY (dry-run statement_timestamp)
HEAD local = dd2873b60a4f92a7fa9e8295e735f0e18fcb7ad4
0012 SHA-256 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
```

Scope: compile, apply and physically validate
`insforge/migrations/0012_payment-pending-expiry-transaction.sql` exclusively on
sandbox `impl-14a-expiry`. Main, commit, push, IMPL-14A-3C and production were
not authorized.

## 2. Entornos

Sandbox (mutated):

```text
name: impl-14a-expiry
Project ID: 2921e092-aed6-4abb-93be-946c42eee82a
prefix: 4bg9ufz2-2w7
mode: schema-only
migrations before: max 11 (logical-capacity-expiry-exclusion)
migrations after:  max 12 (payment-pending-expiry-transaction)
```

Main (read-only verification; zero writes):

```text
name: ready2hybrid
Project ID: 91fa34b1-e3b5-44c0-9806-b092c1dd7144
prefix: 4bg9ufz2
migration max: 10
0011 absent
0012 absent
```

CLI context was pointed at `4bg9ufz2-2w7` for all writes. MCP was not used for
sandbox mutation. Main was inspected by temporary CLI switch to parent, then
returned to the sandbox.

## 3. Migración

```text
canonical filename: 0012_payment-pending-expiry-transaction.sql
remote name: payment-pending-expiry-transaction
runner result: Migration executed successfully
byte-identical SHA-256: E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
```

A temporary directory junction `migrations -> insforge/migrations` was used so
the official InsForge runner could locate the file without copying or renaming
it. The junction was removed after apply and is not part of the repository
tree.

## 4. Objetos instalados

```text
index: idx_orders_state_expires_at_id = present

expire_payment_pending_aggregate_tx:
  volatility = VOLATILE
  SECURITY DEFINER = true
  search_path = pg_catalog, public, pg_temp
  EXECUTE = project_admin only

expire_payment_pending_batch_tx:
  volatility = VOLATILE
  SECURITY DEFINER = true
  search_path = pg_catalog, public, pg_temp
  EXECUTE = project_admin only

expire_payment_pending_dry_run_tx:
  volatility = STABLE (pg_proc.provolatile = 's')
  SECURITY DEFINER = true
  search_path = pg_catalog, public, pg_temp
  EXECUTE = project_admin only
```

No EXECUTE grants observed for PUBLIC, anon or authenticated.

## 5. Matriz de resultados

| Caso | Resultado | Notas |
| --- | --- | --- |
| A1 order_not_found | PASS | zero durable writes |
| A2 skipped_locked | PASS | concurrent FOR UPDATE + NOWAIT |
| A3 not yet expired | PASS | noop / NOT_ELIGIBLE_NOT_YET_EXPIRED |
| A4 NULL expiry | PASS | noop / NOT_ELIGIBLE_EXPIRY_UNKNOWN |
| A5 PAID | PASS | noop / ORDER_STATE_NOT_ELIGIBLE |
| B1 effective spectator q=1 | PASS | EXPIRED + audit ORDER_EXPIRY_APPLIED = 1; outbox = 0 |
| C idempotent replay | PASS | second call noop; audit stays 1; outbox stays 0 |
| E credential guard | PASS | CAPTAIN / INVITATION_EXCHANGE_CODE / INVITED_MEMBER remain ISSUED |
| M spectator qty>1 | PASS | registrations_cancelled = 3; holds_expired = 1 |
| M individual competitor | PASS | PENDING_PAYMENT → CANCELLED |
| M team J2/J3 | PASS | teams/team_members intact; invitation cannot become access |
| D inconsistent matrix | **BLOCKED** | see §6 |
| DR statement stability (eligible) | PASS | same `evaluated_at` in one SQL statement |
| DR zero writes | PASS | table fingerprint unchanged |
| DR deferred PREFERENCE_PENDING | PASS when isolated | classification reported |
| DR noop/inconsistent findings | **BLOCKED** | same array bug |
| BATCH self-lock + SKIP LOCKED | PASS | locked row absent from items[]; skipped_locked = 0 |
| SUBTX audit boom isolation | PASS | A error + rollback; B expired + audit=1 |
| Harness cleanup | PASS | temp trigger/function removed |
| CX expiry wins → late APPROVED | PASS | REQUIRES_REVIEW; tickets = 0 |
| CX webhook wins | PASS | during lock skipped_locked/noop; after PAID → noop |
| ROW_COUNT B1 | PASS | rpc counts match durable states (1/1/1) |

## 6. Hallazgo bloqueador — PL/pgSQL `text[] || text`

Physical call of the inconsistent path raises:

```text
malformed array literal: "HOLD_MISSING"
```

Probe function in the sandbox proved:

```text
a := a || 'HOLD_MISSING'                 → ERROR (malformed array literal)
b := b || ARRAY['HOLD_MISSING']          → OK
c := array_append(c, 'HOLD_MISSING')     → OK
```

This is a PL/pgSQL operator-resolution defect for bare text appends to `text[]`.
It affects every findings-append site in:

- `expire_payment_pending_aggregate_tx` (all inconsistent routes)
- `expire_payment_pending_dry_run_tx` (noop/inconsistent classification when findings are appended)

Healthy expiry paths (empty findings) and deferred PREFERENCE_PENDING reporting
do not hit the failing form.

**Recommended FIX (not applied in this unit):** replace every
`v_findings := v_findings || 'LITERAL'` with
`v_findings := array_append(v_findings, 'LITERAL')` or
`v_findings := v_findings || ARRAY['LITERAL']` in both aggregate and dry-run.
Do not re-apply until that local fix is authorized.

## 7. Concurrencia (saneada)

```text
Expiry-wins: aggregate → EXPIRED; webhook APPROVED → REQUIRES_REVIEW; tickets=0
Webhook-wins: webhook APPROVED → PAID; aggregate during lock → skipped_locked;
              aggregate after commit → noop
```

No Mercado Pago, Edge Functions, webhooks externos or secrets were used.

## 8. Subtransacción

Temporary `BEFORE INSERT` trigger on `activity_log` raised only for one
synthetic order’s `ORDER_EXPIRY_APPLIED`. Batch result:

```text
order A → outcome error; original states preserved; audit/outbox = 0
order B → outcome expired; full transition; audit = 1
```

Trigger and function removed; catalog confirms absence.

## 9. Regresión local (post-runtime)

```text
npm test                 → 18 files / 309 tests PASS
npm run typecheck        → PASS
npm run lint             → PASS (0 hits on 0012 / expiry tests)
git diff --check         → PASS
focused vitest (expiry + checkout) → PASS
```

No code corrections were made during this unit.

## 10. Restricciones vigentes

```text
0012 applied only to impl-14a-expiry
Main application = NOT AUTHORIZED
IMPL-14A-3B = NOT VALIDATED / NOT CLOSED
IMPL-14A-3C = NOT AUTHORIZED
PRODUCTION = NO-GO
commit = 0
push = 0
```

## 11. Gate

```text
CHANGES_REQUIRED
```

Ready for CTO review of this sandbox evidence. Next authorized unit should be a
minimal local FIX for the `text[]` append form, then a focused sandbox retest of
inconsistent + dry-run findings paths only.

## 12. Runtime finding B-ARRAY

```text
Runtime finding B-ARRAY:
CONFIRMED (historical — IMPL-14A-3B-SBX-RUNTIME-1)
→ RESOLVED IN SANDBOX (IMPL-14A-3B-FIX-2-SBX-RETEST)

Affected (historical):
aggregate inconsistent findings
dry-run findings

0012 sandbox status:
APPLIED / IMMUTABLE

Corrective migration:
0013_payment-pending-expiry-array-fix.sql
APPLIED ONLY TO impl-14a-expiry (NOT Main)

Retest:
EXECUTED / PASS
```

Historical note (unchanged): under `0012`, PL/pgSQL `text[] || 'literal'` raised
`malformed array literal` on findings append. Probe confirmed `array_append`
and `|| ARRAY[...]` as working forms.

## 13. IMPL-14A-3B-FIX-2-SBX-RETEST

```text
unit: IMPL-14A-3B-FIX-2-SBX-RETEST
date: 2026-07-29
authority: Project Owner — apply 0013 on impl-14a-expiry + physical B-ARRAY retest
0013 applied only to impl-14a-expiry
0013 SHA-256: BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0012 SHA-256 unchanged: E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
migration before = 12
migration after  = 13
remote name = payment-pending-expiry-array-fix
runner = Migration executed successfully
```

### Effective definitions (catalog)

```text
aggregate: VOLATILE, SECURITY DEFINER, clock_timestamp=1, statement_timestamp=0,
           array_append=19, ambiguous findings||=0, search_path pinned,
           EXECUTE=project_admin only
dry-run:   STABLE, SECURITY DEFINER, statement_timestamp=1, clock_timestamp=0,
           array_append=14, ambiguous findings||=0, search_path pinned,
           EXECUTE=project_admin only
batch:     VOLATILE, SECURITY DEFINER, clock_timestamp=1, no array_append,
           no FIX-2 comment — definition from 0012 intact
```

### B-ARRAY / findings results

```text
malformed array literal errors = 0
single-finding HOLD_MISSING = PASS
multiple-findings HOLD+REG+HOLDER = PASS
full inconsistency matrix (13 findings) = PASS each
coexist multi-findings + idempotent noop = PASS
  (second call noop; audit=1; outbox=1)
```

### Dry-run

```text
by order_id (inconsistent findings) = PASS
global sweep = PASS
statement_timestamp stability (same evaluated_at in one SQL) = PASS
PREFERENCE_PENDING deferral = PASS
noop unknown expiry = PASS
zero-write proof (activity_log/outbox/orders/holds fingerprints) = PASS
```

### Short regression

```text
effective expiry + ORDER_HOLDER guard (CAPTAIN/INVITATION/INVITED intact) = PASS
effective idempotency = PASS
payment APPROVED protection = PASS
batch consistent+inconsistent = PASS
SKIP LOCKED (locked row omitted from batch items) = PASS
teams/team_members untouched = PASS
ROW_COUNT effective: holds_expired=1, regs_cancelled=1, order_holder_expired=1 = PASS
tickets nuevos = 0; payments mutados = 0
```

### Environment integrity

```text
Main intact: migration max=10; 0011/0012/0013 absent
harness cleanup: temporary triggers=0, temporary functions=0
synthetic fixtures tagged FIX2-RETEST-* / FIX2-BATCH-* retained for traceability
no Mercado Pago / Edge Functions / external webhooks / secrets
no code/migration edits during retest
local suite: 316/316 PASS; focused expiry 112/112 PASS; typecheck PASS; lint PASS; diff-check PASS
```

### Remaining

```text
CTO RUNTIME REVIEW = PASSED
B-ARRAY = RESOLVED IN SANDBOX
FIX-2 RETEST = PASSED
AGGREGATE INCONSISTENCY MATRIX = 13/13 PASS
TOTAL FIX-2 RETEST CASES = 29/29 PASS
DRY-RUN ZERO-WRITE = PASS
BATCH / SELF-LOCK / SKIP LOCKED = PASS
ROW_COUNT DURABLE COMPARISON = PASS
NO-EMISSION = PASS

Main application = NOT AUTHORIZED
IMPL-14A-3C = NOT AUTHORIZED / NOT STARTED
PRODUCTION = NO-GO
human closure = NOT PERFORMED
IMPL-14A-3B = READY_FOR_HUMAN_VALIDATION_APPROVAL
  (NOT VALIDATED / NOT CLOSED)
```

## 14. Gate (artifact finalization)

```text
READY_FOR_CTO_POST_PUSH_REVIEW
B-ARRAY = RESOLVED IN SANDBOX
CTO RUNTIME REVIEW = PASSED
```

Timeline preserved:

```text
0012 applied first on sandbox (v12);
B-ARRAY discovered (malformed array literal);
0012 remains immutable;
0013 corrected aggregate + dry-run via array_append;
0013 applied and revalidated on sandbox (v13).
```
