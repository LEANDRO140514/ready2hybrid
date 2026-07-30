# IMPL-14A-3C-SBX-RUNTIME — Scheduled Payment Pending Expiry Reconciler

```text
unit: IMPL-14A-3C SANDBOX RUNTIME VALIDATION
date: 2026-07-29
status: IMPL-14A-3C VALIDATED / CLOSED
scope: local implementation + automated tests + physical sandbox runtime
human validation: 2026-07-29 — America/Merida
main: NOT APPLIED
production: NOT AUTHORIZED
schedule: INACTIVE
authority: Project Owner sandbox-only runtime authorization 2026-07-29;
  human validation and closure 2026-07-29 — America/Merida (see §22)
```

Historical note: this document also preserves, unmodified, the FIX-1 sandbox
retest that ended in `VALIDATION_FAILED` (§1–§20) and the FIX-2 sandbox retest
that reached `PASS` (§21). The header above reflects the current, superseding
status; it does not erase or reinterpret either historical result.

## 1. Scope and Git preflight

```text
repository: C:\vonde\enforma-sys\ready2hybrid
branch: main
HEAD: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
origin/main after fetch: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
divergence: 0 / 0
staged: 0
```

All non-`.cursor` local changes at preflight mapped to IMPL-14A-3C:
migration 0014, the reconciler Edge source and shared module, focused tests,
the authorized migration-sequence assertion, and `WORKSPACE_STATUS.md`.

## 2. Immutable migration integrity

```text
0012 SHA-256: E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 SHA-256: BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 authorization token (63 characters, invalid as SHA-256):
  92068A6524DCFDFCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0014 actual local file SHA-256 (64 characters):
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0014 canonical SHA-256 ratified by Project Owner 2026-07-29:
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

No migration file was edited during runtime validation.

## 3. Environment attestation

Sandbox (write target):

```text
project: impl-14a-expiry
Project ID: 2921e092-aed6-4abb-93be-946c42eee82a
prefix: 4bg9ufz2-2w7
migration before: 13 / payment-pending-expiry-array-fix
migration after: 14 / payment-pending-expiry-run-lease
```

Main (read-only, zero writes):

```text
project: ready2hybrid
Project ID: 91fa34b1-e3b5-44c0-9806-b092c1dd7144
prefix: 4bg9ufz2
migration max: 10 / spectator-multi-quantity
0011 / 0012 / 0013 / 0014: absent
payment-pending-expiry function: absent
payment-pending-expiry schedule: absent
```

The CLI context was restored to `impl-14a-expiry` after the final Main
read-only check.

## 4. Migration runner and catalog

```text
runner: applied exactly one file
file: 0014_payment-pending-expiry-run-lease.sql
remote version: 14
remote name: payment-pending-expiry-run-lease
runner input file actual SHA:
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

The runner applied the current local 0014 bytes. The remote migration inventory
stores version/name, not an independently queryable content hash. Final
verification proved that the Project Owner token supplied for 0014 is one
character short and therefore could never match any SHA-256. See
`MIGRATION-SHA-001`.

Both installed RPCs are physically:

```text
VOLATILE (pg_proc.provolatile = v)
SECURITY DEFINER = true
search_path = pg_catalog, public, pg_temp
project_admin EXECUTE = true
anon EXECUTE = false
authenticated EXECUTE = false
PUBLIC implicit EXECUTE = absent by migration ACL
advisory lock references = 0
```

0014 added only the two functions, comments and grants. It added no table,
column, index or trigger and did not replace the 0012/0013 expiry RPCs.

## 5. Physical lease matrix

| Case | Physical result |
| --- | --- |
| L1 first acquire | PASS — `acquired` |
| L2 live acquire, different run_id | PASS — `overlap_skipped` |
| L3 live acquire, same run_id | PASS — `overlap_skipped` |
| L4 two concurrent sessions, different run_id | PASS — exactly one `acquired`, one `overlap_skipped` |
| L5 two concurrent sessions, same run_id | PASS — exactly one `acquired`, one `overlap_skipped` |
| L6 expired/released lease reclaim | PASS — next owner `acquired` |
| L7 owner release | PASS — `released` |
| L8 non-owner release | PASS — `not_owner` |
| L9 second release | PASS — canonical `already_expired` |
| L10 owner isolation | PASS — old/other run_id could not release current lease |

L4 and L5 used two independent CLI/PostgreSQL sessions. Session 1 acquired
inside a statement held open by `pg_sleep(5)`; session 2 executed concurrently
and waited on the unique-key conflict. This was not a sequential substitute.

## 6. Edge deployment and secret

```text
function: payment-pending-expiry
status: active
deployment prefix: 4bg9ufz2-2w7
bundle SHA-256: A9C683A5797E1CD8FC636B21183FB0ADE1D4FC3EE0DDFFD16E804A52EDBEA4DA
schedule secret key: PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET
schedule secret value: generated cryptographically / never recorded
```

The temporary bundle and the deployed source contain only the four RPC names:

```text
acquire_payment_pending_expiry_run_lease_tx
release_payment_pending_expiry_run_lease_tx
expire_payment_pending_batch_tx
expire_payment_pending_dry_run_tx
```

Searches found no Mercado Pago, checkout, webhook, ticket, QR, team-management
or refund module in the bundle. No other function was deployed.

## 7. HTTP and Edge anti-overlap

| Request | Result |
| --- | --- |
| GET | 405 `METHOD_NOT_ALLOWED` |
| POST without Authorization | 401 `UNAUTHORIZED` |
| POST with invalid bearer | 403 `FORBIDDEN` |
| POST malformed JSON | 400 |
| valid reconcile, no candidates | 200 `completed`, processed 0 |
| live lease, same run_id | 200 `overlap_skipped`, processed 0 |
| live lease, different run_id | 200 `overlap_skipped`, processed 0 |
| reconcile after owner release | 200 `completed` |

Function logs contain only structured run/item fields. Searches found no
Authorization header, bearer value or schedule-secret key/value.

The public `environment` field was `unknown` because
`INSFORGE_ENVIRONMENT` was not configured. The target was still physically
attested as the sandbox by Project ID, prefix, function URL and CLI branch.
Provisioning an additional environment variable was outside this unit's
exclusive-secret authorization.

