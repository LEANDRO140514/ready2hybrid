---
id: SPEC-041
title: Multi-Provider Payment Contract
status: APPROVED
version: 0.1.0
phase: MULTI-PAY
created_at: 2026-08-21
approved_at: 2026-08-22
approved_by: Leandro Espinosa, Project Owner
approval_basis: Explicit Project Owner approval after MULTI-PAY-1C READY_FOR_APPROVAL; authorizes MULTI-PAY-2 implementation traceability preparation only; does not by itself authorize runtime implementation, adapters, SQL, migrations, InsForge writes, provider API calls, commit, or push
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.3.0
  - SPEC-031 v0.3.0
  - SPEC-032 v0.3.0
compatible_with:
  - SPEC-011 v0.1.0
  - SPEC-040 v0.1.1
  - SPEC-060 v0.1.0
---

# SPEC-041 v0.1.0 — Multi-Provider Payment Contract

```text
STATUS: APPROVED
Created: 2026-08-21
Approved: 2026-08-22
Approved by: Leandro Espinosa, Project Owner
Unit: MULTI-PAY
Effective: YES
This document is APPROVED. It authorizes MULTI-PAY-2 implementation
traceability preparation only. It does NOT by itself authorize code, SQL,
migrations, adapters, SDKs, provider API calls, webhook configuration,
secrets, InsForge writes, sandbox or production payments, SALES_STATUS=OPEN,
commit, or push.
This specification does NOT supersede SPEC-001, SPEC-030, SPEC-031, SPEC-032,
or SPEC-040.
```

## 1. Purpose

Define an additive, reviewable contract so Ready2Hybrid can offer three active
hosted/redirected payment providers while retaining a single canonical order
owned by Ready2Hybrid / InsForge.

This contract is edition-reusable: it MUST remain valid when the sales domain
changes products, days, prices, or awards. Multi-Pay MUST NOT encode a specific
event catalog.

Active providers for the first multi-provider version:

```text
MERCADO_PAGO
CLIP
OPENPAY
```

PayPal is dormant and out of initial implementation scope.

This specification wraps the already approved Mercado Pago Checkout Pro
behavior. It does not replace it.

## 2. Authority sources

1. Explicit Project Owner product decision for unit `MULTI-PAY-0-SPEC-DRAFT`
   dated 2026-08-21: first multi-payment version supports Mercado Pago, Clip,
   and Openpay; PayPal is dormant / future.
2. `CURSOR_START_PROMPT.md`, `MANIFEST.md`, `WORKSPACE_STATUS.md`.
3. `docs/00_CICLO_DEL_EVENTO.md` through `docs/05_ANEXO_PLAN_TECNICO.md`.
4. SPEC-000 v0.2.0 `APPROVED`.
5. SPEC-001 v0.1.0 `APPROVED`, especially R010–R016 and R018.
6. SPEC-030 v0.3.0 `APPROVED` / `EFFECTIVE` as the currently effective sales
   contract for commercial eligibility and Mercado Pago MSI policy. This
   payment draft MUST NOT copy catalog composition, SKU counts, retired sets,
   schedule, or awards from SPEC-030. `SALES_STATUS` remains closed.
7. SPEC-031 v0.3.0 `APPROVED` / `EFFECTIVE`, including carried-forward payment,
   webhook, redirect-non-authority, and opaque-ID invariants from v0.2.0 /
   last clean committed v0.1.0.
8. SPEC-032 v0.3.0 `APPROVED` / `EFFECTIVE`, including carried-forward Order /
   Payment / WebhookEvent / PaymentVerificationRecord model from v0.2.0 /
   last clean committed v0.1.0.
9. SPEC-040 v0.1.1 `APPROVED` (payment-pending expiry remains compatible and
   is not redesigned here).
10. Official provider documentation consulted 2026-08-21 (appendix A). These
    sources constrain external capabilities; they do not grant product
    authority.

This draft MUST NOT silently resolve contradictions with approved specs.
Where a later patch to SPEC-001 or SPEC-031 may be required, that patch is
recorded as impact only and is not executed by this unit.

## 3. Context

Ready2Hybrid already sells through a canonical InsForge order plus Mercado
Pago Checkout Pro (`mp-create-checkout`, `mp-webhook`, server-side payment
retrieval, `external_reference`, amount/currency checks, idempotency, and
normalized payment states).

`docs/05_ANEXO_PLAN_TECNICO.md` already describes a conceptual
`PaymentProvider` adapter and a `payments` table that is gateway-agnostic.
The implemented physical `payments` table already stores `provider` and
`provider_payment_id`, with uniqueness on `(provider, provider_payment_id)`
when the provider payment id is present.

SPEC-001-R013 requires Mercado Pago Checkout Pro as the **first** payment
provider. This draft treats that as additive-compatible: Mercado Pago remains
first; Clip and Openpay are additional active providers. This draft does not
replace Checkout Pro.

`SALES_STATUS` remains CLOSED. This specification does not open sales.

```text
LANDING_MASTER_R2H_RECONCILIATION = IN_PROGRESS
```

The sales catalog, schedule, prices, and awards are being reconciled between
the landing master and Ready2Hybrid on a parallel lane. Multi-Pay MAY continue
as a DRAFT. It MUST NOT correct the catalog, MUST NOT modify SPEC-030/031/032,
and MUST NOT freeze event-edition commercial details. Checkout is permitted
only for a canonical order the sales domain has already marked
`PAYMENT_ELIGIBLE`.

## 4. Scope

This specification covers the multi-provider **contract**:

- canonical Ready2Hybrid order versus provider financial transaction;
- active versus dormant providers;
- hosted/redirected checkout;
- redirect non-authority;
- provider-specific event verification and server-side payment retrieval;
- amount, currency, and order correlation;
- ORDER STATUS versus PAYMENT STATUS;
- idempotency against duplicate checkout, events, callbacks, lookups, tickets,
  registrations, and capacity effects;
- fail-closed failure modes;
- sandbox versus production isolation;
- secrets and PAN/CVV boundary;
- audit/observability minimum;
- account-readiness classification without secret values;
- MSI/financing decision boundary;
- fee/surcharge prohibition;
- refund recognition versus refund execution;
- sales-domain decoupling (payment layer does not own catalog rules);
- impact on existing approved specs.

## 5. Non-goals

This specification does not:

- implement adapters, SDKs, SQL, migrations, schema changes, or Edge Functions;
- authorize production activation of any provider;
- open `SALES_STATUS`;
- implement PayPal or create PayPal credentials, adapters, webhooks, UI, or
  tests;
- redesign Mercado Pago Checkout Pro, MSI policy, or `mp-webhook`;
- decide Clip or Openpay MSI / installments commercial policy;
- decide visual provider order, default provider, logos, “recommended”,
  cheapest, or promotional steering;
- introduce buyer-facing payment fees, convenience fees, or PSP surcharges;
- create a universal PSP framework for arbitrary future providers;
- make multi-provider refund **execution** part of initial go-live;
- change commercial refund/transfer policy (docs/04; SPEC-030 transfer rule);
- capture PAN/CVV on Ready2Hybrid surfaces;
- fix definitive public URL paths when existing InsForge function names already
  work;
- inspect or mutate Mercado Pago, Clip, Openpay, or PayPal accounts;
- encode SKU counts, retired/reprogrammed SKU lists, competition days,
  AM/PM/FULL_DAY/ALL_DAY rules, prizes, awards, kits, or podium amounts;
- decide commercial eligibility, catalog composition, or event schedule;
- reconcile the landing master with Ready2Hybrid.

## 6. Definitions

- **Sales domain:** Ready2Hybrid commercial/eligibility layer that validates
  product/SKU, offering, event, sales window, price, currency, capacity, and
  related rules **before** any PSP is called.
- **PAYMENT_ELIGIBLE:** Server-side mark or equivalent precondition meaning the
  sales domain has already accepted the order as payable under the currently
  effective Ready2Hybrid sales contract. Multi-Pay does not compute this.
- **Canonical order:** Ready2Hybrid / InsForge order and order items. The sales
  domain owns product, SKU, contractual price, currency, eligibility, sales
  window, and capacity. Multi-Pay consumes the resulting snapshot; it does not
  decide those fields.
- **Provider financial transaction:** The PSP’s own checkout session, payment,
  charge, or equivalent financial object and its evidences.
- **Active provider:** A PSP in the initial multi-provider set:
  `MERCADO_PAGO`, `CLIP`, `OPENPAY`.
- **Dormant / future provider:** A named PSP that MUST NOT be required by
  initial implementation. PayPal is the only named dormant provider in this
  draft.
- **Enabled provider:** An active provider that a future approved
  configuration allows for a given environment. Implementation of enablement
  is out of this draft.
- **Hosted / redirected checkout:** The buyer is sent to a provider-hosted
  page that collects sensitive card data. Ready2Hybrid does not see PAN/CVV.
- **Redirect / return / frontend callback:** Browser navigation back to
  Ready2Hybrid or the landing, including success/error URLs and query
  parameters. Non-authoritative.
- **Provider-specific verifier:** The authenticity and parsing rules for one
  PSP’s events. Mercado Pago, Clip, and Openpay verifiers MUST NOT share
  signature, header, secret, timestamp, or event-format logic.
- **Server-side verification:** Authenticated retrieval or equivalent official
  server-to-server confirmation of the provider financial object, performed
  with server-only credentials.
- **Normalized payment status:** The existing SPEC-032 / implementation
  payment literals: `UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`,
  `CANCELLED`, `REFUNDED`, `CHARGED_BACK`.
- **Order status:** Canonical order aggregate states from SPEC-032, including
  `CREATED`, `PREFERENCE_PENDING`, `PAYMENT_PENDING`, `PAID`, `REJECTED`,
  `CANCELLED`, `EXPIRED`, `REQUIRES_REVIEW`, `REFUNDED`, `CHARGED_BACK`.
