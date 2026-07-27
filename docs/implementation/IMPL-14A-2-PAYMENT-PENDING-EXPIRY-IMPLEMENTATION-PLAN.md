# IMPL-14A-2 — Payment Pending Expiry Reconciliation

## Implementation Traceability and Plan

```text
Status: PLAN / APPROVED
Version: 0.2.0
Created: 2026-07-27
Revised: 2026-07-27 (IMPL-14A-2F — CTO CHANGES_REQUIRED fixes)
Approved: 2026-07-27
Approved by: Leandro Espinosa, Project Owner
Approval basis: Project Owner approval after CTO READY_FOR_APPROVAL
  and IMPL-14A-2V read-only validation
Approved content SHA-256:
  04BAC5D62D6E3A75F0826AEAE0839D31340369D0156AC1DA09EB9D565D56EC0D
Unit: IMPL-14A-2 / IMPL-14A-2F / IMPL-14A-2C (documentary registration)
Governing specification: SPEC-040 v0.1.1 APPROVED
Authority: Project Owner approval of SPEC-040 (2026-07-27);
  Project Owner approval of this plan (2026-07-27)
CTO plan review: CHANGES_REQUIRED → 2F corrections → READY_FOR_APPROVAL
Commit/push: NOT AUTHORIZED by this unit (selective incorporation pending)
Runtime execution: NOT AUTHORIZED
Code/SQL/migrations/cron/edge: NOT AUTHORIZED
No IMPL-14A-3* authorization from this document
```

---

## 1. Metadata

| Field | Value |
|---|---|
| Project | Ready2Hybrid |
| Repository | `C:\vonde\enforma-sys\ready2hybrid` |
| Baseline at plan authoring | `main` @ `9668dfe` = `origin/main` |
| Spec | SPEC-040 Payment Pending Expiry Reconciliation |
| Spec version / status | 0.1.1 / APPROVED |
| Spec approved at / by | 2026-07-27 / Leandro Espinosa, Project Owner |
| Plan status | `PLAN / APPROVED` v0.2.0 |
| Plan approved at / by | 2026-07-27 / Leandro Espinosa, Project Owner |
| Plan approval SHA-256 | `04BAC5D62D6E3A75F0826AEAE0839D31340369D0156AC1DA09EB9D565D56EC0D` |
| Plan path | `docs/implementation/IMPL-14A-2-PAYMENT-PENDING-EXPIRY-IMPLEMENTATION-PLAN.md` |
| Convention | Matches existing `docs/implementation/IMPL-*-….md` |

---

## 2. Authority

Normative:

1. Project Owner decisions D1–D10 (2026-07-27)
2. SPEC-040 v0.1.1 APPROVED
3. SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-030/031/032 v0.1.0 APPROVED
4. SPEC-032-R042 (unchanged late-payment fail-safe)
5. IMPL-14A-0 diagnosis; IMPL-14A-2R review findings; CTO CHANGES_REQUIRED
6. Operational constructor: Cursor + best available LLM

This plan does **not** modify SPEC-040 normative text.

---

## 3. Objective

Prepare complete implementation traceability so a future authorized unit can
implement SPEC-040 without inventing product decisions, without degrading
`PAID`, and without executing refunds.

---

## 4. Scope

Documentary planning only:

- inventory of real symbols and capacity readers;
- architecture (logical cupo, expiry TX, dry-run, schedule, admin);
- file/migration/security/observability/validation plans;
- OD-040-001/002 recommendations and open blockers; OD-040-003 boundary;
- subdivided implementation units IMPL-14A-3A…3G (not authorized here).

---

## 5. Non-goals

- Code, SQL, migrations, schedules, edge functions, deploys
- InsForge / Mercado Pago writes
- Backfill, DELETE, mass UPDATE, sandbox creation/deletion
- Refund execution / MP refund verify / REFUNDED / exception closed (OD-040-003)
- `APPROVED → IMPLEMENTING` status transition
- Commit / push
- Main `EN_VENTA`
- Auto-authorization of any IMPL-14A-3* unit

---

## 6. Current-state inventory (READ_ONLY)

### 6.1 Confirmed SPEC-040 approval

```text
status: APPROVED
version: 0.1.1
approved_at: 2026-07-27
approved_by: Leandro Espinosa, Project Owner
```

### 6.2 Gap (from IMPL-14A-0 + code)

| Fact | Evidence |
|---|---|
| No automatic `PAYMENT_PENDING` → `EXPIRED` | No writer of order `EXPIRED` found |
| ACTIVE holds past `expires_at` still count | `checkout_start_tx` sums `state='ACTIVE'` only (`0010` ~128–131) |
| Provisional regs stay `STARTED` | Insert `STARTED`; no timeout transition |
| `ORDER_HOLDER` may remain `ISSUED` after `expires_at` | Created with TTL; no expiry reconciler |
| No expiry reconciler / schedule in repo | No expire job / schedules artifact |
| Late APPROVED protected by R042 | `webhook_apply_payment_tx` (`0009`) |

### 6.3 Real symbols

