# IMPL-13C — Single Spectator Sandbox E2E Preparation

```text
Unit: IMPL-13C — Single spectator end-to-end in sandbox
Mode: PREPARATION ONLY · NO EXECUTION · NO MAIN WRITES · NO PRODUCTIVE SALES
Prepared after: IMPL-13B VALIDATED / CLOSED (human 2026-07-26)
Ready2Hybrid HEAD at preparation: 0cb8b12
Landing HEAD at preparation: 9b9cf48
Sandbox: impl-13b-spectator-wiring / 4bg9ufz2-rug
Host: https://4bg9ufz2-rug.us-east.insforge.app
Status: PREPARED / AWAITING_EXECUTION_AUTHORIZATION
Gate: READY_FOR_IMPL_13C_SPECTATOR_SANDBOX_E2E
```

## 1. Objective (when execution is authorized)

Validate **one** spectator purchase path in sandbox:

```text
Landing (local, sandbox flags) → mp-create-checkout → Mercado Pago Checkout Pro (test)
→ payment approved (test buyer) → mp-webhook (test) → order PAID
→ get-order-status public projection → tickets/credentials/entitlements as designed
```

Product focus:

```text
PUB-VIE · quantity 1 · price alignment already accepted for spectator smoke
```

## 2. Authorized surfaces (execution unit only)

| Surface | Role |
|---|---|
| Landing `hybrid-event-landing` | Local sandbox checkout UI (`VITE_CHECKOUT_MODE=sandbox`, enabled flag, functions base → rug host) |
| InsForge sandbox `4bg9ufz2-rug` | Event may be opened for test sales **only on sandbox** if required by the execution unit |
| Mercado Pago **test** credentials / test buyer | Checkout Pro test payment only |
| Ready2Hybrid functions already on sandbox | `mp-create-checkout`, `get-order-status`, `mp-webhook` as needed |

## 3. Explicitly forbidden

```text
Main EN_VENTA
Main transactional writes for this E2E (prefer sandbox-only path)
productive MP credentials
productive webhook panel enablement
real-money payments
public launch / marketing enablement of checkout
broad catalog E2E beyond the single spectator case
replacing InsForge gateway CORS architecture
removing application Origin enforcement
```

## 4. Preconditions checklist

| # | Precondition | Baseline |
|---|---|---|
| 1 | IMPL-13B closed | `VALIDATED / CLOSED` |
| 2 | Application Origin gate active on sandbox functions | `0cb8b12` deployed |
| 3 | Landing atomic submit lock present | `9b9cf48` |
| 4 | Sandbox host | `https://4bg9ufz2-rug.us-east.insforge.app` |
| 5 | CORS env on sandbox | `CHECKOUT_CORS_ORIGIN` / `ORDER_STATUS_CORS_ORIGIN` = `http://localhost:3000` |
| 6 | Gateway CORS residual | Accepted for sandbox (ACAO `*` / reflected OPTIONS) |
| 7 | Main event | remains `CONFIGURADO` unless a later unit explicitly changes Main |
| 8 | Test webhook | test-only; production webhook NOT CONFIGURED |
| 9 | Abuse / rate limiting for public endpoints | **still open** — blocks production, not this sandbox E2E |

## 5. Proposed execution scope (not started)

Minimal path:

1. Confirm sandbox HEX-2026 sales state required for `PUB-VIE` checkout.
2. Enable landing sandbox flags locally only (never on production host).
3. One PUB-VIE checkout → one preference → one test payment.
4. Confirm webhook effects and public status.
5. Confirm transactional counts match the single order.
6. Reset / leave sandbox clean per execution-unit rules.
7. Publish evidence; do not open Main sales.

## 6. Security notes carried forward

```text
Origin server-side gate remains mandatory
Gateway ACAO * accepted only for sandbox
Production requires PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING closed
Origin ≠ auth; forged Origin / non-browser clients remain in threat model
```

## 7. Exit criteria (for the future execution unit)

```text
Single spectator sandbox E2E = PASS or documented blocker
Main EN_VENTA = still NO
productive webhook/credentials = still NO
Evidence file published under docs/implementation/evidence/
```

## 8. Gate

```text
READY_FOR_IMPL_13C_SPECTATOR_SANDBOX_E2E
IMPL-13C execution = NOT STARTED until explicit “start IMPL-13C” authorization
```