- **Public order projection:** Buyer-visible states from SPEC-031, including
  `CREATING`, `AWAITING_PAYMENT`, `CONFIRMING`, `APPROVED`, `PENDING`,
  `REJECTED`, `CANCELLED`, `EXPIRED`, `REQUIRES_ACTION`, `REFUNDED`,
  `CHARGED_BACK`. Distinct from both canonical order status and payment
  status.
- **Fail closed:** No `PAID` semantics, no ticket, no registration
  confirmation, and no capacity conversion when verification, correlation,
  amount, currency, authenticity, or provider final state is uncertain or
  invalid.
- **PaymentProvider:** Conceptual adapter named in `docs/05` §2.3. This draft
  reuses that name. It is not a TypeScript interface in this unit. It operates
  on a resolved canonical order, not on raw catalog input.

## 7. Invariants

### SPEC-041-R001 Canonical order authority

Ready2Hybrid / InsForge MUST remain the sole canonical authority for order,
order items, product, SKU, contractual price, currency, eligibility, sales
window, capacity, registration, participant, ticket, QR, entitlement, and
audit. Multi-Pay MUST NOT own or re-decide those sales-domain rules.

### SPEC-041-R002 Provider financial authority

Each PSP MUST be treated as authority only for its own financial transaction
and financial evidences. A PSP MUST NOT become source of truth for Ready2Hybrid
sales catalog, commercial eligibility, event schedule, awards, or contractual
price.

### SPEC-041-R003 Active providers

The first multi-provider version MUST treat exactly these providers as active:

```text
MERCADO_PAGO
CLIP
OPENPAY
```

### SPEC-041-R004 Dormant PayPal

PayPal MUST be classified `DORMANT` / `FUTURE_PROVIDER` /
`OUT_OF_INITIAL_IMPLEMENTATION_SCOPE`. Initial implementation MUST NOT require
PayPal credentials, adapter, webhook, UI, or tests.

### SPEC-041-R005 Additive Mercado Pago

The multi-provider contract MUST be additive to the approved Mercado Pago
Checkout Pro integration. It MUST NOT rewrite or replace Checkout Pro as a
condition of this draft.

### SPEC-041-R006 Redirect non-authority

Redirect, return URL, success page, and frontend callback MUST NOT mark an
order as `PAID` and MUST NOT issue tickets, confirm registration, or convert
capacity.

### SPEC-041-R007 Server-side confirmation required

An order MAY reach confirmed-payment semantics only after provider-specific
authenticity handling plus server-side verification of the provider financial
object, using an official mechanism supported by that provider.

### SPEC-041-R008 Provider-specific verifier

Each active provider MUST have its own verifier. Implementations MUST NOT
reuse Mercado Pago `x-signature` logic, secrets, headers, timestamps, or event
format assumptions for Clip or Openpay, or share Clip and Openpay authenticity
checks with each other.

### SPEC-041-R009 Frontend non-authority for commercial fields

The frontend MUST NOT determine product, SKU, canonical price, amount,
currency, eligibility, sales window, or capacity. The Ready2Hybrid sales
domain MUST resolve those values into the canonical order **before** calling
any payment provider. Multi-Pay MUST NOT treat frontend or provider input as
authority for those fields.

### SPEC-041-R010 Contractual currency

The initial contractual currency MUST be `MXN`.

### SPEC-041-R011 No PAN or raw card data

Ready2Hybrid MUST NOT capture or store PAN, CVV, raw card credentials, or
equivalent sensitive cardholder data.

### SPEC-041-R012 Secrets server-side only

Provider secrets, access tokens, API keys, webhook users/passwords, and
webhook secrets MUST remain server-side only. They MUST NOT exist in
frontend, `VITE_*`, repository, committed config, markdown, test snapshots,
agent output, logs, or browser storage.

### SPEC-041-R013 Order status is not payment status

Canonical ORDER STATUS, PAYMENT STATUS, and public order projection MUST
remain distinct. A public `APPROVED` projection MUST continue to mean trusted
backend-verified payment outcome as defined by SPEC-031, not a provider
redirect result and not eligibility by itself.

### SPEC-041-R014 No unauthorized surcharge

Ready2Hybrid MUST NOT add a payment fee, service fee, convenience fee,
provider surcharge, or PSP markup to the contractual price without a future
explicit human commercial decision. Provider settlement net of commissions
belongs to finance/reconciliation and MUST NOT change the amount charged to
the buyer.

### SPEC-041-R015 Uncertainty never issues access

If financial verification is missing, invalid, mismatched, unknown, or
ambiguous, the system MUST fail closed. It MUST NOT issue a ticket, confirm
participation, or convert capacity from that evidence.

### SPEC-041-R016 Draft has no implementation authority

This DRAFT MUST NOT authorize SQL, schema, RLS, payments, webhooks, secrets,
QR authority, production operations, provider account writes, or access to
personal data.

## 8. Functional requirements

### SPEC-041-R017 Provider selection

Checkout MAY present the three active providers as selectable options. The
server MUST accept a provider selection only from enabled active providers for
the current environment. Unknown, dormant, or disabled providers MUST fail
closed with no payable destination and no provider preference/session/charge
creation.

Visual order, default provider, logos, recommendation badges, cheapest labels,
and promotional steering are out of scope (`OPEN DECISION`; see §17).

### SPEC-041-R018 Hosted / redirected checkout

For each active provider, Ready2Hybrid MUST use a hosted/redirected checkout
path when that provider’s official documentation supports it, so that PAN/CVV
are collected on the provider surface.

Normative architectural capability for each active provider: hosted /
redirected checkout so that Ready2Hybrid does not capture PAN/CVV.

Documented hosted/redirected paths verified 2026-08-21 (independently
re-checked 2026-08-22 for Openpay Mexico vs Colombia):

| Provider | Official hosted/redirected capability |
|---|---|
| `MERCADO_PAGO` | Checkout Pro preference + `init_point` (existing approved path) |
| `CLIP` | Checkout Redirect API: create payment link, redirect to `payment_request_url` |
| `OPENPAY` | Hosted / redirected checkout that does not require Ready2Hybrid to capture PAN/CVV. Currently documented Mexico mechanism (`documents.openpay.mx`): server-side charge with `confirm=false` and `redirect_url` (virtual-terminal / hosted form; no card token required). That is current MX evidence, not a frozen exclusive forever-shape. This draft MUST NOT import Colombia `POST /v1/{MERCHANT_ID}/checkouts` or `checkout_link` as Mexico requirements. |

Checkout Transparente / direct card tokenization on Ready2Hybrid MUST NOT be
the initial architecture for Clip or Openpay. Absence of Clip Checkout
Redirect test-mode support MUST NOT select Checkout Transparente as a
fallback. Checkout Transparente MAY enter only through a future approved
architecture change.

### SPEC-041-R019 Minimal PaymentProvider operations

Future implementation MUST map each active provider onto the conceptual
`PaymentProvider` operations already named in `docs/05` §2.3, limited to what
this contract needs:

```text
createCheckout(...)
verifyEvent(...)     // docs/05: verifyWebhook
getPayment(...)      // docs/05: resolvePayment / query payment
normalizeStatus(...)
```

`refund(...)` exists in `docs/05` as a conceptual method. It MUST NOT be a
mandatory initial go-live operation for Clip or Openpay. See R036.

This requirement does not freeze TypeScript signatures, file names, or SDK
choices.

### SPEC-041-R020 Mercado Pago first-provider preservation

Mercado Pago Checkout Pro MUST remain the first provider and MUST continue to
satisfy SPEC-001-R013–R014 and SPEC-031 webhook/payment verification:

1. create Checkout Pro preference from the canonical snapshot;
2. verify `x-signature` per current Mercado Pago documentation;
3. query `/v1/payments/{id}` with backend credentials;
4. validate merchant/collector ownership, `external_reference`, amount, and
   currency;
5. apply domain effects only after those checks.

Existing function names `mp-create-checkout` and `mp-webhook` MAY be retained.

### SPEC-041-R021 Clip checkout and verification

For Clip, createCheckout MUST use the official Checkout Redirect API to create
a payment link and return `payment_request_url`.

Clip event ingress MUST use a Clip-specific verifier. Official Clip checkout
webhook documentation consulted on 2026-08-21 does not specify an HMAC /
signature scheme equivalent to Mercado Pago `x-signature`. Therefore:

- the webhook body MUST NOT be treated as financial truth;
- the verifier MUST obtain `payment_request_id` only as a retrieval handle;
- the server MUST retrieve the payment link via authenticated
  `GET /checkout/{payment_request_id}` before any payment-dependent effect;
- missing, malformed, or unauthenticated retrieval MUST fail closed.

Buyer `redirection_url` success/error/default MUST remain non-authoritative.

### SPEC-041-R022 Openpay checkout and verification

For Openpay, createCheckout MUST use a hosted/redirected checkout path that
does not require Ready2Hybrid to capture PAN or CVV. Mexico is the initial
provider context.

The currently documented Mexico mechanism on the official REST API
(`documents.openpay.mx`) is a server-side charge with `confirm=false` plus
`redirect_url`, which returns a provider-hosted payment form and does not
require a card token. That mechanism is the current MX official evidence for
this draft. It MUST NOT be treated as the only conceivable Openpay hosted
product forever. This draft MUST NOT import Colombia
`POST /v1/{MERCHANT_ID}/checkouts` or `checkout_link` as Mexico requirements.

Openpay event ingress authentication and financial state resolution are
distinct operations:

1. **Event ingress authentication.** When an Openpay webhook is configured,
   official HTTP Basic authentication (`user` / `password`) and the
   create-time URL verification ping protect the ingress endpoint. HTTP Basic
   MUST NOT be treated as proof of approved payment, correct amount, correct
   currency, or final financial state.
2. **Financial state resolution.** Ready2Hybrid MUST retrieve the charge
   server-side via authenticated
   `GET /v1/{MERCHANT_ID}/charges/{TRANSACTION_ID}` (or the customer-scoped
   equivalent) before any payment-dependent effect. That GET is the financial
   evidence, which MUST then be compared against the canonical order per R024.