```text
finding: OBS-3C-ENV-001
severity: NON-BLOCKING
status: OPEN
```

## 8. Effective reconciliation, cap and per-order commits

Synthetic fixtures were tagged with `IMPL-14A-3C-SBX`.

```text
single healthy aggregate:
  order PAYMENT_PENDING -> EXPIRED
  hold ACTIVE -> EXPIRED
  registration PENDING_PAYMENT -> CANCELLED
  ORDER_HOLDER ISSUED -> EXPIRED
  audit actor_ref = system:payment-pending-expiry

default max_items:
  max_items = 25
  run 1 = HTTP 200 partial, processed 25, expired 25
  durable state after run 1 = 25 EXPIRED + 1 PAYMENT_PENDING
  run 2 = HTTP 200 completed, processed 1, expired 1
  all 26 orders = EXPIRED, exactly one effective audit each
```

Every Edge iteration passed `limit:1`; the deployed bundle fixes that input and
rejects `processed > 1`.

## 9. Item failure and fatal HTTP status

A temporary trigger raised only for synthetic item 2:

```text
run result: HTTP 503 / BATCH_RPC_FAILED
processed = 2; expired = 1; errors = 1
item 1: EXPIRED + audit 1 (committed)
item 2: PAYMENT_PENDING + audit 0 (retryable)
next fire after harness removal: item 2 EXPIRED + audit 1
```

Temporary grant harnesses also proved:

```text
batch RPC unavailable -> HTTP 503 / BATCH_RPC_FAILED; lease released
release RPC unavailable -> HTTP 503 / LEASE_RELEASE_FAILED; lease not released
```

Both grants were restored and the retained lease was owner-released.

## 10. Dry-run zero-write proof

`mode=dry_run` returned HTTP 200, `applied=false`. Before/after counts and MD5
fingerprints were identical for:

```text
orders
capacity_holds
registrations
capability_credentials
payments
activity_log
outbox_delivery_jobs
tickets
access_entitlements
```

The `payment_pending_expiry_run` lease-row count also remained unchanged,
demonstrating zero lease acquire calls and zero batch calls.

## 11. Temporary schedule and SLA

```text
name: payment-pending-expiry
cron: * * * * *
method: POST
body: {"mode":"reconcile","max_items":25}
Authorization: InsForge secret reference (value never embedded)
```

Observed authenticated executions:

```text
20:01:00.022Z -> 200, 1186 ms
20:02:00.018Z -> 200, 1121 ms
20:03:00.007Z -> 200,  734 ms
20:04:00.013Z -> 200, 1304 ms
```

No overlap outcome occurred. Main has neither this function nor this schedule.

SLA fixture:

```text
expires_at:          2026-07-29T20:00:10.000Z
first later fire:    2026-07-29T20:01:00.022Z
persisted expiry:    2026-07-29T20:01:01.152Z
latency:             51.152927 seconds
required:            <= 300 seconds
result:              PASS
```

The schedule was disabled at `2026-07-29T20:04:42.933Z`; final state is
`isActive=false` and `cronJobId=null`.

## 12. Domain protection

For all IMPL-14A-3C synthetic orders:

```text
payments = 0
tickets = 0
access entitlements = 0
team/team_member links = 0
outbox jobs = 0
PAID orders = 0
PAID orders touched by reconciler actor = 0
```

Sandbox totals remained `payments=8`, `tickets=0`, `teams=2`,
`team_members=4` across the effective synthetic reconciliation checks. No
Mercado Pago call, refund, QR/access issuance or PAID degradation occurred.

## 13. Historical finding — malformed 0014 authorization token

Final hash verification established:

```text
authorized token length: 63
actual SHA-256 length: 64
first divergence: position 16 (the authorized token is missing a D)
actual file unchanged during runtime: yes
```

The earlier preflight incorrectly treated the malformed token as matching and
remote writes continued. This violates the stop condition in the authorization.
No attempt was made to edit 0014, create 0015 or roll back the sandbox.

On 2026-07-29 the Project Owner confirmed the 63-character value was a
documentary transcription error and ratified the actual 64-character SHA-256
as canonical. No migration bytes changed.