| Symbol | Path | Type | Responsibility | SPEC-040 impact | Planned change | Risk | Validation |
|---|---|---|---|---|---|---|---|
| `checkout_start_tx` | `insforge/migrations/0010_spectator-multi-quantity.sql` | SECURITY DEFINER RPC | Checkout create; inventory SUM | R004, R010, I004, I007 | **3A:** exclude time-expired ACTIVE from SUM only | Oversale if missed | AC003, AC008 |
| `checkout_attach_preference` | `0007` | RPC | PREFERENCE→PAYMENT_PENDING | R017 | None for natural expiry | Low | AC007 |
| `checkout_compensate_preference` | `0007` | RPC | CANCELLED + hold RELEASED | R017 | None | Low | AC007 |
| `webhook_apply_payment_tx` | `0009_fix_webhook_payment_verification_order.sql` | RPC | Payment apply; R042 | R011, R020, R024, I003, I008 | Lock coexistence; no PAID degrade | High if wrong | AC006, AC020–023 |
| Inventory SUM ACTIVE | only inside canonical `checkout_start_tx` (`0010`) | SQL fragment | Cupo check | R004, I007 | Predicate change in 3A | Oversale | AC003 |
| `mp-create-checkout` | `insforge/functions/mp-create-checkout/index.ts` | Edge | Calls checkout RPCs | R004 | **No change in 3A** (RPC change only) | Low | Regression |
| `mp-webhook` | `insforge/functions/mp-webhook/index.ts` | Edge | Signed webhook → apply TX | I001, R011 | Prefer none | High if touched | AC028 |
| `get-order-status` | `insforge/functions/get-order-status/index.ts` | Edge | Read-only status | Public EXPIRED visibility | Projection only if needed | Low | Manual |
| Ticket issuance RPCs | `0008` | RPC | Tickets post-PAID | R011, R016-A | Unreachable from expiry | High | AC006, AC020 |
| `activity_log` | `0001` + writers in RPCs | Table | Audit | R015, I009 | Expiry TX must write + couple | Medium | AC010, AC027 |
| `outbox_delivery_jobs` | `0001` + webhook late path | Table | Durable work / alerts | R016-B | Refund task marker (see §7.3) | Medium | AC013 |
| `idempotency_records` | `0001` + unique indexes `0002` | Table | Effect identity | R016-C, anti-dup | Run-lock candidate; admin dedup | Medium | AC014, AC025 |
| Grants `project_admin` | migrations 0005–0010 | AuthZ | Edge admin client only | R016, OD-040-002 | See actor matrix; not minimum privilege | High | AC011 |
| InsForge schedules | CLI `references/schedules.md` (not in repo) | Platform | Cron → function URL + secret headers | R005, R010, R021 | Future create only; **no documented platform no-overlap** | Ops | AC004, AC019 |
| Index `idx_capacity_holds_product_state_expires` | `0002` | Index | `(product_id, state, expires_at)` | Batch select | **Do not recreate** | — | — |

### 6.4 Capacity readers

**Only known cupo consumer deciding availability:** `checkout_start_tx` inventory SUM
(canonical definition in `0010`). Webhook reads holds by order for late-payment
classification — not a reservation SUM. Future units must re-grep before coding.

### 6.5 Platform evidence (schedules / overlap)

Verified from InsForge CLI docs (`schedules.md`):

- 5-field cron including `* * * * *` (every minute);
- headers may reference `${{secrets.KEY_NAME}}`;
- `schedules logs` for execution history;
- **no documented** platform no-overlap, lease, mutex, or single-flight guarantee.

Verified from stack (PostgreSQL via InsForge migrations):

- `SECURITY DEFINER` RPCs + `REVOKE`/`GRANT EXECUTE TO project_admin` pattern;
- `idempotency_records` with unique `(scope, key_hash)` / `(scope, actor_context, key_hash)`;
- Postgres advisory locks (`pg_try_advisory_lock`) are standard Postgres capabilities;
  **not** documented as an InsForge product feature — usable only if CTO accepts
  application-owned run-lock design inside a SECURITY DEFINER RPC.

**Replay protection:** schedule docs do not document signed timestamp, native
scheduler JWT, or durable nonce. Plan must **not** claim replay protection unless
CTO selects a verified mechanism (see OD-040-002).

---

## 7. Technical decisions (OPEN where required)

### 7.1 OD-040-001 — Cadencia física y anti-overlap

| Dimension | Value | Notes |
|---|---|---|
| Trigger cadence | every **1 minute** (`* * * * *`) | **APPROVED** by Project Owner 2026-07-27 |
| Aggregate SLA | persisted expiry ≤ **5 minutes** after `expires_at` | SPEC-040-R005; **APPROVED** |
| Max execution timeout | **≤ 45 seconds** hard budget | Leaves margin under 60s cadence |
| Batch size / items per run | start **25**, hard cap **50** | Tunable; documented in run result |
| Retries | failed items → next run; run-level fail → next minute | No unbounded in-process spin |
| Backoff | none beyond next scheduled fire | Keep simple until volume evidence |
| Row locking | `FOR UPDATE SKIP LOCKED` (or equivalent) on candidates | **Does not** replace job anti-overlap |
| Job anti-overlap | **OPEN — see §8** | Must be approved before IMPL-14A-3C |

**PO decision (2026-07-27):**

```text
OD-040-001 cadence/SLA = APPROVED (1 minute / max 5 minutes)
anti-overlap mechanism = OPEN (must be approved before IMPL-14A-3C)
BLOCKS IMPL-14A-3C until anti-overlap design accepted
```

Behavior definitions (required regardless of chosen lock):

| Condition | Required behavior |
|---|---|
| Job exceeds 60s | Abort further item claims; return PARTIAL/FAIL; rely on anti-overlap so next fire does not dual-apply |
| Next execution starts while prior running | Second run must **fail-closed acquire** (no-op or SKIP_LOCKED_RUN) — not dual mutate |
| Abandoned lease | Lease/advisory must release on session end **or** expire via `expires_at` so recovery ≤ one cadence |
| Schedule outage | No successful run within **>2× cadence** (and eligible age >5m) → SLA/outage SIGNAL (R021) |
| Two overlapping executions detected | Both must not expire same aggregate twice; second acquires fail → metric `overlap_rejected` |

### 7.2 OD-040-002 — Actores, authn, privilegios

```text
OD-040-002 = OPEN (Project Owner 2026-07-27)
system reconciler and admin operator MUST use separate actors/credentials
project_admin is NOT automatically minimum privilege
BLOCKS IMPL-14A-3C and IMPL-14A-3D until approved technical solution
```

