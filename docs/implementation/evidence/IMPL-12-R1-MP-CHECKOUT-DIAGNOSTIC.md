# IMPL-12-R1 — Mercado Pago Checkout Pro Sandbox Diagnostic

```text
Unit: IMPL-12-R1 — Controlled diagnosis of Checkout Pro sandbox block
Mode: DIAGNOSE ONLY · ISOLATED INSFORGE BRANCH · MP TEST ONLY · NO CODE CHANGE · NO IMPL-13
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: a5f9388
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Diagnostic branch: impl12-r1-mpdiag-20260725 (appkey 4bg9ufz2-etc) — DELETED
Result: ROOT_CAUSE_ESTABLISHED: BROWSER_SESSION_CONFLICT
IMPL-12 status: NOT CLOSED (retry may be authorized)
Gate: READY_FOR_IMPL_12_RETRY_AUTHORIZATION
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD / origin/main | `a5f9388` |
| Divergence | `0 / 0` |
| Working tree | only `?? .cursor/settings.json` (Stripe plugin local; untracked / unmodified) |
| Prior IMPL-12 | `PROVIDER_SANDBOX_BLOCKED` — payment UI blocked |
| MP webhook panel (human) | Test: URL stored, events NONE, callback DISABLED · Production: NOT CONFIGURED |

## 2. Official protocol verified

| Requirement | Source | Applied |
|---|---|---|
| Test credentials | MP MCP `get_credentials` app `2442407257411599` | Test Access Token prefix `APP_USR-`; production credentials NOT activated |
| Test buyer in browser | MP docs: test accounts / email verification code | Chrome Incognito + buyer `test_user_*@testuser.com` + email OTP |
| Seller only server-side | Checkout Pro test seller automatic | Collector `3560835739` on preference/payment; no seller browser session |
| Real card / production | Prohibited | Not used |
| Webhook panel changes | Not authorized this unit | Unchanged |

## 3. Hypotheses

| ID | Hypothesis | Discriminant | Outcome |
|---|---|---|---|
| H1 | Seller/personal session mixed with test buyer | Clean Incognito + test buyer OTP | **ESTABLISHED** — block cleared |
| H2 | Wrong buyer / site | Buyer from app test users; MLM | Not sole cause |
| H3 | Wrong credential/collector | Preference `collector_id` = test seller | Eliminated as sole cause |
| H4 | `init_point` vs `sandbox_init_point` | System returns `init_point`; sandbox URL also present | **Not sole cause** — payment completed on system `init_point` URL |
| H5 | `back_urls` / `auto_return` loop | Preference has `auto_return=approved` + example.com backs | No loop; success shown; empty redirect label secondary |
| H6 | Residual `notification_url` | Panel events NONE / callback DISABLED | Not causal for UI |
| H7 | Payer email | No payer email prefilled | Not causal |
| H8 | Unsupported preference config | Minimal viable preference paid | Eliminated |
| H9 | Browser/cookies alone | Incognito + correct buyer worked | Secondary to H1 |
| H10 | Provider outage | Official path completed payment | Eliminated |

## 4. Static inspection — prior IMPL-12 + code

| Fact | Evidence |
|---|---|
| Preference payload | items MXN, qty 1, unit 300, `external_reference`=order id, `auto_return=approved`, `notification_url`, `back_urls`, optional expiration |
| System `checkout_url` | Always `preference.initPoint` (`www.mercadopago.com.mx`) — `orchestrate.ts` |
| `sandbox_init_point` | Returned by MP API but **not** exposed in public response |
| Prior IMPL-12 operators | Manually used `sandbox_init_point` after noting system returned `init_point` |
| Prior symptoms | `ERR_TOO_MANY_REDIRECTS` on sandbox login; **Pagar** disabled; mixed real buyer fatal page |

## 5. Preference P1 (this unit)

| Field | Sanitized value |
|---|---|
| HTTP | 200 |
| Product | WOD-H · Workout Experience Hombre |
| Amount / currency | 300 MXN |
| Collector | `3560835739` (matches test seller) |
| `live_mode` on preference | null |
| `auto_return` | `approved` |
| `back_urls` | `https://example.com/r2h/{success,failure,pending}` |
| `notification_url` host | `4bg9ufz2-etc.us-east.insforge.app` `/functions/mp-webhook` |
| Payer email | absent |
| System URL host | `www.mercadopago.com.mx` (`init_point`) |
| Alternate URL host | `sandbox.mercadopago.com.mx` (`sandbox_init_point`) |

## 6. Preference P2

```text
DIRECT_PROVIDER_CONTROL_NOT_AVAILABLE
```