```text
finding: MIGRATION-SHA-001
status: RATIFIED BY PROJECT OWNER
canonical 0014 SHA:
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

## 14. Blocking finding — 45-second budget vs gateway

The physical requirement `partial by budget -> HTTP 200` did not pass.

Two temporary, fully removed delay harnesses were tried:

1. One 45.2-second item delay exceeded the database query gateway timeout. A
   concurrent Edge call observed the locked candidate as processed 0.
2. Twenty-five independent two-second item delays kept each RPC below the
   database timeout but the public Edge request ended in CloudFront HTTP 504.
   The durable database state subsequently showed all 25 items EXPIRED; no
   HTTP 200 `budget_exhausted=true` response was observable.

This establishes a runtime mismatch between the configured 45-second Edge
budget and the shorter public gateway deadline. No code or migration correction
was made in this unit.

```text
finding: BUDGET-GATEWAY-001
severity: BLOCKER
status: STILL FAILING AFTER FIX-1 SANDBOX RETEST
authorized correction: RUN_BUDGET_MS 45_000 -> 30_000
correction state: DEPLOYED ONLY TO impl-14a-expiry
sandbox retest: EXECUTED / GATEWAY HTTP 504
```

The historical 45-second attempt and HTTP 504 evidence above remain unchanged.
IMPL-14A-3C-FIX-1 changed only the budget constant to 30 seconds and was
redeployed only to the authorized sandbox. Section 19 records the physical
retest; the gateway still returned HTTP 504 before the Edge response.

## 15. Cleanup

```text
temporary trigger functions: 0
temporary triggers: 0
temporary grant changes: 0
temporary deploy bundle: deleted
temporary local secret variable: cleared
schedule: inactive
0014: retained in sandbox
Edge function: retained active in sandbox
schedule secret: retained active in sandbox
synthetic fixtures: retained and tagged for traceability
```

The migration runner required a temporary nested CLI link because it only
searched `<cwd>/migrations`. The CLI unexpectedly refreshed global InsForge
skills and generated nested `AGENTS.md` and `.gitignore` files; all generated
repository files and the nested project link were removed immediately.

## 16. Local regression

Historical runtime-unit regression:

```text
npm test: 20 files / 348 tests PASS
focused expiry suite: 5 files / 144 tests PASS
npm run typecheck: PASS
npm run lint: exit 0 (pre-existing warnings only)
git diff --check: PASS
```

No code correction was made during that runtime unit.

IMPL-14A-3C-FIX-1 local regression:

```text
npm test: 20 files / 348 tests PASS
focused expiry suite: 5 files / 144 tests PASS
npm run typecheck: PASS
npm run lint: PASS (exit 0; pre-existing warnings outside FIX-1)
git diff --check: PASS
```

The focused budget test asserts the exact 30,000 ms constant, permits only the
already-started batch, preserves its processed/noop accounting, returns partial
HTTP 200 with `budget_exhausted=true`, and releases the lease in `finally`.
Existing overlap, max-items, fatal batch and fatal release contracts remain
green.

## 17. Credential-safety observation

The dedicated schedule secret was never disclosed. During preflight, however,
`insforge current --json` emitted the existing sandbox admin API key in a
diagnostic tool output. Generated output artifacts containing that diagnostic
were deleted, but the session transcript cannot be rewritten.

```text
finding: SBX-CREDENTIAL-001
severity: MAJOR
status: REMEDIATED BY HUMAN CREDENTIAL RECOVERY
rotation/recovery verification: PASS through sandbox metadata
new credential disclosure: 0
Main credential affected: no
```

## 18. IMPL-14A-3C-FIX-1 current state

```text
IMPL-14A-3C: IMPLEMENTING / NOT VALIDATED / NOT CLOSED
MIGRATION-SHA-001: RATIFIED BY PROJECT OWNER
BUDGET-GATEWAY-001: STILL FAILING
RUN_BUDGET_MS: 30_000 DEPLOYED ONLY TO SANDBOX
sandbox retest: EXECUTED / VALIDATION_FAILED
sandbox API key recovery: EXECUTED / VERIFIED / DISCLOSURE 0
INSFORGE_ENVIRONMENT: sandbox
0014 sandbox apply: EXECUTED
Edge sandbox redeploy: EXECUTED
schedule validation: EXECUTED / INACTIVE AFTER TEST
schedule current state: INACTIVE
Main application: NOT AUTHORIZED / writes 0
human validation / closure: NOT PERFORMED
true least privilege: OPEN
PRODUCTION: NO-GO
staging / commit / push: 0 / 0 / 0
```

## 19. IMPL-14A-3C-FIX-1 sandbox retest

### 19.1 Preflight, environment and deploy

```text
repository branch: main
HEAD = origin/main: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
divergence: 0 / 0
staged: 0
sandbox: impl-14a-expiry
Project ID: 2921e092-aed6-4abb-93be-946c42eee82a
prefix: 4bg9ufz2-2w7
migration max: 14 / payment-pending-expiry-run-lease
schedule before/after: inactive / inactive
INSFORGE_ENVIRONMENT: sandbox
redeployed function: payment-pending-expiry only
deployed bundle SHA-256:
  72D62A7A603DA3EB8B542261C8A3F66825D054106210A8709E555FE2BE39F5F9
temporary deploy bundle: removed
```

The deployed bundle contained `RUN_BUDGET_MS=30_000`, `limit:1`, lease TTL 90,
the fixed actor and the dedicated schedule-secret gate.

### 19.2 HTTP contract

```text
GET: 405
POST without Authorization: 401
POST invalid bearer: 403
POST invalid JSON: 400
POST valid with no candidates: 200 completed
environment: sandbox
```

### 19.3 Physical 30-second budget result

The temporary harness created five complete, expired synthetic aggregates
tagged `IMPL-14A-3C-FIX-1-BUDGET`. A temporary trigger delayed each state
transition by 7.6 seconds. The request used `max_items=5`.

```text
public gateway HTTP: 504
client-observed duration_ms: 30496
gateway 504 count: 1

Edge structured terminal log:
  outcome: partial
  duration_ms: 30997.408915
  processed: 4
  expired: 4
  inconsistent: 0
  noop: 0
  errors: 0
  budget_exhausted: true
  lease_released: true
  environment: sandbox