The `id` query parameter on Openpay `redirect_url` MUST NOT confirm payment by
itself. The server MUST use it only as a retrieval handle, then GET the
charge.

### SPEC-041-R023 Snapshot amount and currency to the PSP

Amount and currency sent to any provider MUST equal the canonical order
snapshot exactly. The client MUST NOT supply authoritative amount or currency.

### SPEC-041-R024 Correlation before paid semantics

Before promoting an order to confirmed-payment semantics, verification MUST
confirm all of the following when the provider response supplies them:

- expected provider;
- canonical order correlation;
- provider transaction identity;
- final financial state that maps to normalized `APPROVED`;
- amount equal to snapshot;
- currency equal to snapshot (`MXN`).

If the PSP reports paid/completed but correlation, amount, currency, provider,
or order identity fails: fail closed. No ticket. No registration confirmation
from that evidence. Record a protected audit/incident (`REQUIRES_REVIEW` or
equivalent existing reconciliation state).

### SPEC-041-R025 Provider transaction identity

Logical uniqueness of a provider financial transaction MUST be expressed as:

```text
provider + provider_transaction_id
```

This requirement states the idempotency property. It MUST NOT invent a new
physical schema in this draft. Existing SPEC-032 Payment uniqueness and the
physical unique index on `(provider, provider_payment_id)` MAY be reused by a
later approved implementation.

Order correlation MAY continue to use the existing Mercado Pago
`external_reference` for Mercado Pago. Clip official metadata includes
`me_reference_id` / `external_reference`. Openpay charges accept `order_id`.
Exact field mapping is an implementation choice provided correlation is
server-owned and unique per canonical order/provider checkout attempt under
existing SPEC-031/032 idempotency rules.

### SPEC-041-R026 Repeated checkout

Repeated checkout requests with the same logical idempotency key and
normalized payload MUST return or reconcile the original logical checkout and
MUST NOT create a second uncontrolled payable destination, hold, or order.

Same key with a different normalized payload MUST fail as `CONFLICT` (or the
existing equivalent) with no second uncontrolled effect.

User double-click MUST be covered by that same checkout idempotency.

If a provider createCheckout call may have succeeded but the response was
lost, retry MUST reconcile the existing provider/order identity before
creating a new provider financial object.

### SPEC-041-R027 Repeated events, callbacks, and lookups

The following MUST be idempotent with respect to business effects:

- repeated webhook/event delivery;
- duplicated provider event;
- webhook retry;
- repeated frontend callback / return URL;
- repeated payment lookup / GET.

A duplicate MUST NOT apply a second payment, second registration confirmation,
second ticket, or second capacity conversion.

Out-of-order events MUST NOT override a newer verified provider state merely
because a notification arrived later. A fresh authenticated provider GET
resolves ambiguity, as already required for Mercado Pago by SPEC-031.

### SPEC-041-R028 Duplicate financial transaction

Two canonical orders MUST NOT consume one provider financial transaction.
A second application of the same `provider + provider_transaction_id` MUST
not create a second paid order, ticket set, or capacity conversion.

### SPEC-041-R029 Duplicate registration, ticket, and capacity

Verified payment effects MUST remain effectively-once under SPEC-031/032:

- registration confirmation;
- ticket issuance;
- capacity hold conversion.

Repeated successful verification of the same financial event MUST return the
already applied effect and MUST NOT decrement capacity twice.

### SPEC-041-R030 Webhook / event boundary

Each PSP MUST have a distinct ingress. Exact paths are an implementation
choice. Compatible options:

```text
EXISTING INSFORGE CONVENTION (preferred if it reduces risk)
/functions/mp-webhook
/functions/clip-webhook   (name illustrative)
/functions/openpay-webhook (name illustrative)

ALTERNATIVE SHAPE (not mandatory)
/payments/webhooks/mercadopago
/payments/webhooks/clip
/payments/webhooks/openpay
```

This draft MUST NOT require renaming `mp-webhook`. Sibling functions for Clip
and Openpay SHOULD follow the existing InsForge function convention unless a
later approved implementation plan justifies otherwise.

Ingress stages remain those of SPEC-031:

```text
NOTIFICATION_RECEIVED
PAYMENT_QUERIED
PAYMENT_VERIFIED
EFFECT_APPLIED
```

Receipt of a notification is not payment confirmation.

### SPEC-041-R031 Normalized payment status

Provider financial states MUST be normalized into the existing payment
literals. New payment enums MUST NOT be invented.

Mercado Pago mapping (existing SPEC-031 / implementation):

| Provider status | Normalized payment status |
|---|---|
| `approved` | `APPROVED` |
| `pending`, `in_process`, `in_mediation`, `authorized` | `PENDING` |
| `rejected` | `REJECTED` |
| `cancelled` / `canceled` | `CANCELLED` |
| `refunded` | `REFUNDED` |
| `charged_back` | `CHARGED_BACK` |
| any other | `UNKNOWN` |

Clip Checkout Redirect mapping (official checkout statuses, after GET):

| Provider status | Normalized payment status |
|---|---|
| `CHECKOUT_CREATED` / `CREATED` | `PENDING` |
| `CHECKOUT_PENDING` / `PENDING` | `PENDING` |
| `CHECKOUT_COMPLETED` / `COMPLETED` | `APPROVED` |
| `CHECKOUT_CANCELLED` / `CANCELED` | `CANCELLED` |
| `CHECKOUT_EXPIRED` / `EXPIRED` | `CANCELLED` |
| refund resource `APPROVED` | `REFUNDED` |
| any other | `UNKNOWN` |

Openpay charge mapping (official transaction statuses / events, after GET):

| Provider status or event | Normalized payment status |
|---|---|
| `completed` / `charge.succeeded` | `APPROVED` |
| `in_progress` / `charge.created` / `charge_pending` | `PENDING` |
| `failed` / `charge.failed` | `REJECTED` |
| `charge.cancelled` | `CANCELLED` |
| `charge.refunded` | `REFUNDED` |
| `chargeback.accepted` | `CHARGED_BACK` |
| any other | `UNKNOWN` |

`UNKNOWN` MUST NOT produce `PAID` semantics.

Clip `EXPIRED` checkout maps to payment `CANCELLED` and MAY move the canonical
order to `EXPIRED` under existing SPEC-032 order transitions. It MUST NOT be
treated as `APPROVED`.

`charge_pending` appears in official Openpay examples; the summarized
transaction `status` table lists `completed`, `in_progress`, `failed`. Mapping
`charge_pending` → `PENDING` is required when that value is observed. Additional
Openpay values remain `UNKNOWN` until official documentation confirms them.

### SPEC-041-R032 Order versus payment transitions

Canonical order transitions remain those of SPEC-032. This draft does not
replace `PREFERENCE_PENDING` / `PAYMENT_PENDING` / `PAID`. For Clip and
Openpay, `PREFERENCE_PENDING` means “provider checkout object not yet linked”
and `PAYMENT_PENDING` means “provider checkout/charge linked, not verified
approved.” Those names MAY be retained to avoid enum replacement. A future
SPEC-032 patch MAY generalize the preference wording; this draft MUST NOT
perform that patch.

Public projections remain SPEC-031 and MUST NOT be submitted by clients as
transitions.

### SPEC-041-R033 MSI / financing boundary

Product price and provider financing MUST remain separate.

- **Mercado Pago:** the currently approved Mercado Pago MSI / financing policy
  in the effective sales contract MUST remain unchanged by this specification.
  This draft MUST NOT copy that policy as a SKU list.
- **Clip:** official Checkout Redirect supports `custom_payment_options.installments_msi`
  with allowed values `3|6|9|12|18|24`. Commercial policy is `NOT YET DEFINED`
  / `OPEN DECISION`.
- **Openpay:** official Mexico Charges API `PaymentPlan` documents
  `payment_plan.payments` of `3, 6, 9, 12, 18`. That is a **Charges
  PaymentPlan capability**. This draft MUST NOT assert that every Openpay
  hosted product supports those terms. Commercial policy is `NOT YET DEFINED`
  / `OPEN DECISION`.

This draft MUST NOT copy Mercado Pago MSI policy onto Clip or Openpay. It MUST
NOT decide a cash/one-shot fallback as a commercial default.

The core provider contract MAY be implemented later without Clip/Openpay
financing if the Project Owner leaves those policies open; financing MUST NOT
be silently enabled.

### SPEC-041-R034 Timeouts, retries, and unavailability

Provider timeout, unavailability, invalid response, and checkout creation
failure MUST leave the canonical order in a named non-payable or retryable
state. They MUST NOT create `PAID` semantics.

Safe retry of checkout creation MUST obey R026. Payment lookup retry MUST obey
R027. Temporary Ready2Hybrid outage after a provider event MUST recover
through durable receipt/verification records without double effect.

If a Ready2Hybrid database transaction fails after a verified provider event,
verified external payment truth MUST be preserved for reconciliation and
downstream effects MUST remain blocked until recovery, consistent with
SPEC-031 audit/outbox failure handling.

### SPEC-041-R035 Reconciliation uncertainty

Ambiguous, late, mismatched, or unverifiable provider outcomes MUST route to
existing protected reconciliation (`REQUIRES_REVIEW` / incident), not to
tickets.

### SPEC-041-R036 Refund recognition versus execution

The system MUST continue to represent `REFUNDED` and `CHARGED_BACK` when a
verified provider corrective state exists (SPEC-032 payment transitions).

Initiating a refund from Ready2Hybrid against multiple providers is
`POST_GO_LIVE` / `SEPARATE CONTRACT`. It is not required for initial
multi-provider go-live.

This draft MUST NOT invent a commercial refund policy and MUST NOT delete
historical ability to record refunds/chargebacks.

### SPEC-041-R037 Environment isolation

Sandbox/test and production MUST be isolated for credentials, endpoints when
the provider differentiates them, webhook configuration, merchant/account IDs,
checkout sessions, and transactions.

