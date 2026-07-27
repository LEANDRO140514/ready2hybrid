---
id: SPEC-040
title: Payment Pending Expiry Reconciliation
status: APPROVED
version: 0.1.1
phase: IMPL-14A
created_at: 2026-07-27
approved_at: 2026-07-27
approved_by: Leandro Espinosa, Project Owner
approval_basis: Project Owner approval after CTO review of SPEC-040 v0.1.1
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.1.0
  - SPEC-031 v0.1.0
  - SPEC-032 v0.1.0
compatible_with:
  - SPEC-011 v0.1.0
---

# SPEC-040 - Payment Pending Expiry Reconciliation

## 1. Purpose

Define the durable contract that expires abandoned `PAYMENT_PENDING` checkout
aggregates so that:

- orders, capacity holds, provisional registrations, and `ORDER_HOLDER`
  credentials do not remain active indefinitely;
- capacity availability is not retained by time-expired holds;
- transitions are deterministic, idempotent, auditable, and safe under
  concurrency with Mercado Pago webhook verification;
- late approved payments remain fail-safe under SPEC-032-R042 and recover only
  through a protected administrative action.

This document is `APPROVED`. It authorizes preparing the implementation
traceability and plan (IMPL-14A-2). It does not by itself authorize runtime
code, SQL, migrations, schedules, edge functions, deploys, or InsForge writes.

## 2. Authority sources

Normative authority for this draft, in descending force:

1. Explicit Project Owner contract decisions for IMPL-14A dated 2026-07-27
   (D1–D10).
2. SPEC-000 v0.2.0 `APPROVED`.
3. SPEC-001 v0.1.0 `APPROVED`.
4. SPEC-030 v0.1.0 `APPROVED`.
5. SPEC-031 v0.1.0 `APPROVED`.
6. SPEC-032 v0.1.0 `APPROVED`, including SPEC-032-R042 (late verified payment).
7. Product/architecture context in `docs/00`–`docs/05` where not contradicted
   by the above.
8. Operational evidence from IMPL-13E-Y closure documenting the open gap
   `PAYMENT_PENDING_EXPIRY_RECONCILIATION`.

Compatibility:

9. SPEC-011 v0.1.0 `APPROVED` (no PWA authority change required by this draft).

This specification MUST NOT alter:

- webhook → server-side Mercado Pago query → canonical InsForge authority;
- SPEC-032-R042 fail-safe outcomes;
- IMPL-13E-Y closure;
- `RETURN_REFERENCE_RESILIENCE`;
- `PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`.

## 3. Context

As of IMPL-13E-Y human closure (`9668dfe`) and IMPL-14A-0 diagnosis:

- checkout creates aligned `expires_at` on order, capacity hold, and
  `ORDER_HOLDER`;
- hold inventory counting currently treats all `ACTIVE` holds as capacity
  consumers regardless of wall-clock expiry;
- states `EXPIRED` exist for order, hold, and capability credentials but are
  not written by a dedicated expiry reconciler;
- preference creation failure already compensates with order `CANCELLED` and
  hold `RELEASED` (distinct from natural expiry);
- webhook late/expired-hold path already preserves `APPROVED` payment, sets
  order `REQUIRES_REVIEW`, hold `CONFLICT`, and issues no tickets.

The Project Owner prioritized IMPL-14A before UX-REG-01 and approved D1–D10 to
govern this contract.

CTO review of SPEC-040 v0.1.0 returned `CHANGES_REQUIRED` (IMPL-14A-1F).

## 4. Scope

This specification covers:

- eligibility rules for natural checkout expiry;
- terminal/state transitions for order, capacity hold, provisional
  registrations, and `ORDER_HOLDER`;
- logical and persisted capacity-release guarantees;
- interaction with webhook payment application and SPEC-032-R042;
- divergence handling for historical `expires_at` mismatches;
- fail-closed handling of inconsistent aggregates;
- retention and dry-run inspection of expired attempts;
- audit minimums and audit-persistence coupling for effective reconciliations;
- protected administrative recovery for late-approved payments, including the
  refund-required boundary when capacity is unavailable;
- a conceptual scheduler/job boundary and opportunistic defense;
- acceptance criteria and validation plan for a future implementation unit.

## 5. Non-goals

This specification does not define or authorize:

- SQL, migrations, physical indexes, RLS, TypeScript, or Edge Function code;
- creation of InsForge schedules/cron, deployments, or secret changes;
- backfill mutation, silent history rewrite, or deletion of sandbox evidence;
- automatic buyer notification for expiry (deferred extension point only);
- automatic ticket/entitlement issuance for late payments;
- automatic capacity expansion or oversale to fulfill late payments;
- executing Mercado Pago refunds, verifying refund provider results, or closing
  refund exceptions with final canonical refund state (those belong to a
  refund runbook or later authorized unit; SPEC-040 only marks refund
  required/pending and forbids access issuance while pending);
- UI/admin panel design beyond the protected-action contract;
- athlete registration UX (UX-REG-01);
- public endpoint abuse/rate limiting;
- return-reference resilience redesign;
- Main `EN_VENTA`, real payments, or productive sales opening;
- supersession or silent amendment of SPEC-032 open decisions.

## 6. Definitions

| Term | Meaning |
|---|---|
| Checkout aggregate | Order plus its capacity hold(s), provisional registration(s), and `ORDER_HOLDER` credential created for one checkout attempt |
| Natural expiry | Wall-clock passage of `expires_at` without a verified `APPROVED` payment |
| Reconciler | Authorized system process that persists expiry transitions idempotently |
| Logical availability guarantee | Inventory math that excludes time-expired `ACTIVE` holds even before persisted state change |
| Persisted expiry guarantee | Durable state transitions written by the reconciler within the approved SLA |
| Late approved payment | Provider-verified `APPROVED` payment applied after hold expiry/release under SPEC-032-R042 |
| Provisional registration | Registration in `STARTED` or `PENDING_PAYMENT` linked to a not-yet-paid order |
| `ORDER_HOLDER` | Capability credential `kind=ORDER_HOLDER`, scope `order:continue`; expected non-ticket credential |
| Dry-run | Inspection mode that reports candidate actions without mutating durable state |
| Protected admin recovery | Authenticated, role-authorized, idempotent, audited command that resolves late-payment exceptions |
| Refund required / refund pending | Audited operational marker that a late-approved payment cannot be fulfilled for capacity reasons and a Mercado Pago refund must be executed by a separate authorized refund path |
| Inconsistent aggregate | Checkout-related rows that violate expected structural assumptions (missing hold/order/`ORDER_HOLDER`, non-provisional registration on expiry path, multiple ACTIVE holds, etc.) |
| Effective reconciliation | Domain transition that has persisted both required state changes and required audit evidence |

## 7. Invariants

### SPEC-040-I001

Payment authority remains:

```text
signed webhook ingress
→ server-side Mercado Pago payment query
→ canonical InsForge state transition
```

Browser redirects, query strings, `collection_status`, merchant order ids from
the client, and session storage MUST NOT authorize payment or expiry outcomes.

### SPEC-040-I002

Natural expiry MUST NOT use order state `CANCELLED`. `CANCELLED` remains
reserved for cancellations, provider rejections, and preference-compensation
paths distinct from timeout.

### SPEC-040-I003

A late verified `APPROVED` payment MUST preserve payment truth, MUST NOT auto-
issue tickets/entitlements/`TICKET_ACCESS`, and MUST enter
`REQUIRES_REVIEW` / hold `CONFLICT` per SPEC-032-R042.

### SPEC-040-I004

At checkout creation, `order.expires_at`, `capacity_hold.expires_at`, and
`ORDER_HOLDER.expires_at` MUST be identical.

### SPEC-040-I005

Expired attempts MUST be retained. Physical deletion, mass cleanup, and silent
history rewrite are prohibited by this contract.

### SPEC-040-I006

`ORDER_HOLDER` MUST NEVER become `TICKET_ACCESS`, attach to a ticket, or
authorize event check-in.

### SPEC-040-I007

Availability calculations MUST NOT count a hold with `state=ACTIVE` and
`expires_at <= now()` toward reserved capacity.

### SPEC-040-I008

Expiry reconciliation and webhook application MUST be concurrency-safe:
duplicate reconciler runs and duplicate webhooks MUST be idempotent and MUST
NOT regress a verified `PAID` order or invent access.

### SPEC-040-I009

If mandatory audit evidence for an effective reconciliation cannot be
persisted, the domain transition MUST NOT be considered completed.

## 8. Functional requirements

### SPEC-040-R001 Eligibility for natural order expiry

An order MUST be eligible for natural expiry when all of the following hold:

- `state = PAYMENT_PENDING`;
- `expires_at <= now()`;
- no provider-verified payment with normalized state `APPROVED` is bound to
  the order.

### SPEC-040-R002 Order terminal transition

An eligible order MUST transition to `EXPIRED`.

The system MUST NOT transition that order to `CANCELLED` solely because of
natural expiry.

### SPEC-040-R003 Capacity hold persisted expiry