See full actor matrix §9. Key constraints:

- Do **not** claim `project_admin` is minimum privilege.
- Scheduler secret ≠ admin recovery credential.
- No verified human-operator edge pattern exists in current functions
  (all use `API_KEY` + `createAdminClient`). Admin recovery auth remains **OPEN**.

### 7.3 OD-040-003 — Refund runbook boundary

```text
OD-040-003 = DEFERRED_TO_OPERATIONAL_RUNBOOK
does not block 3A–3C
3D may create refund task markers only
MUST NOT execute MP refund, mark REFUNDED, or close exception in IMPL-14A
```

---

## 8. Anti-overlap design (job-level)

### 8.1 What the platform documents

InsForge schedules: invoke URL on cron; secret headers; logs. **No** documented
single-flight / no-overlap.

### 8.2 Candidate mechanisms (evidence-based)

| Mechanism | Evidence | Verdict |
|---|---|---|
| Platform no-overlap | Not in `schedules.md` | **Cannot claim** |
| Postgres session advisory lock via RPC (`pg_try_advisory_lock`) | Standard Postgres; InsForge DB is Postgres | **Proposed candidate** — app-owned; auto-releases on session end |
| Durable run-lock row in `idempotency_records` (scope=`payment_pending_expiry_run`, short `expires_at`, unique key) | Table + unique indexes exist (`0001`/`0002`) | **Proposed candidate** — survives disconnect; needs expiry/cleanup rules |
| Edge in-memory mutex | Multi-instance serverless | **Rejected** — not durable across instances |

### 8.3 Recommended technical shape (still OPEN)

Prefer **advisory lock inside the batch SECURITY DEFINER RPC** as primary
single-flight, optionally **plus** `idempotency_records` run marker for
observability (`run_id`, `started_at`, `finished_at`).

```text
Classification: recommended technical resolution / requires CTO review
Cadence/SLA: APPROVED by Project Owner 2026-07-27
Until anti-overlap accepted: OD-040-001 anti-overlap remains OPEN → BLOCKS 3C
```

Row-level `SKIP LOCKED` remains mandatory for item concurrency with webhook
workers but is **insufficient alone**.

---

## 9. Actor matrix

| Actor | AuthN | AuthZ | Minimum privileges | Allowed | Prohibited | Audit |
|---|---|---|---|---|---|---|
| SYSTEM_RECONCILER | InsForge schedule POST + **dedicated schedule secret** (high entropy; server-side only; env-separated). Edge may use service `API_KEY` only to call expiry/dry-run RPCs | Edge gate fail-closed without secret; RPC `EXECUTE` only on expire/batch/dry-run functions | Call expire batch + dry-run RPCs; write run telemetry | Expire eligible aggregates; emit run metrics | Ticket mint; admin recover; refund execute; public exposure; browser | `activity_log` actor_ref=`system:payment-pending-expiry`; run `correlation_id` / `run_id` |
| DRY_RUN_OPERATOR | Same edge with `dry_run=true` **or** separate mode requiring schedule secret **or** (future) operator auth if CTO splits | Same as reconciler for read path | Read-only dry-run RPC | Report candidates | Domain transitions; domain audit-as-applied; refund tasks; outbox ops | Telemetry only; no domain reconciliation audit |
| ADMIN_RECOVERY_OPERATOR | **Human/admin auth distinct from schedule secret** — mechanism **OPEN** (no existing edge pattern) | Server-side role check before RPC; fail-closed anon | Call `admin_recover_*` only after authz | R016-A/B/C | Direct SQL/state edits; refund execute; schedule secret reuse; ticket mint outside R016-A rules | `activity_log` with **identifiable** `actor_ref`; idempotency key; correlation id |
| PAYMENT_WEBHOOK | MP signature verify + server `getPayment` | Existing `mp-webhook` → `webhook_apply_payment_tx` | Apply payment truth; R042 | Payment outcomes per SPEC-032/040 | Natural expiry; admin recover | Existing webhook activity_log |
| PUBLIC_CLIENT | Origin-guarded public endpoints | No expire/recover grants | Read status / start checkout | Public status of EXPIRED once persisted | Expire, recover, refund, ticket issue authority | Minimal public logs; no secrets |

### 9.1 SYSTEM_RECONCILER privilege reality

Evidence: every sensitive RPC today is `GRANT EXECUTE … TO project_admin` only;
edges use broad `API_KEY` → admin client. Narrower DB roles are **not** present.

If CTO confirms platform forces broad service credential:

| Residual risk | Compensating controls |
|---|---|
| Compromised `API_KEY` can call all `project_admin` RPCs including tickets | Edge code allowlist: only expiry RPCs; no ticket imports; separate **schedule secret** gate before any mutate; POST-only; redact secrets; rotate schedule secret + API_KEY on compromise; revoke schedule (`--active false`); observe overlap/deny metrics; never ship secrets to client/repo |

Preferred direction (subject to CTO): keep RPC grants on `project_admin` matching repo pattern **and** treat schedule secret + code allowlist as compensations — **not** “minimum privilege achieved.”

### 9.2 Scheduler secret requirements

Must include:

- high-entropy random secret;
- server-side InsForge secret only (`${{secrets.KEY}}`);
- per-environment separation;
- rotation + revocation procedures;
- constant-time compare in edge;
- never log value;
- fail-closed on missing/mismatch;
- POST only;
- never browser / never git;
- **not reused** for admin recovery.

**Replay:** platform does not document native replay protection. Options that may
be proposed later (each needs CTO evidence acceptance): short-lived signed
request, durable nonce table, or accept residual replay risk mitigated by
idempotent expiry + anti-overlap. **Do not declare replay protection today.**

### 9.3 ADMIN_RECOVERY_OPERATOR

Until a verified human-identifiable server-side auth pattern is approved:

```text
OD-040-002 remains OPEN
BLOCKS IMPL-14A-3D
(also BLOCKS 3C for reconciler secret/auth closure)
```

Requirements when designed: identifiable actor; existing role if possible;
server-side authz; idempotency key; correlation id; audit actor; fail-closed;
zero direct state edits (RPC only).

---

## 10. Refund marker durable storage (no new order state)

### 10.1 Evaluation of existing artifacts

| Artifact | Fit | Notes |
|---|---|---|
| `activity_log` | Audit evidence | Durable append-only; has `correlation_id`, `idempotency_fingerprint`, `sanitized_metadata`, `actor_ref`. **Not** an operational work queue (no task state machine). |
| `outbox_delivery_jobs` | **Recommended operational task** | Durable row with `state`, `attempts`, `communication_type`, `domain_event_ref`, `minimal_payload`, timestamps. Already used for `INTERNAL_ALERT` late-payment path (`0009`). |
| `idempotency_records` | **Dedup / identity** | Unique scope+key prevents duplicate task creation (R016-C). |
| `webhook_events` | Poor fit | Provider ingress evidence; not admin refund work. |
| New `orders` state | **Forbidden** | Do not add REFUNDED/refund states to orders in IMPL-14A. |

### 10.2 Proposed persistence (conceptual; no schema authored here)

| Field | Where |
|---|---|
| `refund_required` / `refund_pending` | Operational meaning in `outbox_delivery_jobs.state` and/or `minimal_payload.status` (e.g. create `PENDING` = required; update payload/state to pending-processing **without** REFUNDED) |
| Task identity | `outbox_delivery_jobs.id` + `domain_event_ref` = `order:<uuid>:refund_required` |
| Idempotency key | `idempotency_records` scope `admin_late_payment_refund_task`, `key_hash` from order id |
| Correlation id | `activity_log.correlation_id` + payload |
| Actor | `activity_log.actor_ref` (human id) |
| `created_at` | outbox + activity_log |
| Operative status | outbox `state` / payload only — **not** order.state |

**Recommended artifact:** `outbox_delivery_jobs` (+ `idempotency_records` for uniqueness) + `activity_log` for audit.

**Why durable:** rows survive process death; indexed by state; already in production schema.

**Duplicate avoidance:** unique idempotency insert before/with outbox insert; R016-C.

**Operational query:** `outbox_delivery_jobs` where `communication_type` = dedicated refund-required type AND `state` in open set; join activity_log by correlation/entity_ref.

**Must not store:** MP tokens, full payment payloads, PII beyond minimal refs, REFUNDED/completed/closed markers as IMPL-14A outcomes.

**New table/column?** Prefer **none**. If outbox semantics prove insufficient under CTO/impl review, propose **minimum** additive change in the authorizing unit (not here) — still no new order state.

IMPL-14A must **not** mark `REFUNDED`, refund completed, or exception closed.

---

## 11. Architecture plan

### 11.1 Logical cupo (mandatory) — unit 3A only

Predicate conceptually:

```text
state = 'ACTIVE'
AND (expires_at IS NULL OR expires_at > now())
```

Apply in every capacity reader (today: `checkout_start_tx` only).

### 11.2 Canonical expiry transaction — unit 3B

Conceptual RPCs (names final in 3B):

```text
expire_payment_pending_aggregate_tx(p jsonb)
expire_payment_pending_batch_tx(p jsonb)
expire_payment_pending_dry_run_tx(p jsonb)
```

#### Hardened sequence (conceptual; no SQL)

```text
1. Locate candidate (stable order; see §11.4).
2. Lock aggregate in webhook-compatible order: ORDER row then HOLD row(s) (FOR UPDATE).
3. Re-read order and hold under lock.
4. Verify current states.
5. Confirm absence of canonical payment APPROVED (server-side/canonical payment row).
6. If order PAID or payment APPROVED: do not mutate expiry path; defer to SPEC-032/R042.
7. Validate aggregate consistency (R023); else fail-closed → REQUIRES_REVIEW path.
8. Prepare transitions (order EXPIRED; hold EXPIRED; regs CANCELLED/ORDER_EXPIRED; ORDER_HOLDER EXPIRED).
9. Persist transitions + activity_log under same atomic guarantee (I009).
10. Return structured outcome (expired | noop | inconsistent | skipped_locked | error).
```

**Prohibited:** mutate before payment truth; degrade PAID; partial update without audit; issue tickets; invent missing components; complete without audit.

**Single lock order:** `orders` then `capacity_holds` (same conceptual order as webhook path) to reduce deadlocks.

### 11.3 Dry-run — unit 3B

Explicit guarantees:

```text
zero domain transitions;
zero audit records that appear as effective reconciliation;
zero refund tasks;
zero operational outbox writes;
zero unnecessary destructive locks;
zero timestamp corrections;
zero ticket issuance.
```

May produce: read-only result; separate technical read telemetry (not domain audit);
correlation id; redacted report.

**Proof of zero writes:** before/after counts (or snapshot hashes) on
`orders`, `capacity_holds`, `registrations`, `capability_credentials`,
`activity_log`, `outbox_delivery_jobs`, `tickets` for fixture scope — must be
identical (AC009, AC017).

### 11.4 Scheduled reconciler — unit 3C (blocked by OD-040-001/002)

Must define:

| Control | Plan |
|---|---|
| Stable candidate order | Deterministic `ORDER BY expires_at ASC, order_id ASC` (or equivalent) |
| Stable pagination/cursor | Keyset on `(expires_at, order_id)`; no OFFSET-unstable pages |
| Items per run | ≤ batch cap (25–50) |
| Per-item result | expired / noop / inconsistent / skipped_locked / error |
| Locked item | skip + retry next run (`SKIP LOCKED`) |
| `run_id` | UUID per successful acquire |
| Item correlation id | `run_id` + `order_id` |
| Anti-overlap | §8 — required before 3C |
| Timeout | ≤45s budget |
| Retry | next schedule fire |
| SLA signal | eligible age >5m or missing success >2× cadence |
| Partial batch | committed items stay; remainder next run |
| Review/dead-letter | inconsistent → REQUIRES_REVIEW + durable marker; errors counted |
| Schedule outage | R021 signal via missing success / schedules logs |