Openpay officially distinguishes `https://sandbox-api.openpay.mx` and
`https://api.openpay.mx` with separate credentials.

Mercado Pago already separates test and production credentials.

Clip official test credentials exist. Official Clip `Pruebas / Sandbox`
documentation (consulted 2026-08-21; independently re-checked 2026-08-22)
lists as test-mode compatible: Checkout Transparente APIs, Refund API, and
Checkout Transparente SDK, and states that any other API does not work in
test mode. Checkout Redirect is not on that list.

Therefore the three dimensions MUST stay distinct:

- **Public provider capability:** Clip Checkout Redirect is documented as a
  hosted product (production-context capability: present).
- **Environment availability:** Clip Checkout Redirect **test-mode
  environment capability** is `KNOWN_MISSING`. The product currently has no
  official Clip test-mode support.
- **Project account readiness:** Clip project credentials, account
  configuration, and production enablement remain `UNKNOWN` or
  `BLOCKED_BY_ACCOUNT` until inspected. This draft did not inspect secrets or
  live accounts. Test-mode `KNOWN_MISSING` MUST NOT be inferred as missing
  project credentials.

`KNOWN_MISSING` for Redirect test mode MUST NOT select Checkout Transparente
as the initial Clip path. Hosted/redirected Checkout Redirect remains the
initial Clip product. Checkout Transparente MAY enter only through a future
approved architecture change.

The future conceptual unit `MULTI-PAY-5 — CLIP ADAPTER + SANDBOX` contains a
naming / test-strategy expectation that no longer matches the documented
Redirect test-mode capability. Record only:
`FUTURE UNIT TEST-STRATEGY / NAMING REVIEW REQUIRED` before executing
MULTI-PAY-5. This draft MUST NOT rename or execute that unit.

A provider that is implemented MUST NOT be treated as production-ready.
Production enablement requires a later explicit readiness unit.

### SPEC-041-R038 Configuration server-side

Provider enablement, credentials, webhook authenticity material, merchant IDs,
and environment endpoints MUST be server-side configuration. Frontend MUST NOT
receive secret or environment-mixing values.

### SPEC-041-R039 Future providers

Additional providers after the three active ones MUST require a future
approved specification change. This draft MUST NOT add hypothetical provider
methods “for the future.”

## 9. Non-functional requirements

### SPEC-041-R040 Audit minimum

Every verification attempt and every fail-closed outcome that can affect
money, access, or capacity MUST record at least:

- provider identifier;
- canonical order identifier when known;
- provider transaction/event identifier when safe;
- normalized status transition;
- verification outcome;
- correlation outcome;
- failure category;
- retry/replay information;
- timestamps;
- environment;
- audit actor / system origin.

Audit MUST NOT record PAN, CVV, access tokens, API keys, webhook secrets, raw
secrets, or unnecessary sensitive payloads.

The concrete observability tool is an implementation choice. No new platform
is required by this draft.

### SPEC-041-R041 Time bounds

Provider calls MUST use bounded timeouts. Webhook ingress SHOULD acknowledge
receipt quickly enough for the provider’s retry policy, while domain effects
remain gated by verification (existing Mercado Pago ~22 s retry guidance
remains a Mercado Pago operational fact, not a Clip/Openpay assumption).

### SPEC-041-R042 Expiration and cancellation

Expired or cancelled provider checkout objects MUST NOT be treated as paid.
Clip official checkout expiration and cancellation-after-failed-attempts MUST
fail closed for payment confirmation. Openpay failed/cancelled charges MUST
likewise fail closed.

Canonical hold expiry remains governed by SPEC-040 and MUST stay compatible:
expiry MUST NOT degrade a verified `PAID` order.

### SPEC-041-R043 Payment-eligible order gate

The payment layer MUST create checkout only for a canonical order that the
Ready2Hybrid sales domain has already marked `PAYMENT_ELIGIBLE` under the
currently effective sales contract. An order that is not payment-eligible MUST
fail closed: no provider preference, payment link, or charge.

Multi-Pay MUST NOT implement catalog, retirement, schedule, or prize rules in
order to compute eligibility.

### SPEC-041-R044 Adapter input from resolved canonical order

`PaymentProvider.createCheckout` MUST receive only values already resolved by
Ready2Hybrid, conceptually:

```text
order_id
provider
amount
currency
description/reference safe for the provider
return/callback metadata
provider-specific allowed configuration
```

Amount MUST come from the canonical order snapshot. The adapter MUST NOT
accept as authority: frontend amount or price, frontend SKU price, sales
stage, category eligibility, capacity decision, retirement status, event
schedule, or prize data.

Schedule or SKU identifiers MAY appear in opaque/safe order metadata for
traceability. They MUST NOT decide payment eligibility inside the adapter.

### SPEC-041-R045 Edition-independent payment contract

This specification MUST NOT encode a particular event edition’s SKU count,
category lineup, retired set, competition days, session tokens
(`AM` / `PM` / `FULL_DAY` / `ALL_DAY`), or awards. Any product the sales
domain later marks `PAYMENT_ELIGIBLE` MUST be payable through this contract
without changing provider adapters for catalog reasons.

## 10. Interfaces and contracts

```text
LANDING / CUSTOMER
  -> READY2HYBRID SALES DOMAIN
       validates product/SKU, eligibility, offering, event, sales window,
       price, currency, capacity; marks order PAYMENT_ELIGIBLE
  -> CANONICAL ORDER (resolved snapshot)
  -> MULTI-PAY ORCHESTRATION / PaymentProvider.createCheckout
       input: order_id, provider, amount, currency, safe reference,
              return metadata, provider-specific allowed configuration
       -> MERCADO_PAGO Checkout Pro
       -> CLIP Checkout Redirect payment link
       -> OPENPAY hosted/redirected checkout (currently documented MX
          mechanism: confirm=false + redirect_url; not a Colombia
          /checkouts requirement)
  -> buyer redirect (non-authoritative)
  -> provider event ingress (provider-specific verifier)
  -> PaymentProvider.getPayment (server-side)
  -> amount / currency / correlation / ownership checks
  -> normalizeStatus
  -> existing TX-2 domain effects (capacity, registration, tickets)
```

Conceptual operations:

| Operation | Meaning | Initial mandatory |
|---|---|---|
| `createCheckout` | Create hosted destination from canonical snapshot | YES |
| `verifyEvent` | Provider-specific event-ingress authenticity / handle extraction. MUST NOT by itself prove approved payment, amount, currency, or final financial state | YES |
| `getPayment` | Authenticated server-side financial object retrieval (financial evidence) | YES |
| `normalizeStatus` | Map provider state to existing payment literals | YES |
| `refund` | Initiate PSP refund from Ready2Hybrid | NO (post-go-live / separate contract) |

## 11. Failure modes

All rows are fail-closed for ticket issuance, registration confirmation, and
capacity conversion unless an existing named recovery command already applies.

| Failure mode | Required response |
|---|---|
| Provider unavailable | Named non-payable/retryable order; no `PAID` |
| Provider timeout | Same as unavailable; bounded retry only under R026/R027 |
| Checkout creation failure | No destination; hold handled under existing checkout policy |
| Invalid provider response | Reject; no payable destination or no domain effect |
| Signature / authenticity invalid | No receipt-as-truth; no domain effect |
| Malformed webhook/event | No business mutation |
| Unknown provider | Reject selection or ingress; no effect |
| Unknown transaction | Fail closed; incident if a paid claim was asserted |
| Unknown canonical order | Fail closed; incident |
| Order correlation failure | Fail closed; `REQUIRES_REVIEW` |
| Amount mismatch | Fail closed; incident |
| Currency mismatch | Fail closed; incident |
| Provider final status conflict | Fresh GET; if still conflicting, `REQUIRES_REVIEW` |
| Duplicate event | Acknowledge; no duplicate business effect |
| Event out of order | Newer verified state wins; no regression by late notice |
| Expired checkout | Not paid; order/hold follow SPEC-032/040 |
| Cancelled checkout | Not paid |
| Provider says paid, correlation fails | Fail closed; incident; no ticket |
| Provider says paid, amount differs | Fail closed; incident; no ticket |
| Provider says paid, currency differs | Fail closed; incident; no ticket |
| DB transaction fails after provider event | Preserve payment truth; block downstream effects until recovery |
| Callback without server verification | Ignore as authority; at most trigger a safe lookup |
| Server verification unavailable | Remain pending/review; no ticket |
| Repeated return URL | No duplicate effect |
| Duplicate payment candidate | Apply at most once per `provider + provider_transaction_id` |
| Redirect/success URL reached | `CONFIRMING` / pending projection only |
| Order not `PAYMENT_ELIGIBLE` | No checkout creation; sales domain owns the reason |
| Adapter given frontend price/SKU/schedule as authority | Ignore as authority; fail closed if no canonical snapshot |

## 12. Security and privacy

- Hosted/redirected checkout only for the three active providers in v1.
- No PAN/CVV on Ready2Hybrid.
- Secrets server-side only (R012).
- Provider verifiers are not interchangeable.
- Public responses continue to omit internal/provider IDs except opaque
  tracking already allowed by SPEC-031.
- Anonymous clients still MUST NOT receive direct write authority to
  canonical tables (SPEC-001-R017).
- FINANCE / CHECKIN_STAFF role boundaries are unchanged (SPEC-001-R020).

## 13. Acceptance criteria

### SPEC-041-AC001 Canonical order authority

- **Precondition:** This DRAFT and SPEC-001/032 authority text are available.
- **Input:** R001, R002, R009, R023, R043, R044.
- **Action:** Inspect whether any requirement lets a PSP own sales-catalog
  rules or contractual price, or lets the frontend set amount/currency.
- **Expected result:** Ready2Hybrid sales domain remains order/price/eligibility
  authority; frontend cannot determine those fields; Multi-Pay does not encode
  catalog composition.