A capacity hold with `state = ACTIVE` and `expires_at <= now()` MUST be
transitioned by the reconciler to `EXPIRED`.

### SPEC-040-R004 Capacity logical release

From the instant `state = ACTIVE` and `expires_at <= now()`, the hold MUST be
excluded from availability/cupo calculations even if the persisted state has
not yet become `EXPIRED`.

### SPEC-040-R005 Persisted expiry SLA

The reconciler MUST persist hold expiry (and the linked eligible aggregate
transitions defined herein) within a maximum of **5 minutes after**
`expires_at`.

Opportunistic reconciliation during a subsequent checkout MUST be treated as
an additional defense and MUST NOT be the sole release mechanism.

### SPEC-040-R006 Provisional registration expiry

Provisional registrations associated with an order being expired MUST
transition from `STARTED` or `PENDING_PAYMENT` (when present) to `CANCELLED`
with retained audit reason `ORDER_EXPIRED`.

This cancellation MUST NOT imply refund, expulsion, or revocation of any
previously issued access artifact.

### SPEC-040-R007 ORDER_HOLDER expiry

`ORDER_HOLDER` credentials for the expired order MUST transition to `EXPIRED`
in the **same transactional operation** that expires the order and capacity
hold.

They MUST NOT be physically deleted.

### SPEC-040-R008 Atomic aggregate expiry transaction

For a single eligible order, the effective reconciler operation MUST atomically
apply, as applicable and idempotent:

- order → `EXPIRED`;
- active time-eligible hold(s) → `EXPIRED`;
- provisional registrations → `CANCELLED` with reason `ORDER_EXPIRED`;
- associated `ORDER_HOLDER` → `EXPIRED`;
- required audit record(s).

Partial silent completion of a divergent or inconsistent historical aggregate
is prohibited (see R012 and R023).

### SPEC-040-R009 Idempotency

Re-running expiry against an already expired aggregate MUST be a no-op success
(or equivalent idempotent outcome) without duplicate side effects.

### SPEC-040-R010 Scheduler and opportunistic defense

Implementation MUST provide a durable scheduled/system trigger capable of
meeting R005.

Implementation MAY additionally reconcile opportunistically at checkout
inventory reservation time, applying the same transactional rules.

### SPEC-040-R011 Late approved payment fail-safe

When verified payment is `APPROVED` after hold expiry/release, the system MUST:

- preserve payment `APPROVED`;
- set order to `REQUIRES_REVIEW` (unless already in a non-regressible paid
  success path defined by SPEC-032);
- set hold to `CONFLICT` when applicable;
- issue **0** tickets, **0** entitlements, **0** `TICKET_ACCESS`.

### SPEC-040-R012 Expires_at divergence

New checkouts MUST set identical `expires_at` values (I004).

If a historical divergence is detected:

- MUST NOT invent corrected timestamps;
- MUST NOT rewrite timestamps by assumption;
- MUST NOT delete rows;
- MUST NOT silently complete the full aggregate as if consistent;
- MUST record the inconsistency;
- MUST route the case to `REQUIRES_REVIEW` or an equivalent approved review
  mechanism;
- MUST still exclude any hold whose own `expires_at` has passed from
  availability (R004), independent of order/`ORDER_HOLDER` timestamps.

### SPEC-040-R013 Historical retention and dry-run

Expired attempts MUST be retained and remain queryable for audit.

Before any authorized repair of historical inconsistencies, the system MUST
support an inspection/`dry-run` mode that reports candidate actions without
mutating durable state.

IMPL-14A MUST NOT authorize:

- physical `DELETE` of these historical rows;
- mass cleanup;
- silent rewrite;
- deletion of sandbox evidence.

### SPEC-040-R014 Buyer notification

Automatic buyer notification of expiry is **out of scope** for the first
IMPL-14A implementation.

The design MAY emit a domain event or extension point for a later
communication unit. Absence of notification MUST NOT block expiry
transitions.

### SPEC-040-R015 Audit minimum for effective reconciliation

Each effective reconciliation MUST record at least:

- order reference;
- capacity hold reference(s);
- affected registration reference(s);
- affected `ORDER_HOLDER` reference;
- prior states;
- posterior states;
- observed `expires_at`;
- reason (`ORDER_EXPIRED` or named admin reason);
- timestamp;
- correlation id;
- system actor or administrative actor;
- result.

Audit MUST NOT store unnecessary PII, secrets, or full payment payloads.

If mandatory audit evidence cannot be persisted, the domain transition MUST
NOT be considered completed (I009). Implementation MAY satisfy this by the
same database transaction or an equivalent approved durability guarantee.

