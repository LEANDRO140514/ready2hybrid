# IMPL-14A-3A-SBX-RUNTIME — Logical Capacity Expiry Exclusion — Sandbox Runtime Validation

```text
unit: IMPL-14A-3A-SBX-RUNTIME
date: 2026-07-28
status: EVIDENCE CAPTURED
human closure: PERFORMED 2026-07-28 (Project Owner)
closure scope: IMPL-14A-3A implementation + sandbox validation only
```

## 1. Autoridad

```text
SPEC-040 v0.1.1 (Payment Pending Expiry Reconciliation) = APPROVED
IMPL-14A-2 v0.2.0 = PLAN / APPROVED
implementation commit under validation: ced7c62
```

Validation scope was the database capacity contract only: the logical exclusion of
time-expired `ACTIVE` holds from the cupo calculation inside `checkout_start_tx`.
No expiry persistence, reconciler, schedule or admin recovery was in scope.

## 2. Entornos

Sandbox (the only environment mutated):

```text
name: impl-14a-expiry
Project ID: 2921e092-aed6-4abb-93be-946c42eee82a
prefix: 4bg9ufz2-2w7
mode: schema-only
migration max: 11
```

Main (untouched):

```text
name: ready2hybrid
Project ID: 91fa34b1-e3b5-44c0-9806-b092c1dd7144
prefix: 4bg9ufz2
migration max: 10
writes: 0
```

The sandbox was provisioned in `schema-only` mode by IMPL-14A-3A-SBX-PROVISION,
which also retired `impl-13b-spectator-wiring` to free branch quota. Before any
runtime case, the inherited `MERCADOPAGO_ACCESS_TOKEN` was removed from the
sandbox so no case could reach a payment provider; Main's own credential was
verified intact and never read again.

## 3. Migración

```text
remote migration name: logical-capacity-expiry-exclusion
canonical repository filename: 0011_logical-capacity-expiry-exclusion.sql
SHA-256: 7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22
```

The SQL applied to the sandbox was byte-identical to the versioned artifact. The
migration only replaces `checkout_start_tx`; it creates no index, no table, no
schedule and no new function. The capacity predicate under validation is:

```sql
state = 'ACTIVE' AND (expires_at IS NULL OR expires_at > v_capacity_now)
```

where `v_capacity_now := clock_timestamp()` is captured once, after the product
and event row locks and before the `SUM(capacity_units)`.

## 4. Matriz de resultados

| Criterio          | Evidencia                                   | Estado |
| ----------------- | ------------------------------------------- | ------ |
| SPEC-040-I007     | Casos B–F                                   | PASS   |
| SPEC-040-R004     | Casos A–F y concurrencia                    | PASS   |
| SPEC-040-AC003    | Lock-wait físico discriminante              | PASS   |
| ACTIVE futuro     | Caso A                                      | PASS   |
| ACTIVE pasado     | Caso B                                      | PASS   |
| ACTIVE NULL       | Caso C                                      | PASS   |
| Igualdad temporal | Caso D                                      | PASS   |
| Estados no ACTIVE | Caso F                                      | PASS   |
| Concurrencia      | Una procede y una SOLD_OUT                  | PASS   |
| Cero persistencia | Sin transición automática                   | PASS   |
| Regresión RPC     | Individual, spectator, gates e idempotencia | PASS   |
| Main intacto      | v1–v10 y cero transacciones                 | PASS   |

Each case ran against its own synthetic product so no case could inherit state
from another. Effective reserved capacity never exceeded the configured cupo on
any product, in any case, including the concurrent ones.

## 5. Lock-wait físico

Two concurrent sessions were used. Session A locked the product row and held the
transaction open; session B entered `checkout_start_tx` and blocked on that lock.
The seeded hold was set to expire *during* B's wait — after B's transaction had
already started, before A released the lock.

```text
A lock start:      06:07:31.201 UTC
B checkout start:  06:07:37.274 UTC
hold expires_at:   06:07:50.453277 UTC
A release:         06:07:57.399 UTC
B completion:      06:07:57.402 UTC
B duration:        20128 ms
B result:          success
```

Discriminación:

```text
expires_at > transaction-start now()        = true
expires_at > post-lock clock_timestamp()    = false
```

This is what makes the case discriminating rather than merely passing: a
transaction-start clock would still have counted the hold and returned
`SOLD_OUT`, while the post-lock canonical clock correctly released the cupo and
let B succeed. The scenario therefore validates SPEC-040-AC003 against the
implementation's actual temporal source, not against a coincidence of timing.

## 6. Cero persistencia de expiración

No hold, order, `ORDER_HOLDER` or registration changed state as a result of the
capacity calculation. Expired holds remained `ACTIVE` with their original
`expires_at`; the exclusion is read-only arithmetic. No payments, tickets,
entitlements, `TICKET_ACCESS` credentials or webhook rows were produced in the
sandbox, and no schedule or edge function was created or invoked.

## 7. Hallazgos retenidos

```text
NB-1: TX-1 creates the order/hold in PREFERENCE_PENDING before the Mercado Pago
      preference exists, so a preference failure leaves a hold that only expiry
      reconciliation can clear.
NB-2: capacity_holds.updated_at has no trigger maintenance; it is written only by
      explicit statements, so it is not a reliable change timestamp.
NB-3: an isolated TX-1 replay depends on idempotency_records.response_ref;
      without it the replay path cannot rebuild the original response.
NB-4: the retained sandbox still holds inherited secrets that are unused after
      MERCADOPAGO_ACCESS_TOKEN was neutralised; Main's credential is intact.
NB-5: the validation harness artifacts (synthetic events, days, products and
      seeded holds) did not alter any result.
```

```text
OPEN FOR IMPL-14A-3B:
boundary asymmetry — checkout_start_tx frees cupo at expires_at <= v_capacity_now
while TX-2 (0009) treats a hold as expired only at expires_at < now().
No change was made to TX-2 in 3A.

TIME-SEMANTICS-AUDIT:
other now() uses remain pending analysis (hold duration derivation, sales gates,
TX-2), required before integral runtime validation or production.
```

## 8. Estado resultante

```text
SANDBOX RUNTIME VALIDATION = EXECUTED
CTO RUNTIME REVIEW = PASSED
ARTIFACT FILENAME CORRECTION = COMPLETED
IMPL-14A-3A = VALIDATED / CLOSED (implementation + sandbox validation scope)
human closure = PERFORMED 2026-07-28 (Project Owner)
Main application of 0011 = NOT AUTHORIZED
IMPL-14A-3B = NOT AUTHORIZED / NOT STARTED
PRODUCTION = NO-GO
PAYMENT_PENDING_EXPIRY_RECONCILIATION = OPEN (SPEC-040 not closed by 3A)
```

The Project Owner closed IMPL-14A-3A on 2026-07-28 for the scope recorded in this
document only. The closure does not declare the migration deployed, does not
authorize applying 0011 to Main, does not authorize production and does not
authorize starting IMPL-14A-3B. The retained findings in §7 remain open.