- **Evidence:** Requirement inspection.
- **Pass/fail rule:** `PASS` when R001/R002/R009/R023/R043/R044 are explicit;
  `FAIL` if a PSP or frontend is granted catalog/price authority.
- **Validates:** R001, R002, R009, R023, R043, R044.

### SPEC-041-AC002 Enabled active providers only

- **Precondition:** Provider selection contract is present.
- **Input:** R003, R004, R017.
- **Action:** Check that only Mercado Pago, Clip, and Openpay are active and
  that unknown/dormant/disabled selections fail closed.
- **Expected result:** PayPal is not required; invalid provider creates no
  checkout object.
- **Evidence:** Requirement and non-goals inspection.
- **Pass/fail rule:** `PASS` when active set and fail-closed selection match;
  `FAIL` if PayPal is required or invalid providers can create checkout.
- **Validates:** R003, R004, R017, R039.

### SPEC-041-AC003 Frontend cannot set price or currency

- **Precondition:** Snapshot and currency requirements are present.
- **Input:** R009, R010, R023, R044.
- **Action:** Confirm contractual currency is `MXN`, amount/currency sent to
  any PSP equal the canonical-order snapshot, and frontend price/SKU are not
  adapter authority.
- **Expected result:** Client-supplied money fields are non-authoritative.
- **Evidence:** Requirement inspection.
- **Pass/fail rule:** `PASS` when server snapshot is sole money authority.
- **Validates:** R009, R010, R023, R044.

### SPEC-041-AC004 Redirect cannot mark paid

- **Precondition:** Redirect and confirmation requirements are present.
- **Input:** R006, R007, failure-mode table.
- **Action:** Confirm redirect/return/callback are listed as non-authoritative
  and cannot issue tickets.
- **Expected result:** Only server-side verification can produce confirmed
  payment semantics.
- **Evidence:** R006, R007, R015, failure-mode rows for callback/return URL.
- **Pass/fail rule:** `PASS` when no redirect path can mark `PAID`.
- **Validates:** R006, R007, R015.

### SPEC-041-AC005 Provider-specific verifiers

- **Precondition:** R008, R020–R022, R030 are present.
- **Input:** Mercado Pago `x-signature`, Clip GET-after-webhook, Openpay Basic
  auth + GET charge.
- **Action:** Confirm verifiers are distinct and must not share authenticity
  logic.
- **Expected result:** Three different authenticity mechanisms; no shared
  signature implementation mandate.
- **Evidence:** R008, R020, R021, R022.
- **Pass/fail rule:** `PASS` when each provider has its own verifier and
  shared-logic is prohibited.
- **Validates:** R008, R020, R021, R022, R030.

### SPEC-041-AC006 Server verification before financial confirmation

- **Precondition:** R007, R020–R022.
- **Input:** Official GET/query mechanisms.
- **Action:** Confirm webhook/event body alone cannot confirm payment.
- **Expected result:** Authenticated retrieval is required for all three.
- **Evidence:** R007, R020–R022, R030.
- **Pass/fail rule:** `PASS` when notification payload is never sufficient.
- **Validates:** R007, R020, R021, R022.

### SPEC-041-AC007 Amount mismatch fails closed

- **Precondition:** R011-equivalent money checks in R024 and failure modes.
- **Input:** Provider reports paid with different amount than snapshot.
- **Action:** Confirm required response is fail closed, no ticket.
- **Expected result:** Incident/review; no `PAID` semantics.
- **Evidence:** R024, §11 amount-mismatch row.
- **Pass/fail rule:** `PASS` when amount mismatch cannot issue access.
- **Validates:** R024, R015.

### SPEC-041-AC008 Currency mismatch fails closed

- **Precondition:** R010, R024.
- **Input:** Provider reports paid with non-snapshot currency.
- **Action:** Confirm fail closed.
- **Expected result:** No ticket; incident.
- **Evidence:** R010, R024, §11 currency-mismatch row.
- **Pass/fail rule:** `PASS` when currency mismatch cannot issue access.
- **Validates:** R010, R024, R015.

### SPEC-041-AC009 Unknown order fails closed

- **Precondition:** R024 and §11 unknown-order row exist.
- **Input:** Verified provider object that does not correlate to a canonical
  order.
- **Action:** Confirm fail closed and incident/audit.
- **Expected result:** No ticket or registration confirmation.
- **Evidence:** R024, R015, §11.
- **Pass/fail rule:** `PASS` when unknown/uncorrelated order cannot issue
  access.
- **Validates:** R024, R015, R025.

### SPEC-041-AC010 Duplicate checkout or event has no duplicate business effect

- **Precondition:** R026, R027, R028, R029.
- **Input:** Repeated checkout / double-click with the same logical
  idempotency key, or repeated webhook/event for the same provider
  transaction.
- **Action:** Confirm checkout retry and event replay are effectively-once.
- **Expected result:** No second uncontrolled payable destination, hold, or
  order from repeated checkout. No second payment application, registration,
  ticket, or capacity conversion from duplicate events.
- **Evidence:** R026–R029.
- **Pass/fail rule:** `PASS` when repeated checkout and duplicate events are
  effect-free after the first successful application.
- **Validates:** R026, R027, R028, R029.

### SPEC-041-AC011 Repeated callback has no duplicate business effect

- **Precondition:** R006, R027.
- **Input:** Repeated return URL / frontend callback.
- **Action:** Confirm callback is non-authoritative and idempotent.
- **Expected result:** No duplicate business effect.
- **Evidence:** R006, R027, §11 repeated-return row.
- **Pass/fail rule:** `PASS` when callbacks cannot duplicate effects.
- **Validates:** R006, R027.

### SPEC-041-AC012 Repeated verification cannot duplicate ticket or registration

- **Precondition:** R029.
- **Input:** Two successful verifications of the same financial event.
- **Action:** Confirm ticket issuance and registration confirmation are
  effectively once.
- **Expected result:** Existing ticket/registration is reused; no second
  issuance or confirmation.
- **Evidence:** R029.
- **Pass/fail rule:** `PASS` when both duplicate ticket and duplicate
  registration are prohibited.
- **Validates:** R029, R015.

### SPEC-041-AC013 Capacity cannot decrement twice from the same financial event

- **Precondition:** R029.
- **Input:** Repeated conversion attempt for one verified payment.
- **Action:** Confirm hold conversion is effectively once.
- **Expected result:** Capacity is not decremented twice.
- **Evidence:** R029, R028.
- **Pass/fail rule:** `PASS` when double conversion is prohibited.
- **Validates:** R029.

### SPEC-041-AC014 Provider outage does not create false paid state

- **Precondition:** R034, §11 provider unavailable/timeout.
- **Input:** Checkout or GET failure.
- **Action:** Confirm named non-payable/pending/review state, not `PAID`.
- **Expected result:** No false paid state and no ticket.
- **Evidence:** R034, R015, §11.
- **Pass/fail rule:** `PASS` when outage cannot mark paid.
- **Validates:** R034, R015.

### SPEC-041-AC015 Malformed event does not mutate business state

- **Precondition:** §11 malformed webhook/event; R008.
- **Input:** Unparseable or unverifiable event.
- **Action:** Confirm no business mutation.
- **Expected result:** No order/payment/ticket/capacity change.
- **Evidence:** R008, R015, §11.
- **Pass/fail rule:** `PASS` when malformed events are inert.
- **Validates:** R008, R015.

### SPEC-041-AC016 Secrets remain server-side

- **Precondition:** R012, R038.
- **Input:** Secret-handling requirements.
- **Action:** Confirm prohibition of frontend/`VITE_*`/repo/logs exposure.
- **Expected result:** No secret values are specified or exemplified in this
  draft.
- **Evidence:** R012, R038, this document’s text (no credential values).
- **Pass/fail rule:** `PASS` when secrets are server-side only and this file
  contains no secret values.
- **Validates:** R012, R038.

### SPEC-041-AC017 PAN/CVV are not captured

- **Precondition:** R011, R018.
- **Input:** Hosted/redirected path table.
- **Action:** Confirm Checkout Transparente / direct card data is not the
  initial path.
- **Expected result:** Ready2Hybrid does not capture PAN/CVV.
- **Evidence:** R011, R018, non-goals.
- **Pass/fail rule:** `PASS` when hosted/redirected is mandatory for v1.
- **Validates:** R011, R018.

### SPEC-041-AC018 Sandbox and production are isolated

- **Precondition:** R037, R038.
- **Input:** Environment-isolation requirements.
- **Action:** Confirm credentials, endpoints, webhooks, and transactions must
  not be mixed; implemented ≠ production-ready. Confirm Clip Checkout Redirect
  test-mode environment capability is classified `KNOWN_MISSING`, distinct
  from uninspected account credentials (`UNKNOWN` / `BLOCKED_BY_ACCOUNT`).
- **Expected result:** Explicit isolation, later production-readiness gate,
  and no `UNKNOWN` classification for Clip Redirect test-mode capability.
- **Evidence:** R037, R038, OD-041-004, Appendix A/B.
- **Pass/fail rule:** `PASS` when isolation and non-automatic production
  enablement are explicit, Clip Redirect test mode is `KNOWN_MISSING`, and
  Checkout Transparente is not a fallback.
- **Validates:** R037, R038.

### SPEC-041-AC019 Normalized state does not collapse order into payment

- **Precondition:** R013, R031, R032.
- **Input:** Existing SPEC-032 order and payment literals.
- **Action:** Confirm this draft reuses those literals and keeps them
  separate.
- **Expected result:** No new conflicting enums; public projection remains
  distinct.
- **Evidence:** R013, R031, R032.
- **Pass/fail rule:** `PASS` when order, payment, and public projection stay
  separate and existing names are preserved.
- **Validates:** R013, R031, R032.

### SPEC-041-AC020 Three providers share the core contract without identical security mechanisms

- **Precondition:** R018–R022.
- **Input:** Hosted checkout + verifyEvent + getPayment + normalizeStatus.
- **Action:** Confirm all three fit the core operations while authenticity
  mechanisms differ.