### SPEC-040-R016 Protected administrative recovery

IMPL-14A MUST define a protected administrative action to resolve late-payment
exceptions. The action MUST be:

- authenticated;
- authorized by role;
- idempotent;
- audited;
- fail-closed;
- compatible with SPEC-032-R042.

The action MUST NOT allow unconstrained direct editing of sensitive states
from a general UI.

#### R016-A Capacity still available

The action MUST:

1. re-verify the payment with Mercado Pago server-side;
2. verify current capacity;
3. authorize manual fulfillment;
4. convert the reservation under governed rules;
5. issue the corresponding access artifacts;
6. record actor, reason, and evidence.

#### R016-B Capacity unavailable — refund-required boundary

When capacity is unavailable, SPEC-040 MUST:

1. re-verify the payment with Mercado Pago server-side and confirm
   `APPROVED`;
2. confirm that capacity is unavailable without increasing cupo;
3. prohibit issuance of tickets, entitlements, and `TICKET_ACCESS`;
4. mark the case as `refund_required` / `refund_pending` (or equivalent
   audited marker);
5. create an audited refund operation or task for a separate authorized
   refund path;
6. keep the order in `REQUIRES_REVIEW` until a canonical refund (or other
   approved) resolution is persisted with evidence.

SPEC-040 MUST NOT:

- close the exception as resolved based only on intent;
- treat a manual state edit as a completed refund;
- issue tickets while refund is pending;
- increase cupo or cause oversale to auto-fulfill the late payment.

Executing the Mercado Pago refund, verifying its provider result server-side,
persisting final refund canonical state, and closing the exception with that
evidence are **outside** SPEC-040 and belong to a refund runbook or later
authorized unit (see OD-040-003).

#### R016-C Idempotent admin recovery

Repeating the same administrative recovery command for the same logical
exception MUST yield a single effective resolution: no duplicate tickets,
no double conversion, no duplicate refund-task creation for the same case,
and correlated audit evidence of the replay.

### SPEC-040-R017 Preference-failure path remains distinct

Checkout preference compensation that sets order `CANCELLED` and hold
`RELEASED` remains outside natural expiry and MUST continue to use those
states, not `EXPIRED`.

### SPEC-040-R018 Rejected or cancelled provider payment

Verified `REJECTED` / `CANCELLED` payment handling remains under SPEC-032 /
existing webhook contract and MUST NOT be redefined as natural expiry.

Such payments MUST NOT, by themselves, drive order/hold transitions to
`EXPIRED` through the natural-expiry reconciler path.

### SPEC-040-R019 Determinism

Given the same durable inputs and clock reading used by the transaction,
eligible aggregates MUST converge to the same terminal states.

### SPEC-040-R020 Concurrency with webhook

The reconciler and webhook apply paths MUST serialize on the order/hold
aggregate (or equivalent compare-and-set guards) so that:

- expiry cannot clobber a commit that already moved the order to `PAID`;
- a late `APPROVED` after expiry follows R011 / R042;
- duplicate workers cannot double-release or double-issue access;
- `PAID` is never degraded by expiry;
- no invented access artifacts occur under interleaving.

Covered interleavings include at least:

- webhook `APPROVED` before the reconciler obtains its lock;
- webhook `APPROVED` while both paths compete for the aggregate;
- expiry commit before a late `APPROVED`;
- two reconcilers on the same order;
- retry of the same batch/work item.

### SPEC-040-R021 Observability

Failures of scheduled reconciliation MUST be detectable without relying on
buyer reports. At minimum, the following MUST produce an observable,
correlation-id-linkable operational signal:

- job failure;
- delay beyond the R005 SLA;
- batch/work item error.

### SPEC-040-R022 Privacy

Expiry and admin-recovery audits MUST minimize personal data and MUST exclude
secrets, raw tokens, and full provider payloads.

### SPEC-040-R023 Inconsistent aggregate fail-closed

When the reconciler or admin-recovery path encounters an inconsistent
aggregate, including but not limited to:

- order without the expected hold;
- hold without order;
- registration in a non-provisional state on the natural-expiry path;
- absent `ORDER_HOLDER` where one is expected;
- more than one `ACTIVE` hold for the same order;
- inability to persist mandatory audit evidence;

the system MUST:

- MUST NOT invent missing components;
- MUST NOT silently complete a partial transition as if the aggregate were
  consistent;
- MUST NOT issue access artifacts;
- MUST record the inconsistency;
- MUST route the case to `REQUIRES_REVIEW` or an equivalent approved review
  mechanism;