Mercado Pago MCP exposes no create-preference tool. Diagnosis continued with P1 only (1 of 2 max preferences used).

## 7–12. Browser matrix

### D1 — P1 system URL (`init_point`) · Chrome Incognito · test buyer

| Observation | Result |
|---|---|
| Email OTP gate | Present for test buyer; completed by Project Owner |
| Checkout load | PASS · badge **Test** |
| Redirect loop | **None** |
| Amount / product | $300 · Workout Experience Hombre |
| **Pagar** | **Enabled** |
| Edge | NOT_RUN (not needed after D1 success) |
| D3 alternate URL | NOT_RUN (payment completed on system URL) |

### Payment attempt (authorized max 1)

| Observation | Result |
|---|---|
| Executed | Yes |
| UI | “¡Listo! Tu pago ya se acreditó” · Operación `#169718349115` |
| Descriptor | `Mercadopago*fake` (sandbox) |
| API GET `/v1/payments/{id}` | `status=approved` · `status_detail=accredited` · amount 300 MXN · collector test seller |
| API `live_mode` | `true` (observed; production credentials remain not activated; UI `*fake`) |
| Webhook / simulator | **Not run** (not authorized) |
| Tickets / QR / domain effects on Main | **None** (branch-only; no webhook) |

Secondary UX: success page text `En 1 segundos te llevaremos a .` — empty destination label consistent with placeholder `example.com` `back_urls`, not a payment failure.

## 13. Cause

```text
ROOT_CAUSE_ESTABLISHED:
BROWSER_SESSION_CONFLICT
```

Demonstrated: a clean Chrome Incognito session with the application **test buyer**, completing the email verification code, loads Checkout Pro and completes a sandbox payment of $300 MXN using the **system-returned `init_point`**. Prior IMPL-12 failure symptoms match mixed/personal sessions and incomplete test-buyer authentication, not a hard provider outage and not a mandatory `sandbox_init_point`-only defect.

## 14. Recommended correction

| Kind | Action |
|---|---|
| Code | **None required** to clear the observed block |
| Operational protocol for IMPL-12 retry | Incognito; test buyer only; complete email OTP; never seller session in buyer browser |
| Optional hardening (future unit) | Prefer exposing `sandbox_init_point` when present; use real public return URLs instead of `example.com` placeholders |
| Specs | No change in this unit |

## 15. Branch and cleanup

| Step | Result |
|---|---|
| Branch create | `impl12-r1-mpdiag-20260725` full mode · `4bg9ufz2-etc` |
| Isolation probe | `IMPL12_R1_PROBE` present on branch, absent on Main |
| Branch event | `CONFIGURADO` → `EN_VENTA` (+ sales window) → restored `CONFIGURADO` |
| Branch delete | `deleted: true` · branch list empty |
| MP webhook panel | Unchanged |

## 16. Main snapshot final

| Item | Value |
|---|---|
| HEX-2026 | `CONFIGURADO` |
| products | 28 |
| orders / payments / tickets / webhook_events / waiver_documents | 0 |
| functions | 5 |
| `IMPL12_R1_PROBE` / `CHECKOUT_*` on Main | absent |
| canonical differences | 0 |

```text
CANONICAL_PROJECT_CONTAMINATED = false
```

## 17. Protected local artifact

```text
.cursor/settings.json = UNTRACKED / UNMODIFIED / UNSTAGED
```

## 18–19. Unit status

```text
IMPL-12 = DIAGNOSED / NOT CLOSED / READY FOR RETRY AUTHORIZATION
IMPL-13 = NOT_STARTED / NOT AUTHORIZED
Mercado Pago = PROVEEDOR PRIMARIO VIGENTE
```

## 20. Operations inventory

### InsForge Main

| Op | Count |
|---|---|
| reads | snapshots |
| writes | 0 |
| deploys | 0 |
| migrations | 0 |

### InsForge branch

| Op | Count |
|---|---|
| branch create | 1 |
| event state / sales window changes | open + restore |
| checkout-domain writes | P1 order/preference on branch |
| branch delete | 1 |

### Mercado Pago

| Op | Count |
|---|---|
| preferences | 1 |
| payment attempts | 1 (approved) |
| webhook simulations | 0 |
| callback changes | 0 |
| production operations | 0 |

### Stripe

| Op | Count |
|---|---|
| reads / writes / auth | 0 |

## 21. Recommended gate

```text
READY_FOR_IMPL_12_RETRY_AUTHORIZATION
```

Next human action options:

1. Authorize a full IMPL-12 retry using the verified test-buyer protocol.
2. Do **not** start IMPL-13 from this diagnostic.
3. Keep production webhook NOT CONFIGURED until a dedicated unit.