Eligibility changes mid-run: re-check under lock (steps 3–6); may become noop.
Process dies after some commits: safe partial; anti-overlap releases; next run continues.
Overlapping run: second fails acquire.
Scheduler never fires: outage detection (§7.1).

### 11.5 Opportunistic reconciliation boundary

```text
3A implements ONLY mandatory logical exclusion.
3A does NOT persist opportunistic expirations.
3A does NOT modify mp-create-checkout except insofar as the governing RPC
   (checkout_start_tx) changes — edge file itself stays untouched in 3A.
```

Opportunistic persist:

```text
optional;
separate later unit/extension;
must use 3B transactional contract;
not required to approve 3A;
never a substitute for the schedule.
```

### 11.6 Webhook concurrency

Same lock order; PAID → expiry noop; post-expiry late APPROVED → R042; never
regress PAID.

### 11.7 Admin recovery — unit 3D (blocked by OD-040-002)

R016-A / R016-B / R016-C as SPEC-040; refund execution out of scope.

---

## 12. Exact file plan

| Order | File | Type | EXISTING/NEW | Responsibility | I/R | AC | Unit | Risk | Validation |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Next available migration after preflight (likely after `0010`) — logical cupo only | Migration | NEW — PROPOSED PATH | REPLACE `checkout_start_tx` inventory predicate only | R004, I007 | AC003, AC008 | **3A** | High | DB + unit |
| 2 | Next available migration after 3A — expiry TX + dry-run + audit | Migration | NEW — PROPOSED PATH | expire/dry-run/batch RPCs + grants | R001–R015, R023–R024, I002–I009 | AC001–002,005,009–010,016–017,020,026–027,029–030 | **3B** | High | DB |
| 3 | `insforge/functions/payment-pending-expiry/index.ts` | Edge | NEW — PROPOSED PATH | Schedule reconciler + dry-run mode | R005,R010,R021 | AC004,AC019 | **3C** | Med | Integration |
| 4 | Next available migration if admin needs DB RPCs | Migration | NEW — PROPOSED PATH | `admin_recover_*` RPC + grants | R016 | AC011–013,AC025 | **3D** | High | Security |
| 5 | `insforge/functions/admin-late-payment-recovery/index.ts` | Edge | NEW — PROPOSED PATH | Protected admin recovery | R016 | AC011–013,AC025 | **3D** | High | Security |
| 6 | `insforge/functions/mp-create-checkout/index.ts` | Edge | EXISTING | Untouched in 3A; later only if opportunistic authorized | R010 | AC003 | later | Med | Regression |
| 7 | `insforge/functions/mp-webhook/index.ts` | Edge | EXISTING | Prefer none | I001,R011,R020 | AC006,AC021–023 | 3E | High if touched | Regression |
| 8 | `insforge/functions/get-order-status/index.ts` | Edge | EXISTING | EXPIRED projection if needed | Public | Manual | 3F | Low | Manual |
| 9 | Tests — see §13 | Tests | EXISTING + NEW | AC coverage | all | all | 3E | Low | CI |
| 10 | `docs/implementation/evidence/` | Docs | NEW dir when authorized | Sandbox evidence | all | all | 3F–3G | Low | Human |
| 11 | InsForge schedule (platform) | Config | NEW when authorized | 1-min invoke | R005,R021 | AC004,AC019 | 3C/3F | Ops | Sandbox |

**Do not fix migration numbers as 0011/0012/0013 in advance.** Confirm remote max at each unit preflight. **Do not recreate** `idx_capacity_holds_product_state_expires`.

---

## 13. Exact test plan

### 13.1 Existing files (regression / extension)

| Path | Role | I/R | AC |
|---|---|---|---|
| `tests/unit/checkout/checkout-start.test.ts` | EXISTING — extend for R004 predicate expectations / static | R004,I007 | AC003,AC008 |
| `tests/unit/checkout/spectator-quantity.test.ts` | EXISTING — cupo/quantity regression | R004 | AC003 |
| `tests/unit/webhook/webhook-payment-verification-order.test.ts` | EXISTING — R042 / verify order | R011,I001,I003 | AC006,AC023,AC028 |
| `tests/unit/webhook/webhook-migration-static.test.ts` | EXISTING — static coexistence | R020,R024 | AC020–022 |
| `tests/unit/order-status/order-status.test.ts` | EXISTING — EXPIRED mapping if surfaced | Public | Manual/AC subset |
| `tests/unit/tickets/ticket-credentials.test.ts` | EXISTING — no access from expiry | I006 | AC002 |
| `tests/unit/tickets/ticket-issuance-policy.test.ts` | EXISTING — issuance only post-PAID | R011 | AC006,AC020 |
| `tests/unit/tickets/ticket-credentials-migration-static.test.ts` | EXISTING — static | I006 | Regression |

### 13.2 New proposed test files