- **Expected result:** Same core contract; different verifiers.
- **Evidence:** R008, R018–R022, §10.
- **Pass/fail rule:** `PASS` when the core is shared and verifiers differ.
- **Validates:** R008, R018, R019, R020, R021, R022.

### SPEC-041-AC021 PayPal is not required by initial implementation

- **Precondition:** R004, non-goals.
- **Input:** Entire draft.
- **Action:** Search for PayPal adapter, credentials, webhook, UI, or tests as
  requirements.
- **Expected result:** PayPal appears only as dormant/future.
- **Evidence:** R004, §5, R039.
- **Pass/fail rule:** `PASS` when no initial PayPal implementation requirement
  exists.
- **Validates:** R004, R039.

### SPEC-041-AC022 Clip/Openpay financing remains open

- **Precondition:** R033.
- **Input:** MSI statements per provider.
- **Action:** Confirm Mercado Pago policy is unchanged and Clip/Openpay remain
  `OPEN DECISION` without a silent cash fallback. Confirm Openpay `3, 6, 9,
  12, 18` is qualified as Charges PaymentPlan capability, not all hosted
  products.
- **Expected result:** No invented Clip/Openpay financing policy. Openpay MSI
  months are not asserted for every hosted Openpay product.
- **Evidence:** R033, §17.
- **Pass/fail rule:** `PASS` when Clip/Openpay MSI are open, MP policy is
  untouched, and Openpay terms are Charges PaymentPlan-qualified.
- **Validates:** R033.

### SPEC-041-AC023 No unauthorized surcharge

- **Precondition:** R014.
- **Input:** Fee/surcharge prohibition.
- **Action:** Confirm contractual price cannot be increased by PSP fees
  without a future human decision.
- **Expected result:** No payment/convenience/provider fee in this contract.
- **Evidence:** R014, non-goals.
- **Pass/fail rule:** `PASS` when surcharges are prohibited.
- **Validates:** R014.

### SPEC-041-AC024 Uncertain outcomes do not issue tickets

- **Precondition:** R015, R035, §11.
- **Input:** Ambiguous/unverified/mismatched cases.
- **Action:** Confirm tickets are forbidden under uncertainty.
- **Expected result:** Review/incident path only.
- **Evidence:** R015, R035, §11.
- **Pass/fail rule:** `PASS` when uncertainty cannot issue tickets.
- **Validates:** R015, R035.

### SPEC-041-AC025 Audit without secrets

- **Precondition:** R040.
- **Input:** Audit minimum and prohibited fields.
- **Action:** Confirm required identifiers/outcomes exist and secrets/PAN are
  excluded.
- **Expected result:** Observable verification/failure evidence without secret
  values.
- **Evidence:** R040, R012.
- **Pass/fail rule:** `PASS` when audit minimum is specified and prohibited
  data is excluded.
- **Validates:** R040, R012.

### SPEC-041-AC026 Existing Mercado Pago behavior remains wrappable

- **Precondition:** R005, R020, impact analysis.
- **Input:** SPEC-001-R013, SPEC-031 webhook contract, current `mp-webhook`.
- **Action:** Confirm this draft is additive and does not require rewriting
  Checkout Pro in MULTI-PAY-0.
- **Expected result:** MP remains first provider; existing verifier path is
  preserved; no silent supersession of SPEC-031.
- **Evidence:** R005, R016, R020, §16.
- **Pass/fail rule:** `PASS` when the draft is additive and non-implementing.
- **Validates:** R005, R016, R020.

### SPEC-041-AC027 Payment layer accepts only payment-eligible canonical orders

- **Precondition:** R043, R044, R045 and §10 are present.
- **Input:** This DRAFT.
- **Action:** Search for MUST/MUST NOT that bind Multi-Pay to a SKU count,
  retired set, prize amount, competition day, or session token. Confirm
  checkout requires a sales-domain `PAYMENT_ELIGIBLE` canonical order and
  adapter amount from that order.
- **Expected result:** No payment-layer catalog composition rules. Checkout
  is gated on payment-eligible canonical orders. Adapter inputs exclude
  frontend price and sales-domain decisions.
- **Evidence:** Requirement search plus §10 contract.
- **Pass/fail rule:** `PASS` when R043–R045 hold and no SKU-count/retired-set
  /prize/day MUST exists; `FAIL` otherwise.
- **Validates:** R043, R044, R045.

### SPEC-041-AC028 Edition-reusable without catalog coupling

- **Precondition:** R045 and non-goals are present.
- **Input:** This DRAFT.
- **Action:** Confirm a later sales-domain change of product, day, price, or
  award would not require changing this payment contract’s provider adapters
  for catalog reasons.
- **Expected result:** Multi-Pay stays valid across event editions.
- **Evidence:** R045, non-goals, §3 reconciliation note.
- **Pass/fail rule:** `PASS` when catalog/schedule/awards are excluded from
  the payment contract.
- **Validates:** R045.

## 14. Validation plan

This document is `APPROVED`. Validation of the specification itself:

1. Confirm status is `APPROVED` and this approval does not by itself authorize
   runtime implementation.
2. Confirm requirement IDs `SPEC-041-R001`–`SPEC-041-R045` are unique.
3. Confirm acceptance IDs `SPEC-041-AC001`–`SPEC-041-AC028` are unique and
   each maps to one or more requirements.
4. Confirm active providers are Mercado Pago, Clip, and Openpay.
5. Confirm PayPal is dormant and has no initial implementation requirements.
6. Confirm redirect non-authority, provider-specific verifiers, amount,
   currency, correlation, fail-closed, idempotency, secrets, sandbox/prod
   isolation, MSI open decisions, and existing-spec impact are present.
7. Confirm this file does not encode SKU counts, retired category sets, prize
   amounts, or competition-day/session rules as payment MUST/MUST NOT.
8. Confirm checkout is gated on sales-domain `PAYMENT_ELIGIBLE` canonical
   orders.
9. Confirm the file contains no SQL, TypeScript interface, secret values, or
   migration.
10. Independent review `MULTI-PAY-1C` completed with `READY_FOR_APPROVAL`.
    This approved version MUST NOT be treated as `READY_FOR_IMPLEMENTATION`.
    The next authorized unit is `MULTI-PAY-2` implementation traceability only.

Runtime tests remain out of scope until an authorized implementation unit
exists.

## 15. Traceability

| Requirement | Authority source | Rationale | Acceptance criteria |
|---|---|---|---|
| R001 | SPEC-001 R010; docs/01; this unit | Canonical order stays Ready2Hybrid; Multi-Pay does not own sales rules | AC001, AC027 |
| R002 | This unit; docs/05 payments agnostic | PSP owns only its financial object | AC001 |
| R003 | Project Owner 2026-08-21 | Three active providers | AC002 |
| R004 | Project Owner 2026-08-21 | PayPal dormant | AC002, AC021 |
| R005 | SPEC-001 R013, R018; SPEC-000 R018 | Additive, not replacement | AC026 |
| R006 | SPEC-001 R014; SPEC-031; this unit | Redirect is not payment approval | AC004, AC011 |
| R007 | SPEC-001 R014; SPEC-031 A.3 | Server verification required | AC004, AC006 |
| R008 | This unit; official PSP docs | Verifiers are not interchangeable | AC005, AC015, AC020 |
| R009 | SPEC-031 checkout contract; this correction | Frontend cannot set commercial fields; sales domain resolves them first | AC001, AC003 |
| R010 | SPEC-032 money invariants | MXN | AC003, AC008 |
| R011 | This unit security boundary | No PAN/CVV | AC017 |
| R012 | SPEC-000 R021; SPEC-001 R016 | Secrets stay server-side | AC016, AC025 |
| R013 | SPEC-031 public states; SPEC-032 order vs payment | Do not collapse statuses | AC019 |
| R014 | This unit; SPEC-032 no extra surcharge | No PSP markup to buyer | AC023 |
| R015 | SPEC-032 fail-closed; this unit | No ticket under uncertainty | AC004, AC007–AC009, AC014, AC024 |
| R016 | SPEC-000 R006, R025 | Draft is not implementation authority | AC026 |
| R017 | Project Owner; this unit | Selection from enabled active set | AC002 |
| R018 | Official Clip/Openpay/MP docs 2026-08-21; MX Openpay re-checked 2026-08-22 | Hosted/redirected v1; Openpay current MX mechanism not forever-shape | AC017, AC020 |
| R019 | docs/05 §2.3 PaymentProvider | Minimal conceptual adapter | AC020 |
| R020 | SPEC-001 R013; SPEC-031 A.3 | Preserve Checkout Pro | AC005, AC006, AC026 |
| R021 | Clip official Checkout Redirect + GET | Clip hosted path + GET-after-event | AC005, AC006, AC020 |
| R022 | Openpay official MX hosted charge + GET charge; Basic auth is ingress only | Openpay hosted path + GET-after-event; Basic ≠ financial state | AC005, AC006, AC020 |
| R023 | SPEC-031 A.2; SPEC-032 C.1 | Snapshot amount/currency to PSP | AC001, AC003 |
| R024 | SPEC-031 A.3; this unit | Correlation/amount/currency gates | AC007–AC009 |
| R025 | SPEC-032 Payment uniqueness; physical `(provider, provider_payment_id)` | Idempotent financial identity | AC009, AC010 |
| R026 | SPEC-031 A.6 checkout idempotency | Repeat checkout / double-click | AC010 |
| R027 | SPEC-031 A.3/A.6 | Repeat event/callback/lookup | AC010, AC011 |
| R028 | SPEC-032 one provider payment ↛ two orders | Duplicate financial application | AC010, AC013 |
| R029 | SPEC-031 ticket/registration/capacity effectively-once | No double access/capacity | AC010, AC012, AC013 |
| R030 | Existing `mp-webhook`; this unit | Distinct ingress per PSP | AC005, AC006 |
| R031 | SPEC-032 payment literals; official PSP statuses | Normalize without new enums | AC019, AC020 |
| R032 | SPEC-032 order transitions | Keep order names | AC019 |
| R033 | Effective sales-contract MP MSI; Clip installments_msi; Openpay Charges PaymentPlan only | MP unchanged; others open; Openpay months not all hosted products | AC022 |
| R034 | SPEC-031 checkout failure; this unit | Outage/timeout fail closed | AC014 |
| R035 | SPEC-032 REQUIRES_REVIEW | Ambiguity to review | AC024 |
| R036 | SPEC-032 REFUNDED/CHARGED_BACK; docs/04 commercial policy | Recognize ≠ execute | AC019, AC024 |
| R037 | Official sandbox/prod docs; Clip pruebas 2026-08-22; SPEC-001 secrets | Environment isolation; Clip Redirect test-mode `KNOWN_MISSING` | AC018 |
| R038 | SPEC-001 R016 | Server-side config | AC016, AC018 |
| R039 | This unit non-goals | No speculative extra PSPs | AC002, AC021 |
| R040 | SPEC-001 R015/R024; SPEC-000 R010 | Safe audit minimum | AC025 |
| R041 | SPEC-031 webhook timing; this unit | Bounded calls | AC014 |
| R042 | Clip/Openpay expiration docs; SPEC-040 | Expired ≠ paid; PAID immune | AC014, AC024 |
| R043 | Project Owner 2026-08-22 Multi-Pay correction | Checkout only for payment-eligible canonical orders | AC001, AC027 |
| R044 | Project Owner 2026-08-22 Multi-Pay correction | Adapter input is resolved order snapshot | AC001, AC003, AC027 |
| R045 | Project Owner 2026-08-22 Multi-Pay correction | Edition-reusable; no catalog encoding | AC027, AC028 |