- MUST allow idempotent retry after correction or authorized recovery.

Inability to persist mandatory audit evidence is governed by I009 / R015:
the domain transition MUST NOT be considered completed.

### SPEC-040-R024 PAID aggregate immunity

Given an order already in `PAID`, the reconciler MUST NOT change:

- the order state;
- a hold already in `CONVERTED` (or equivalent paid conversion state);
- registrations already `PAYMENT_CONFIRMED` (or later confirmed states);
- tickets, entitlements, or access credentials.

## 9. Non-functional requirements

Non-functional obligations for this contract are expressed as R019–R022 and
I008–I009 above. No additional numbered NFRs are introduced in this revision.

## 10. Interfaces and contracts

### 10.1 Conceptual operations

| Operation | Actor | Mutates | Notes |
|---|---|---|---|
| `expire_payment_pending_aggregates` | system reconciler | yes | batch or single-order; idempotent; meets R005 |
| `expire_payment_pending_aggregates_dry_run` | system/operator inspection | no | reports candidates only |
| inventory reservation / checkout start | checkout service | yes | MUST apply R004; MAY opportunistically persist expiry |
| `webhook_apply_payment` | payment verification service | yes | unchanged authority; R011 on late approve |
| `admin_recover_late_approved_payment` | protected operator | yes | R016 only; R016-B creates refund task, does not execute refund |

Exact RPC/function names, HTTP paths, and schedule syntax are implementation
choices and are not fixed by this draft.

### 10.2 Domain extension point

A domain event such as `ORDER_EXPIRED` MAY be recorded for future buyer
communication. Emitting the event MUST NOT require sending a message in the
first IMPL-14A implementation.

### 10.3 Public client contract

Public clients MUST continue to treat canonical order status from the backend
as authority. Expiry MUST become visible through existing public order-status
semantics once persisted; no browser-driven expiry command is authorized.

## 11. Failure modes

| Failure | Required behavior |
|---|---|
| Reconciler crash mid-batch | Already committed aggregates remain valid; remainder retried idempotently |
| Clock skew / delayed job beyond SLA | Logical R004 still frees cupo; R021 signal required; SLA breach is an operational defect, not a license to oversell |
| Job failure / batch error | R021 observable correlated signal; retry idempotent |
| Webhook wins before expiry commit | Order may become `PAID` / converted; expiry MUST no-op (R024) |
| Webhook competes during reconciler lock | Serialization / CAS; `PAID` never degraded; no double release/issue |
| Expiry wins before late APPROVED | R011 / R042 apply; no auto tickets |
| Divergent historical expires_at | R012 review path; availability uses hold timestamp only |
| Inconsistent aggregate | R023 fail-closed review; no invented components; no access |
| Mandatory audit write failure | I009 / R015: domain transition not completed; retryable |
| Admin recovery without role | Fail-closed deny; audit denial without secrets |
| Admin recovery when capacity gone | R016-B: refund_required/pending + audited task; order stays `REQUIRES_REVIEW`; no tickets |
| Duplicate admin recovery | R016-C: single effective resolution |
| Refund provider execution failure | Outside SPEC-040; order remains `REQUIRES_REVIEW` / refund_pending until canonical evidence |
| Closing refund by intent only | Prohibited by R016-B |
| Dry-run requested | Zero durable mutations |
| Provider REJECTED/CANCELLED | SPEC-032 webhook path; not natural-expiry `EXPIRED` (R018) |

## 12. Security and privacy

- Expiry jobs and admin recovery MUST use least-privilege service or operator
  credentials.
- Raw Mercado Pago access tokens, webhook secrets, and credential tokens MUST
  NOT appear in logs or audit metadata.
- `ORDER_HOLDER` remains non-access; expiry hardens that boundary but MUST NOT
  be the only control against misuse.
- Public endpoints MUST NOT expose an unauthenticated “expire my order”
  mutation.

## 13. Acceptance criteria

### SPEC-040-AC001

Given an eligible `PAYMENT_PENDING` order with past `expires_at` and no
`APPROVED` payment, effective reconciliation results in order state `EXPIRED`.

### SPEC-040-AC002

The same run transitions the associated `ACTIVE` time-expired hold to
`EXPIRED`, provisional registrations to `CANCELLED` with reason
`ORDER_EXPIRED`, and `ORDER_HOLDER` to `EXPIRED` in one transactional success.

### SPEC-040-AC003

Availability calculations exclude `ACTIVE` holds with `expires_at <= now()`
even before persisted `EXPIRED`.

### SPEC-040-AC004