| Path | NEW FILE — PROPOSED PATH | I/R | AC |
|---|---|---|---|
| `tests/unit/expiry/logical-capacity-exclusion.test.ts` | Logical capacity expiry | R004,I007 | AC003 |
| `tests/unit/expiry/expire-aggregate-tx.test.ts` | Expiry transaction | R001–R009,R023–R024,I002,I009 | AC001–002,005,016,020,026–027,029 |
| `tests/unit/expiry/expire-dry-run.test.ts` | Dry-run zero mutations | R013,I005 | AC009,AC017 |
| `tests/unit/expiry/webhook-expiry-concurrency.test.ts` | Webhook concurrency | R011,R020,I008 | AC006,AC014,AC021–023 |
| `tests/unit/expiry/scheduler-reconciler.test.ts` | Scheduler behavior / anti-overlap / SLA signals | R005,R010,R021 | AC004,AC019,AC024 |
| `tests/unit/expiry/admin-recovery-authz.test.ts` | Admin recovery authorization | R016 | AC011 |
| `tests/unit/expiry/admin-recovery-idempotency.test.ts` | Admin recovery idempotency | R016-C | AC012–013,AC025 |
| `tests/unit/expiry/audit-failure.test.ts` | Audit failure coupling | I009,R015 | AC027,AC010 |
| `tests/unit/expiry/inconsistent-aggregates.test.ts` | Inconsistent aggregates | R012,R023 | AC016,AC026 |
| `tests/unit/expiry/privacy-log-redaction.test.ts` | Privacy/log redaction | R022 | AC030 |

---

## 14. Migration strategy (split; no monolith)

| Unit | Migration responsibility | Requirements | AC | Rollback / forward-fix | Tests | Evidence |
|---|---|---|---|---|---|---|
| **3A** | Next available file: REPLACE `checkout_start_tx` inventory predicate only; no expire RPCs; no admin; **no new index duplicate** | R004, I007 | AC003, AC008 | Forward-fix REPLACE prior body if needed; keep audit | logical-capacity + checkout-start | Cupo before/after |
| **3B** | Next available after 3A: expire aggregate/batch/dry-run RPCs + grants; audit coupling | R001–R015, R023–R024, I002–I009 | listed in §12 | Forward-fix function REPLACE; disable callers | expire-aggregate + dry-run + audit-failure | SQL snapshots |
| **3D** | Next available if DB needed: admin recover RPC + grants only | R016 | AC011–013,AC025 | Forward-fix; revoke EXECUTE | admin-recovery-* | Authz matrix |

Forbidden: DROP destructive; DELETE history; mass backfill; Main apply without unit auth; recreating `idx_capacity_holds_product_state_expires`.

Schema DDL: prefer **none** beyond functions/grants. States `EXPIRED` already in CHECKs (`0002`).

---

## 15. Security plan (summary)

See §9. Confirm:

- ORDER_HOLDER ≠ access (I006);
- reconciler never mints tickets;
- browser/redirect never decide expiry/payment;
- service credentials never in client;
- refund not executed in IMPL-14A;
- schedule secret ≠ admin recovery secret.

---

## 16. Observability plan

Each run reports (sanitized):

```text
run_id, started_at, finished_at, duration_ms
correlation_id
candidates, expired, noop, inconsistent, skipped_locked, errors
sla_breach_count
overlap_rejected
batch_size, retries
result: OK | PARTIAL | FAIL | SKIPPED_OVERLAP
```

Detect: job not run; failed; delayed/SLA; partial; audit failure; overlap rejected;
schedule outage via `schedules logs` + missing success watermark.

---

## 17. Traceability matrices

### 17.1 I/R → implementation

| I/R | Source | Planned file | Symbol | Change |
|---|---|---|---|---|
| I001 | SPEC-031 | `mp-webhook` (unchanged) | getPayment path | Preserve |
| I002–I009 | SPEC-040 | 3B migration RPCs | expire_* | Enforce |
| R001–R009 | D1–D3 | 3B migration | expire_aggregate_tx | Implement |
| R004,I007 | D4 | **3A** migration + `checkout_start_tx` | inventory SUM | Predicate only |
| R005,R010 | D4 | 3C edge + schedule | reconciler | Persist ≤5m; needs OD-040-001/002 |
| R011 | R042 | `webhook_apply_payment_tx` | late path | Preserve |
| R012–R013 | D6–D7 | 3B | expire + dry-run | Fail-closed / retain |
| R014 | D8 | optional later | outbox event | No buyer notify v1 |
| R015,I009 | D9 | 3B | activity_log couple | Same TX |
| R016* | D5/D10 | 3D migration + admin edge | admin_recover_* | A/B/C; needs OD-040-002 |
| R017–R018 | existing | compensate / webhook | — | Preserve |
| R019–R022 | NFR | edge + tests | — | Signals/privacy |
| R023–R024 | CTO | 3B | expire guards | Fail-closed / PAID |

### 17.2 I/R → validation (all NOT_RUN)