Future implementation areas (not files in this unit):

- payment orchestration;
- provider adapters (`PaymentProvider`);
- provider verifier endpoints / sibling functions;
- order/payment persistence (existing SPEC-032 entities);
- checkout UI provider selection;
- observability/audit fields;
- server-side provider configuration;
- provider-specific tests.

## 16. Impact on existing specifications

This DRAFT does not modify any approved specification.

| Spec | Impact | Explanation |
|---|---|---|
| SPEC-000 v0.2.0 | NO IMPACT | Governance unchanged. This document is a new DRAFT under existing numbering and structure rules. |
| SPEC-001 v0.1.0 | ADDITIVE IMPACT; FUTURE PATCH MAY BE REQUIRED | R013 requires Mercado Pago Checkout Pro as the **first** provider, not the only provider. This draft preserves that. The architecture diagram currently names only Mercado Pago. A future patch MAY mention Clip/Openpay as additional providers. Not an authority conflict. |
| SPEC-030 v0.3.0 | NO IMPACT | This draft does not modify SPEC-030 and does not copy catalog composition, SKU counts, retired sets, schedule, or awards. Landing-master reconciliation is in progress on Lane A. Mercado Pago MSI policy remains a sales-contract authority that Multi-Pay MUST NOT rewrite. `SALES_STATUS` remains closed. |
| SPEC-031 v0.3.0 | ADDITIVE IMPACT; FUTURE PATCH MAY BE REQUIRED | Payment/webhook/redirect invariants are carried forward and preserved. Internal operation “Create Mercado Pago preference” and Checkout Pro destination remain valid for Mercado Pago. Adding Clip/Openpay destinations later MAY require a SPEC-031 patch to generalize OP-PUB-04 destination and the internal preference row without weakening MP checks. Any such future patch MUST NOT import event-edition SKU counts or retired sets into the payment contract. This draft does not perform that patch and does not silently supersede SPEC-031. |
| SPEC-032 v0.3.0 | ADDITIVE IMPACT; FUTURE PATCH MAY BE REQUIRED | Payment is already provider-agnostic (`provider`, unique provider payment id, normalized states including `REFUNDED`/`CHARGED_BACK`). Order name `PREFERENCE_PENDING` is Mercado Pago-worded but reusable as “provider checkout object pending link.” A future patch MAY generalize that wording. Physical unique `(provider, provider_payment_id)` already matches R025. No incompatible schema is imposed by this draft. |
| SPEC-040 v0.1.1 | NO IMPACT | Expiry remains compatible; this draft forbids treating expiry as paid and preserves PAID immunity. |

There is no `AUTHORITY CONFLICT` that prevents an additive DRAFT. SPEC-001-R013
and SPEC-000-R018 forbid replacing Mercado Pago Checkout Pro; this draft does
not replace it.

## 17. Open decisions

### OD-041-001 Clip MSI / installments policy

- **Decision:** Whether Clip checkout offers MSI, which terms, and at what
  cost.
- **Why unresolved:** Official capability exists (`installments_msi`);
  commercial policy, account capability, and cost are human decisions.
- **Owner:** Project Owner (product/commercial); CTO (technical fit).
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks Clip financing enablement only.
  Does not block core hosted checkout without financing.

### OD-041-002 Openpay MSI / installments policy

- **Decision:** Whether Openpay charges use Charges `PaymentPlan`, which
  terms, and at what cost. Documented Charges PaymentPlan months (`3, 6, 9,
  12, 18`) are not automatically a hosted-product policy.
- **Why unresolved:** Official capability exists; policy is not authorized.
- **Owner:** Project Owner; CTO.
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks Openpay financing enablement only.

### OD-041-003 Provider selection UX

- **Decision:** Visual order, default provider, logos, recommendation,
  cheapest, promotions, financing highlights, steering.
- **Why unresolved:** Explicitly not decided.
- **Owner:** Project Owner.
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks UX polish only, not backend
  contract.

### OD-041-004 Clip Checkout Redirect test-strategy evidence

- **Decision:** How Ready2Hybrid will obtain provider-specific integration
  evidence for Clip hosted Checkout Redirect given that the provider currently
  does not support that product in test mode (`KNOWN_MISSING` environment
  capability). This is no longer a question of whether Redirect has official
  test-mode support.
- **Why unresolved:** Test strategy is not selected. Candidate strategies that
  MUST NOT be treated as chosen by this draft include: isolated controlled
  production validation; future Clip test-mode support; a provider/account-
  specific facility; an alternative test harness/mocks; a future approved
  architecture change. Checkout Transparente is **not** authorized as a
  fallback by this draft.
- **Owner:** CTO with Project Owner.
- **Blocks spec review:** No. Non-blocking for the core payment contract.
- **Blocks future implementation:** Blocks Clip hosted Checkout Redirect
  provider-specific E2E evidence until a test strategy is resolved. Does not
  block specifying the hosted contract. Before executing the conceptual unit
  `MULTI-PAY-5 — CLIP ADAPTER + SANDBOX`, a test-strategy / naming review is
  required (`FUTURE UNIT TEST-STRATEGY / NAMING REVIEW REQUIRED`). This draft
  MUST NOT rename or execute that unit.

### OD-041-005 Production enablement per provider

- **Decision:** Which active providers may be enabled in production, and when.
- **Why unresolved:** Account readiness is not `KNOWN_READY`; production
  authorization is a later unit.
- **Owner:** Project Owner.
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks production activation, not contract
  review.

### OD-041-006 Exact webhook URL paths for Clip and Openpay

- **Decision:** Final function/path names.
- **Why unresolved:** Implementation choice; retaining `mp-webhook` reduces
  risk.
- **Owner:** CTO during a later implementation plan.
- **Blocks spec review:** No.
- **Blocks future implementation:** No, if sibling distinct ingress is
  preserved.

### OD-041-007 Multi-provider refund execution

- **Decision:** If/when Ready2Hybrid may initiate refunds at Clip/Openpay.
- **Why unresolved:** Recognition of `REFUNDED`/`CHARGED_BACK` already exists;
  execution is deferred. Commercial policy remains “no refunds / transfer”
  unless later changed by Project Owner.
- **Owner:** Project Owner (policy); CTO (technical contract).
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks refund-execution API only.

### OD-041-008 Landing master ↔ Ready2Hybrid sales reconciliation

- **Decision:** Final event-edition catalog, schedule, prices, and awards.
- **Why unresolved:** `LANDING_MASTER_R2H_RECONCILIATION = IN_PROGRESS`.
- **Owner:** Project Owner / Lane A (sales domain). Multi-Pay MUST NOT decide
  it.
- **Blocks spec review:** No.
- **Blocks future implementation:** Blocks using unreconciled catalog details
  inside Multi-Pay implementation. Does not block reviewing this decoupled
  payment DRAFT.

## 18. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.1.0 | 2026-08-21 | DRAFT | Cursor, authorized by Project Owner via MULTI-PAY-0-SPEC-DRAFT | Draft additive multi-provider payment contract for Mercado Pago, Clip, and Openpay. No implementation, no approval, no SALES_STATUS change. |
| 0.1.0 | 2026-08-22 | DRAFT | Cursor, authorized by Project Owner via MULTI-PAY correction pass | Withdraw sales-domain leaks (SKU counts, retired-set copy, event dates as payment facts). Gate checkout on `PAYMENT_ELIGIBLE` canonical orders. Record landing-master reconciliation as in progress. No approved-spec or Lane A changes. |
| 0.1.0 | 2026-08-22 | DRAFT | Cursor, authorized by Project Owner via MULTI-PAY-1B findings correction | Address MULTI-PAY-1 review F-001–F-004: Clip Redirect test-mode `KNOWN_MISSING`; Openpay hosted boundary vs current MX mechanism; account-readiness hygiene; R026/AC010, Openpay Basic vs GET, Charges PaymentPlan qualifier. Status remains DRAFT. No approved-spec or Lane A changes. |
| 0.1.0 | 2026-08-22 | IN_REVIEW | Project Owner | MULTI-PAY-1C second independent spec review result `READY_FOR_APPROVAL`. Lifecycle `DRAFT -> IN_REVIEW` recorded in this approval unit. Zero normative change. |
| 0.1.0 | 2026-08-22 | APPROVED | Leandro Espinosa, Project Owner | Explicit human approval: `APRUEBO SPEC-041 — MULTI-PROVIDER PAYMENT CONTRACT.` Lifecycle `IN_REVIEW -> APPROVED`. Approved version 0.1.0. Zero normative change from the reviewed draft. Does not authorize implementation in this unit. |