A hold that became eligible for expiry is persisted to `EXPIRED` within
5 minutes after `expires_at` under the scheduled mechanism (measured in the
validation environment).

### SPEC-040-AC005

Re-running reconciliation on an already expired aggregate produces no
duplicate side effects and leaves terminal states unchanged.

### SPEC-040-AC006

A verified late `APPROVED` payment after expiry yields preserved payment,
order `REQUIRES_REVIEW`, hold `CONFLICT` (when applicable), and zero
tickets/entitlements/`TICKET_ACCESS`.

### SPEC-040-AC007

Preference-failure compensation still uses order `CANCELLED` and hold
`RELEASED`, not `EXPIRED`.

### SPEC-040-AC008

Checkout creation writes identical `expires_at` on order, hold, and
`ORDER_HOLDER`.

### SPEC-040-AC009

Dry-run lists candidate expiry actions for a known fixture without mutating
rows. Historical expired/inconsistent fixtures remain queryable afterward
with zero physical deletes and zero silent rewrites attributable to the
dry-run or natural-expiry path under test.

### SPEC-040-AC010

Effective reconciliation audit contains the minimum fields in R015 and
contains no secrets or full payment payloads.

### SPEC-040-AC011

Unauthorized caller cannot execute admin late-payment recovery.

### SPEC-040-AC012

Authorized admin recovery with available capacity can fulfill access only
after fresh Mercado Pago verification and capacity check, with audit.

### SPEC-040-AC013

Authorized admin recovery without capacity:

- issues no tickets/entitlements/`TICKET_ACCESS`;
- does not increase cupo;
- marks the case `refund_required` / `refund_pending` (or equivalent);
- creates an audited refund operation/task;
- keeps the order in `REQUIRES_REVIEW`;
- does **not** close the exception as resolved by intent alone;
- does **not** treat a manual state edit as a completed refund.

### SPEC-040-AC014

Concurrent reconciler duplicate workers against one order do not corrupt
state, double-release capacity, double-issue access, or invent access.

### SPEC-040-AC015

No automatic buyer notification is required for AC pass of the first
implementation; optional domain extension may exist without delivery.

### SPEC-040-AC016

Given a historical aggregate whose `expires_at` values diverge, reconciliation
MUST NOT invent or rewrite timestamps, MUST NOT silently complete the full
aggregate, MUST record the inconsistency, MUST route to review, and MUST
exclude any time-expired hold from availability.

### SPEC-040-AC017

Natural-expiry and dry-run paths perform zero physical `DELETE` of retained
historical attempt rows; retained rows remain queryable after the operation.

### SPEC-040-AC018

A verified provider `REJECTED` or `CANCELLED` payment follows SPEC-032 webhook
transitions and MUST NOT be processed through the natural-expiry path that
sets order/hold to `EXPIRED` solely for that reason.

### SPEC-040-AC019

Job failure, delay beyond the R005 SLA, and batch/work-item error each produce
an observable operational signal that can be correlated without buyer reports.

### SPEC-040-AC020

Given an order already `PAID` with converted hold and confirmed registrations
(and any issued tickets/entitlements/credentials), reconciler execution leaves
those artifacts unchanged.

### SPEC-040-AC021

Webhook `APPROVED` before the reconciler lock results in a non-degraded paid
or SPEC-032 success path; subsequent expiry MUST no-op against that aggregate.

### SPEC-040-AC022

When webhook `APPROVED` and reconciler compete, exactly one coherent outcome
occurs: either paid conversion under SPEC-032, or late-approve R042 review,
without `PAID` degradation, double release, double issuance, or invented
access.

### SPEC-040-AC023

When expiry commits before a late `APPROVED`, the late payment follows R011 /
SPEC-032-R042 (review/conflict, zero auto access).

### SPEC-040-AC024

Retrying the same reconciler batch/work item is idempotent and does not invent
access or duplicate side effects.

### SPEC-040-AC025

Executing the same authorized admin recovery twice for one logical exception
yields one effective resolution, no duplicate tickets, no double conversion,
no duplicate refund-task for the same case, and correlated audit of the
replay.

### SPEC-040-AC026

Given an inconsistent aggregate (missing expected hold/order/`ORDER_HOLDER`,
non-provisional registration on expiry path, or multiple ACTIVE holds), the
system does not invent components, does not silently partial-complete, does
not issue access, records the inconsistency, routes to review, and remains
idempotently retryable.

### SPEC-040-AC027

If mandatory audit evidence for a reconciliation cannot be persisted, the
domain transition is not considered completed and may be retried idempotently
after the failure is resolved.

