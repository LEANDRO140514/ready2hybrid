# IMPL-12-R3 — Webhook Payment-Before-Verification Fix Evidence

```text
Unit: IMPL-12-R3 — Minimal webhook corrective fix + Case A revalidation
Mode: VALIDATE + MINIMAL FORWARD MIGRATION · ISOLATED BRANCH · MP TEST ONLY · NO IMPL-13
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: 2014758
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Sandbox branch: impl12-r3-webhook-fix-20260726 (appkey 4bg9ufz2-7vd) — DELETED
Result: IMPL_12_CORRECTIVE_VALIDATION_FAILED
Defect class addressed: VERIFICATION_INSERT_PRECEDES_PAYMENT_UPSERT — FIXED on branch
Case A full checklist: FAIL (expired capacity hold → REQUIRES_REVIEW; no tickets)
Gate: IMPL_12_CORRECTIVE_VALIDATION_FAILED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD (start) | `2014758` |
| origin/main (start) | `2014758` |
| Divergence | `0 / 0` |
| Working tree (start) | clean (local excludes only) |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_IMPL_12_WEBHOOK_CORRECTIVE_FIX` |
| Specs | SPEC-000/001/011/030/031/032 APPROVED |
| Primary operation | Validate implementation against approved specification |
| Governance | `ready2hybrid-spec-governance` |

## 3. Defect confirmation (pre-write)

```text
DEFECT_CONFIRMED:
VERIFICATION_INSERT_PRECEDES_PAYMENT_UPSERT
```

Prior order (0008 `webhook_apply_payment_tx`):

1. receive webhook / validate signature / fetch MP payment  
2. invoke `webhook_apply_payment_tx`  
3. insert `payment_verification_records` **without** `payment_id`  
4. create/upsert `payments`  
5. backfill `payment_id`

Failure (IMPL-12-R2 evidence): NOT NULL on `payment_verification_records.payment_id` → HTTP 500.

## 4. Correction design

```text
1. resolve order
2. upsert payments → obtain payment.id
3. insert payment_verification_records WITH payment_id
4. apply order/registration transitions
5. issue tickets when outcome PAID / ALREADY_PAID
```

Constraints respected:

- `payment_id` remains NOT NULL (0002 untouched)
- no schema change
- no NULL insert
- single TX / SECURITY DEFINER / least privilege preserved
- idempotent DUPLICATE short-circuit preserved

## 5. Migration v9

| Item | Value |
|---|---|
| Repo path | `insforge/migrations/0009_fix_webhook_payment_verification_order.sql` |
| Remote apply (branch) | `0009_fix-webhook-payment-verification-order` → version **9** |
| Objects changed | `CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(jsonb)` only |
| Tables/columns | unchanged |
| Main migrations after cleanup | still **v1–v8** (v9 not applied on Main) |
| `mp-webhook` redeploy | not required (RPC-only fix) |

## 6. Local regression

| Command | Result |
|---|---|
| `npm run lint` | PASS (preexisting deploy-bundle warnings only) |
| `npm run typecheck` | PASS |
| `npm test` | **166** passed (12 files); **+7** new in `webhook-payment-verification-order.test.ts` |
| `npm run build` | PASS |

New tests assert: prior 0008 defect ordering; 0009 payment insert precedes verification insert with `payment_id`; grants; DUPLICATE + ticket issuance preserved; ORDER_NOT_FOUND without null verification.

## 7. Sandbox branch

| Item | Result |
|---|---|
| Name | `impl12-r3-webhook-fix-20260726` |
| Appkey | `4bg9ufz2-7vd` |
| Isolation probe | PASS (branch secret absent on Main) |
| Main during work | CONFIGURADO / products 28 / transactional 0 / migrations v8 |
| Branch after v9 | migrations v1–v9 / functions 5 |
| Event | temporarily `EN_VENTA` |

## 8. Case A payment (human)

| Field | Value |
|---|---|
| Product | WOD-H |
| Amount | $300 MXN |
| Order / external_reference | `8df4b4d6-7de1-4abc-a448-2371eb2cf90f` |
| Tracking | `trk_d81b745153df4a359c3a7187cdb03f96` |
| Provider payment id | `170606686994` |
| Provider status | `approved` / `accredited` |
| Environment | TEST (`Mercadopago*fake`) |
| Attempts | 1 |

## 9. Signed webhook + domain

Secret loaded to branch only; local `.cursor/impl12-r3.webhook.secret` deleted after `has_webhook_secret=true`.

| Attempt | HTTP | Body outcome |
|---|---|---|
| First signed POST | **200** | `REQUIRES_REVIEW` (`applied=true`) |
| Duplicate same notification id | **200** | `DUPLICATE` (`replay=true`) |
| Invalid signature | **401** | `UNAUTHORIZED` |

| Check | Required | Observed | State |
|---|---|---|---|
| Webhook HTTP 2xx | yes | 200 | PASS |
| Payment created once | yes | 1 · APPROVED · 30000 · VERIFIED | PASS |
| Verification `payment_id` NOT NULL | yes | present → payment `f62cad48-…` | PASS |
| Order PAID | yes | **REQUIRES_REVIEW** | **FAIL** |
| Registration PAYMENT_CONFIRMED | yes | **STARTED** | **FAIL** |
| Ticket = 1 | yes | **0** | **FAIL** |
| Credential ACTIVE = 1 | yes | **0** | **FAIL** |
| Entitlement = 1 | yes | **0** | **FAIL** |
| Idempotency | yes | duplicate → DUPLICATE; counts unchanged | PASS |
| Invalid signature writes | 0 domain | 401; no extra rows | PASS |

### Why not PAID

Capacity hold `expires_at = 2026-07-26 08:25:08+00` (TTL 1800s). Human payment occurred during the hold window; signed webhook apply occurred hours later after secret recovery delays. RPC late/expired-hold path (SPEC-032-R042) set:

- order → `REQUIRES_REVIEW`
- hold → `CONFLICT`
- outcome → `REQUIRES_REVIEW`
- tickets not issued (by design)

No second payment. No second code patch in this unit.

## 10. Cleanup

| Step | Result |
|---|---|
| Branch event | `CONFIGURADO` before delete |
| Branch delete | `impl12-r3-webhook-fix-20260726` DELETED; branches = 0 |
| Local secret file | absent |
| Mercado Pago topics disable via MCP | **unavailable** this session (server not listed); URL may remain stored pointing at deleted host — human should set test topics NONE in panel |
| Main snapshot | CONFIGURADO / products 28 / orders·payments·webhooks·tickets = 0 / migrations v1–v8 / functions 5 |

## 11. Files modified (authorized)

```text
insforge/migrations/0009_fix_webhook_payment_verification_order.sql
tests/unit/webhook/webhook-payment-verification-order.test.ts
docs/implementation/evidence/IMPL-12-R3-WEBHOOK-PAYMENT-ORDER-FIX.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

## 12. Gate

```text
IMPL_12_CORRECTIVE_VALIDATION_FAILED
IMPL-12: CORRECTIVE_RPC_FIXED_ON_BRANCH / CASE_A_FULL_CHECKLIST_FAIL / NOT CLOSED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

Recommended next (not authorized here): authorize Main apply of v9 + Case A revalidation with immediate signed webhook inside the hold TTL (no code change expected for the payment_id defect).