```

Durable state immediately after the budget run was exactly four `EXPIRED`
orders and one `PAYMENT_PENDING` order, with four expired holds, four cancelled
registrations, four expired `ORDER_HOLDER` credentials and four audit rows.
The fifth aggregate remaining untouched proves that no fifth batch call began
after the budget gate. The durable lease row was `COMPLETED` and expired.

The Edge contract behaved correctly internally, but its HTTP 200 response was
not observable because the public gateway returned 504 first. Therefore the
required `gateway 504=0` condition failed.

### 19.4 Limited remote regressions

```text
max_items=1: HTTP 200 partial, processed 1, expired 1, lease released
overlap_skipped: HTTP 200, processed 0
batch RPC unavailable: HTTP 503 / BATCH_RPC_FAILED, lease released
release RPC unavailable: HTTP 503 / LEASE_RELEASE_FAILED
no candidates: HTTP 200 completed, environment sandbox
```

Both temporary grants were restored. The retained lease from the release-fatal
case was owner-released after restoration.

### 19.5 Durable state, domain protection and cleanup

```text
five tagged orders: 5 EXPIRED / 0 PAYMENT_PENDING / 0 PAID
expired holds / cancelled registrations / expired holders: 5 / 5 / 5
effective audit rows: 5
payments total before/after: 8 / 8
tickets total before/after: 0 / 0
access entitlements before/after: 0 / 0
teams before/after: 2 / 2
team_members before/after: 4 / 4
temporary functions: 0
temporary triggers: 0
temporary grant changes: 0
lease released: true
schedule active: false
cron job id present: false
```

No Mercado Pago, refund, ticket, QR/access, team or PAID-order path was invoked.
The tagged synthetic fixtures remain for traceability, as permitted by the
sandbox authorization; all temporary harness objects were removed.

### 19.6 Post-retest local regression

```text
npm test: 20 files / 348 tests PASS
focused expiry suite: 5 files / 144 tests PASS
npm run typecheck: PASS
npm run lint: exit 0 (pre-existing warnings only)
git diff --check: PASS
```

Gate:

```text
VALIDATION_FAILED
```

## 20. IMPL-14A-3C-FIX-2 — Local gateway-safe deadline

Local-only unit. Zero remote interaction. The physical sandbox retest of FIX-2
remains PENDING and requires separate authorization after CTO review.

### 20.1 Scope conflict and Scope Amendment-1

The original FIX-2 authorization required `RUN_BUDGET_MS = 20_000` while also
prohibiting any modification of `tests/unit/expiry/scheduler-reconciler.test.ts`,
which asserted `expect(RUN_BUDGET_MS).toBe(30_000)`. Both requirements could not
hold at once, so execution stopped before writing any file.

The human owner then issued `IMPL-14A-3C-FIX-2 SCOPE AMENDMENT-1`, which
replaced that single prohibition and expressly authorized:

```text
insforge/functions/_shared/expiry/config.ts
insforge/functions/_shared/expiry/orchestrate.ts
tests/unit/expiry/scheduler-reconciler.test.ts
tests/unit/expiry/payment-pending-expiry.test.ts
docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md
WORKSPACE_STATUS.md
```

`tests/unit/expiry/expiry-run-lock.test.ts`, `insforge/migrations/*`, other Edge
Functions, `.cursor/*` and `.insforge/project.json` remained prohibited and were
not touched. `payment-pending-expiry.test.ts` needed no FIX-2 change and keeps
all inherited modifications.

### 20.2 Git baseline before writing

```text
branch: main
HEAD: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
origin/main: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
divergence: 0 0
staged: 0
```

SHA-256 of the authorized files before writing:

```text
config.ts                4A79A2B323ABCA284E847F2752BFC6791C4BF44BE9E40F73AE6857831E55AC61
orchestrate.ts           97A858BB277994598F065C395088877A6E1CEEAA0588013707A3AAC3F3037D2A
scheduler-reconciler     7E81FA76DEF717EAC7DB4628C1CDF5DCEA3E8990246C84B9474B72EF661C9B75
payment-pending-expiry   BBD10FE2C488E6CF9963E80B7AFF42286B4113F4E516E38D080D684F1A39C496
IMPL-14A-3C-SBX-RUNTIME  89CD755562DF9E1210809C4D1830F4858FAF08B4D27B1C13162829177493C7BF
WORKSPACE_STATUS         CC7631F15176E7706A510D36813BCF4BFE1D903455C3309A3C4EDFAA372BA25A
```

### 20.3 Functional change

Deadline constant in `insforge/functions/_shared/expiry/config.ts`:

```text
- export const RUN_BUDGET_MS = 30_000
+ export const RUN_BUDGET_MS = 20_000
```

Measurement origin in `insforge/functions/_shared/expiry/orchestrate.ts`:

```text
- const budgetStartedMs = monotonicNow()   // read after lease acquisition
- if (monotonicNow() - budgetStartedMs >= RUN_BUDGET_MS)   // pre-batch
- if (monotonicNow() - budgetStartedMs >= RUN_BUDGET_MS)   // post-batch
+ if (monotonicNow() - startedMs >= RUN_BUDGET_MS)         // pre-batch
+ if (monotonicNow() - startedMs >= RUN_BUDGET_MS)         // post-batch
```

`budgetStartedMs` no longer exists. `startedMs` is read once at the very start of
the execution, before parsing, authorization and lease acquisition, so every
pre-batch operation now consumes the execution budget. The mandatory pre-batch
gate stays immediately before the `deps.repo.runBatch` call at the top of each
loop iteration; the post-batch gate is retained only to report exhaustion after
in-flight work commits. No cancellation was introduced inside a transaction.

Normative condition:

```text
elapsed_ms = monotonicNow() - startedMs
elapsed_ms >= RUN_BUDGET_MS -> no new batch, outcome = partial,
                               budget_exhausted = true, lease released, HTTP 200
```

### 20.4 Contract preserved

```text
lease TTL 90 s, lease owner run_id, actor system:payment-pending-expiry
default max_items 25, absolute cap 50, batch limit 1, commit per order
cadence 1 minute, dry-run without lease or batch
overlap -> 200 | max_items -> 200 partial | budget -> 200 partial
fatal batch -> 503 | fatal release -> 503 | no candidates -> 200 completed
migrations 0012/0013/0014, tables, RPCs, grants, auth: unchanged
```

### 20.5 Test matrix B1–B14

All timing is driven by the injected `monotonicNow` clock; no test waits real
seconds.

| ID | Criterion | Expected | Observed | Result |
| --- | --- | --- | --- | --- |
| B1 | Operational constant | `RUN_BUDGET_MS === 20_000` | assertion updated from `30_000`; targeted search finds no operational `30_000` | PASS |
| B2 | Batch allowed below deadline | `elapsed 19_999` -> batch starts | 1 `runBatch` call, `completed`, `budget_exhausted=false` | PASS |
| B3 | Batch blocked at exact deadline | `elapsed 20_000` -> no batch | `runBatch` never called, `partial`, `budget_exhausted=true` | PASS |
| B4 | Batch blocked past deadline | `elapsed 20_001` -> no batch | `runBatch` never called, `partial`, `budget_exhausted=true` | PASS |
| B5 | Partial result | HTTP 200 / `partial` / `budget_exhausted=true` | status 200 with both fields | PASS |
| B6 | No extra batch call | zero calls after the gate | `expect(repo.runBatch).not.toHaveBeenCalled()` in B3/B4; exactly 2 of 25 allowed calls in B7 | PASS |
| B7 | Committed work preserved | counters equal completed batches | `processed 2`, `expired 2`, `errors 0` after mid-run cut | PASS |
| B8 | Lease released on deadline exit | `lease_released=true`, 1 release call | released in every budget path, including the zero-batch paths | PASS |
| B9 | Fatal release intact | HTTP 503 `LEASE_RELEASE_FAILED` | unchanged existing test passes | PASS |
| B10 | Fatal batch intact | HTTP 503 `BATCH_RPC_FAILED` | unchanged existing tests pass (thrown and `ok:false`) | PASS |
| B11 | Max-items distinct from budget | `partial` with `budget_exhausted=false` | 25 calls, `processed 25`, no budget flag | PASS |
| B12 | No candidates intact | HTTP 200 `completed`, `budget_exhausted=false` | assertions strengthened on the `processed=0` test | PASS |
| B13 | Dry-run intact | no lease, no batch | unchanged existing tests pass | PASS |
| B14 | Accounting | reported counters equal real work | B7 and B3/B4 zero-work counters exact | PASS |

Measurement origin is proven by B3: the fake `acquireLease` advances the clock to
exactly `RUN_BUDGET_MS`, and no batch starts. Under the previous
`budgetStartedMs` origin the elapsed time would have been 0 and a batch would
have started, so the test fails against the old logic and passes against the new
one. This is the direct local analogue of the sandbox failure, where lease
acquisition and pre-batch latency were invisible to the budget.

### 20.6 Local validation

```text
affected file (scheduler-reconciler.test.ts): 25 tests PASS
focused expiry suite (tests/unit/expiry): 5 files / 148 tests PASS
complete suite (npm test): 20 files / 352 tests PASS
npm run typecheck: PASS
npm run lint: oxlint exit 0, pre-existing warnings only, zero findings in FIX-2 files
git diff --check: PASS
```

Targeted constant search:

```text
operational 30_000 deadline: absent
operational 20_000 deadline: present (config.ts line 4)
historical 30,000 ms references in sections 14 and 19: preserved unchanged
unrelated 30000 values (catalog prices, seeds, IMPL-12 evidence): untouched
```

### 20.7 Remote interaction

```text
InsForge CLI invocations: 0
remote metadata reads: 0
remote SQL: 0
Edge Function invocations: 0
deploys: 0
migrations: 0
schedule changes: 0
Mercado Pago / MCP calls: 0
sandbox writes: 0
Main writes: 0
production changes: 0
network calls: git fetch origin only
```

The deployed sandbox bundle still contains `RUN_BUDGET_MS = 30_000`; FIX-2 exists
only in the local working tree.

### 20.8 Pending

```text
CTO review of this local evidence: PENDING
physical sandbox retest of FIX-2: PENDING, not authorized yet
BUDGET-GATEWAY-001: OPEN until a sandbox run returns HTTP 200 partial with
                    gateway 504 = 0
```

Gate:

```text
READY_FOR_CTO_IMPL_14A_3C_FIX_2_LOCAL_REVIEW
```

## 21. IMPL-14A-3C-FIX-2 — Sandbox gateway-safe retest

Executed 2026-07-29 `America/Merida` (2026-07-30 UTC) in `impl-14a-expiry` after
the local CTO review passed. Mode
`VALIDATE`: the 20-second execution deadline was exercised physically against the
public gateway. No code was changed during this retest.

### 21.1 Git preflight

```text
branch: main
HEAD: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
origin/main: 65ef456f3bb98d2817ce2789b98fe9a18ab909aa
divergence: 0 0
staged: 0
git diff --check: PASS
```

Working tree classification:

```text
inherited before FIX-2:
  M  tests/unit/expiry/payment-pending-expiry.test.ts
  ?? insforge/functions/_shared/expiry/
  ?? insforge/functions/payment-pending-expiry/
  ?? insforge/migrations/0014_payment-pending-expiry-run-lease.sql
  ?? tests/unit/expiry/expiry-run-lock.test.ts
  ?? tests/unit/expiry/scheduler-reconciler.test.ts
  ?? docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md
FIX-2 local edits (inside the untracked/modified files above):
  config.ts, orchestrate.ts, scheduler-reconciler.test.ts
retest documentary changes:
  M  WORKSPACE_STATUS.md
  docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md (this section)
out of scope, untouched:
  .cursor/* (untracked IMPL-12 / IMPL-13 artifacts)
  .insforge/project.json
```

### 21.2 Implementation hashes, unchanged across the retest

```text
config.ts                915DC733877EF275AB0605505EF6973EB0050DB0B5C9916640AD39EC5E667CFA
orchestrate.ts           82A99D81620234290051B2DD304FCBDA2000E290233951C2213EC122B62EF608
payment-pending-expiry/index.ts
                         2A74C02FF03878CB0FD1BBB41F1150CC9BCB5DEC8E644CCC41B626EAD9A0C4C0
scheduler-reconciler.test.ts
                         FE98C2B18787184955138A8C7C2A1935CA1CEF1785084717D9569A222A0F4984
payment-pending-expiry.test.ts
                         BBD10FE2C488E6CF9963E80B7AFF42286B4113F4E516E38D080D684F1A39C496
```

Local pre-deploy verification:

```text
RUN_BUDGET_MS = 20_000        (config.ts line 4)
budgetStartedMs               absent in functions and tests (0 occurrences)
elapsed source                startedMs
pre-batch gate                present, immediately before deps.repo.runBatch
DEFAULT_MAX_ITEMS = 25 | ABSOLUTE_MAX_ITEMS = 50 | LEASE_TTL_SECONDS = 90
ACTOR_REF = system:payment-pending-expiry | batch limit = 1
```

### 21.3 Canonical migration hashes

```text
0012  E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1  MATCH
0013  BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A  MATCH
0014  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000  MATCH
```

`0013` is `0013_payment-pending-expiry-array-fix.sql`. No migration was modified
or re-applied.

### 21.4 Main before the retest

Inspected read-only through the Main-bound MCP channel (`ready2hybrid`,
`91fa34b1-e3b5-44c0-9806-b092c1dd7144`, appkey `4bg9ufz2`). The repository was not
linked to Main.

```text
applied migration ceiling: 10
0011 marker in checkout_start_tx: absent
expire_payment_pending_* functions: 0
payment_pending_expiry_run_lease functions: 0
idx_orders_state_expires_at_id (0012): absent
payment-pending-expiry Edge Function: absent (5 functions: ticket-credentials,
  team-roster, get-order-status, mp-webhook, mp-create-checkout)
orders / holds / registrations / credentials / payments / tickets / activity_log
  / idempotency_records: 0 rows each
IMPL-14A-3C fixtures: 0
writes by this operation: 0
```

Schedule evidence for Main is indirect and is recorded as a limitation:

```text
finding: OBS-3C-CRONVIEW-001
severity: NON-BLOCKING
status: OPEN
detail: the project role cannot read schema cron ("permission denied for schema
        cron"), and the InsForge schedules API is only reachable for the project
        the CLI is linked to. Main holds no payment-pending-expiry function at
        all, so no in-project schedule can target it; the single schedule record
        observed belongs to the sandbox branch.
```

### 21.5 Sandbox before the retest

```text
project_name: impl-14a-expiry
project_id: 2921e092-aed6-4abb-93be-946c42eee82a
appkey: 4bg9ufz2-2w7
region: us-east
parent_project_id: 91fa34b1-e3b5-44c0-9806-b092c1dd7144
branch_state: ready (mode schema-only)
API key: valid (authenticated reads and writes succeeded)
applied migrations: 14, including logical-capacity-expiry-exclusion,
  payment-pending-expiry-transaction, payment-pending-expiry-array-fix,
  payment-pending-expiry-run-lease
payment-pending-expiry Edge Function: present, active
schedule payment-pending-expiry: isActive=false, cronJobId=null
INSFORGE_ENVIRONMENT secret: present, active
expiry candidates before the harness: 0
lease rows: 1, none ACTIVE
domain baseline: payments 8, refunds 2, tickets 0, access_entitlements 0,
  teams 2, team_members 4, outbox 32, activity_log 141, orders 147
```

`current --json` was not used and no credential was rotated. One credential
observation is recorded:

```text
finding: SBX-CREDENTIAL-003
severity: NON-BLOCKING
status: OPEN
detail: npx @insforge/cli branch list --json returns each branch's encrypted
        database_password, jwt_secret and access_api_key envelopes. The values
        are ciphertext, not usable plaintext keys, and none is reproduced in this
        evidence. The command was not repeated. Human review should decide
        whether any rotation is warranted; this unit was not authorized to
        rotate credentials.
```

### 21.6 Redeploy

```text
bundler: npx -y esbuild@0.28.1 --bundle --format=esm --platform=neutral
         --target=es2022 --external:npm:@insforge/sdk@1.5.0
         --external:npm:@insforge/sdk
entry: insforge/functions/payment-pending-expiry/index.ts
outfile: OS temporary directory, outside the repository
bundle SHA-256: F45A0FB4F4C31738B8C50F2C0825262F61FE1B8B2AC73C8ABB2818913E908EEC
bundle size: 16781 bytes
deploy: npx @insforge/cli functions deploy payment-pending-expiry --file <temp>
deployment id: sjpyyrc0etaf
deployment status: success
function status: active
updatedAt: 2026-07-30T05:17:51.641Z
functions deployed: payment-pending-expiry only
migrations applied: 0
temporary bundle: deleted after deploy
```

The active bundle returned by the deploy response contains:

```text
var RUN_BUDGET_MS = 2e4;                          // 20_000
if (monotonicNow() - startedMs >= RUN_BUDGET_MS)  // pre-batch and post-batch
var ACTOR_REF = "system:payment-pending-expiry";
var DEFAULT_MAX_ITEMS = 25; var ABSOLUTE_MAX_ITEMS = 50;
var LEASE_TTL_SECONDS = 90; limit: 1
```

No occurrence of `30000`, `3e4` or `budgetStartedMs`. Only the four authorized
RPC names appear; searches for Mercado Pago, checkout, webhook, ticket and refund
modules returned zero matches. No secret value was printed at any point; the
schedule secret was read into a shell variable and cleared afterwards.

### 21.7 HTTP contract and environment

```text
GET with valid bearer                 405 METHOD_NOT_ALLOWED
POST without Authorization            401 UNAUTHORIZED
POST with invalid bearer              403 FORBIDDEN
POST with malformed JSON              400
POST valid, no candidates             200 completed, processed 0
environment field                     sandbox   (not unknown)
```

`OBS-3C-ENV-001` stays resolved in the sandbox: every response carried
`"environment":"sandbox"`.

### 21.8 Physical deadline result

Harness: five complete, temporally eligible synthetic aggregates tagged
`IMPL-14A-3C-FIX-2-BUDGET-1..5` (order `PAYMENT_PENDING`, one `ACTIVE` hold, one
provisional registration, one `ISSUED` `ORDER_HOLDER` credential, all three
`expires_at` identical and 10 minutes in the past, zero payments). A temporary
`BEFORE UPDATE` trigger on `orders` delayed each `PAYMENT_PENDING -> EXPIRED`
transition of a tagged fixture by 7.0 seconds. Request body:
`{"mode":"reconcile","max_items":5}`.

```text
client start (UTC):        2026-07-30T05:22:08.879Z
client end (UTC):          2026-07-30T05:22:31.033Z
client start (local):      2026-07-29T23:22:08.879-06:00  (America/Merida)
client end (local):        2026-07-29T23:22:31.033-06:00  (America/Merida)
client observed duration:  22153.819 ms  (curl time_total 22098.605 ms)
internal duration_ms:      21408.765834 ms
Edge started_at:           2026-07-30T05:22:09.151Z
Edge finished_at:          2026-07-30T05:22:30.560Z
public gateway HTTP:       200
gateway 504 count:         0
outcome:                   partial
budget_exhausted:          true
lease_released:            true
run_id (sanitized):        b4c38173-…-e9e82d77
max_items:                 5
batches initiated:         3
batches completed:         3
batches blocked by gate:   1 (the fourth was never started)
orders processed:          3
expired:                   3
inconsistent / noop / errors: 0 / 0 / 0
```

Verification points:

```text
1. lease acquisition and pre-batch work inside the budget: the run crossed the
   20 s line during the third batch and stopped; started_at to finished_at spans
   the whole execution, and the reported duration exceeds RUN_BUDGET_MS by
   1408.8 ms, which is exactly the tail of the in-flight batch.
2. batch started before the limit finishes normally: the third batch began at
   about 14.5 s elapsed and committed its order at about 21.4 s.
3. no batch starts once elapsed >= 20_000: only three expiry_item_result events
   exist for this run_id and two fixtures were left untouched.
4. completed batches keep their commits: BUDGET-3/4/5 are EXPIRED with hold
   EXPIRED, registration CANCELLED and ORDER_HOLDER EXPIRED.
5. counters match durable state: processed 3 / expired 3 versus exactly 3
   EXPIRED aggregates and 3 ORDER_EXPIRY_APPLIED audit rows.
6. no double transition: each expired order has exactly one audit row and zero
   ORDER_EXPIRY_INCONSISTENT rows; the untouched fixtures have zero audit rows.
7. no ticket emission: 0 tickets and 0 access entitlements for every fixture.
8. no payment change: 0 payments per fixture; project payments stayed at 8.
9. no refund change: REFUNDED/CHARGED_BACK payments stayed at 2.
10. lease released: the lease row returned to a non-ACTIVE state, 0 retained.
11. reacquisition works: the following authenticated run acquired the lease and
    returned HTTP 200.
12. the client received the JSON body, not a 504: the body above is the verbatim
    external response captured by curl.
```

Structured terminal log for the run:

```text
{"event":"expiry_run_partial","outcome":"partial","duration_ms":21408.765834,
 "processed":3,"expired":3,"inconsistent":0,"noop":0,"errors":0,
 "budget_exhausted":true,"lease_released":true,"environment":"sandbox"}
```

### 21.9 Temporal safety margin

```text
requirement:                    gateway_504 = 0 and external HTTP = 200
result:                         PASS
previous FIX-1 gateway cut:     30496 ms
client observed now:            22098.605 ms
margin at the client:           8397.4 ms  (27.5 % below the cut)
internal duration now:          21408.766 ms
margin against the cut:         9087.2 ms
previous internal duration:     30997.409 ms  (cut before responding)
improvement:                    9588.6 ms shorter execution
```

Residual risk: the margin depends on the duration of the single in-flight batch
when the gate fires. This harness used a 7.0 s per-item delay, so the observed
overshoot past the deadline was 1408.8 ms. A production batch slower than about
10 s could still push a run toward the cut, because the contract deliberately
lets an already-started batch finish instead of cancelling inside a transaction.

```text
finding: BUDGET-GATEWAY-001
status: PHYSICALLY SATISFIED IN SANDBOX / PENDING HUMAN VALIDATION
residual: worst-case single-batch duration is not bounded by the deadline
```

Historical state at execution time; superseded by §22.

The deadline was not changed and no code was corrected during the retest.

### 21.10 Limited remote regressions

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| max_items reached | 200 partial | 200, `partial`, processed 1, `budget_exhausted=false`, lease released, 7304.4 ms | PASS |
| overlap_skipped | 200 | 200, `overlap_skipped`, processed 0, `lease_released=false`, 24.3 ms | PASS |
| fatal batch | 503 | 503, `BATCH_RPC_FAILED`, processed 0, errors 1, lease released | PASS |
| fatal release | 503 | 503, `LEASE_RELEASE_FAILED`, processed 1 committed, lease retained | PASS |
| no candidates | 200 completed | 200, `completed`, processed 0, `budget_exhausted=false` | PASS |

The overlap case used a live lease acquired directly through the RPC with a
different `run_id`; the fatal cases used a temporary `REVOKE EXECUTE` on the
batch RPC and then on the release RPC. `max_items` also proves lease
reacquisition after the budget run, and it stays distinguishable from the budget
exit because `budget_exhausted` is `false`. The full L1–L10 lease matrix,
migration 0014, schedule cadence, closed 3B tests, other Edge Functions and
Mercado Pago were not re-executed.

### 21.11 Cleanup and protected domain

```text
synthetic fixtures:            0
temporary helper functions:    0  (fix2_budget_delay_fn dropped)
temporary triggers:            0  (fix2_budget_delay_trg dropped)
temporary grants:              restored — EXECUTE for project_admin true on all
                               five expiry/lease RPCs
harness leases retained:       0
temporary deploy bundle:       deleted
local temporary request files: deleted
schedule:                      isActive=false, cronJobId=null
future executions:             0
```

Domain counters after cleanup are identical to the pre-retest baseline:

```text
payments 8 = 8 | refunds 2 = 2 | tickets 0 = 0 | access_entitlements 0 = 0
teams 2 = 2 | team_members 4 = 4 | outbox 32 = 32 | activity_log 141 = 141
orders 147 = 147
```

No unauthorized ticket, access, payment, refund, team or member change occurred.

### 21.12 Main after the retest

```text
applied migration ceiling: 10
0011–0014: absent
expire_payment_pending_* / lease functions: 0
idx_orders_state_expires_at_id: absent
fix2_* harness functions and triggers: 0
payment-pending-expiry Edge Function: absent (same 5 functions as before)
orders / holds / registrations / credentials / payments / tickets /
  activity_log / idempotency_records: 0 rows each
writes by this operation: 0
```

Main is byte-for-byte identical to the pre-retest inspection.

### 21.13 Final local regression

```text
npm test -- tests/unit/expiry: 5 files / 148 tests PASS
npm test: 20 files / 352 tests PASS
npm run typecheck: PASS
npm run lint: oxlint exit 0, pre-existing warnings only, all in generated
              handler.deploy.js bundles unrelated to FIX-2
git diff --check: PASS
```

### 21.14 Files, staging and remote scope

```text
modified by the retest:
  docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md
  WORKSPACE_STATUS.md
implementation files: unchanged, hashes as in 21.2
migrations, tests, other functions, .cursor/*, .insforge/project.json: untouched
staging: 0 | commit: 0 | push: 0
sandbox deploys: 1 (payment-pending-expiry) | migrations: 0
Main writes: 0 | production changes: 0 | schedule changes: 0
Mercado Pago / payment provider calls: 0
other Edge Functions invoked or deployed: 0
```

### 21.15 Blockers and risks

```text
blockers: none
risk 1: worst-case single-batch duration is not bounded by the 20 s deadline
        (see 21.9); a batch slower than about 10 s could approach the gateway cut
risk 2: OBS-3C-CRONVIEW-001 — Main's schedule store is not directly readable
        without linking or switching the CLI, which is prohibited here
risk 3: SBX-CREDENTIAL-003 — branch list --json emits encrypted credential
        envelopes; not reproduced, no rotation performed
open: OD-040-002 true least privilege remains OPEN (project_admin grants)
```

Gate:

```text
READY_FOR_CTO_IMPL_14A_3C_FIX_2_RUNTIME_REVIEW
```

## 22. IMPL-14A-3C — Human validation and closure

Date: 2026-07-29 (`America/Merida`, canonical governance timezone). Authority:
Project Owner (human owner of Ready2Hybrid), after reviewing the CTO
recommendation on the FIX-2 sandbox runtime evidence.

### 22.1 Authorized state transition

```text
before: IMPL-14A-3C = IMPLEMENTING / VALIDATED = NO / CLOSED = NO
after:  IMPL-14A-3C = VALIDATED / CLOSED
```

Closure scope, verbatim from the authorization:

```text
implementacion local
+ pruebas automatizadas
+ runtime fisico validado en sandbox
```

### 22.2 Basis of the validation

```text
RUN_BUDGET_MS            20_000
deadline origin          startedMs (full execution start)
gate                     immediately before each runBatch
external HTTP            200
outcome                  partial
budget_exhausted         true
gateway 504              0
lease_released           true
lease re-acquisition     PASS
durable consistency      PASS
remote regressions       PASS (5/5)
cleanup                  PASS
expiry suite             148/148 PASS
full suite               352/352 PASS
```

Evidence for every line above is sections 21.1–21.15 of this document; FIX-1's
failed evidence (sections up to 20) is preserved unmodified.

### 22.3 Findings that remain OPEN after closure

```text
OD-040-002                  true least privilege (project_admin EXECUTE grants)
OBS-3C-CRONVIEW-001         Main schedule store not readable read-only
SBX-CREDENTIAL-003          branch list --json emits encrypted credential envelopes
IN-FLIGHT BATCH RESIDUAL    worst-case batch duration not bounded by the deadline
MAIN APPLY                  0011/0012/0013/0014 not applied to Main
PRODUCTION                  NO-GO
IMPL-14A-3D                 NOT AUTHORIZED
RATE LIMITING               PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING not closed
DEFERRED                    outbox and the remaining documented deferrals
```

### 22.4 What the closure does not authorize

```text
Main writes            NOT AUTHORIZED
production             NOT AUTHORIZED
schedule activation    NOT AUTHORIZED
new deploys            NOT AUTHORIZED
migrations             NOT AUTHORIZED
Mercado Pago           NOT AUTHORIZED
IMPL-14A-3D            NOT AUTHORIZED
staging / commit / push NOT AUTHORIZED
```

### 22.5 Closure operation scope

```text
operation              local documentary update only
files changed          WORKSPACE_STATUS.md
                       docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md
code changes           0
migration changes      0
test changes           0
remote calls           0 (no CLI, no SQL, no invoke, no deploy, no schedule, no MCP)
sandbox writes         0
Main writes            0
staged / commit / push 0 / none / none
```

Implementation hashes re-verified after the documentary update and unchanged:

```text
insforge/functions/_shared/expiry/config.ts
  915DC733877EF275AB0605505EF6973EB0050DB0B5C9916640AD39EC5E667CFA
insforge/functions/_shared/expiry/orchestrate.ts
  82A99D81620234290051B2DD304FCBDA2000E290233951C2213EC122B62EF608
insforge/functions/payment-pending-expiry/index.ts
  2A74C02FF03878CB0FD1BBB41F1150CC9BCB5DEC8E644CCC41B626EAD9A0C4C0
tests/unit/expiry/scheduler-reconciler.test.ts
  FE98C2B18787184955138A8C7C2A1935CA1CEF1785084717D9569A222A0F4984
tests/unit/expiry/payment-pending-expiry.test.ts
  BBD10FE2C488E6CF9963E80B7AFF42286B4113F4E516E38D080D684F1A39C496
tests/unit/expiry/expiry-run-lock.test.ts
  46988443E42ED342BF5D7D17A57AB4D1FDC6837116D01A950CA670A5B19B884B
insforge/migrations/0012_payment-pending-expiry-transaction.sql
  E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
insforge/migrations/0013_payment-pending-expiry-array-fix.sql
  BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
insforge/migrations/0014_payment-pending-expiry-run-lease.sql
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

### 22.6 Closure date normalization

The Project Owner confirmed that the human validation and closure of
IMPL-14A-3C happened on 2026-07-29 in the canonical governance timezone
`America/Merida` (UTC-06:00). Earlier drafts of this closure recorded the UTC
calendar day (2026-07-30), which was ambiguous because the retest ran late in
the local evening. The rule applied to both authorized documents:

```text
human and governance dates -> America/Merida
execution timestamps       -> keep UTC as captured, with the Z suffix
```

Normalized references (human/governance):

```text
IMPL-14A-3C human validation and closure   2026-07-29 America/Merida
BUDGET-GATEWAY-001 closure                 2026-07-29 America/Merida
FIX-2 sandbox retest calendar day          2026-07-29 America/Merida
                                           (= 2026-07-30 UTC)
```

Execution timestamps preserved verbatim, with local equivalents added only as
annotations in 21.8:

```text
2026-07-30T05:22:08.879Z   client start   (= 2026-07-29T23:22:08.879-06:00)
2026-07-30T05:22:31.033Z   client end     (= 2026-07-29T23:22:31.033-06:00)
2026-07-30T05:22:09.151Z   Edge started_at
2026-07-30T05:22:30.560Z   Edge finished_at
2026-07-30T05:17:51.641Z   deployment updatedAt
```

No measured duration, counter, HTTP status, hash or outcome was altered. The
normalization touched only `WORKSPACE_STATUS.md` and this evidence document; code,
tests, migrations, Edge Functions, `.cursor/*` and `.insforge/project.json` were
not modified, and no remote resource was contacted.

Gate:

```text
READY_FOR_CTO_IMPL_14A_3C_DATE_NORMALIZATION_REVIEW
```