### SPEC-040-AC028

Canonical payment authority remains webhook + server-side Mercado Pago query +
InsForge; browser redirect/query artifacts alone never authorize expiry or
payment outcomes under this contract.

### SPEC-040-AC029

Deterministic replay of the same eligible inputs and clock boundary yields the
same terminal expiry states (R019), without inventing access.

### SPEC-040-AC030

Audit and operational logs for expiry/admin recovery exclude secrets, raw
tokens, and full provider payloads (R022).

## 14. Validation plan

Documentary (this draft / approval review):

1. Confirm D1–D10 are fully reflected and do not contradict SPEC-032-R042.
2. Confirm non-goals exclude code/SQL/cron execution authority from the draft
   itself.
3. Confirm every R001–R024 and critical invariants have explicit AC coverage.
4. Confirm OD-010 is not declared superseded by this draft.
5. Confirm refund boundary: SPEC-040 marks refund required/pending only.

After future `APPROVED` → implementation authorization (separate unit):

1. Unit tests for eligibility predicates and idempotent transition tables.
2. Transaction tests for aggregate expiry atomicity and audit coupling (I009).
3. Inventory tests proving R004 exclusion.
4. Concurrency tests covering AC021–AC024 and AC014.
5. Late-payment tests proving R011 / R042 (AC006, AC023).
6. Dry-run vs apply and retention/no-delete tests (AC009, AC017).
7. Admin recovery allow/deny, capacity-available/unavailable, and idempotent
   replay (AC011–AC013, AC025).
8. Inconsistent-aggregate fail-closed tests (AC016, AC026).
9. Observability signal tests for job failure / SLA breach / batch error
   (AC019).
10. Scheduled job SLA observation in sandbox (not Main `EN_VENTA`).
11. Audit redaction review (AC010, AC030).
12. Provider REJECTED/CANCELLED non-expiry-path test (AC018).
13. PAID immunity test (AC020).

Runtime validation remains `NOT_RUN` until a separately authorized
`IMPLEMENTING` / validation unit executes against this approved contract.

## 15. Traceability

| Decision / source | Requirements / ACs |
|---|---|
| PO D1 order → `EXPIRED` | R001, R002, AC001 |
| PO D2 registrations → `CANCELLED` / `ORDER_EXPIRED` | R006, AC002 |
| PO D3 `ORDER_HOLDER` → `EXPIRED` same TX | R007, R008, AC002 |
| PO D4 logical + persisted ≤5 min + not-only opportunistic | R003, R004, R005, R010, AC003, AC004 |
| PO D5 late payment + admin recovery | R011, R016, AC006, AC012, AC013, AC025 |
| PO D6 identical expires_at + divergence review | I004, R012, AC008, AC016 |
| PO D7 retain history + dry-run | I005, R013, AC009, AC017 |
| PO D8 notification out of scope | R014, AC015 |
| PO D9 audit minimum | R015, I009, AC010, AC027, AC030 |
| PO D10 protected admin action | R016, AC011–AC013, AC025 |
| SPEC-032-R042 | I003, R011, AC006, AC023 |
| SPEC-031 payment authority | I001, AC028 |
| Preference compensation distinct | R017, AC007 |
| Rejected/cancelled ≠ natural expiry | R018, AC018 |
| Concurrency / PAID immunity | R020, R024, I008, AC014, AC020–AC024 |
| Observability | R021, AC019 |
| Determinism | R019, AC029 |
| Inconsistent aggregates | R023, AC026 |
| Privacy | R022, AC030 |
| IMPL-13E-Y gap evidence | Context only |
| CTO CHANGES_REQUIRED (IMPL-14A-1F) | AC016–AC030, R023–R024, R016-B/C, I009 |

### 15.1 Requirement → Acceptance Criteria

| Requirement | Acceptance Criteria |
|---|---|
| I001 | AC028 |
| I002 | AC001, AC007 |
| I003 | AC006, AC023 |
| I004 | AC008 |
| I005 | AC009, AC017 |
| I006 | AC002 |
| I007 | AC003 |
| I008 | AC014, AC020–AC024 |
| I009 | AC027 |
| R001 | AC001 |
| R002 | AC001 |
| R003 | AC002, AC004 |
| R004 | AC003, AC016 |
| R005 | AC004, AC019 |
| R006 | AC002 |
| R007 | AC002 |
| R008 | AC002 |
| R009 | AC005, AC024 |
| R010 | AC004 |
| R011 | AC006, AC023 |
| R012 | AC008, AC016 |
| R013 | AC009, AC017 |
| R014 | AC015 |
| R015 | AC010, AC027 |
| R016 / R016-A / R016-B / R016-C | AC011, AC012, AC013, AC025 |
| R017 | AC007 |
| R018 | AC018 |
| R019 | AC029 |
| R020 | AC014, AC021, AC022, AC023, AC024 |
| R021 | AC019 |
| R022 | AC010, AC030 |
| R023 | AC026, AC027 |
| R024 | AC020, AC021 |

