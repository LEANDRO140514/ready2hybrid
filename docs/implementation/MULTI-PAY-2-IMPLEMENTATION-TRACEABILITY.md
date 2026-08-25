# MULTI-PAY-2 — Multi-Provider Payment Implementation Traceability

```text
Status: DOCUMENTARY ONLY
Version: 0.1.0
Created: 2026-08-22
Unit: MULTI-PAY-2
Lane: LANE B — MULTI-PAY
Authority: SPEC-041 v0.1.0 APPROVED / EFFECTIVE
  (Project Owner Leandro Espinosa, 2026-08-22)
Commit/push: NOT AUTHORIZED by this unit
Runtime execution: NOT AUTHORIZED
Adapters / SDKs / SQL / migrations: NOT AUTHORIZED
InsForge writes: NOT AUTHORIZED
Provider API calls / secrets / deploy: NOT AUTHORIZED
SALES_STATUS change: NOT AUTHORIZED
MULTI-PAY-3 execution: AUTHORIZED (abstraction/mocks); MULTI-PAY-3C correction applied, pending rereview
MULTI-PAY-4 execution: AUTHORIZED (Mercado Pago adapter wrap; runtime wiring BLOCKED_BY_LANE_A)
MULTI-PAY-5 execution: AUTHORIZED (Clip Checkout Redirect adapter; runtime enablement NO; E2E BLOCKED_BY_TEST_STRATEGY)
```

## A. Objective

Translate the approved SPEC-041 Multi-Provider Payment Contract into a
controlled implementation chain without executing any unit:

```text
APPROVED REQUIREMENT
  -> EXISTING IMPLEMENTATION / GAP
  -> PLANNED FILE OR BOUNDARY
  -> VALIDATION
  -> EXPECTED EVIDENCE
  -> FUTURE IMPLEMENTATION UNIT
```

This document does **not** authorize code, adapters, SQL, migrations, SDK
installs, provider account writes, webhook configuration, secrets, sandbox or
production payments, landing changes, commit, or push.

SPEC-041 requirements are not reinterpreted. Open decisions are carried
forward, not resolved.

## B. Authority

| Spec / source | Version | Status |
|---|---|---|
| SPEC-000 Specification Governance | 0.2.0 | APPROVED |
| SPEC-001 System Architecture | 0.1.0 | APPROVED |
| SPEC-030 Public Sales Catalog and Registration Journeys | 0.3.0 | APPROVED / EFFECTIVE |
| SPEC-031 Public Sales API and Backend Contract | 0.3.0 | APPROVED / EFFECTIVE |
| SPEC-032 Minimal Sales Data Model and Transaction Integrity | 0.3.0 | APPROVED / EFFECTIVE |
| SPEC-040 Payment Pending Expiry Reconciliation | 0.1.1 | APPROVED |
| SPEC-041 Multi-Provider Payment Contract | 0.1.0 | APPROVED / EFFECTIVE |
| SPEC-011 PWA Foundation | 0.1.0 | APPROVED (compatibility) |
| SPEC-060 Event Entry Operations | 0.1.0 | APPROVED (compatibility) |
| `docs/00`–`docs/05` | product | governing product/architecture |
| Current repository payment code | HEAD `c5068a4` plus working-tree inspection | implementation evidence only |

Lane A relaunch WIP (SPEC-030/031/032 working copies, `0017`–`0019`,
staged-pricing, checkout orchestrate/sales/validate, landing) is **protected**.
Future overlap is marked `COORDINATION_REQUIRED_WITH_LANE_A`. This document
does not take ownership of Lane A files.

## C. Baseline (documentary, read-only)

```text
Repository HEAD: c5068a4820cd912cca5f28060cb50b14319a6f0e (c5068a4) main
Working tree: DIRTY (Lane A relaunch WIP + untracked SPEC-041)
SPEC-041: v0.1.0 APPROVED / Effective YES
SALES_STATUS: remains closed (not changed by this unit)
Clip / Openpay application code: NOT PRESENT
PaymentProvider TypeScript interface: NOT PRESENT
```

Existing Mercado Pago checkout is the first provider path. It is wrapped, not
rewritten, by later MULTI-PAY-4.

This unit did not query InsForge, Mercado Pago, Clip, Openpay, or secrets.

## D. Existing payment architecture

Current productive path is Mercado Pago Checkout Pro only.

```text
Landing POST
  -> insforge/functions/mp-create-checkout
       origin guard
       CatalogPort (products/events)
       sales.ts assertSalesOpen / assertProductSellable
       eligibility.ts (multiday spectator/press block)
       pricing / staged-pricing (Lane A WIP) commercial snapshot
       startCheckoutTx (order + hold + idempotency)
       mp-client.ts createCheckoutProPreference
       attachPreference (init_point)
  -> buyer redirect to Mercado Pago (non-authoritative)
  -> POST insforge/functions/mp-webhook
       x-signature authenticity (mercadopago/signature.ts)
       GET /v1/payments/{id} (mercadopago/payments.ts)
       normalize.ts MP status -> SPEC-032 payment literals
       amount/currency/reference/ownership flags
       RPC webhook_apply_payment_tx
         payment row, order transition, hold convert/release,
         registration PAYMENT_CONFIRMED, tickets (migration 0008)
  -> GET get-order-status public projection (SPEC-031)
```

Physical uniqueness already present (committed migrations, not designed here):

- `payments (provider, provider_payment_id)` unique
  (`uq_payments_provider_payment_id`, migration `0002`)
- `webhook_events (provider, provider_notification_id)` unique
  (`uq_webhook_events_provider_notification_id`)

Environment names already used (values not read):

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_LIVE_MODE`
- `MERCADOPAGO_COLLECTOR_ID`
- `CHECKOUT_HOLD_DURATION_SECONDS`
- `CHECKOUT_IDEMPOTENCY_TTL_SECONDS`
- `CHECKOUT_BACK_URL_SUCCESS` / `_FAILURE` / `_PENDING`
- `CHECKOUT_NOTIFICATION_URL`
- `CHECKOUT_CORS_ORIGIN`
- `INSFORGE_BASE_URL` / `API_KEY`

Clip and Openpay configuration names: `NAME_TO_BE_DEFINED_DURING_IMPLEMENTATION`.

## E. Abstraction seam assessment

| Concept | Classification | Evidence |
|---|---|---|
| `PaymentProvider` (docs/05 §2.3) | `NOT_PRESENT` as code | Named in docs/05 and SPEC-041 only |
| `createCheckout` | `MERCADOPAGO_COUPLED` | `MercadoPagoClient.createCheckoutProPreference` |
| `verifyEvent` / `verifyWebhook` | `MERCADOPAGO_COUPLED` | `validateMercadoPagoWebhookSignature` + `orchestrateWebhook` |
| `getPayment` / `resolvePayment` | `MERCADOPAGO_COUPLED` | `PaymentClient.getPayment` → MP `/v1/payments/{id}` |
| `normalizeStatus` | `REUSABLE_WITH_EXTRACTION` | `normalizeProviderPaymentStatus` is MP status map; literals are SPEC-032 |
| Canonical post-payment TX | `REUSABLE_WITH_EXTRACTION` | `webhook_apply_payment_tx` is domain-centric but invoked only from MP webhook |
| Checkout sales validation | `REUSABLE` as Sales Domain | `sales.ts`, `eligibility.ts`, `validate.ts` — **not** a PSP adapter |
| Public order projection | `REUSABLE` | `public-status/mapping.ts` |
| Payment / webhook uniqueness | `REUSABLE` | `(provider, provider_payment_id)` and webhook notification unique indexes |
| Clip / Openpay adapters | `NOT_PRESENT` | no matching symbols in `insforge/` or `src/` |

Principle: extract a **minimal** three-provider contract. Do not build a
universal payment framework, PayPal stubs, plugin marketplace, or refund API.

## F. Canonical post-payment assessment

**`PARTIALLY_CENTRALIZED`**

- Domain effects for verified payment live in SQL RPC `webhook_apply_payment_tx`
  (order, hold, registration, later tickets in `0008`). That is the preferred
  canonical post-payment business path.
- Ingress, authenticity, GET payment, and evidence prefix (`mp_payment:`) are
  Mercado Pago-coupled in `mp-webhook` + `webhook/orchestrate.ts`.
- Future Clip/Openpay MUST feed the same domain TX after their own
  authenticity + financial GET. Do not duplicate ticket/registration/capacity
  logic inside adapters.

Classification detail:

```text
Ticket / registration / capacity effects: CENTRALIZED (RPC)
Payment application: CENTRALIZED (RPC) + MERCADOPAGO_COUPLED ingress
Order PAID transition: CENTRALIZED (RPC)
```

## G. Target architecture (approved, not implemented here)

```text
LANDING / CUSTOMER
        |
        v
READY2HYBRID SALES DOMAIN
        | product / SKU / eligibility / offering / sales window /
        | contractual price / currency / capacity
        | -> PAYMENT_ELIGIBLE
        v
CANONICAL ORDER
        |
        v
MULTI-PAY ORCHESTRATION
        |
        +---- MERCADO_PAGO   (wrap existing Checkout Pro)
        +---- CLIP           (Checkout Redirect; no Transparente fallback)
        +---- OPENPAY        (hosted/redirected no-PAN; MX confirm=false
                              + redirect_url as current mechanism)