| I/R | AC | Test file (planned) | Env | Evidence |
|---|---|---|---|---|
| I001 | AC028 | webhook-payment-verification-order | sandbox | Server-side verify |
| I002 | AC001,AC007 | expire-aggregate-tx + compensate regression | sandbox | EXPIRED vs CANCELLED |
| I003 | AC006,AC023 | webhook-expiry-concurrency | sandbox | R042 |
| I004 | AC008 | checkout-start + logical-capacity | local | Equal expires_at |
| I005 | AC009,AC017 | expire-dry-run | sandbox | No DELETE / zero writes |
| I006 | AC002 | tickets/* + expire-aggregate | sandbox | No TICKET_ACCESS |
| I007 | AC003 | logical-capacity-exclusion | local | Cupo excludes expired ACTIVE |
| I008 | AC014,AC020–024 | webhook-expiry-concurrency + scheduler | sandbox | Matrix |
| I009 | AC027 | audit-failure | local | Abort without audit |
| R001–R024 | per AC map | files in §13 | sandbox/local | Evidence pack |

### 17.3 AC → evidence

| AC | Fixture | Action | Expected | Evidence |
|---|---|---|---|---|
| AC001–AC002 | eligible unpaid | apply expire | EXPIRED aggregate | SQL snapshot |
| AC003 | expired ACTIVE hold | checkout reserve | not counted | Before/after cupo |
| AC004 | eligible + schedule | wait ≤5m | persisted EXPIRED | Timestamps |
| AC005,AC024 | already EXPIRED | re-run | no-op | Diff empty |
| AC006,AC023 | late APPROVED | webhook | REVIEW/CONFLICT 0 tickets | Rows |
| AC007 | pref fail | compensate | CANCELLED/RELEASED | Rows |
| AC008 | new checkout | create | equal expires_at | Rows |
| AC009,AC017 | dry-run | dry-run | 0 mutations (snapshot) | Counts |
| AC010,AC030 | apply | apply | audit; redacted logs | Audit+logs |
| AC011 | anon admin | call | deny | HTTP 401/403 |
| AC012–AC013 | late recovery | admin A/B | fulfill or refund_pending task | Rows |
| AC014,AC021–022 | dual workers | concurrent | one outcome | Logs |
| AC015 | expiry | apply | no buyer notify required | Absence |
| AC016 | divergent TTL | apply | review; cupo exclude | Rows |
| AC018 | REJECTED | webhook | not natural EXPIRED | Rows |
| AC019 | kill job / delay | ops | signal | Metrics |
| AC020 | PAID | expire | unchanged | Rows |
| AC025 | admin×2 | recover | one resolution | Audit |
| AC026–AC027 | bad aggregate / audit fail | apply | review / incomplete | Rows |
| AC028–AC029 | authority/determinism | suite | pass | Pack |

### 17.4 File → I/R

| File | I/R | AC | Why |
|---|---|---|---|
| 3A migration | R004,I007 | AC003,AC008 | Logical cupo only |
| 3B migration | R001–R015,R023–R024,I002–I009 | most TX ACs | Core expiry |
| payment-pending-expiry edge | R005,R010,R021 | AC004,AC019 | Schedule runner |
| 3D migration + admin edge | R016 | AC011–013,AC025 | Human recovery |
| webhook_apply_payment_tx | R011,R020,I001,I003 | AC006,AC021–023 | Coexistence |
| tests §13 | mapped | mapped | Proof |

---

## 18. Fixtures (conceptual; not created)

| Fixture | Initial | Action | Expected | Must not exist | AC |
|---|---|---|---|---|---|
| Eligible unpaid expired | PENDING + ACTIVE past TTL | expire | EXPIRED set | tickets | AC001–002 |
| Unexpired PENDING | future expires_at | expire | no-op | EXPIRED | — |
| PAID | PAID+CONVERTED | expire | unchanged | EXPIRED on paid | AC020 |
| Late APPROVED | expired then APPROVED | webhook | REVIEW/CONFLICT | tickets | AC006,AC023 |
| REJECTED / CANCELLED | provider path | webhook | SPEC-032 | natural EXPIRED | AC018 |
| Already EXPIRED | terminal | expire | no-op | dup side effects | AC005 |
| Divergent expires_at | mismatch | expire | review; cupo exclude | silent complete | AC016 |
| Order w/o hold | orphan | expire | review | invent hold | AC026 |
| Hold w/o order | orphan | expire | review | invent order | AC026 |
| Missing ORDER_HOLDER | no cred | expire | review/as applicable | invent | AC026 |
| Non-provisional reg | CONFIRMED on pending | expire | review | cancel confirmed access | AC026 |
| Multi ACTIVE holds | 2 ACTIVE | expire | review | silent dual invent | AC026 |
| Audit write failure | forced | expire | incomplete | domain without audit | AC027 |
| Dual reconciler | same order | concurrent | one winner | double release | AC014 |
| Dual admin | same case | recover×2 | one resolution | dup tickets/refund task | AC025 |
| No capacity late | APPROVED+no cupo | admin B | refund_pending task | tickets / REFUNDED | AC013 |
| Overlapping jobs | two fires | both invoke | one mutates; other SKIPPED_OVERLAP | double expire | AC014,AC019 |
| Dry-run accidental write | dry-run | dry-run | zero domain writes | activity-as-applied | AC009 |

---

## 19. Sandbox plan (future; not created now)

| Field | Proposal |
|---|---|
| Name | `impl-14a-expiry` |
| Purpose | Validate expiry, cupo, concurrency, admin boundary |
| Do not reuse | `impl-13b-spectator-wiring`, `impl-13e-public-press` |
| Data | Minimal catalog / CONFIGURADO; synthetic fixtures |
| Migrations | Apply authorized unit migrations only |
| Functions | checkout, webhook, expiry, admin, get-order-status |
| Schedule | 1-min after 3C auth + OD closure |
| Secrets | By **name only** — never values |
| Evidence | Under `docs/implementation/evidence/` |
| Retention | Human gate to destroy |
| Main | Untouched |

---

## 20. Implementation units (updated)

### IMPL-14A-3A — Logical capacity exclusion

- **Objective:** R004 / I007 only
- **Files:** next migration REPLACE inventory predicate in `checkout_start_tx`; **no** opportunistic persist; **no** `mp-create-checkout` edits
- **AC:** AC003, AC008
- **Blocked by OD?** No
- **Gate out:** human review → not auto 3B
- **Sensitive:** none external

### IMPL-14A-3B — Expiry TX + dry-run + audit

- **Objective:** R001–R009, R012–R015, R023–R024, I009; hardened sequence §11.2
- **Files:** next migration after 3A
- **AC:** AC001–002,005,009–010,016–017,020,026–027,029–030
- **Blocked by OD?** No
- **Non-goal:** schedule, admin, opportunistic

### IMPL-14A-3C — Scheduled reconciler + observability

- **Objective:** R005, R010, R021; §11.4
- **Files:** expiry edge; schedule create (separate auth)
- **AC:** AC004, AC019, AC014/AC024 partial
- **Needs:** OD-040-001 **and** OD-040-002 closure
- **BLOCKS until ODs accepted**

### IMPL-14A-3D — Admin recovery boundary

- **Objective:** R016 A/B/C; refund **task only**
- **Files:** admin RPC migration (if needed) + admin edge
- **AC:** AC011–013, AC025
- **Needs:** OD-040-002
- **Non-goal:** refund execution / REFUNDED / close

### IMPL-14A-3E — Automated tests + concurrency

- **Objective:** matrix + §13 new tests
- **AC:** AC006,014,018,021–024,028 + mapped
- **Non-goal:** production mutate

### IMPL-14A-3F — Sandbox deploy + runtime evidence

- Isolated `impl-14a-expiry` only

### IMPL-14A-3G — Human validation and closure

- Sign-off only; no new implementation

Each unit requires **separate human authorization**. This plan does not start them.

---

## 21. Rollback and recovery

| Topic | Approach |
|---|---|
| Forward-fix | Prefer REPLACE functions; keep audit |
| Revert | Disable schedule (`active=false`); undeploy edges; leave EXPIRED rows |
| Partial batch | Safe; remainder next run |
| PAID check | Evidence query: no PAID→EXPIRED |
| Cupo | Logical predicate restores availability without inventing |
| Evidence | Never delete proof as rollback |
| Anti-overlap fail | Fail-closed skip; alert |

---

## 22. Risks (updated)

| Risk | P | I | Mitigation | Test | Evidence |
|---|---|---|---|---|---|
| PAID degraded | L | Crit | R024 + lock order + step 5–6 | AC020–022 | Row snapshots |
| Double release / issue | M | High | Idempotency + SKIP LOCKED | AC014,AC025 | Logs |
| Oversale | M | Crit | R004 in 3A | AC003 | Cupo math |
| Ghost cupo | H today | High | R004 + schedule | AC003–004 | Timestamps |
| Lock contention | M | Med | Short TX; SKIP LOCKED | 3E | Duration |
| Deadlock | M | High | Single lock order orders→holds | concurrency suite | DB logs |
| Overlapping scheduled jobs | M | High | Job anti-overlap §8 | scheduler-reconciler | `overlap_rejected` |
| Scheduler outage | M | High | >2× cadence + SLA signal; schedules logs | AC019 | Metrics |
| Unstable pagination | M | Med | Keyset `(expires_at,order_id)` | scheduler tests | Determinism |
| Stale candidate read | M | High | Re-read under lock steps 3–6 | expire-aggregate | Outcomes |
| Service credential compromise | M | Crit | Rotate; revoke schedule; secret≠admin; allowlist RPCs | AC011 + ops drill | Rotation record |
| Replay of scheduler request | M | High | Idempotent expire + anti-overlap; **no false claim of platform replay protection** | AC014,AC024 | Dual POST evidence |
| Refund-task duplication | M | Med | idempotency_records + R016-C | AC025 | Unique constraint |
| Dry-run accidental mutation | M | High | Dry-run guarantees §11.3 | AC009,AC017 | Before/after counts |
| Admin endpoint exposure | M | Crit | OD-040-002 human auth | AC011 | Deny matrix |
| Audit loss | M | High | I009 same TX | AC027 | Abort |
| PII in logs | L | High | Redaction | AC030 | Log samples |
| Unauthorized backfill | L | High | Plan forbids | review | Diff |
| Historical divergence | M | Med | R012/R023 | AC016,AC026 | Review rows |
| Duplicate index creation | L | Med | Reuse `idx_capacity_holds_product_state_expires` | migration review | No new twin |

---

## 23. Open decisions (authoritative)

| ID | Status | PO decision / notes | Blocks |
|---|---|---|---|
| OD-040-001 | Cadence/SLA **APPROVED**; anti-overlap **OPEN** | Trigger every **1 minute**; persist ≤ **5 minutes** after `expires_at`; anti-overlap design must be approved before 3C | **3C** (anti-overlap) |
| OD-040-002 | **OPEN** | Separate reconciler vs admin actors/credentials; `project_admin` ≠ automatic least privilege | **3C and 3D** |
| OD-040-003 | **DEFERRED_TO_OPERATIONAL_RUNBOOK** | IMPL-14A may create `refund_required`/`refund_pending` durable idempotent task + audit + keep `REQUIRES_REVIEW` + zero access; MUST NOT execute refunds or mark `REFUNDED` | Does **not** block 3A–3C; 3D task-only |

No IMPL-14A-3* authorized by this document.

---

## 24. Protected paths (this documentary unit)

Unmodified:

```text
SPEC-040 normative content
SPEC-000/001/030/031/032
docs/00–05
MANIFEST.md
code, migrations, tests, functions, seeds
.cursor/*
```

Updated by IMPL-14A-2 / 2F / 2C (documentary):

```text
docs/implementation/IMPL-14A-2-PAYMENT-PENDING-EXPIRY-IMPLEMENTATION-PLAN.md
docs/specs/SPEC-040-PAYMENT-PENDING-EXPIRY-RECONCILIATION.md
docs/specs/README.md
WORKSPACE_STATUS.md
```

---

## 25. Explicit non-authorization

```text
NO CODE
NO SQL
NO MIGRATIONS
NO CRON/SCHEDULE CREATE
NO EDGE FUNCTION CREATE
NO INSFORGE WRITES
NO MP WRITES
NO BACKFILL
NO ROW REPAIRS
NO PAYMENTS/REFUNDS
NO DEPLOY
NO SANDBOX CREATE
NO MAIN EN_VENTA
NO IMPLEMENTING STATUS
NO IMPL-14A-3* START
NO COMMIT
NO PUSH
```

---

## 26. Gate

```text
READY_FOR_IMPL_14A_2C_DOCUMENTARY_CONSOLIDATION
```

Plan is `PLAN / APPROVED` v0.2.0 (PO 2026-07-27). Next authorized work is
documentary consolidation / selective repository incorporation only.
No IMPL-14A-3* / code / SQL / cron / deploy until separately authorized.