### 15.2 Acceptance Criterion → Requirements

| AC | Requirements / invariants |
|---|---|
| AC001 | R001, R002, I002 |
| AC002 | R003, R006, R007, R008, I006 |
| AC003 | R004, I007 |
| AC004 | R005, R010 |
| AC005 | R009 |
| AC006 | R011, I003 |
| AC007 | R017, I002 |
| AC008 | R012, I004 |
| AC009 | R013, I005 |
| AC010 | R015, R022 |
| AC011 | R016 |
| AC012 | R016-A |
| AC013 | R016-B |
| AC014 | R020, I008 |
| AC015 | R014 |
| AC016 | R012, R004 |
| AC017 | R013, I005 |
| AC018 | R018 |
| AC019 | R021, R005 |
| AC020 | R024, I008 |
| AC021 | R020, R024 |
| AC022 | R020, I008 |
| AC023 | R011, R020, I003 |
| AC024 | R009, R020 |
| AC025 | R016-C |
| AC026 | R023 |
| AC027 | I009, R015, R023 |
| AC028 | I001 |
| AC029 | R019 |
| AC030 | R022 |

## 16. Open decisions

| ID | Topic | Status | Notes |
|---|---|---|---|
| OD-040-001 | Exact physical job cadence under the 5-minute SLA | OPEN / non-blocking for approval | Implementation may choose e.g. 1-minute schedule; must meet R005 |
| OD-040-002 | Exact admin role name and authn mechanism | OPEN / non-blocking for approval | Must satisfy R016 fail-closed |
| OD-040-003 | Refund provider execution runbook | OPEN / operational / outside SPEC-040 execution | SPEC-040 defines refund_required/pending + audited task only; MP refund execution, provider verification, and canonical close remain a separate authorized unit/runbook |

### Related (not superseded by this draft)

| ID | Topic | Status | Notes |
|---|---|---|---|
| OD-010 (SPEC-032) | Hold duration / late commercial policy | RELATED | PO D5 clarifies the late-payment recovery shape for SPEC-040. SPEC-032 OD-010 remains governed by SPEC-032 until formally resolved or changed. This DRAFT does not supersede SPEC-032. |

### Resolved decisions

| ID | Topic | Resolution |
|---|---|---|
| OD-040-004 | Opportunistic checkout expiry persistence | Resolved by PO D4: opportunistic persistence is an additional defense and MUST NOT be the sole release mechanism (R005, R010). |

No blocking open decision remained for approval. Project Owner approved
v0.1.1 on 2026-07-27. OD-040-001, OD-040-002, and OD-040-003 remain open for
the implementation plan or operational runbook. D1–D10 are not reopened.

## 17. Change log

| Version | Date | Status | Actor | Notes |
|---|---|---|---|---|
| 0.1.0 | 2026-07-27 | DRAFT | Cursor, authorized by Project Owner | Initial IMPL-14A-1 draft encoding PO decisions D1–D10 for payment-pending expiry reconciliation; no implementation authority. |
| 0.1.1 | 2026-07-27 | DRAFT | Cursor, authorized after CTO CHANGES_REQUIRED | CTO review fixes: complete acceptance coverage; define inconsistent aggregate fail-closed behavior; correct OD-010/OD-040-004 governance; clarify refund execution boundary; preserve no implementation authority. |
| 0.1.1 | 2026-07-27 | APPROVED | Project Owner Leandro Espinosa | Status transition DRAFT → APPROVED after CTO READY_FOR_APPROVAL; authorizes IMPL-14A-2 implementation traceability and plan only; no runtime implementation authority. |

## 18. Explicit non-authorization

While `status: APPROVED` and before a separate `IMPLEMENTING` authorization:

```text
APPROVED authorizes: IMPL-14A-2 implementation traceability and plan
still prohibited without further authorization:
no code
no SQL
no migrations
no cron/schedules creation
no edge function deploys
no backfill
no row repairs
no InsForge writes
no payments or refunds
no Main EN_VENTA
no IMPLEMENTING/VALIDATED status claims without new human decision
```

Next authorized unit: IMPL-14A-2 — IMPLEMENTATION TRACEABILITY AND PLAN.
