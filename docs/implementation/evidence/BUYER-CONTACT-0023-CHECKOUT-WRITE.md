# BUYER-CONTACT-0023 — Checkout contact write (PASO 2)

```text
Unit: BUYER-CONTACT-0023-CHECKOUT-WRITE
Title: contact_consent_at + checkout_start_tx writes email/name/phone/consent
Mode: LOCAL AUTHORING ONLY — NOT APPLIED TO MAIN
Date: 2026-08-25 (America/Merida)
Actor: Cursor
Authority: Project Owner decisions PASO 2 (explicit)
Predecessor DDL: 0022_buyer-contact-fields.sql (NOT applied to Main yet)
Migration: insforge/migrations/0023_buyer-contact-checkout-write.sql
```

## 1. Owner decisions (binding)

| # | Decision |
|---|---|
| 1 | `contact_consent_at timestamptz NULL` (opt-in when set; NULL = no consent) |
| 2 | Public error `CONTACT_REQUIRED` (same pattern as `WAIVER_REQUIRED`) when email/name missing |
| 3 | New migration **0023** — do not edit published 0022 |
| 4 | 0023 includes column **and** `CREATE OR REPLACE checkout_start_tx` |
| 5 | Landing: contact step **before** payment, not inside sandbox card; landing work is a separate repo/session |
| 6 | `selected_provider` gap on landing = **pre-existing**, out of this unit |

## 2. What shipped (this repo)

### Migration `0023_buyer-contact-checkout-write.sql`

- `ALTER TABLE buyer_contacts ADD COLUMN contact_consent_at timestamptz`
- `checkout_start_tx` requires `buyer_email` + `buyer_name`; optional `buyer_phone`
- `buyer_contact_consent` boolean → `contact_consent_at = now()` when true, else NULL
- Loose `@` check mirrors 0022 CHECK; returns `CONTACT_REQUIRED` on fail
- Preserves v0.4 organizer `sale_state` SOLD_OUT (no cupo commercial SOLD_OUT)

### Edge / shared

- `validate.ts`: `buyer` required; `email`/`name` required; `phone` optional; `contact_consent` optional boolean
- `assertBuyerContactRequired` → `CONTACT_REQUIRED` before Zod
- `errors.ts`: `CONTACT_REQUIRED` (409)
- `orchestrate.ts` + `mp-create-checkout/index.ts`: pass buyer contact fields to RPC
- `handler.deploy.js` regenerated via `npm run bundle:checkout`

### Tests

Fixtures updated: `checkout-start`, `validate-forbidden-keys`, `spectator-quantity`, `msi-preference-spike`, `multiday-checkout-eligibility`; canonical TX pointer → 0023.

## 3. PII / consent separation

| Field | Use |
|---|---|
| email, name, phone | Ticket delivery + operational contact (PII) |
| contact_consent_at | Marketing/news/events opt-in (distinct from sports waiver) |
| waiver_* / waiver_acceptances | SPEC-030 participation waiver — **not** this consent |

## 4. Landing note (not implemented here)

`hybrid-event-landing` has **no** `RegistroPage`. Checkout today is card → `createCheckout` with only `product_code` / `quantity` / `idempotency_key`.

**Recommendation for landing session:** add a dedicated pre-payment contact step (new route/page such as `RegistroPage` or `/checkout/contacto`) that collects email, name, optional phone, and unchecked opt-in; then call `mp-create-checkout` with `buyer` + (separately) `selected_provider` / waiver. Do **not** bury the form inside the sandbox product card.

Also note: landing still omits `selected_provider` while orchestrate requires it — fix in the landing unit, not here.

## 5. Apply posture

```text
MAIN APPLY 0022 = NOT AUTHORIZED by this unit
MAIN APPLY 0023 = NOT AUTHORIZED by this unit
When authorized: apply 0022 then 0023, then deploy bundled mp-create-checkout
git push = NOT in this unit (Owner may authorize later)
```

## 6. Gates

```text
npm run typecheck     → PASS
npm test              → PASS (48 files / 583 tests)
npm run build         → PASS
npm run bundle:checkout → regenerated handler.deploy.js
```