```

Adapters MUST NOT recompute catalog, eligibility, price, capacity, schedule,
or prizes.

## H. Requirement traceability (SPEC-041-R001 … R045)

Existing-state vocabulary:

`ALREADY_SATISFIED` | `PARTIALLY_SATISFIED` | `NOT_IMPLEMENTED` |
`IMPLEMENTATION_CHOICE_PENDING` | `BLOCKED_BY_ACCOUNT` |
`COORDINATION_REQUIRED_WITH_LANE_A`

| Requirement | Existing state | Current evidence | Planned implementation boundary | Planned file(s) | Future unit | Validation | Expected evidence | Blocker |
|---|---|---|---|---|---|---|---|---|
| R001 Canonical order authority | `ALREADY_SATISFIED` | Orders in InsForge; checkout creates canonical order before MP | Keep order ownership in Sales Domain / TX-1 | EXISTING_REUSE `startCheckoutTx` | MULTI-PAY-3/4 | UNIT_TEST + STATIC_INSPECTION | Adapter never inserts catalog-owned order | Lane A checkout TX coordination |
| R002 PSP owns only financial object | `PARTIALLY_SATISFIED` | `payments.provider` + `provider_payment_id`; only MP writes | Adapters persist provider financial objects only | EXISTING_REUSE `payments`; NEW adapter writers | MULTI-PAY-3–6 | CONTRACT_TEST | No catalog writes from adapter | None for MP; Clip/Openpay not present |
| R003 Three active providers | `NOT_IMPLEMENTED` | Only Mercado Pago functions exist | Enablement from server config; no PayPal | NEW provider registry/config | MULTI-PAY-3,7 | UNIT_TEST | Disabled/unknown provider rejected | Account readiness per PSP |
| R004 PayPal dormant | `ALREADY_SATISFIED` | No PayPal code | Keep out of initial adapters | none | MULTI-PAY-3 | STATIC_INSPECTION | No PayPal files/tests/requirements executed | None |
| R005 Additive Mercado Pago | `ALREADY_SATISFIED` | `mp-create-checkout`, `mp-webhook`, Checkout Pro | Wrap; do not replace | EXISTING_REUSE MP functions | MULTI-PAY-4 | UNIT_TEST + existing suite | Existing MP tests still pass | `COORDINATION_REQUIRED_WITH_LANE_A` on checkout WIP |
| R006 Redirect non-authority | `ALREADY_SATISFIED` | PAID only via webhook TX; `get-order-status` is projection | Preserve; apply to Clip/Openpay return URLs | EXISTING_REUSE public-status | MULTI-PAY-4–6 | UNIT_TEST + CONTRACT_TEST | Return/callback cannot mark PAID | None |
| R007 Server-side confirmation | `PARTIALLY_SATISFIED` | MP: signature then GET payment then TX | Same split for Clip GET checkout / Openpay GET charge | NEW verifiers + EXISTING TX | MULTI-PAY-4–6 | CONTRACT_TEST | No domain effect without GET | Clip E2E: OD-041-004 |
| R008 Provider-specific verifier | `PARTIALLY_SATISFIED` | MP x-signature only | Separate Clip (no invented HMAC) and Openpay Basic-ingress verifiers | NEW clip/openpay verifier modules | MULTI-PAY-5,6 | UNIT_TEST | Verifiers do not share crypto/header logic | None for coding mocks |
| R009 Frontend non-authority | `PARTIALLY_SATISFIED` | `validate.ts` FORBIDDEN_CLIENT_MONEY_KEYS; `expected_unit_price_cents` non-authoritative | Keep; adapters take order snapshot only | PROTECTED_LANE_A `validate.ts` | MULTI-PAY-3,7 | UNIT_TEST (existing forbidden-keys) | Frontend amount ignored | `COORDINATION_REQUIRED_WITH_LANE_A` |
| R010 MXN | `ALREADY_SATISFIED` | Checkout currency `'MXN'`; webhook `currencyOk = MXN` | Keep MXN gate for all PSPs | EXISTING_REUSE | MULTI-PAY-3,7 | UNIT_TEST | Non-MXN fail closed | None |
| R011 No PAN/CVV | `PARTIALLY_SATISFIED` | MP hosted Checkout Pro | Clip Redirect + Openpay hosted form; no Transparente | NEW adapters | MULTI-PAY-5,6 | STATIC_INSPECTION + MANUAL_SECURITY_REVIEW | No PAN fields in R2H | Architecture change would be required for Transparente |
| R012 Secrets server-side | `PARTIALLY_SATISFIED` | Deno.env MP secrets; headers redact x-signature | Same for Clip/Openpay; no `VITE_*` admin tokens | CONFIG_ONLY | MULTI-PAY-3,8 | STATIC_INSPECTION | No secret values in repo/logs | Secrets not inspected |
| R013 Order ≠ payment ≠ public | `ALREADY_SATISFIED` | `orders.state`, `payments.normalized_state`, `public-status/mapping.ts` | Do not invent enums | EXISTING_REUSE | MULTI-PAY-3,7 | UNIT_TEST | Unknown maps to UNKNOWN/REQUIRES_ACTION | Future SPEC-032 wording patch is documentary |
| R014 No unauthorized surcharge | `ALREADY_SATISFIED` | Amount from commercial snapshot / order.total_cents | Keep; fees stay finance-side | EXISTING_REUSE | MULTI-PAY-7 | UNIT_TEST | Contractual amount unchanged by PSP fee | None |
| R015 Uncertainty never issues access | `PARTIALLY_SATISFIED` | Webhook mismatch → no PAID; UNKNOWN normalize exists | Apply to Clip/Openpay unknown statuses | EXISTING TX + NEW normalize maps | MULTI-PAY-3,7 | CONTRACT_TEST | UNKNOWN ↛ ticket | None |
| R016 Draft had no impl authority | `ALREADY_SATISFIED` | SPEC-041 now APPROVED; this unit is documentary only | Implementation still needs per-unit human auth | this document | MULTI-PAY-2 | STATIC_INSPECTION | No adapters created in this unit | None |
| R017 Provider selection | `NOT_IMPLEMENTED` | Checkout has no provider field | Server accepts only enabled active set; UX order is OD-041-003 | EXISTING_MODIFY checkout request (later) | MULTI-PAY-3,7 | UNIT_TEST | Unknown/dormant/disabled fail closed | OD-041-003 does not block backend set |
| R018 Hosted/redirected v1 | `PARTIALLY_SATISFIED` | MP Checkout Pro only | Clip Redirect; Openpay hosted MX mechanism | NEW Clip/Openpay createCheckout | MULTI-PAY-5,6 | CONTRACT_TEST | No PAN capture path | Clip test-mode `KNOWN_MISSING` |
| R019 Minimal PaymentProvider ops | `NOT_IMPLEMENTED` | docs/05 name only; MP types are concrete | Conceptual ops only; no frozen TS unless later unit decides | NEW_FILE shared payments contract | MULTI-PAY-3 | UNIT_TEST mocks | createCheckout / verifyEvent / getPayment / normalizeStatus | Do not merge verifyEvent with getPayment |
| R020 MP first-provider preservation | `ALREADY_SATISFIED` | Full Checkout Pro + webhook path | Wrap in MULTI-PAY-4 | EXISTING_REUSE | MULTI-PAY-4 | existing UNIT_TEST + CONTRACT_TEST | No MP behavioral regression | Lane A checkout WIP |
| R021 Clip Redirect + GET | `NOT_IMPLEMENTED` | No Clip code | create link; webhook handle; GET `/checkout/{id}`; no HMAC invention | NEW clip adapter + clip-webhook sibling | MULTI-PAY-5 | MOCK_PROVIDER_TEST; SANDBOX_E2E not promised | Contract tests pass; E2E `BLOCKED_BY_TEST_STRATEGY` | OD-041-004; test-mode `KNOWN_MISSING` |
| R022 Openpay hosted + GET | `NOT_IMPLEMENTED` | No Openpay code | Hosted no-PAN; MX `confirm=false`+`redirect_url` current mechanism; Basic ingress ≠ GET charge; no Colombia `/checkouts` | NEW openpay adapter + openpay-webhook | MULTI-PAY-6 | MOCK_PROVIDER_TEST + SANDBOX_E2E if account ready | Basic auth not treated as PAID | Account UNKNOWN |
| R023 Snapshot amount/currency to PSP | `PARTIALLY_SATISFIED` | MP preference from order snapshot | Same for Clip/Openpay createCheckout input (R044) | EXISTING_REUSE snapshot; NEW adapters | MULTI-PAY-3–6 | UNIT_TEST | PSP amount = order snapshot | Lane A staged-pricing |
| R024 Correlation before PAID | `PARTIALLY_SATISFIED` | MP: collector, live_mode, external_reference, amount, currency in TX | Same gates per provider GET object | EXISTING TX + NEW mappings | MULTI-PAY-4–7 | CONTRACT_TEST | Mismatch fail closed, no ticket | None |
| R025 Provider transaction identity | `ALREADY_SATISFIED` (schema) | Unique `(provider, provider_payment_id)` | Reuse; no new enum; later migration only if Clip/Openpay ids need extra columns | EXISTING_REUSE index; `MIGRATION_REQUIRED_LATER` only if proven | MULTI-PAY-3,5,6 | INTEGRATION_TEST | Duplicate id cannot bind two orders | Do not design migration now |
| R026 Repeated checkout | `ALREADY_SATISFIED` | `idempotency.ts` + `startCheckoutTx` replay | Keep; key must not include SKU schedule except as already in order identity | EXISTING_REUSE | MULTI-PAY-3,7 | UNIT_TEST (checkout-start) | Double-click replays same destination | Lane A orchestrate |
| R027 Repeat events/callbacks/lookups | `PARTIALLY_SATISFIED` | Webhook unique notification + replay; return URL not a writer | Clip/Openpay retries same | EXISTING webhook uniqueness + NEW ingress | MULTI-PAY-5–7 | CONTRACT_TEST | Duplicate event effect-free | None |
| R028 Duplicate financial application | `ALREADY_SATISFIED` | Unique payment id + TX ALREADY_PAID | Keep | EXISTING RPC | MULTI-PAY-7 | INTEGRATION_TEST | One payment ↛ two orders | None |
| R029 Duplicate registration/ticket/capacity | `PARTIALLY_SATISFIED` | TX converts hold once; 0008 tickets gated on PAID/PAYMENT_CONFIRMED | Keep single post-payment path | EXISTING RPC / ticket helper | MULTI-PAY-7 | INTEGRATION_TEST | No double ticket/capacity | Lane A commercial TX patches |
| R030 Distinct webhook ingress | `PARTIALLY_SATISFIED` | `mp-webhook` only | Keep `mp-webhook`; add sibling functions; no aesthetic common router required | NEW `clip-webhook`, `openpay-webhook` | MULTI-PAY-5,6 | CONTRACT_TEST | Distinct authenticity | Path names OD-041-006 non-blocking |
| R031 Normalize to existing literals | `PARTIALLY_SATISFIED` | MP map in `normalize.ts`; unknown → UNKNOWN | Add Clip/Openpay maps; do not invent enums | EXISTING_MODIFY normalize (extract MP map) | MULTI-PAY-3,5,6 | UNIT_TEST | Unlisted → UNKNOWN | None |
| R032 Order transitions | `ALREADY_SATISFIED` | PREFERENCE_PENDING / PAYMENT_PENDING / PAID reused | Clip/Openpay reuse names; no enum replacement | EXISTING_REUSE | MULTI-PAY-3 | STATIC_INSPECTION | No new order literals | Optional future SPEC-032 wording patch |
| R033 MSI boundary | `PARTIALLY_SATISFIED` | MP `payment-policy.ts` from commercial `msi_eligible`; Clip/Openpay not coded | Do not copy MP policy; Clip/Openpay financing remain fail-closed/off until OD | PROTECTED_LANE_A payment-policy for MP | MULTI-PAY-4–6 | UNIT_TEST | Clip/Openpay MSI not silently enabled | OD-041-001, OD-041-002 |
| R034 Timeouts/unavailability | `PARTIALLY_SATISFIED` | MP create failure → `compensatePreferenceFailure`; webhook PROVIDER_UNAVAILABLE | Same for Clip/Openpay create/GET | EXISTING compensate + NEW adapters | MULTI-PAY-5–7 | UNIT_TEST | Outage ↛ PAID | None |
| R035 Reconciliation uncertainty | `ALREADY_SATISFIED` | REQUIRES_REVIEW / mismatch outcomes in TX | Keep | EXISTING RPC | MULTI-PAY-7 | CONTRACT_TEST | Ambiguity ↛ ticket | None |
| R036 Refund recognize ≠ execute | `PARTIALLY_SATISFIED` | Normalize REFUNDED/CHARGED_BACK; no multi-PSP refund API | Do not plan refund execution | none for refund POST | POST_GO_LIVE / SEPARATE CONTRACT | UNIT_TEST map only | Recognition without initiate-refund | OD-041-007 |
| R037 Environment isolation | `PARTIALLY_SATISFIED` | MP live_mode vs expected; distinct token/secret | Clip Redirect test-mode `KNOWN_MISSING`; Openpay sandbox URI capability exists | CONFIG_ONLY | MULTI-PAY-5,6,8 | CONFIGURATION_REVIEW | No env mix | OD-041-004, OD-041-005 |
| R038 Server-side config | `PARTIALLY_SATISFIED` | `loadCheckoutRuntimeConfig` / webhook config | Add enabled flags + Clip/Openpay refs; names TBD | CONFIG_ONLY | MULTI-PAY-3,8 | STATIC_INSPECTION | Frontend has no secrets | Account not inspected |
| R039 No speculative extra PSPs | `ALREADY_SATISFIED` | Only MP | Do not add PayPal/other | none | MULTI-PAY-3 | STATIC_INSPECTION | Three actives only | None |
| R040 Audit minimum | `PARTIALLY_SATISFIED` | webhook_events + payment_verification_records; redacted headers | Extend actor/provider/outcome fields if missing at impl time | EXISTING_REUSE; `MIGRATION_REQUIRED_LATER` if gap proven | MULTI-PAY-3,7 | STATIC_INSPECTION | No PAN/secrets in audit | Do not design schema now |
| R041 Bounded calls / fast ack | `PARTIALLY_SATISFIED` | MP webhook returns 200; GET then TX in-request | Keep ack-vs-effect split per PSP retry policy | NEW ingress | MULTI-PAY-5–7 | CONTRACT_TEST | Ingress 200 without implying PAID | Provider retry differences |
| R042 Expiry ≠ paid | `ALREADY_SATISFIED` | SPEC-040 expiry function; PAID immune | Clip EXPIRED / Openpay failed → not PAID | EXISTING expiry + NEW maps | MULTI-PAY-5–7 | UNIT_TEST | Expired checkout ↛ PAID | None |
| R043 PAYMENT_ELIGIBLE gate | `COORDINATION_REQUIRED_WITH_LANE_A` | Sales checks exist (`assertSalesOpen`, sellable, eligibility, pricing) but no named `PAYMENT_ELIGIBLE` mark | Sales Domain marks/equivalent before Multi-Pay createCheckout | PROTECTED_LANE_A sales/orchestrate | MULTI-PAY-3,7 | UNIT_TEST | Non-eligible order cannot create PSP checkout | Lane A commercial contract WIP |
| R044 Adapter input from resolved order | `NOT_IMPLEMENTED` | Orchestrate still resolves catalog then calls MP directly | createCheckout receives order_id, provider, amount, currency, safe ref, return metadata | NEW orchestration seam | MULTI-PAY-3 | CONTRACT_TEST | Adapter has no SKU/price authority | Lane A orchestrate |
| R045 Edition-independent adapters | `PARTIALLY_SATISFIED` | Payment tables are catalog-agnostic; `journeys.ts` is sales-side | Adapters must not encode SKU counts/days/prizes | NEW adapters + keep catalog in Sales Domain | MULTI-PAY-3,5,6 | STATIC_INSPECTION | No 23-SKU / retired-set / prize in adapters | Lane A catalog reconciliation OD-041-008 |

No requirement omitted. SPEC-000 chain mapping: Source = SPEC-041; Implementation = current evidence + planned boundary; State = Existing state column.

## I. Acceptance traceability (SPEC-041-AC001 … AC028)

| AC | Requirements | Validation type | Future unit | Environment/account dependency | Expected evidence |
|---|---|---|---|---|---|
| AC001 Canonical order authority | R001, R002, R009, R023, R043, R044 | UNIT_TEST + STATIC_INSPECTION | MULTI-PAY-3,7 | none | Adapter/PSP cannot own catalog or price |
| AC002 Enabled active providers only | R003, R004, R017, R039 | UNIT_TEST | MULTI-PAY-3,7 | config flags | Unknown/PayPal/disabled rejected |
| AC003 Frontend cannot set price/currency | R009, R010, R023, R044 | UNIT_TEST (existing forbidden-keys) | MULTI-PAY-3 | Lane A validate.ts | Amount/currency from order snapshot |
| AC004 Redirect cannot mark paid | R006, R007, R015 | UNIT_TEST + CONTRACT_TEST | MULTI-PAY-4–7 | none | Return URL has no PAID writer |
| AC005 Provider-specific verifiers | R008, R020, R021, R022, R030 | UNIT_TEST | MULTI-PAY-4–6 | none | Distinct MP/Clip/Openpay authenticity |
| AC006 Server verification before confirm | R007, R020, R021, R022 | CONTRACT_TEST | MULTI-PAY-4–6 | MP sandbox known; Clip E2E blocked; Openpay sandbox if account | GET before domain TX |
| AC007 Amount mismatch fail closed | R024, R015 | UNIT_TEST + CONTRACT_TEST | MULTI-PAY-7 | none | No ticket |
| AC008 Currency mismatch fail closed | R010, R024, R015 | UNIT_TEST | MULTI-PAY-7 | none | Non-MXN / mismatch ↛ PAID |
| AC009 Unknown order fail closed | R024, R015, R025 | CONTRACT_TEST | MULTI-PAY-7 | none | Uncorrelated GET ↛ access |
| AC010 Duplicate checkout or event | R026, R027, R028, R029 | UNIT_TEST + CONTRACT_TEST | MULTI-PAY-7 | none | Effectively-once |
| AC011 Repeated callback | R006, R027 | UNIT_TEST | MULTI-PAY-7 | none | Callback inert |
| AC012 Duplicate ticket/registration | R029, R015 | INTEGRATION_TEST | MULTI-PAY-7 | local DB | No second issuance |
| AC013 Capacity not double-decremented | R029 | INTEGRATION_TEST | MULTI-PAY-7 | local DB | Hold convert once |
| AC014 Outage ↛ PAID | R034, R015 | UNIT_TEST | MULTI-PAY-5–7 | none | Named non-payable state |
| AC015 Malformed event inert | R008, R015 | UNIT_TEST | MULTI-PAY-5–7 | none | No business mutation |
| AC016 Secrets server-side | R012, R038 | STATIC_INSPECTION | MULTI-PAY-3,8 | secrets not read here | No VITE admin tokens; no secret values in repo |
| AC017 No PAN/CVV | R011, R018 | STATIC_INSPECTION + MANUAL_SECURITY_REVIEW | MULTI-PAY-5,6 | none | Hosted/redirected only |
| AC018 Sandbox/prod isolation | R037, R038 | CONFIGURATION_REVIEW | MULTI-PAY-5,8 | Clip Redirect test-mode `KNOWN_MISSING` | No env mix; Transparente not fallback |
| AC019 Status not collapsed | R013, R031, R032 | UNIT_TEST | MULTI-PAY-3,7 | none | Existing literals only |
| AC020 Shared core, different verifiers | R008, R018–R022 | CONTRACT_TEST + MOCK_PROVIDER_TEST | MULTI-PAY-3 | none | Mocks for three providers |
| AC021 No PayPal v1 | R004, R039 | STATIC_INSPECTION | MULTI-PAY-3 | none | No PayPal adapter |
| AC022 Clip/Openpay MSI open | R033 | STATIC_INSPECTION + UNIT_TEST | MULTI-PAY-5,6 | OD-041-001/002 | Financing off/fail-closed until policy |
| AC023 No surcharge | R014 | UNIT_TEST | MULTI-PAY-7 | none | Order amount unchanged |
| AC024 Uncertain ↛ ticket | R015, R035 | CONTRACT_TEST | MULTI-PAY-7 | none | REQUIRES_REVIEW / fail closed |
| AC025 Audit without secrets | R040, R012 | STATIC_INSPECTION | MULTI-PAY-7 | none | Redacted evidence |
| AC026 MP remains wrappable | R005, R016, R020 | existing UNIT_TEST suite | MULTI-PAY-4 | MP test credentials historically used; not re-certified here | No Checkout Pro rewrite |
| AC027 PAYMENT_ELIGIBLE only | R043, R044, R045 | UNIT_TEST + STATIC_INSPECTION | MULTI-PAY-3,7 | Lane A sales domain | No catalog MUST in adapters |
| AC028 Edition-reusable | R045 | STATIC_INSPECTION | MULTI-PAY-3,5,6 | OD-041-008 catalog | Adapters survive sales-domain edition change |

No AC omitted.

## J. Critical cross-cutting matrix

| Concern | Current owner | Future implementation owner | Validation owner |
|---|---|---|---|
| CANONICAL ORDER AUTHORITY | checkout TX / InsForge orders | Sales Domain (unchanged) | MULTI-PAY-3 unit tests |
| PAYMENT_ELIGIBLE | implicit sales asserts (no named mark) | Sales Domain; Multi-Pay consumes | MULTI-PAY-3/7; Lane A coord |
| PROVIDER SELECTION | none (MP implicit) | Multi-Pay orchestration + server enablement | MULTI-PAY-3/7 |
| SERVER-SIDE FINANCIAL RESOLUTION | `mercadopago/payments.ts` GET | per-adapter getPayment | MULTI-PAY-4–6 |
| REDIRECT NON-AUTHORITY | webhook TX + public-status | same + Clip/Openpay returns | MULTI-PAY-4–7 |
| AMOUNT | order snapshot + webhook TX | adapters pass snapshot; TX compares GET | MULTI-PAY-7 |
| CURRENCY | hardcoded/checked MXN | same gate all PSPs | MULTI-PAY-7 |
| CORRELATION | `external_reference` / order id | per-provider mapping onto existing fields | MULTI-PAY-5–7 |
| STATUS NORMALIZATION | `webhook/normalize.ts` (MP) | extracted maps per PSP | MULTI-PAY-3,5,6 |
| IDEMPOTENCY | checkout key + webhook unique + payment unique | reuse; no SKU schedule key | MULTI-PAY-7 |
| TICKET EFFECTIVELY-ONCE | `webhook_apply_payment_tx` + 0008 | same canonical path | MULTI-PAY-7 |
| REGISTRATION EFFECTIVELY-ONCE | same RPC | same | MULTI-PAY-7 |
| CAPACITY EFFECTIVELY-ONCE | hold CONVERTED in RPC | same | MULTI-PAY-7 |
| AUDIT | webhook_events / verification records | extend without secrets | MULTI-PAY-7 |
| SECRETS | Deno.env MP | server-side Clip/Openpay refs | MULTI-PAY-8 |
| SANDBOX/PRODUCTION | MP live_mode | per-PSP env isolation | MULTI-PAY-5,8 |
| REFUNDS | normalize REFUNDED/CHARGED_BACK | recognize only | POST_GO_LIVE |

## K. Future file plan

Exact TypeScript signatures are **not** frozen. Paths are planning boundaries.

| Path | Class | Purpose | SPEC-041 | Future unit | Risk | Validation |
|---|---|---|---|---|---|---|
| `insforge/functions/_shared/payments/` (contract module) | NEW_FILE | Minimal createCheckout / verifyEvent / getPayment / normalizeStatus ownership | R019, R008 | MULTI-PAY-3 | Over-abstraction | UNIT_TEST mocks |
| `insforge/functions/_shared/webhook/normalize.ts` | EXISTING_MODIFY | Extract MP map; add Clip/Openpay maps; keep literals | R031 | MULTI-PAY-3,5,6 | Mixing webhook aliases vs GET names | UNIT_TEST |
| `insforge/functions/_shared/mercadopago/*` | EXISTING_REUSE | Keep MP GET + x-signature | R020 | MULTI-PAY-4 | Regression | existing tests |
| `insforge/functions/_shared/checkout/mp-client.ts` | EXISTING_REUSE / PROTECTED_LANE_A | Wrap as MP createCheckout | R018, R020, R033 | MULTI-PAY-4 | Lane A MSI/payment-methods WIP | existing mp-client tests |
| `insforge/functions/_shared/checkout/orchestrate.ts` | EXISTING_MODIFY / PROTECTED_LANE_A | After PAYMENT_ELIGIBLE order, dispatch provider | R017, R043, R044 | MULTI-PAY-3,4 | **Lane A collision** | UNIT_TEST |
| `insforge/functions/_shared/checkout/sales.ts` `eligibility.ts` `validate.ts` `pricing.ts` `staged-pricing.ts` `journeys.ts` `payment-policy.ts` | PROTECTED_LANE_A | Remain Sales Domain; not PSP adapters | R009, R033, R043 | later coord | Do not move catalog into adapters | existing checkout tests |
| `insforge/functions/mp-create-checkout/` | EXISTING_REUSE | Keep name; may call shared orchestration | R005, R020 | MULTI-PAY-4 | Lane A handler.deploy.js | origin + checkout tests |
| `insforge/functions/mp-webhook/` | EXISTING_REUSE | Keep MP ingress | R030, R020 | MULTI-PAY-4 | none for rename | webhook unit tests |
| `insforge/functions/clip-create-checkout/` (or shared create + provider param) | NEW_FILE | Checkout Redirect create | R021 | MULTI-PAY-5 | test-mode missing | MOCK_PROVIDER_TEST |
| `insforge/functions/clip-webhook/` | NEW_FILE | Clip event ingress sibling | R021, R030 | MULTI-PAY-5 | no HMAC to invent | UNIT_TEST |
| `insforge/functions/_shared/clip/` | NEW_FILE | GET checkout + status map | R021, R031 | MULTI-PAY-5 | GET vs webhook status aliases | UNIT_TEST |
| `insforge/functions/openpay-create-checkout/` | NEW_FILE | MX hosted charge current mechanism | R022 | MULTI-PAY-6 | over-coupling to confirm=false | MOCK + optional SANDBOX_E2E |
| `insforge/functions/openpay-webhook/` | NEW_FILE | Basic ingress only | R022, R030 | MULTI-PAY-6 | Basic ≠ financial truth | UNIT_TEST |
| `insforge/functions/_shared/openpay/` | NEW_FILE | GET charge | R022 | MULTI-PAY-6 | no Colombia /checkouts | CONTRACT_TEST |
| `insforge/functions/_shared/webhook/orchestrate.ts` | EXISTING_MODIFY | Keep MP orchestrator; do not generic-verifyEvent | R007, R008 | MULTI-PAY-4 | merging authenticity+finance | existing webhook tests |
| `webhook_apply_payment_tx` (SQL) | EXISTING_REUSE | Canonical post-payment | R028, R029, R032 | MULTI-PAY-7 | Lane A 0018 copies of TX | INTEGRATION_TEST |
| `payments` / unique indexes | EXISTING_REUSE | Identity | R025 | MULTI-PAY-3 | extra columns unknown | STATIC_INSPECTION |
| possible later migration | POSSIBLE_MIGRATION | Only if proven id/metadata gap | R025, R040 | later unit | do not author now | n/a |
| `tests/unit/payments/*` | TEST_FILE | Common contract mocks | AC002, AC007–AC011, AC020 | MULTI-PAY-3,7 | none | UNIT_TEST |
| `tests/unit/clip/*` `tests/unit/openpay/*` | TEST_FILE | Provider maps + verifiers | R021, R022 | MULTI-PAY-5,6 | promising sandbox E2E | MOCK_PROVIDER_TEST |
| existing `tests/unit/checkout/*` `tests/unit/webhook/*` | TEST_FILE / PROTECTED_LANE_A | Preserve MP | R020, R026 | MULTI-PAY-4 | Lane A dirty tests | regression |
| server config / secrets refs | CONFIG_ONLY | enablement + env isolation | R037, R038 | MULTI-PAY-3,8 | names TBD | CONFIGURATION_REVIEW |
| landing provider UX | PROTECTED_LANE_A / later | OD-041-003 | R017 | not initial backend | steering undecided | n/a this unit |

## L. Future implementation units

Sequence retained as given. No autonomous roadmap change.
`SEQUENCE_ADJUSTMENT_RECOMMENDED`: none. MULTI-PAY-4 wrapping existing MP after MULTI-PAY-3 mocks is the least-risk order.

### MULTI-PAY-3 — Provider abstraction / mocks

| Field | Value |
|---|---|
| Scope | Minimal contract + mocks; PAYMENT_ELIGIBLE consumption; unknown provider fail-closed; no PSP writes |
| Out of scope | Real Clip/Openpay HTTP; production; Lane A catalog rewrite |
| Entry | Project Owner authorization after this traceability |
| Exit | Provider contract implemented; mocks exist; no provider writes; existing MP tests not regressed |
| Current state | `IMPLEMENTED — abstraction/mocks/contract tests only; no PSP integration` |

### MULTI-PAY-4 — Mercado Pago adapter

| Field | Value |
|---|---|
| Scope | Wrap existing Checkout Pro create + x-signature + GET payment + normalize |
| Out of scope | Rewriting TX-2; changing MP MSI policy |
| Exit | Adapter passes existing + contract tests; redirect still non-authoritative |
| Coordination | `COORDINATION_REQUIRED_WITH_LANE_A` on checkout orchestrate/mp-client |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### MULTI-PAY-5 — Clip adapter + controlled test strategy

| Field | Value |
|---|---|
| Product | Checkout Redirect only |
| Flag | `TEST_STRATEGY / UNIT NAMING REVIEW REQUIRED` before execution (official Redirect sandbox unavailable) |
| Out of scope | Checkout Transparente; invented HMAC; promising sandbox E2E |
| Exit | Adapter contract complete; hosted create+GET; evidence per **separately approved** OD-041-004 strategy |
| E2E | `BLOCKED_BY_TEST_STRATEGY` until OD-041-004 |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### MULTI-PAY-6 — Openpay adapter + sandbox

| Field | Value |
|---|---|
| Product | Hosted/redirected no-PAN; current MX mechanism `confirm=false` + `redirect_url` |
| Out of scope | Colombia `/checkouts`; treating Basic auth as PAID; MSI policy |
| Exit | Adapter; webhook Basic vs GET charge verified; sandbox E2E if account ready else mocks only |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### MULTI-PAY-7 — Multi-provider integration tests

| Field | Value |
|---|---|
| Scope | Selection, normalization, idempotency, common post-payment path, failure matrix, MP regression |
| Exit | Common contract tests pass; no double ticket/registration/capacity |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### MULTI-PAY-8 — Controlled production readiness

| Field | Value |
|---|---|
| Scope | Account/secret/callback/webhook readiness; controlled E2E; human production authorization |
| Out of scope | Silent provider enablement; SALES_STATUS=OPEN; this unit’s execution |
| Exit | Human production authorization still required after evidence |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

Refund execution remains `POST_GO_LIVE / SEPARATE CONTRACT` (not MULTI-PAY-3–8).

## M. Test plan (designed, not executed)

### Common contract (MULTI-PAY-3/7)

- disabled/unknown provider rejected
- only PAYMENT_ELIGIBLE (or sales-domain equivalent) canonical order enters Multi-Pay
- amount and currency from canonical order
- redirect/return/callback cannot create PAID
- UNKNOWN cannot create PAID / ticket / capacity convert
- amount mismatch fail closed
- currency mismatch fail closed
- unknown order fail closed
- duplicate event effectively-once
- duplicate callback no business effect
- duplicate payment no duplicate ticket/registration/capacity

### Mercado Pago (MULTI-PAY-4)

- Preserve `tests/unit/checkout/checkout-start.test.ts`, webhook signature/orchestrate/verification-order, mp-client payment-methods
- Add adapter contract tests without rewriting Checkout Pro

### Clip (MULTI-PAY-5)

- Mocks/contract tests for create + GET statuses (`CHECKOUT_*` and short aliases)
- Webhook body is handle only
- **Do not promise** Checkout Redirect sandbox E2E
- Real integration evidence: `BLOCKED_BY_TEST_STRATEGY` until OD-041-004

### Openpay (MULTI-PAY-6)

- Mocks: hosted create, Basic ingress rejected-as-finance, GET charge
- Sandbox E2E later if account readiness permits
- No Colombia checkout resource tests as MX contract

## N. Security traceability

| Control | Implementation control (future) | Validation method |
|---|---|---|
| No PAN / CVV | Hosted/redirected only; no Transparente | STATIC_INSPECTION + MANUAL_SECURITY_REVIEW |
| Hosted/redirected | MP Pro; Clip Redirect; Openpay hosted MX | CONTRACT_TEST |
| Secrets server-side | Deno.env / platform secrets; never frontend | STATIC_INSPECTION |
| No frontend secrets | No `VITE_*` admin/PSP tokens | STATIC_INSPECTION |
| No raw secret logging | Continue x-signature redaction; same for new verifiers | UNIT_TEST + STATIC_INSPECTION |
| Sandbox/prod separation | Existing MP live_mode; per-PSP env | CONFIGURATION_REVIEW |
| Provider-specific verifier | Separate modules | UNIT_TEST |
| Fail closed | Existing TX + new maps to UNKNOWN | CONTRACT_TEST |
| Amount/currency/correlation | TX gates reused | CONTRACT_TEST |
| No unauthorized surcharge | Snapshot amount only | UNIT_TEST |

This unit displayed **no secret values**.

## O. Idempotency traceability

| Scenario | Current evidence | Future |
|---|---|---|
| Repeated checkout / double click | `idempotency.ts` + startCheckoutTx replay | reuse (R026) |
| Duplicate webhook / provider event / retry | unique `(provider, provider_notification_id)` + replay | per-PSP notification id |
| Repeated callback / return URL | not a PAID writer (`get-order-status` projection) | keep non-authoritative |
| Repeated provider lookup | GET then TX idempotent | same |
| Duplicate transaction application | unique `(provider, provider_payment_id)` + ALREADY_PAID | reuse |
| Duplicate registration / ticket / entitlement / capacity | RPC once + ticket helper gated on PAID | keep centralized path |

No catalog/schedule idempotency key. Schema change: `MIGRATION_REQUIRED_LATER` only if a later unit proves Clip/Openpay identity cannot fit existing columns. Not designed here.

## P. Provider-specific blockers

### MERCADO_PAGO

| Dimension | State |
|---|---|
| Public capability | Checkout Pro documented and implemented |
| Account readiness | `UNKNOWN` (not re-inspected; historical sandbox E2E exists as prior evidence, not recertified) |
| Environment | Test vs production credentials distinguished in code via live_mode / distinct tokens |
| Implementation | `PARTIALLY_SATISFIED` / wrappable |
| Production enablement | `UNKNOWN` / not authorized by SPEC-041 approval |

### CLIP

| Dimension | State |
|---|---|
| Public capability | Checkout Redirect documented |
| Checkout Redirect test-mode | `KNOWN_MISSING` (SPEC-041 R037) |
| Project credentials | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` (not inspected) |
| Production enablement | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` |
| Transparente fallback | **Not authorized** |
| Hosted E2E evidence | `BLOCKED_BY_TEST_STRATEGY` (OD-041-004) |
| Unit naming | `TEST_STRATEGY / UNIT NAMING REVIEW REQUIRED` before MULTI-PAY-5 execution |

### OPENPAY

| Dimension | State |
|---|---|
| Public capability | MX hosted/redirected via current Charges `confirm=false` + `redirect_url` |
| Sandbox API | Environment capability documented (`sandbox-api.openpay.mx`) |
| Account / keys | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` |
| Production enablement | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` |
| Colombia `/checkouts` | Not in MX contract |
| MSI | Charges PaymentPlan capability only; policy OPEN |

## Q. Lane A coordination points

Every expected future overlap with protected relaunch WIP:

| Path / area | Why Multi-Pay may touch later | Rule now |
|---|---|---|
| `orchestrate.ts` | Dispatch provider after sales snapshot | `COORDINATION_REQUIRED_WITH_LANE_A` |
| `sales.ts` / `eligibility.ts` / `journeys.ts` | PAYMENT_ELIGIBLE equivalent | Do not move into adapters |
| `validate.ts` | Optional provider field later | Keep money-key forbid list |
| `mp-client.ts` / `payment-policy.ts` | MP wrap + MSI | Do not copy MSI to Clip/Openpay |
| `staged-pricing.ts` / `pricing.ts` | Amount authority snapshot | Sales Domain only |
| `mp-create-checkout/index.ts` `handler.deploy.js` | Entry remains MP function | Wrap, don’t replace |
| checkout unit tests | Regression | Preserve |
| `0017*` `0018*` `0019*` / webhook TX copies | Post-payment RPC | Reuse committed TX; do not own relaunch SQL |
| `holding/` / landing | Provider UX / catalog | OD-041-003, OD-041-008 |
| `WORKSPACE_STATUS.md` | Status reporting | Not updated by this unit |
| SPEC-030/031/032 working copies | Future patch MAY generalize MP-only destination wording | Not modified here |

## R. Open decisions impact

| OD | Affects unit | Blocks coding? | Blocks provider E2E? | Blocks production? |
|---|---|---|---|---|
| OD-041-001 Clip MSI | MULTI-PAY-5 | No (default financing off/fail-closed) | No for hosted without MSI | Yes for Clip financing offer |
| OD-041-002 Openpay MSI | MULTI-PAY-6 | No (Charges PaymentPlan not auto-enabled) | No for hosted without plan | Yes for Openpay financing offer |
| OD-041-003 Provider UX | landing / MULTI-PAY-7 | No for backend enablement set | No | No (steering only) |
| OD-041-004 Clip test strategy | MULTI-PAY-5,8 | No for mocks/contract | **Yes — Clip hosted E2E** | Indirectly if production evidence required |
| OD-041-005 Production enablement | MULTI-PAY-8 | No | Yes for prod E2E | **Yes** |
| OD-041-006 Webhook paths | MULTI-PAY-5,6 | No (`mp-webhook` retained; siblings TBD) | No | No |
| OD-041-007 Refund execution | post-go-live | No for initial go-live | No | No for recognize-only |
| OD-041-008 Landing Master reconciliation | Sales Domain / Lane A | **Yes for using unreconciled catalog in Multi-Pay** | No for adapter contract | Yes if catalog still unreconciled |

## S. Implementation gates (not executed)

| Unit | Exit gate meaning |
|---|---|
| MULTI-PAY-3 | Contract + mocks; no provider writes; MP not regressed |
| MULTI-PAY-4 | MP adapter + existing tests; redirect non-authoritative |
| MULTI-PAY-5 | Clip Redirect adapter; evidence per approved test strategy; no Transparente |
| MULTI-PAY-6 | Openpay hosted adapter; Basic ≠ GET; sandbox if account allows |
| MULTI-PAY-7 | Selection, normalize, idempotency, shared post-payment, failure matrix |
| MULTI-PAY-8 | Account/secret/webhook readiness + human production authorization |

Production remains closed. SPEC-041 approval is not production-ready.

## T. Specification-impact findings

No silent spec change. Documentary impacts already recorded in SPEC-041 §16:

- SPEC-031 **FUTURE PATCH MAY BE REQUIRED** to generalize OP-PUB-04 destination beyond Mercado Pago.
- SPEC-032 **FUTURE PATCH MAY BE REQUIRED** to generalize `PREFERENCE_PENDING` wording.

Inspection did not find an approved requirement that cannot be implemented without changing its meaning. Clip Redirect sandbox absence is already classified `KNOWN_MISSING` in SPEC-041; it constrains **evidence strategy**, not the hosted product requirement.

R043 named mark `PAYMENT_ELIGIBLE` is the code token (`PaymentEligibleMark` / checkout-input). It is a sales-domain consumption marker, not proof that Sales Domain validation ran, and not a product-table column. Introducing a literal column would be a later coordinated choice, not a SPEC-041 rewrite.

## U. Change log (this artifact)

| Version | Date | Actor | Reason |
|---|---|---|---|
| 0.1.0 | 2026-08-22 | Cursor (MULTI-PAY-2) | Record implementation traceability after SPEC-041 approval. No code. |
| 0.1.1 | 2026-08-23 | Cursor (MULTI-PAY-3) | Append MULTI-PAY-3 evidence. Plan sequence unchanged. No SPEC-041 edit. |
| 0.1.2 | 2026-08-23 | Cursor (MULTI-PAY-3C) | Record review-finding corrections. In-memory event gate is test/mock-only; R027 remains PARTIAL_FOUNDATION_ONLY. F-MP3-003 not reproducible. No SPEC-041 edit. |
| 0.1.3 | 2026-08-23 | Cursor (MULTI-PAY-4) | Record Mercado Pago adapter wrap. Runtime wiring BLOCKED_BY_LANE_A. No SPEC-041 edit. OD-041-001…008 unchanged. |
| 0.1.4 | 2026-08-23 | Cursor (MULTI-PAY-5) | Record Clip Checkout Redirect adapter. No runtime enablement. OD-041-001 and OD-041-004 remain OPEN. No SPEC-041 edit. |

## V. MULTI-PAY-3 implementation evidence (2026-08-23)

Project Owner authorization received:

```text
APRUEBO MULTI-PAY-3 — PROVIDER ABSTRACTION / MOCKS.
```

This appendix records evidence only. It does **not** rewrite the MULTI-PAY-2 plan,
authorize MULTI-PAY-4, wrap Mercado Pago, implement Clip/Openpay networks,
enable providers, or change SPEC-041.

### Files (NEW_FILE / TEST_FILE)

| Path | Class | Purpose |
|---|---|---|
| `insforge/functions/_shared/payments/` | NEW_FILE | Minimal three-provider contract |
| `insforge/functions/_shared/payments/mocks/in-memory-adapter.ts` | NEW_FILE | Deterministic in-memory mocks |
| `tests/unit/payments/*.test.ts` | TEST_FILE | Contract / fail-closed / static inspection |

No Lane A, MP production, SQL, migration, or SPEC-041 files were modified for this unit.

### Validation executed

```text
npx vitest run tests/unit/payments
  3 files, 24 passed

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 passed

npx oxlint insforge/functions/_shared/payments tests/unit/payments
  exit 0
```

MULTI-PAY-4 remains `NOT AUTHORIZED / NOT STARTED`.

## W. MULTI-PAY-3C review-findings correction (2026-08-23)

Correction of MULTI-PAY-3R `CHANGES_REQUIRED`. Does not start MULTI-PAY-4.

| Finding | Result |
|---|---|
| F-MP3-001 | `createInMemoryEventEffectGate` moved to `mocks/event-gate.ts` and removed from the production payments barrel. In-memory helper is test/mock-only. |
| F-MP3-002 | Empty / whitespace `providerTransactionId` fail closed before `eligible_for_domain_tx`. |
| F-MP3-003 | `NOT_REPRODUCIBLE` — SPEC-041-R043 and code both use `PAYMENT_ELIGIBLE`. No token change. |

R027: MULTI-PAY-3 in-memory event gate is **not** durable effectively-once evidence. Classification for this unit: `PARTIAL_FOUNDATION_ONLY`. Persistent uniqueness remains the existing payments unique index / webhook notification uniqueness / future RPC. No SQL or migration was added.

`PAYMENT_ELIGIBLE` remains a sales-domain mark consumed by Multi-Pay; it is not proof that Sales Domain validation ran.

OD-041-001 … OD-041-008 unchanged. OD-041-004 remains OPEN.

## X. MULTI-PAY-4 implementation evidence (2026-08-23)

Project Owner authorization received:

```text
APRUEBO MULTI-PAY-4 — MERCADO PAGO ADAPTER.
```

This appendix records evidence only. It does **not** rewrite the MULTI-PAY-2
plan, authorize MULTI-PAY-5, implement Clip/Openpay/PayPal, enable providers,
change SALES_STATUS, or edit SPEC-041.

### Files

| Path | Class | Purpose |
|---|---|---|
| `insforge/functions/_shared/payments/mercadopago-adapter.ts` | NEW_FILE | Thin Mercado Pago adapter implementing `PaymentProviderAdapter` |
| `insforge/functions/_shared/payments/storage-mapping.ts` | NEW_FILE | Single owner of `MERCADO_PAGO` ↔ persisted `mercadopago` |
| `insforge/functions/_shared/payments/index.ts` | EXISTING_MODIFY | Barrel export of adapter + mapping; still no mocks |
| `insforge/functions/_shared/payments/types.ts` | EXISTING_MODIFY | Optional MP `x-signature` authenticity fields (`xSignature`, `xRequestId`, `dataId`; secret never included) |
| `tests/unit/payments/mercadopago-adapter.test.ts` | TEST_FILE | Focused adapter / mapping / correspondence tests |

Lane A production files (`checkout/mp-client.ts`, `checkout/orchestrate.ts`, `mp-create-checkout/index.ts`, webhook orchestrate, `0017*`–`0019*`) were **not** modified.

### Runtime wiring

`BLOCKED_BY_LANE_A`

Checkout Pro HTTP lives in dirty `checkout/mp-client.ts`. Adapter consumes a narrow injected `MercadoPagoPreferencePort` and does not import that file. Live entrypoints were not switched.

### Validation executed

```text
npx vitest run tests/unit/payments
  4 files, 46 passed

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 passed

npx oxlint insforge/functions/_shared/payments tests/unit/payments
  exit 0
```

No live Mercado Pago / Clip / Openpay / PayPal API call. No SQL/migration.

OD-041-001 … OD-041-008 unchanged. OD-041-004 remains OPEN.

MULTI-PAY-5 later authorized; see appendix Y.

## Y. MULTI-PAY-5 implementation evidence (2026-08-23)

Project Owner authorization received:

```text
APRUEBO MULTI-PAY-5 — CLIP ADAPTER.
```

This appendix records evidence only. It does **not** rewrite the MULTI-PAY-2
plan, authorize MULTI-PAY-6, implement Openpay/PayPal, enable Clip in
production, change SALES_STATUS, or edit SPEC-041.

Official product used: Clip Checkout Redirect API v2.
Create: `POST {base}/v2/checkout`. GET: `GET {base}/v2/checkout/{payment_request_id}`.
Default host in client: `https://api.payclip.com`. Tests inject fetch; no live call.

Clip Redirect sandbox capability: `KNOWN_MISSING` (not on Clip's official test-mode list).
`CLIP_REDIRECT_E2E = BLOCKED_BY_TEST_STRATEGY`. OD-041-004 remains OPEN.

Account API access: `UNKNOWN` (service contracted per Project Owner; no authenticated probe).

Storage: `payments.provider` is unconstrained `text`. Mapping `CLIP` ↔ `clip` is
`STORAGE_MAPPING_SAFE`. No migration.

Expiry: optional provider-neutral `expiresAt` added to
`ResolvedPaymentCheckoutInput`. Clip `createCheckout` requires it and forwards
`expires_at`. Lane A must populate the canonical hold/order expiry before runtime
use. Clip remains `NOT_RUNTIME_READY` until that wiring exists.

Webhook: Checkout Webhook structural validation only (`event_handle`).
No invented HMAC. `financialAuthority = false`. Authoritative state is GET.

`receipt_no` is the completed financial transaction identity from GET.
Missing `receipt_no` on `CHECKOUT_COMPLETED` fails closed.

MSI (`installments_msi`) is not configured. Tips (`tip_enabled: false`).
OD-041-001 remains OPEN.

Runtime enablement: Clip adapter is registerable in tests. Production flags
unchanged. `RUNTIME_ENABLED_PROVIDER = NO`.

### Files

| Path | Class | Purpose |
|---|---|---|
| `insforge/functions/_shared/clip/money.ts` | NEW_FILE | Cents ↔ Clip decimal conversion |
| `insforge/functions/_shared/clip/status.ts` | NEW_FILE | SPEC-041-R031 Clip GET status map |
| `insforge/functions/_shared/clip/types.ts` | NEW_FILE | Checkout Redirect v2 request/response types |
| `insforge/functions/_shared/clip/checkout-client.ts` | NEW_FILE | Injected-fetch POST/GET client |
| `insforge/functions/_shared/payments/clip-adapter.ts` | NEW_FILE | `PaymentProviderAdapter` for CLIP |
| `insforge/functions/_shared/payments/storage-mapping.ts` | EXISTING_MODIFY | `CLIP` ↔ `clip` |
| `insforge/functions/_shared/payments/types.ts` | EXISTING_MODIFY | Optional `expiresAt`; Clip `event_handle` fields; optional `notificationId` |
| `insforge/functions/_shared/payments/checkout-input.ts` | EXISTING_MODIFY | Optional `expiresAt` parse |
| `insforge/functions/_shared/payments/index.ts` | EXISTING_MODIFY | Clip exports; still no mocks |
| `tests/unit/clip/checkout-client.test.ts` | TEST_FILE | HTTP client + money tests (mocked fetch) |
| `tests/unit/payments/clip-adapter.test.ts` | TEST_FILE | Adapter / correspondence / no-fallback tests |

Lane A production files were **not** modified. Mercado Pago adapter HTTP/signature was **not** rewritten.

### Validation executed

```text
npx vitest run tests/unit/payments tests/unit/clip
  6 files, 67 passed

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 passed

npx oxlint insforge/functions/_shared/payments insforge/functions/_shared/clip tests/unit/payments tests/unit/clip
  exit 0
```

No live Clip / Mercado Pago / Openpay / PayPal API call. No SQL/migration.
No Clip runtime enablement. No Landing selector.

OD-041-001 = OPEN (Clip MSI).
OD-041-004 = OPEN (Clip Redirect E2E strategy).
OD-041-002, 003, 005, 006, 007, 008 unchanged.

MULTI-PAY-6 remains `NOT AUTHORIZED / NOT STARTED`.

### MULTI-PAY-5C — Clip adapter provider-shape corrections (2026-08-24)

Independent review MULTI-PAY-5R result: `CHANGES_REQUIRED`.
Findings MP5R-001..005 were MINOR. No BLOCKING. No MAJOR. No approved-spec
conflict. No Lane A mutation.

Parent authorization remains: `APRUEBO MULTI-PAY-5 — CLIP ADAPTER.`
This subsection records MP5C evidence only. It does **not** rewrite SPEC-041,
authorize MULTI-PAY-6, implement Openpay, enable Clip at runtime, wire Landing,
or modify Lane A.

Corrections applied against the current Clip Checkout Redirect v2 CREATE schema:

- MP5R-001 tip nesting: send `override_settings.tip_enabled = false`; remove
  undocumented top-level `tip_enabled`. No other override settings. Tips remain
  disabled.
- MP5R-002 minimum amount: Clip create requires amount >= 1.00 MXN; canonical
  cents `< 100` fail before HTTP. No clamp/round-up.
- MP5R-003 `metadata.external_reference` max 36; empty rejected; length > 36
  rejected before HTTP. No truncate/hash/replace. Canonical order id remains the
  correlation value.
- MP5R-004 `purchase_description` 1..250 after the existing whitespace
  sanitizer; reject empty and >250. No silent slice. Control characters still
  normalized; no new charset invention; emoji not additionally restricted
  because Clip CREATE UTF-8/special-character text does not explicitly reject it.
- MP5R-005 `expires_at` serialized as 20-char UTC `YYYY-MM-DDTHH:MM:SSZ`
  (example `2026-08-24T18:00:00Z`), milliseconds omitted, missing/invalid
  rejected, field never omitted. Canonical `expiresAt` remains upstream Lane A
  hold/order expiry. Lane B does not calculate hold duration. Clip default
  expiry is not used.

Clip provider expiry window (greater than 1 minute from create and same-day
CDMX upper bound vs omitted default of three days) is **not** encoded as
Ready2Hybrid hold duration. MP5C does not invent or alter Lane A expiry.
If a canonical Lane A expiry cannot satisfy that provider window:
`COORDINATION_REQUIRED_WITH_LANE_A`. Clip remains runtime-disabled until that
coordination is satisfied.

Not redesigned in MP5C (review notes, not required findings):

- GET `clipAmountToCents` still uses `toFixed(2)` for provider decimals.
- Missing webhook `resource` still accepted as checkout; webhook remains
  `financialAuthority = false`; authoritative GET remains mandatory.

Unchanged:

- `CLIP_ACCOUNT_API_ACCESS = UNKNOWN`
- `CLIP_CREDENTIAL_CONFIGURATION = UNKNOWN`
- `CLIP_REAL_E2E_TEST_STRATEGY = BLOCKED_BY_TEST_STRATEGY`
- `CLIP_RUNTIME_ENABLEMENT = NO`
- OD-041-001 = OPEN
- OD-041-004 = OPEN
- MULTI-PAY-6 = NOT AUTHORIZED

Temporary untracked helpers observed by MP5R and left untouched:
`.cursor/_mp5_patch_contract.mjs`, `.cursor/_mp5_patch_exports.mjs`,
`.cursor/_mp5_patch_sanitizer.mjs`.

#### MP5C validation executed

```text
npx vitest run tests/unit/payments tests/unit/clip
  6 files, 73 passed

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 total, 16 passed, 7 failed
  classification: PRE_EXISTING_LANE_A_FAILURE
  evidence: failures return 409 UNSUPPORTED_PROVIDER from Lane A
  selected_provider WIP; MP5C did not modify checkout-start or Lane A
  checkout files.

npx oxlint insforge/functions/_shared/payments insforge/functions/_shared/clip tests/unit/payments tests/unit/clip
  exit 0
```

No live Clip / Mercado Pago / Openpay / PayPal API call. No SQL/migration.
No Clip runtime enablement. No commit/push/deploy.

### MULTI-PAY-6 — Openpay Mexico hosted-redirect adapter (2026-08-24)

Project Owner authorization: `APRUEBO MULTI-PAY-6 — OPENPAY ADAPTER.`

This subsection records MULTI-PAY-6 evidence only. It does **not** rewrite
SPEC-041, authorize MULTI-PAY-6R / MULTI-PAY-7, enable Openpay at runtime,
wire Landing, modify Lane A, call sandbox/production Openpay, register a
webhook, capture card data, create Openpay customers, enable MSI/PaymentPlan,
implement store/SPEI, or implement PayPal.

Official Mexico endpoint model used:

- Sandbox host: `https://sandbox-api.openpay.mx`
- Production host: `https://api.openpay.mx`
- CREATE: `POST /v1/{MERCHANT_ID}/charges`
- GET: `GET /v1/{MERCHANT_ID}/charges/{TRANSACTION_ID}`
- Auth: HTTP Basic, username = private API key, password blank
- Hosted card redirect: `method=card`, `confirm=false`, `send_email=false`,
  `redirect_url`, inline `customer`; no `source_id` / PAN / token
- X-Forwarded-For required on CREATE from injected server client IP
- Webhook ingress: `http_basic_ingress` only; not financial authority
- `verification` event is a non-financial handshake
- Authoritative financial id = GET charge `id`
- SPEC-041-R031 status map after GET

Files added/updated for this unit:

- `insforge/functions/_shared/openpay/types.ts`
- `insforge/functions/_shared/openpay/money.ts`
- `insforge/functions/_shared/openpay/status.ts`
- `insforge/functions/_shared/openpay/charge-client.ts`
- `insforge/functions/_shared/payments/openpay-adapter.ts`
- `insforge/functions/_shared/payments/storage-mapping.ts` (`OPENPAY` ↔ `openpay`)
- `insforge/functions/_shared/payments/types.ts` (optional Openpay Basic fields)
- `insforge/functions/_shared/payments/index.ts` (exports; no mocks)
- `tests/unit/openpay/charge-client.test.ts`
- `tests/unit/payments/openpay-adapter.test.ts`

Server-only injected ports (not wired to Lane A):

- customer context (name, last_name, phone_number, email)
- client IP → X-Forwarded-For on CREATE
- webhook Basic expected username/password
- environment SANDBOX/PRODUCTION (no NODE_ENV inference; no production default)

Classifications after this unit:

- `OPENPAY_CONTRACTED_PROVIDER = YES` (Project Owner statement; not probed)
- `OPENPAY_IMPLEMENTED_PROVIDER = YES`
- `OPENPAY_RUNTIME_READY_PROVIDER = NO`
- `OPENPAY_RUNTIME_ENABLED_PROVIDER = NO`
- `OPENPAY_SANDBOX_CAPABILITY = AVAILABLE` (docs); `SANDBOX_TEST_EXECUTED = NO`
- `OPENPAY_ACCOUNT_API_ACCESS = UNKNOWN`
- `OPENPAY_SANDBOX_CREDENTIAL_CONFIGURATION = UNKNOWN`
- `OPENPAY_PRODUCTION_CREDENTIAL_CONFIGURATION = UNKNOWN`
- `OPENPAY_CLIENT_IP_PORT_IMPLEMENTED` + `COORDINATION_REQUIRED_WITH_LANE_A`
- `OPENPAY_CUSTOMER_PORT_IMPLEMENTED` + `COORDINATION_REQUIRED_WITH_LANE_A`
- `STORAGE_MAPPING_SAFE` (`payments.provider` remains unconstrained text)
- `OPENPAY_REDIRECT_3DS_DOC_AMBIGUITY`: dedicated redirect/`confirm=false`
  docs do not require `use_3d_secure`; adjacent tokenized-card docs mention
  3DS. Adapter does not send `use_3d_secure` / `source_id` /
  `device_session_id`.
- `OPENPAY_VERIFICATION_HANDSHAKE_SUPPORTED_IN_ADAPTER` (non-financial)

OD-041-001 … OD-041-008 remain OPEN / unresolved. Not decided by this unit.
MULTI-PAY-6R = NOT AUTHORIZED. MULTI-PAY-7 = NOT AUTHORIZED.

#### MP6 validation executed

```text
npx vitest run tests/unit/payments tests/unit/clip tests/unit/openpay
  8 files, 104 passed

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 total, 16 passed, 7 failed
  classification: PRE_EXISTING_LANE_A_FAILURE
  evidence: failures return 409 UNSUPPORTED_PROVIDER from Lane A
  selected_provider WIP; MP6 did not modify checkout-start or Lane A
  checkout files.

npx oxlint insforge/functions/_shared/payments insforge/functions/_shared/clip
           insforge/functions/_shared/openpay tests/unit/payments
           tests/unit/clip tests/unit/openpay
  exit 0

git diff --check -- <MP6 paths>
  exit 0
```

No live Openpay / Mercado Pago / Clip / PayPal API call. No Openpay sandbox
call. No SQL/migration. No Openpay runtime enablement. No commit/push/deploy.

### MULTI-PAY-7 — Multi-provider integration / canonical domain wiring (2026-08-24)

Project Owner authorization:
`APRUEBO MULTI-PAY-7 — MULTI-PROVIDER INTEGRATION / CANONICAL DOMAIN WIRING.`

This subsection records MULTI-PAY-7 evidence only. It does **not** rewrite
SPEC-041, authorize MULTI-PAY-7R / MULTI-PAY-8, enable Clip or Openpay at
runtime, wire Landing, modify Lane A, call any PSP, register webhooks, create
SQL/migrations, capture card data, or change SALES_STATUS.

HEAD at inspection: `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`)
`main`. Working tree remains DIRTY (Lane A relaunch WIP + untracked Multi-Pay).

#### What this unit added

Provider-neutral integration seam over already-reviewed adapters:

- Checkout: `createPaymentCheckout({ input, enablement, registry })`
- Event: `resolveProviderEvent({ event, expected, enablement, registry })`
- Availability: `SAFE_RUNTIME_ENABLEMENT` (all false) + `describeProviderAvailability`
- Storage owner: `toCanonicalPaymentStorageId` / `fromCanonicalPaymentStorageId`
  (`MERCADO_PAGO`↔`mercadopago`, `CLIP`↔`clip`, `OPENPAY`↔`openpay`)
- Domain apply port: `mapEligibleEvidenceToCanonicalApplyPayload` maps
  **Mercado Pago eligible evidence only** onto the existing
  `webhook_apply_payment_tx(jsonb)` payload shape. Clip/Openpay fail closed.
  The port does **not** invoke the RPC.

Lane A binding point (read-only; not edited):

`insforge/functions/_shared/checkout/orchestrate.ts` after
`assertSelectedProvider` currently fail-closes any provider other than
`MERCADO_PAGO` with `UNSUPPORTED_PROVIDER`. Future call:

resolved snapshot + `selected_provider` + runtime enablement + adapter
registry → `createPaymentCheckout(...)`.

#### Classifications

- Canonical TX: `CANONICAL_TX_MERCADOPAGO_COUPLED`
  (`v_provider text := 'MERCADOPAGO'`; evidence `mp_payment:`)
- Idempotency: `DURABLE_IDEMPOTENCY_MERCADOPAGO_COUPLED`
  (unique indexes `(provider, provider_payment_id)` and
  `(provider, provider_notification_id)` exist, but the live TX always
  writes provider `MERCADOPAGO`)
- Clip/Openpay domain apply: `BLOCKED_BY_SCHEMA_GAP`
- MP generic binding: `MP_GENERIC_BINDING_READY_FOR_LANE_A`
- Webhook paths: `WEBHOOK_PATH_DECISION_OPEN` (OD-041-006)
- Openpay nested refund: `REFUND_RECOGNITION_DEFERRED_FAIL_CLOSED`
- Openpay repeated checkout: `OPENPAY_RETRY_REQUIRES_PROVIDER_ATTEMPT_ID`
- Openpay return URL: `COORDINATION_REQUIRED_WITH_LANE_A_ALLOWLIST`
- OD-041-003 customer-chooses product rule:
  `OWNER_DECISION_RESOLVED_DOCUMENTATION_PENDING`
  (normative R017 already requires explicit selection; visual UX remains OPEN)

#### Files added/updated for this unit

- `insforge/functions/_shared/payments/availability.ts`
- `insforge/functions/_shared/payments/checkout-orchestration.ts`
- `insforge/functions/_shared/payments/event-orchestration.ts`
- `insforge/functions/_shared/payments/domain-apply-port.ts`
- `insforge/functions/_shared/payments/storage-mapping.ts` (canonical owner)
- `insforge/functions/_shared/payments/index.ts` (exports; still no mocks)
- `tests/unit/payments/checkout-orchestration.test.ts`
- `tests/unit/payments/event-orchestration.test.ts`
- `tests/unit/payments/domain-apply-port.test.ts`

Lane A, SPEC-041, WORKSPACE_STATUS.md, SQL, Landing, and provider adapters
were not modified by this unit.

#### MP7 validation executed

```text
npx vitest run tests/unit/payments tests/unit/clip tests/unit/openpay
  11 files, 151 passed
  (previous MP6 baseline: 8 files, 104 passed)

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 total, 16 passed, 7 failed
  classification: PRE_EXISTING_LANE_A_FAILURE
  evidence: 409 UNSUPPORTED_PROVIDER from Lane A selected_provider WIP
  MP7 did not modify checkout-start or Lane A checkout files.

npx oxlint insforge/functions/_shared/payments insforge/functions/_shared/clip
           insforge/functions/_shared/openpay tests/unit/payments
           tests/unit/clip tests/unit/openpay
  exit 0

git diff --check
  exit 0 (CRLF warnings only on pre-existing Lane A dirty files)
```

No live Mercado Pago / Clip / Openpay / PayPal API call. No sandbox call.
No SQL/migration. No Clip or Openpay runtime enablement. No commit/push/deploy.

Gate: `READY_FOR_MULTI_PAY_7_REVIEW`
(remaining runtime entrypoint work is `COORDINATION_REQUIRED_WITH_LANE_A`,
not an adapter defect).

### MULTI-PAY-7S — Canonical TX / durable idempotency provider neutralization (2026-08-24)

Project Owner authorization:
`APRUEBO MULTI-PAY-7S — CANONICAL TX / DURABLE IDEMPOTENCY PROVIDER NEUTRALIZATION.`

This subsection records MULTI-PAY-7S evidence only. It does **not** rewrite
SPEC-041, authorize MULTI-PAY-7SR / MULTI-PAY-8, apply SQL, wire Lane A,
enable Clip or Openpay, call any PSP, or change Mercado Pago production
behavior.

HEAD at inspection: `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`).
Branch: `main`. Working tree remains DIRTY (Lane A relaunch WIP + untracked
Multi-Pay). No stash/reset/clean/checkout/restore/rebase/merge/add/commit/push.

Predecessor RPC: `insforge/migrations/0009_fix_webhook_payment_verification_order.sql`
(`public.webhook_apply_payment_tx(p jsonb)`, `v_provider text := 'MERCADOPAGO'`).
0009 was not modified.

Successor migration (authored, **not applied**):
`insforge/migrations/0021_multi_provider_canonical_tx_neutralization.sql`.
Highest canonical number at inspection was 0020; 0021 did not exist.
No new table, column, or unique index.

#### Durable provider convention

| Contract ProviderId | Durable `payments` / `webhook_events` provider |
|---|---|
| `MERCADO_PAGO` | `MERCADOPAGO` |
| `CLIP` | `CLIP` |
| `OPENPAY` | `OPENPAY` |

Commercial snapshot remains lowercase (`mercadopago` / `clip` / `openpay`)
via `toCanonicalPaymentStorageId`. Distinct mapper:
`toDurablePaymentProviderId` / `fromDurablePaymentProviderId`.

#### Canonical RPC

- Signature preserved: `public.webhook_apply_payment_tx(p jsonb)`
- Reads `p->>'provider'` (contract id). Missing → `MISSING_PROVIDER`.
  Unknown / PAYPAL → `UNSUPPORTED_PROVIDER`. No Mercado Pago default.
- SQL owns durable mapping. Does not trust `storage_provider`.
- Evidence: `mp_payment:` / `clip_payment:` / `openpay_payment:`
- Audit actor: `mp-webhook` (Mercado Pago) / `canonical-payment-tx` (Clip/Openpay)
- Idempotency reuses 0002 indexes:
  `uq_payments_provider_payment_id` `(provider, provider_payment_id)`
  `uq_webhook_events_provider_notification_id` `(provider, provider_notification_id)`
- Lookups/inserts use mapped `v_provider` consistently.
- APPROVED path still performs order PAID, hold CONVERTED, registration
  PAYMENT_CONFIRMED, `ticket_issue_after_payment`.
- UNKNOWN / REFUNDED / CHARGED_BACK cannot mark PAID.
- Grants copied from 0009 (`project_admin` EXECUTE; PUBLIC/anon/authenticated revoked).
- Currency defense unchanged from 0009: caller `currency_ok` plus order-found.
  Classification: `EXISTING_CANONICAL_TX_DEFENSE_LIMITATION`.

#### Domain apply port

`mapEligibleEvidenceToCanonicalApplyPayload` now emits the same payload shape
for `MERCADO_PAGO`, `CLIP`, and `OPENPAY`, including explicit `provider`.
Requires `ownershipProof`:

- Mercado Pago: `{ mechanism: 'collector_id_match', verified: true }`
- Clip/Openpay: `{ mechanism: 'account_scoped_get', verified: true }`

No RPC/SQL, no business effects, no PII. Does not hardcode ownership true
without proof. Live Mercado Pago collector check remains in `mp-webhook`
(Lane A, unmodified): `PROVIDER_OWNERSHIP_BINDING_REQUIRED_WITH_LANE_A`.

#### Apply gate

Live `mp-webhook` still omits `provider`. 0021 fail-closes missing provider.
Therefore:

- `MIGRATION_IMPLEMENTED = YES`
- `MIGRATION_APPLIED = NO`
- `MIGRATION_APPLY_READY = NO`
- `MIGRATION_APPLY_BLOCKER = LANE_A_PROVIDER_PAYLOAD_BINDING`

Rollback concept (not executed): restore 0009 function body via a later
authorized CREATE OR REPLACE. Do not edit 0009.

#### Remaining provider gates (not resolved here)

- `OPENPAY_DOMAIN_ENABLEMENT_BLOCKED_BY_REFUND_RECOGNITION`
- `OPENPAY_DOMAIN_OR_RUNTIME_ENABLEMENT_BLOCKED_BY_RETRY_CONTRACT`
- Clip/Openpay `RUNTIME_ENABLED = NO`
- OD-041-001 … OD-041-008 remain OPEN except OD-041-003
  `OWNER_DECISION_RESOLVED_DOCUMENTATION_PENDING`

#### Files added/updated for this unit

- `insforge/migrations/0021_multi_provider_canonical_tx_neutralization.sql`
- `insforge/functions/_shared/payments/domain-apply-port.ts`
- `insforge/functions/_shared/payments/storage-mapping.ts`
- `insforge/functions/_shared/payments/index.ts` (exports only)
- `tests/unit/payments/canonical-tx-neutralization.test.ts`
- `tests/unit/payments/domain-apply-port.test.ts`
- `docs/implementation/MULTI-PAY-2-IMPLEMENTATION-TRACEABILITY.md`

Lane A, SPEC-041, WORKSPACE_STATUS.md, 0009, 0020, `mp-webhook`,
`mp-create-checkout`, and Landing were not modified by this unit.

#### MP7S validation executed

```text
npx vitest run tests/unit/payments tests/unit/clip tests/unit/openpay
  12 files, 164 passed
  (previous MP7R baseline: 11 files, 151 passed)

npx vitest run tests/unit/webhook/webhook-orchestrate.test.ts
                 tests/unit/webhook/webhook-signature.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/webhook/webhook-migration-static.test.ts
  4 files, 47 passed
  0009 static tests remain predecessor evidence; no successor rewrite required.

npx vitest run tests/unit/checkout/checkout-start.test.ts
  1 file, 23 total, 16 passed, 7 failed
  classification: PRE_EXISTING_LANE_A_FAILURE
  evidence: 409 UNSUPPORTED_PROVIDER from Lane A selected_provider WIP

npx vitest run tests/unit/tickets/ticket-issuance-policy.test.ts
                 tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/ops/operational-identity-migration-static.test.ts
  3 files, 27 passed

npx oxlint insforge/functions/_shared/payments insforge/functions/_shared/clip
           insforge/functions/_shared/openpay tests/unit/payments
           tests/unit/clip tests/unit/openpay
  exit 0

git diff --check -- <MP7S paths>
  exit 0
```

No live Mercado Pago / Clip / Openpay / PayPal API call. No sandbox call.
No SQL executed. No migration applied. No Clip or Openpay runtime enablement.
No commit/push/deploy.

Gate: `READY_FOR_MULTI_PAY_7S_REVIEW`

MULTI-PAY-7SR = NOT STARTED. MULTI-PAY-8 = NOT AUTHORIZED.