## Appendix A — Official provider documentation consulted

Date checked: 2026-08-21. Clip `Pruebas / Sandbox` and Openpay Mexico hosted
path independently re-checked 2026-08-22. Paraphrased. No large external
blocks copied.

| Provider | Official source | Capability verified | Environment applicability | Important limitation |
|---|---|---|---|---|
| Mercado Pago | Existing approved SPEC-031/001 plus Mercado Pago Developers documentation search for Checkout Pro / payments / `x-signature` (MLM, 2026-08-21) | Checkout Pro; signed webhook; GET payment | Test and production credentials are distinct in current Ready2Hybrid practice | Redirect remains non-authoritative |
| Clip | https://developer.clip.mx/docs/api-de-checkout | Hosted Checkout Redirect; create payment link; return to store | Requires Clip account, auth token, identity verification | Hosted page collects payment data |
| Clip | https://developer.clip.mx/reference/createnewpaymentlink | `POST` checkout; `webhook_url`; `payment_request_url` | Same | Response lost must be reconciled by GET, not by assuming create failed |
| Clip | https://developer.clip.mx/reference/checkpaymentlinkstatus | Authenticated GET of payment link; statuses including `CHECKOUT_COMPLETED`; `currency` example `MXN`; `redirection_url`; `metadata.external_reference` | Same | Success redirect is not verification |
| Clip | https://developer.clip.mx/reference/checkout-webhook | Checkout webhook statuses CREATED/PENDING/COMPLETED/CANCELED/EXPIRED; refund resource | Configured per payment link via `webhook_url` | No HMAC/signature scheme documented on this page |
| Clip | https://developer.clip.mx/reference/webhookshxo | Webhook is a handle; GET checkout for truth | Same | Body must not be trusted as final state |
| Clip | https://developer.clip.mx/reference/introduccion-a-clip-checkout | `installments_msi`; MXN and USD mentioned; `expires_at` | MXN is in scope for Ready2Hybrid | USD is out of this contract |
| Clip | https://developer.clip.mx/reference/pruebas | Test credentials exist; test-mode APIs listed | Environment: Checkout Redirect **not** in the test-mode list; any unlisted API does not work in test mode | Checkout Redirect test-mode capability = `KNOWN_MISSING` (environment, not account) |
| Openpay | https://documents.openpay.mx/docs/api | Sandbox `https://sandbox-api.openpay.mx` vs production `https://api.openpay.mx`; Basic API auth with private key | Separate credentials after production approval | Do not mix environments |
| Openpay | https://documents.openpay.mx/docs/api (hosted/virtual-terminal charge) | MX hosted/redirected no-PAN path: currently documented mechanism is `confirm=false` + `redirect_url` hosted form; no card token required | Sandbox and production URIs | Current MX mechanism, not a frozen exclusive forever-shape. Colombia `/checkouts` + `checkout_link` is **not** a Mexico requirement of this draft |
| Openpay | https://documents.openpay.mx/docs/api GET charge | `GET /v1/{MERCHANT_ID}/charges/{TRANSACTION_ID}` | Same | Server-side retrieval exists |
| Openpay | https://documents.openpay.mx/docs/api webhooks | Webhook object with Basic `user`/`password`; URL verification ping; events including `charge.succeeded` / `failed` / `cancelled` / `refunded` / `chargeback.accepted` | Dashboard or API; sandbox vs production | HTTP Basic authenticates ingress only; it is not financial truth. GET the charge for financial state |
| Openpay | https://documents.openpay.mx/docs/api PaymentPlan | Charges `PaymentPlan.payments` 3, 6, 9, 12, 18 | Account/commercial capability not inspected | Charges PaymentPlan capability only; not all hosted products. Policy OPEN |
| Openpay | https://documents.openpay.mx/docs/api transaction status | Documented `completed`, `in_progress`, `failed`; examples also show `charge_pending` | Same | Unlisted values → `UNKNOWN` |

## Appendix B — Account readiness matrix

States allowed: `KNOWN_READY`, `KNOWN_MISSING`, `UNKNOWN`,
`BLOCKED_BY_ACCOUNT`.

Three dimensions MUST remain distinct:

1. **Public provider capability** — what official docs say the product can do.
2. **Project account readiness** — whether this project’s account/credentials
   are known to exist and be usable. Uninspected secrets are `UNKNOWN` or
   `BLOCKED_BY_ACCOUNT`, not `KNOWN_MISSING`.
3. **Environment availability** — whether a documented environment (for
   example test mode) supports that product.

`KNOWN_MISSING` is used only when evidence shows the thing is actually
absent. Example: Clip Checkout Redirect is absent from the official test-mode
API list → environment availability `KNOWN_MISSING`. That does not prove
project credentials are missing.

This unit did not inspect live accounts or secret presence values.

### Mercado Pago

| Item | Documented capability | Account readiness (this unit) |
|---|---|---|
| Account / app | Exists as current first provider | `UNKNOWN` (not re-inspected here) |
| Checkout product | Checkout Pro `KNOWN` as capability | `UNKNOWN` for current production enablement |
| Sandbox/test credential readiness | Distinct test credentials are part of the approved integration | `UNKNOWN` (secrets not read) |
| Production credentials | Required later; historically not authorized for production sales | `UNKNOWN` / not production-authorized |
| Webhook / authenticity | `x-signature` + GET payment documented and already specified | Historical production webhook: not configured per `WORKSPACE_STATUS.md`; current secret/URL not inspected → `UNKNOWN` |
| Sandbox E2E readiness | Prior sandbox E2E exists as historical operational evidence | `UNKNOWN` for current multi-provider unit; prior evidence is not re-certified here |
| Production E2E readiness | Not authorized | `UNKNOWN` (not production-ready) |

### Clip

| Item | Documented capability / environment | Account readiness (this unit) |
|---|---|---|
| Account | Required by official docs | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` until inspected |
| Developer / API access | Auth token model documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` (not inspected; secrets not read) |
| Hosted checkout capability | Checkout Redirect documented (production-context public capability: present) | Account `UNKNOWN` |
| Checkout Redirect test-mode environment | Official test-mode API list does not include Checkout Redirect; unlisted APIs do not work in test mode | Environment availability `KNOWN_MISSING`. Not an account-credential fact |
| Credentials | Bearer token model documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` (not inspected; secrets not read) |
| Webhook / event configuration | `webhook_url` on create documented | `UNKNOWN` |
| Server verification capability | GET checkout documented | Capability yes; account `UNKNOWN` |
| Production enablement | Production product exists as capability | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` |
| MSI / account capability | `installments_msi` documented | `UNKNOWN` (policy and account both open) |

### Openpay

| Item | Documented capability / environment | Account readiness (this unit) |
|---|---|---|
| Merchant / account | Merchant ID model documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` until inspected |
| API access | Private/public keys + Basic auth documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` (not inspected; secrets not read) |
| Hosted checkout capability | MX hosted/redirected no-PAN path documented; current mechanism `confirm=false` + `redirect_url` | Capability yes; account `UNKNOWN` |
| Sandbox | `sandbox-api.openpay.mx` documented for the Charges API | Environment capability yes; account `UNKNOWN` |
| Credentials | Separate sandbox vs production keys documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` (not inspected; secrets not read) |
| Webhook configuration | Dashboard/API webhooks documented | `UNKNOWN` |
| Server verification capability | GET charge documented | Capability yes; account `UNKNOWN` |
| Production enablement | Production API documented | `UNKNOWN` / `BLOCKED_BY_ACCOUNT` |
| MSI / account capability | Charges `PaymentPlan` documented | `UNKNOWN` (policy and account both open; not all hosted products) |

No secret values are included.

## Appendix C — Contradiction scan summary

### A. Resolved facts

- Three active providers: Mercado Pago, Clip, Openpay.
- PayPal dormant / out of initial scope.
- Canonical order remains Ready2Hybrid.
- Redirect is non-authoritative.
- Server-side verification required.
- MXN contractual currency.
- No PAN/CVV capture.
- Secrets server-side.
- No unauthorized surcharge.
- Mercado Pago remains first provider and additive.
- Existing payment/order literals remain.
- `SALES_STATUS` stays closed.
- Multi-Pay does not own catalog, schedule, or awards.
- Checkout requires a sales-domain `PAYMENT_ELIGIBLE` canonical order.
- `LANDING_MASTER_R2H_RECONCILIATION = IN_PROGRESS`.
- This document is DRAFT only.

### B. Implementation choices

- Exact Clip/Openpay function names and URL paths.
- Whether to retain `mp-webhook` unchanged (allowed).
- SDK versus direct HTTP for later adapters.
- Concrete observability tooling.
- Mapping of Clip/Openpay correlation fields onto existing
  `external_reference` / `order_id` / metadata, provided uniqueness and
  server ownership hold.
- Retention of `PREFERENCE_PENDING` name for non-MP checkout objects until a
  future SPEC-032 patch.

### C. Open human decisions

See §17 (MSI Clip/Openpay, UX steering, Clip Redirect test-strategy evidence,
production enablement, refund execution, landing-master sales reconciliation).

### D. Prohibited behavior

- Implementing from this DRAFT.
- Replacing Mercado Pago Checkout Pro.
- Trusting redirects or unsigned/unverified event bodies.
- Copying MP MSI onto Clip/Openpay.
- Introducing PayPal v1 requirements.
- Buyer-facing PSP surcharges.
- Capturing PAN/CVV.
- Declaring production-ready from implementation alone.
- Inventing a cash fallback as commercial policy.
- Modifying approved specs in this unit.
- Encoding SKU counts, retired category sets, prizes, or competition days in
  the payment contract.
- Computing commercial eligibility inside a PSP adapter.
