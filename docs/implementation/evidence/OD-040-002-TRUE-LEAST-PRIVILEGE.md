```text
unit: OD-040-002-A — True least privilege contract and grant matrix
mode: ANALYZE + DOCUMENTATION ONLY
status: ANALYZING / NOT RESOLVED
date: 2026-07-30
baseline: main @ bced99e5a1f27128b7b497013f283c1967223599 = origin/main (0 / 0)
authority: Project Owner authorization 2026-07-30 for OD-040-002-A
  ("Propose a change to an approved specification")
scope: analysis + proposal only; no code, tests, migrations, GRANT/REVOKE,
  deploys, or InsForge writes were executed by this unit
does NOT authorize: APPROVED, RESOLVED, VALIDATED, CLOSED, Main writes,
  production, IMPL-14A-3D, staging, commit, push
```

# OD-040-002-A — True Least Privilege Contract and Grant Matrix

## 1. Estado y alcance

`OD-040-002` is `OPEN`. The only control in force today is the temporary
compensating control approved as `D3C-2` (2026-07-29): exclusive schedule
secret + `actor_ref = system:payment-pending-expiry` + a strict RPC allowlist
in the `payment-pending-expiry` Edge Function code, layered on top of the
existing shared `project_admin` database role. `WORKSPACE_STATUS.md`
explicitly records that this is `PARTIAL for sandbox 3C only` and that
`true least privilege remains OPEN and continues to BLOCK Main, production,
and IMPL-14A-3D admin scope`.

This unit (`OD-040-002-A`) is **analysis and documentation only**. It:

- inventories the real current privilege surface for `mp-create-checkout`,
  `mp-webhook`, `get-order-status`, and `payment-pending-expiry` and their
  RPC dependencies, using source code plus read-only inspection of Main and
  the `impl-14a-expiry` sandbox;
- builds a current-state privilege matrix and a target-state privilege
  matrix;
- evaluates the platform capabilities actually available in InsForge;
- evaluates three implementation alternatives against that evidence;
- recommends one alternative, with an explicit statement of what it can and
  cannot close without further platform confirmation;
- proposes the next authorized units (`OD-040-002-B/C/D`) without creating
  them or their artifacts.

It does not implement, migrate, grant, revoke, deploy, or change any
runtime behavior.

---

## 2. Autoridad

Normative authority, in descending force:

1. Project Owner authorization of `OD-040-002-A` (2026-07-30, this unit).
2. `SPEC-040` v0.1.1 `APPROVED` (2026-07-27), §16 Open decisions:
   `OD-040-002 | Exact admin role name and authn mechanism | OPEN /
   non-blocking for approval | Must satisfy R016 fail-closed`.
3. `docs/implementation/IMPL-14A-2-PAYMENT-PENDING-EXPIRY-IMPLEMENTATION-PLAN.md`
   (`PLAN / APPROVED` v0.2.0, 2026-07-27), which is the document that gives
   `OD-040-002` its full operational definition used throughout this
   repository:
   ```text
   §7.2  OD-040-002 = OPEN (Project Owner 2026-07-27)
         system reconciler and admin operator MUST use separate
         actors/credentials
         project_admin is NOT automatically minimum privilege
         BLOCKS IMPL-14A-3C and IMPL-14A-3D until approved technical solution
   §9    Actor matrix; §9.1 SYSTEM_RECONCILER privilege reality; §9.3
         ADMIN_RECOVERY_OPERATOR
   §13   OD-040-002 | OPEN | Separate reconciler vs admin actors/credentials;
         project_admin ≠ automatic least privilege | Blocks 3C and 3D
   ```
4. `WORKSPACE_STATUS.md` current findings (`D3C-2`, `OD-040-002: PARTIAL for
   sandbox 3C only`).
5. `docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md` §22 (human
   closure of `IMPL-14A-3C`), which leaves `OD-040-002` explicitly open and
   does not authorize this unit to reopen `IMPL-14A-3C`.
6. `MANIFEST.md` / `docs/specs/SPEC-000-GOVERNANCE.md` for general governance
   (no OD-040-002-specific content there).

### 2.1 Exact location and text of OD-040-002

`docs/specs/SPEC-040-PAYMENT-PENDING-EXPIRY-RECONCILIATION.md`, §16:

```text
| OD-040-002 | Exact admin role name and authn mechanism | OPEN /
  non-blocking for approval | Must satisfy R016 fail-closed |
```

`IMPL-14A-2` plan §7.2/§9/§13 broadens this into the operative definition
this repository has used since 2026-07-27: **the reconciler (system) actor
and the admin-recovery (human) actor must use separate credentials, and
`project_admin` — the only database role Edge Functions can currently
authenticate as — is explicitly not a minimum-privilege claim.** This
broader definition, not the narrower SPEC-040 wording alone, is what
`IMPL-14A-3C`/`3D` and `D3C-2` treat as "OD-040-002", and it is what this
unit analyzes.

### 2.2 Requirements/AC affected

- `SPEC-040-R016` (protected administrative recovery: authenticated,
  role-authorized, fail-closed) and `SPEC-040-AC011` (unauthorized caller
  cannot execute admin recovery) — depend on a verified operator identity
  distinct from the reconciler, not yet designed (`IMPL-14A-3D`, blocked).
- `IMPL-14A-2` plan Actor matrix (§9): `SYSTEM_RECONCILER`,
  `ADMIN_RECOVERY_OPERATOR`, `PAYMENT_WEBHOOK`, `PUBLIC_CLIENT` are defined
  as **logically** separate actors, but today they collapse into **one**
  database identity (`project_admin`) at the SQL layer.
- `IMPL-14A-2` plan §13 risk table: `Admin endpoint exposure | Crit |
  OD-040-002 human auth`.

### 2.3 Units that depend on the closure of OD-040-002

```text
IMPL-14A-3C — reconciler secret/auth closure at Main/production scope
              (local + sandbox scope already VALIDATED/CLOSED independently
              of OD-040-002; Main/production scope remains blocked)
IMPL-14A-3D — Admin recovery boundary (R016 A/B/C) — fully blocked
```

---

## 3. Baseline

```text
repository:    C:\vonde\enforma-sys\ready2hybrid
branch:        main
HEAD:          bced99e5a1f27128b7b497013f283c1967223599
origin/main:   bced99e5a1f27128b7b497013f283c1967223599
divergence:    0 / 0
staged:        0
last commit:   bced99e fix(expiry): make pending payment reconciliation
               gateway-safe
```

`.cursor/*` remained untracked and out of scope throughout this unit; it was
not read for authority and was not modified.

Functional state at authorization time:

```text
IMPL-14A-3A = VALIDATED / CLOSED (its scope)
IMPL-14A-3B = VALIDATED / CLOSED (its scope)
IMPL-14A-3C = VALIDATED / CLOSED (local + automated tests + sandbox runtime)
OD-040-002  = OPEN
IMPL-14A-3D = NOT AUTHORIZED
Main apply  = NOT AUTHORIZED
Production  = NOT AUTHORIZED
schedule    = INACTIVE
local suite = 352/352 PASS (re-run 2026-07-30, read-only, no code changed)
expiry suite = 148/148 PASS (re-run 2026-07-30, read-only, no code changed)
```

---

## 4. Inventario actual

### 4.1 Edge Functions in scope

| Edge Function | File | Identity used |
|---|---|---|
| `mp-create-checkout` | `insforge/functions/mp-create-checkout/index.ts` | `createAdminClient({baseUrl: INSFORGE_BASE_URL, apiKey: API_KEY})` |
| `mp-webhook` | `insforge/functions/mp-webhook/index.ts` | same pattern, same `API_KEY` |
| `get-order-status` | `insforge/functions/get-order-status/index.ts` | same pattern, same `API_KEY` |
| `payment-pending-expiry` | `insforge/functions/payment-pending-expiry/index.ts` | same pattern, same `API_KEY` |

`API_KEY` is a single, project-wide **reserved** secret (confirmed via
`secrets list` on the sandbox: exactly one active `API_KEY`, `Reserved:
Yes`, with prior values retained as `API_KEY_OLD_<timestamp>` only for
rotation grace, never as separate per-function keys). All four functions
read the identical env var name and therefore resolve to the **same**
InsForge admin identity, which maps to the **same** Postgres role:
`project_admin`.

### 4.2 Sensitive RPCs and helper functions inventoried

| RPC / function | Migration | Domain |
|---|---|---|
| `checkout_start_tx(jsonb)` | `0005`, replaced `0007`, `0010`, `0011` | checkout |
| `checkout_attach_preference(jsonb)` | `0005`, `0007` | checkout |
| `checkout_compensate_preference(jsonb)` | `0005`, `0007` | checkout |
| `webhook_apply_payment_tx(jsonb)` | `0006`, `0007`, `0009` | webhook |
| `ticket_new_opaque_token(text)` | `0008` | tickets (invoker-mode helper) |
| `ticket_hash_token(text)` | `0008` | tickets (invoker-mode helper) |
| `ticket_issue_one_registration(uuid)` | `0008` | tickets |
| `ticket_issue_after_payment(uuid)` | `0008` | tickets |
| `ticket_issue_after_team_eligible(uuid)` | `0008` | tickets |
| `ticket_credential_reissue_tx(jsonb)` | `0008` | tickets |
| `ticket_credential_verify_tx(jsonb)` | `0008` | tickets |
| `ticket_get_projection_tx(jsonb)` | `0008` | tickets |
| `team_apply_payment_outcome(uuid, text)` | `0007` | teams |
| `team_roster_accept_tx(jsonb)` | `0007`, `0008` | teams |
| `team_roster_get_tx(jsonb)` | `0007` | teams |
| `expire_payment_pending_aggregate_tx(jsonb)` | `0012`, `0013` | expiry |
| `expire_payment_pending_batch_tx(jsonb)` | `0012` | expiry |
| `expire_payment_pending_dry_run_tx(jsonb)` | `0012`, `0013` | expiry |
| `acquire_payment_pending_expiry_run_lease_tx(jsonb)` | `0014` | expiry |
| `release_payment_pending_expiry_run_lease_tx(jsonb)` | `0014` | expiry |

None of `mp-create-checkout`, `mp-webhook`, `get-order-status`,
`payment-pending-expiry` import or call the tickets/teams RPCs. Those exist
for `ticket-credentials` and `team-roster` Edge Functions (out of the
`IMPL-14A` expiry scope but sharing the same `project_admin` identity —
material to the cross-function threat analysis below).

### 4.3 Migrations inventoried

`0001` (schema), `0002` (indexes), `0003` (RLS enable/force + `REVOKE ALL …
FROM PUBLIC`), `0005`–`0011` (checkout/webhook/teams/tickets RPCs and
grants), `0012`–`0014` (expiry aggregate/batch/dry-run + run lease).

---

## 5. Call graphs por Edge Function

Columns: identidad de ejecución → RPC invocadas → tablas leídas
(directo) → tablas escritas (directo) → secuencias → funciones auxiliares →
auditoría emitida → secretos requeridos.

### 5.1 `mp-create-checkout`

```text
Identidad de ejecución:  project_admin (via API_KEY admin client)
RPC invocadas:            checkout_start_tx(jsonb)
                           checkout_attach_preference(jsonb)
                           checkout_compensate_preference(jsonb)
Tablas leídas (directo):  products (SELECT *, by code)
                           events (SELECT *, by code)
Tablas escritas (directo): NONE — all writes happen inside the RPCs
Secuencias:                NONE OBSERVED (uuid primary keys, gen_random_uuid())
Funciones auxiliares:      NONE called directly by this Edge Function
Auditoría emitida:         inside checkout_start_tx / checkout_attach_preference
                           / checkout_compensate_preference (activity_log)
Secretos requeridos:       API_KEY, INSFORGE_BASE_URL, CHECKOUT_CORS_ORIGIN,
                           MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_SITE_ID,
                           CHECKOUT_WAIVER_DOCUMENT_TYPE,
                           CHECKOUT_WAIVER_VERSION, TEAM_INVITATION_TTL_SECONDS
```

### 5.2 `mp-webhook`

```text
Identidad de ejecución:  project_admin (via API_KEY admin client)
RPC invocadas:            webhook_apply_payment_tx(jsonb)
Tablas leídas (directo):  NONE (no direct .from() call in index.ts)
Tablas escritas (directo): NONE — write happens inside the RPC
Secuencias:                NONE OBSERVED
Funciones auxiliares:      NONE called directly
Auditoría emitida:         inside webhook_apply_payment_tx (activity_log,
                           payment_verification_records, webhook_events)
Secretos requeridos:       API_KEY, INSFORGE_BASE_URL,
                           MERCADOPAGO_WEBHOOK_SECRET, MERCADOPAGO_ACCESS_TOKEN,
                           MERCADOPAGO_LIVE_MODE, MERCADOPAGO_COLLECTOR_ID
```

### 5.3 `get-order-status`

```text
Identidad de ejecución:  project_admin (via API_KEY admin client)
RPC invocadas:            NONE
Tablas leídas (directo):  orders (SELECT state only, by tracking_ref)
Tablas escritas (directo): NONE
Secuencias:                NONE OBSERVED
Funciones auxiliares:      NONE
Auditoría emitida:         NONE (read-only projection)
Secretos requeridos:       API_KEY, INSFORGE_BASE_URL,
                           ORDER_STATUS_CORS_ORIGIN / CHECKOUT_CORS_ORIGIN,
                           ORDER_STATUS_POLL_SECONDS
```

### 5.4 `payment-pending-expiry`

```text
Identidad de ejecución:  project_admin (via API_KEY admin client)
RPC invocadas:            acquire_payment_pending_expiry_run_lease_tx(jsonb)
                           expire_payment_pending_batch_tx(jsonb)
                           expire_payment_pending_dry_run_tx(jsonb)
                           release_payment_pending_expiry_run_lease_tx(jsonb)
Tablas leídas (directo):  NONE
Tablas escritas (directo): NONE — all writes happen inside the RPCs
Secuencias:                NONE OBSERVED
Funciones auxiliares:      NONE called directly
Auditoría emitida:         inside expire_payment_pending_aggregate_tx / batch_tx
                           (activity_log); lease acquire/release write
                           idempotency_records (scope
                           payment_pending_expiry_run, actor_context
                           system:payment-pending-expiry)
Secretos requeridos:       API_KEY, INSFORGE_BASE_URL,
                           PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET,
                           INSFORGE_ENVIRONMENT
```

### 5.5 Critical structural fact shared by all four

Every one of the four call graphs above collapses to the **same** Postgres
identity: `project_admin`. There is no observable, DB-enforced difference
between "the expiry reconciler is calling" and "the checkout function is
calling" — the only thing that differs is which RPC name and which
`actor_ref` string the calling code chooses to send, both of which are
**caller-supplied values inside the Edge Function's own code**, not values
verified by Postgres.

---

## 6. Matriz actual de privilegios

Read-only inspected on **Main** (`ready2hybrid`, `91fa34b1-…`, via MCP
`run-raw-sql`, current session role confirmed `current_user = project_admin`,
`session_user = postgres`) and cross-checked on **sandbox**
(`impl-14a-expiry`, via `insforge db query --unrestricted`, same role
model). Both environments expose the **identical** role set:
`anon`, `authenticated`, `project_admin`, plus `postgres` (superuser,
platform-only) and standard `pg_*` system roles. No other custom role
exists in either environment.

| Recurso | Tipo | Propietario | Security mode | Roles con acceso | Privilegio | Uso real | Exceso detectado |
|---|---|---|---|---|---|---|---|
| `checkout_start_tx`, `checkout_attach_preference`, `checkout_compensate_preference` | RPC | `project_admin` | `SECURITY DEFINER`, `search_path=pg_catalog,public,pg_temp` | `project_admin` (EXECUTE); `PUBLIC`/`anon`/`authenticated` explicitly REVOKEd | EXECUTE | `mp-create-checkout` only | `project_admin` (shared) can also be used by `mp-webhook`/`get-order-status`/`payment-pending-expiry`/tickets/teams functions — **cross-function EXECUTE excess** |
| `webhook_apply_payment_tx` | RPC | `project_admin` | `SECURITY DEFINER`, fixed `search_path` | `project_admin` only | EXECUTE | `mp-webhook` only | Same cross-function EXECUTE excess |
| `expire_payment_pending_aggregate_tx`, `expire_payment_pending_batch_tx`, `expire_payment_pending_dry_run_tx`, `acquire_/release_payment_pending_expiry_run_lease_tx` | RPC | `project_admin` | `SECURITY DEFINER`, fixed `search_path` | `project_admin` only | EXECUTE | `payment-pending-expiry` only | Same cross-function EXECUTE excess; `actor_ref='system:payment-pending-expiry'` is a caller-supplied JSONB string validated only inside the function body, not a DB-verified identity |
| `ticket_issue_after_payment`, `ticket_issue_one_registration`, `ticket_issue_after_team_eligible`, `ticket_credential_reissue_tx`, `ticket_credential_verify_tx`, `ticket_get_projection_tx` | RPC | `project_admin` | `SECURITY DEFINER`, fixed `search_path` | `project_admin` only | EXECUTE | `ticket-credentials` function only | Reachable today by `payment-pending-expiry`/`mp-webhook`/`mp-create-checkout` at the DB layer (same role); no code in those functions calls it, but Postgres does not prevent it |
| `team_roster_accept_tx`, `team_apply_payment_outcome`, `team_roster_get_tx` | RPC | `project_admin` | `SECURITY DEFINER`, fixed `search_path` | `project_admin` only | EXECUTE | `team-roster` function only | Same cross-function reachability excess |
| `orders`, `order_items`, `capacity_holds`, `payments`, `payment_verification_records`, `capability_credentials`, `registrations`, `tickets`, `ticket_credential_generations`, `access_entitlements`, `activity_log`, `idempotency_records`, `outbox_delivery_jobs`, `webhook_events`, `teams`, `team_members`, `buyer_contacts`, `participants`, `participant_sensitive_profiles`, `waiver_documents`, `waiver_acceptances` (21 sensitive tables) | Table | n/a | RLS `ENABLED` + `FORCE`, **zero policies defined** | `anon`, `authenticated`: `DELETE, INSERT, SELECT, UPDATE` (table grant only, no RLS policy ⇒ **0 rows visible/writable in practice**, fail-closed by absence of policy); `project_admin`: `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` **and** `rolbypassrls = true` | project_admin: full direct DML, RLS irrelevant to it | Direct writes exercised only inside `SECURITY DEFINER` RPC bodies (owned by `project_admin`) | `project_admin` can bypass every RPC and every RLS policy and write/delete these tables **directly** from any of the four Edge Functions (or from `ticket-credentials`/`team-roster`) without going through the audited business RPC — this is the concrete, currently-open T3 gap |
| `products`, `events` | Table | n/a | RLS `ENABLED` + `FORCE`, zero policies | `anon`/`authenticated`: same broad grant, same fail-closed-by-no-policy; `project_admin`: full DML + bypass RLS | `SELECT` only (catalog read in `mp-create-checkout`) | Grep across all migrations (`0001`–`0014`) shows **no** `INSERT`/`UPDATE` into `products` or `events` from any RPC body | **Confirmed unused privilege**: `project_admin`'s `INSERT/UPDATE/DELETE/TRUNCATE` on `products`/`events` is not required by any current runtime path |
| `event_days` | Table | n/a | Same RLS pattern | Same broad grant to `project_admin`/`anon`/`authenticated` | Not read/written by the 4 in-scope functions | Not observed in scope | Not evaluated further in this unit (out of the 4-function inventory) |
| PL/pgSQL helper functions (`ticket_new_opaque_token`, `ticket_hash_token`) | Function | `project_admin` | `SECURITY INVOKER` (not `prosecdef`) | `project_admin` only | EXECUTE | Called from ticket RPCs internally | None beyond the shared-role pattern above |

Excess/observability summary:

```text
privilegio requerido      = EXECUTE on the specific RPC(s) each function
                             actually calls; SELECT on products/events for
                             checkout; SELECT state on orders for status
privilegio observado      = EXECUTE on EVERY sensitive RPC in the project,
                             plus full direct DML + RLS bypass on EVERY
                             sensitive table, for ALL FOUR functions equally
privilegio excesivo       = the delta above — every function is over-
                             privileged relative to its own call graph by
                             exactly the same margin, because they all share
                             one role
privilegio faltante       = none found; no function is missing a grant it
                             needs today
privilegio no observable  = whether InsForge's Deno runtime scopes secret
                             visibility per function or exposes ALL project
                             secrets to EVERY function process (see §7);
                             NOT OBSERVABLE from static code review or SQL
                             inspection alone
```

---

## 7. Capacidades reales de InsForge

Evaluated by direct SQL inspection (Main + sandbox) and the `insforge-cli`
skill's documented command surface. No write was attempted for any of
these.

| Capacidad | Clasificación | Evidencia |
|---|---|---|
| Roles PostgreSQL personalizados | **NOT SUPPORTED** (self-service) | `project_admin` (the only role our own migrations execute as, confirmed `current_user=project_admin` under both the MCP session and the CLI session) has `rolcreaterole=false` and `rolsuper=false` on both Main and sandbox. `CREATE ROLE` requires `CREATEROLE` or superuser. Our migrations cannot self-provision any new role. |
| Rol distinto por Edge Function | **NOT SUPPORTED** (self-service), **REQUIRES PLATFORM CONFIRMATION** (out-of-band) | Depends on the previous item. No CLI command in the `insforge-cli` skill (`secrets`, `functions deploy`, `config`) exposes binding an Edge Function to a distinct DB role or a distinct scoped API key. `secrets list` shows exactly one project-wide `API_KEY` (reserved), with `API_KEY_OLD_*` used only for rotation grace, never for parallel per-function keys. |
| Claims o actor técnico verificable | **NOT SUPPORTED as observed** | The only actor signal available to a `SECURITY DEFINER` function is the JSONB payload the caller sends (`actor_ref`); Postgres provides no verified claim distinguishing which Edge Function issued the call, because all four authenticate identically. |
| Secreto dedicado por función | **NOT SUPPORTED** (self-service) | `secrets list` on the sandbox shows a single reserved `API_KEY` for the whole project. `PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET` is function-specific by **convention** (only `payment-pending-expiry` code reads it), not by platform-enforced scoping — **NOT OBSERVABLE** whether every function's Deno runtime can read every project secret via `Deno.env` regardless of whether its code references the name (see open question below). |
| Invocación de RPC bajo identidad limitada | **NOT SUPPORTED** (self-service) | Same blocker as "rol distinto por función": the RPC executes under whatever role the caller authenticates as (`project_admin`), and that role is shared. |
| `SECURITY DEFINER` con propietario no login | **SUPPORTED in principle, NOT ACHIEVED today** | Postgres supports non-login `SECURITY DEFINER` owners generally. Today, however, every sensitive RPC's owner **is** `project_admin` — the same role every Edge Function authenticates as. Confirmed via `pg_get_userbyid(p.proowner)` on both Main and sandbox. Creating a genuinely distinct, non-login owner role requires `CREATE ROLE`, which is blocked per above. |
| `REVOKE EXECUTE FROM PUBLIC` | **SUPPORTED and already applied** | Every sensitive RPC already has `REVOKE ALL … FROM PUBLIC` (and from `anon`, `authenticated`) confirmed in `0005`, `0006`, `0007`, `0008`, `0009`, `0010`, `0011`, `0012`, `0013`, `0014`. |
| `GRANT EXECUTE` to a specific technical role | **SUPPORTED, but only one technical role exists** | `GRANT EXECUTE … TO project_admin` is the existing, working pattern; the limitation is the number of distinct grantable identities (one), not the GRANT mechanism itself. |
| RLS aplicable a llamadas desde Edge Functions | **SUPPORTED for `anon`/`authenticated`; NOT APPLICABLE to `project_admin`** | RLS is `ENABLED`+`FORCE` on all 24 domain tables with zero policies, so `anon`/`authenticated` get zero rows today (confirmed via `pg_policies` returning 0 rows) — a working fail-closed pattern. `project_admin` has `rolbypassrls=true` on both Main and sandbox, so RLS cannot be used as a control for the identity Edge Functions actually authenticate as. |
| Restricción de `search_path` | **SUPPORTED and already applied** | Every `SECURITY DEFINER` function inspected sets `search_path = pg_catalog, public, pg_temp` (confirmed via `pg_proc.proconfig` on both Main and sandbox). Only `project_admin` (and `postgres`) have `CREATE` on schema `public` (`anon`/`authenticated` do not, confirmed via `has_schema_privilege`), so the residual search-path-hijack surface against an **external** attacker is already closed; the residual risk is `project_admin` itself hijacking its own functions, which is a `project_admin`-vs-`project_admin` self-consistency concern, not a third-party attack surface. |

### 7.1 Explicit open platform question (not resolved by this unit)

```text
NOT OBSERVABLE: whether InsForge injects ALL project secrets into every
Edge Function's Deno.env regardless of which secret names that function's
code references, or scopes secret visibility per function/deployment.
```

This matters because the `D3C-2` compensating control partly relies on
`PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET` being effectively unknown to the
other three functions' code paths. If secret visibility is **not** scoped
per function at the runtime level, a compromised `mp-create-checkout` could
in principle read this secret directly from its own process environment
even though its own source code never references it, which would weaken —
though not eliminate, because the RPC-level `actor_ref` check and allowlist
still apply — the practical value of secret-based actor differentiation.
Confirming this requires either InsForge platform documentation not
retrievable through the CLI's `docs`/skill surface, or an authorized test
deployment, which is out of scope for this `ANALYZE`-only unit.

---

## 8. Excesos de `project_admin`

Answering the ten required questions from the authorization, with evidence:

1. **RPC que puede ejecutar hoy:** every `SECURITY DEFINER`/`GRANT EXECUTE`
   RPC in the project — checkout, webhook, tickets, teams, and expiry —
   because all of them grant `EXECUTE` to `project_admin` and to no other
   non-system role.
2. **Tablas que puede leer directamente:** all 24 RLS-protected domain
   tables (`SELECT` is part of its granted privilege set and it bypasses
   RLS).
3. **Tablas que puede escribir directamente:** same 24 tables (`INSERT`,
   `UPDATE`, `DELETE`, plus `TRUNCATE`/`REFERENCES`/`TRIGGER`), again with
   RLS bypassed.
4. **Funciones ajenas a IMPL-14A:** yes — `ticket_*` and `team_*` RPCs are
   fully reachable by the `payment-pending-expiry` (or any other) function
   process, since they share the same DB identity.
5. **¿Todas las Edge Functions comparten el mismo rol?** yes, confirmed for
   all four in-scope functions (and also `ticket-credentials`,
   `team-roster`, per source inspection).
6. **¿Una función comprometida podría invocar RPC de otra?** yes — nothing
   in Postgres prevents it; only the calling Edge Function's own source
   code chooses which RPC name to call.
7. **¿Puede saltarse las acciones de negocio auditadas?** yes — because it
   has direct table DML plus RLS bypass, it can `UPDATE orders`,
   `INSERT INTO tickets`, etc., without ever calling the audited RPC that
   would normally write `activity_log` alongside the state change.
8. **¿Existe una identidad técnica más estrecha disponible en InsForge?**
   No narrower role exists today (§6); none can be self-provisioned (§7)
   because `project_admin` lacks `CREATEROLE`.
9. **¿InsForge permite roles personalizados o identidades por función?**
   Not observed as supported; classified `NOT SUPPORTED` (self-service) /
   `REQUIRES PLATFORM CONFIRMATION` (out-of-band), see §7.
10. **¿El control debe aplicarse en PostgreSQL, en la Edge Function, o en
    ambas capas?** Both, but they are not equivalent: Edge Function code
    discipline (allowlists, schedule secret, `actor_ref`) is necessary but
    not sufficient, because it does not bind Postgres itself — a
    compromised or buggy Edge Function bypasses code-level discipline
    entirely, while a Postgres-level control (distinct role + minimal
    grant) holds even if the calling code is fully compromised. **The
    control must ultimately live in PostgreSQL to be a real least-privilege
    guarantee; the Edge Function layer is a compensating control, exactly
    as `D3C-2` and the `IMPL-14A-2` plan §9.1 already state.**

**Conclusion: `project_admin` fails true least privilege on every axis
evaluated. It is not a per-function identity, it is not the owner-vs-caller
boundary `SECURITY DEFINER` is designed to provide (owner = caller today),
it is not scoped to a business domain, and it bypasses the one structural
control (RLS) that could otherwise constrain it.**

---

## 9. Amenazas y resultados esperados

| Amenaza | Resultado normativo requerido | Resultado real hoy | Evidencia |
|---|---|---|---|
| T1 — Invocación cruzada (una función compromete y llama la RPC de otra) | `DENIED` | **ALLOWED** | Same role (`project_admin`) holds `EXECUTE` on every sensitive RPC in the project; no per-function grant boundary exists |
| T2 — Ejecución pública (`PUBLIC`/`anon`/`authenticated` llama una RPC sensible) | `DENIED` | **DENIED (already correct)** | `REVOKE ALL … FROM PUBLIC, anon, authenticated` present on every sensitive RPC in `0005`–`0014`; confirmed no `EXECUTE` grant to those roles exists on Main or sandbox |
| T3 — Escritura directa (el rol técnico evita la RPC protegida) | `DENIED` | **ALLOWED** for the 21 sensitive tables written by RPC bodies (owner = caller = `project_admin`, so tightening the caller's table grants would also break the RPC's own internal writes); **CLOSABLE without a new role** for `products`/`events` only (confirmed unused by every RPC body) | `project_admin` table grants + `rolbypassrls=true` on Main/sandbox; grep of all migrations for writes to `products`/`events` returns none |
| T4 — Función no autorizada (una función fuera de IMPL-14A llama una RPC de pagos/expiry) | `DENIED` | **ALLOWED** | Same shared-role fact as T1; `ticket-credentials`/`team-roster` functions could call expiry/checkout/webhook RPCs and vice versa |
| T5 — Search path hijacking dentro de una función `SECURITY DEFINER` | `MITIGATED BY FIXED SEARCH_PATH AND QUALIFIED OBJECTS` | **MITIGATED** | Every sensitive function sets `SET search_path = pg_catalog, public, pg_temp`; only `project_admin`/`postgres` can `CREATE` in `public` (`anon`/`authenticated` cannot, confirmed via `has_schema_privilege`), so no untrusted role can plant a colliding object; residual risk is `project_admin` acting against itself, not a third-party attacker |
| T6 — Escalada por ownership (el invocador altera o reemplaza la función) | `DENIED` | **STRUCTURALLY ALLOWED FOR THE SHARED IDENTITY** (any Edge Function running as `project_admin` owns every sensitive function and therefore has the object-owner's implicit right to `ALTER`/`DROP`/`CREATE OR REPLACE` it); **NOT OBSERVABLE** whether the InsForge SDK exposed to Edge Function code (`admin.database.rpc/.from`) allows executing arbitrary DDL, or only structured `select/insert/update/delete/rpc` calls — this was not tested (would require deploying code, out of scope for `ANALYZE`) | `pg_get_userbyid(proowner) = project_admin` for every sensitive function on both Main and sandbox |
| T7 — Bypass de auditoría (el rol técnico muta estado sin generar auditoría) | `DENIED` | **ALLOWED** for the same reason as T3 — a direct `UPDATE orders SET state = 'EXPIRED' …` from any of the four functions would never touch `activity_log`, because the audit write lives inside the RPC body, not as a table trigger enforced independently of the caller's path | Same evidence as T3; no `AFTER UPDATE` audit trigger was found on `orders`/`payments`/`tickets`/`capacity_holds` in `0001`–`0003` — audit coupling is implemented inside the RPC transaction (SPEC-040 I009/R015), not as a table-level backstop |

**Net honest statement:** today, only **T2 and T5** are structurally
`DENIED`/`MITIGATED` at the Postgres layer. **T1, T3 (core sensitive
tables), T4, T6, and T7** are currently **allowed** at the Postgres layer
and rely entirely on Edge Function code discipline (which the `D3C-2`
compensating control formalizes but does not make DB-enforced). This is
precisely why `OD-040-002` is correctly `OPEN` and why `project_admin`
cannot be declared minimum privilege.

---

## 10. Alternativas evaluadas

### Alternativa A — Rol técnico por Edge Function

| Criterio | Evaluación |
|---|---|
| Soporte real de InsForge | **NOT SUPPORTED (self-service)**: `project_admin` — the only role our migrations run as — has `rolcreaterole=false` and is not superuser on both Main and sandbox. `CREATE ROLE` cannot be executed by our own migration path. No CLI/platform primitive was found to request a distinct login role or a function-scoped API key. |
| Aislamiento entre funciones | Would be complete (best possible) if the platform provisioned it |
| Complejidad operativa | High if self-service (blocked); unknown if platform-provisioned |
| Riesgo de escalada | Low, once provisioned |
| Compatibilidad con código actual | Requires changing `API_KEY` sourcing per function (`Deno.env.get` of a distinct secret name per function) |
| Migración requerida | Would require platform-side role creation outside our migration runner's privileges |
| Rollback | Simple (revoke/disable the extra role) once it exists |
| Pruebas necesarias | Full T1/T4 negative matrix per function |

**Verdict: not implementable self-service today. Requires an explicit
InsForge platform capability request/confirmation.**

### Alternativa B — Rol técnico compartido con RPC allowlist estricta

| Criterio | Evaluación |
|---|---|
| Soporte real de InsForge | **SUPPORTED** — this is the mechanism already partially in place (`D3C-2`: schedule secret + `actor_ref` + code allowlist) |
| Aislamiento entre funciones | **Residual — not real isolation.** T1/T4 remain structurally `ALLOWED` at the Postgres layer; only application code chooses not to exercise the excess privilege |
| Complejidad operativa | Low |
| Riesgo de escalada | Same as today: a compromised or buggy Edge Function inherits full `project_admin` reach regardless of allowlist code |
| Compatibilidad con código actual | Full — no schema change required |
| Migración requerida | None for the core pattern; optional micro-hardening (see §10.4) needs a small migration |
| Rollback | Trivial |
| Pruebas necesarias | Allowlist unit tests only; cannot prove DB-level denial for T1/T4 |

**Verdict: implementable today, but explicitly not "true least privilege" —
exactly what `WORKSPACE_STATUS.md` already states for `D3C-2`.**

### Alternativa C — Wrappers `SECURITY DEFINER` con grants mínimos

| Criterio | Evaluación |
|---|---|
| Soporte real de InsForge | **Partially supported.** The wrapper pattern itself (fixed `search_path`, `REVOKE … FROM PUBLIC`, `GRANT EXECUTE` to one technical role) is already in use for every sensitive RPC. What is **not** achievable self-service is separating **owner** from **caller**: today `proowner = project_admin` for every sensitive function, and `project_admin` is also the only identity that can call them. `SECURITY DEFINER` provides zero additional isolation when owner = caller. |
| Aislamiento entre funciones | None beyond Alternative B's, unless combined with a distinct owner role (blocked, see Alternative A) |
| Complejidad operativa | Low for the narrow, safe subset described below (revoking unused direct grants on `products`/`events`); High/blocked for the full version that needs a new owner role |
| Riesgo de escalada | Unchanged for core sensitive tables (owner = caller); reduced for `products`/`events` (unused-privilege removal is safe and verifiable) |
| Compatibilidad con código actual | Full for the narrow subset (no RPC reads/writes `products`/`events`, confirmed by grep) |
| Migración requerida | One small migration to `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON products, events FROM project_admin`, keeping `SELECT` |
| Rollback | Trivial (`GRANT` back) |
| Pruebas necesarias | Regression on `mp-create-checkout` catalog read (`SELECT` only, already the only privilege it uses); negative test that `project_admin` can no longer `UPDATE products` directly |

**Verdict: safe, self-service, and immediately implementable for the
catalog tables only. Cannot be extended to the 21 core sensitive tables
without first solving Alternative A's blocker, because those tables are
mutated by `SECURITY DEFINER` bodies owned by the very same role whose
direct grants would need to shrink.**

### 10.1 Structural finding common to all three alternatives

No self-service combination of A, B, or C can fully `DENY` T1, T3 (core
tables), T4, T6, or T7, because every one of those closures requires **at
least one Postgres role distinct from `project_admin`** — either as a
narrower caller identity (Alternative A) or as a narrower/owner-vs-caller
split (the full version of Alternative C) — and creating **any** new role
is blocked today because `project_admin` (the only role our migrations
execute as) has neither `CREATEROLE` nor superuser on Main or on the
sandbox.

---

## 11. Alternativa recomendada

**Recommended: Alternative B, hardened, as the immediately authorizable
interim contract, combined with a mandatory platform-capability request
(the precondition shared by Alternatives A and full-C) as the only path to
fully close T1, T3 (core tables), T4, T6, and T7.**

Concretely, for `OD-040-002-B` (next unit, not authorized here):

1. Keep the single `project_admin` identity (unavoidable today) but make
   the existing compensating control (`D3C-2`) the **documented, permanent,
   audited baseline** rather than a temporary sandbox-only exception —
   explicit schedule secret, explicit `actor_ref` enum-style check inside
   each mutating RPC (not free text), explicit code-level RPC allowlist per
   Edge Function, all already partly present.
2. Apply the one safe, self-service Alternative-C hardening identified with
   evidence in this unit: revoke `project_admin`'s unused
   `INSERT/UPDATE/DELETE/TRUNCATE` on `products` and `events`, leaving only
   `SELECT` (matches the only privilege `mp-create-checkout` actually
   uses, confirmed by code and by absence of any RPC body writing those
   tables).
3. Run the same table-by-table, RPC-body-by-RPC-body audit method used in
   §6/§10.3 for every one of the 21 core sensitive tables, to identify and
   document (not necessarily revoke, since these ARE used by owner-executed
   RPCs) exactly which privilege/table combinations are load-bearing versus
   incidental, so that a future owner-role split (once platform-confirmed)
   has an exact, evidence-based target grant list instead of a guess.
4. File an explicit InsForge platform capability request (via
   `npx @insforge/cli feedback --type feature-request`, per the
   `insforge-cli` skill's documented process) asking whether InsForge
   supports: (a) a distinct non-login `SECURITY DEFINER` owner role separate
   from the calling API-key identity, and/or (b) function-scoped
   credentials/roles. Do not implement a design that assumes an answer
   before it is confirmed.
5. Only once (4) returns a confirmed `SUPPORTED` answer should
   `OD-040-002-C` attempt the full owner/caller split that would let T1,
   T3 (core tables), T4, T6, and T7 move from `ALLOWED`/`MITIGATED` to
   `DENIED`.

This recommendation is evidence-based, not a preference: it is the largest
improvement achievable with confirmed-supported InsForge capabilities
today, it does not claim a closure it cannot deliver, and it names exactly
the platform fact (`project_admin` lacking `CREATEROLE`) that blocks going
further without vendor confirmation.

---

## 12. Matriz objetivo de privilegio mínimo

Target state once `OD-040-002-B` (self-service hardening) is implemented,
explicitly marking what remains open pending platform confirmation
(`OD-040-002-C`):

| Edge Function | Identidad técnica | RPC permitidas | RPC denegadas | Tablas directas permitidas | Tablas directas denegadas | Secretos |
|---|---|---|---|---|---|---|
| `mp-create-checkout` | `project_admin` (shared; **target**: `svc_checkout`, pending §11.4 platform confirmation) | `checkout_start_tx`, `checkout_attach_preference`, `checkout_compensate_preference` | all `webhook_*`, `expire_*`, `acquire_/release_*_lease_tx`, `ticket_*`, `team_*` (**target: DENIED at grant level; today: allowed, mitigated by code allowlist only**) | `products` (SELECT), `events` (SELECT) | `products`/`events` INSERT/UPDATE/DELETE/TRUNCATE (**achievable now, §11.2**); direct writes to `orders`/`capacity_holds`/etc. (**target: DENIED; today: allowed via bypassRLS, mitigated by code discipline only**) | `API_KEY`, `INSFORGE_BASE_URL`, `CHECKOUT_CORS_ORIGIN`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_SITE_ID`, waiver config |
| `mp-webhook` | `project_admin` (shared; target: `svc_webhook`) | `webhook_apply_payment_tx` only | all others | none | all sensitive tables directly (**target: DENIED**) | `API_KEY`, `INSFORGE_BASE_URL`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_LIVE_MODE`, `MERCADOPAGO_COLLECTOR_ID` |
| `get-order-status` | `project_admin` (shared; target: `svc_order_status`, read-only) | none | all RPCs | `orders` (`SELECT state` only, already the only column selected) | all writes; all other tables | `API_KEY`, `INSFORGE_BASE_URL`, CORS/poll config |
| `payment-pending-expiry` | `project_admin` (shared; target: `svc_expiry`) | `acquire_/release_payment_pending_expiry_run_lease_tx`, `expire_payment_pending_batch_tx`, `expire_payment_pending_dry_run_tx` | `checkout_*`, `webhook_apply_payment_tx`, `ticket_*`, `team_*` (**target: DENIED; today: allowed, mitigated only**) | none | all sensitive tables directly (**target: DENIED**) | `API_KEY`, `INSFORGE_BASE_URL`, `PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET`, `INSFORGE_ENVIRONMENT` |

The contract requirements (repeated from the authorization, with current
achievability marked):

```text
1.  each Edge Function only executes the RPC it needs
    → ACHIEVABLE TODAY at the code-allowlist layer; NOT achievable as a
      DB-enforced grant without a distinct role per function
2.  PUBLIC/anon/authenticated cannot execute sensitive RPC
    → ALREADY TRUE (T2 DENIED)
3.  the technical identity cannot write sensitive state directly
    → PARTIALLY ACHIEVABLE (products/events only); NOT achievable for the
      21 core tables without an owner/caller split
4.  sensitive mutations go through audited business functions
    → PARTIALLY TRUE; a compromised/buggy caller can still bypass it today
5.  SECURITY DEFINER functions have a controlled owner
    → TRUE in the narrow Postgres sense (owner is fixed, project_admin);
      FALSE in the intended sense (owner ≠ any client-reachable identity)
6.  the owner is not a role used by clients
    → FALSE TODAY — the owner IS the only client-reachable role
7.  search_path is fixed and safe
    → TRUE (confirmed on Main and sandbox)
8.  referenced objects are qualified where relevant
    → TRUE for cross-schema references (pg_catalog/public/pg_temp fixed);
      not independently re-audited line-by-line in this unit
9.  grants are explicit and reversible
    → TRUE (every grant found is explicit REVOKE+GRANT, easily reversible)
10. a compromised function does not inherit global domain access
    → FALSE TODAY — this is the central open gap
11. checkout/webhook/status/expiry remain operable
    → TRUE for every change proposed in this document (none were applied)
12. the design does not depend on frontend secrets
    → TRUE (all secrets are server-side Edge Function env vars)
13. the proposal includes provable denials, not only happy paths
    → INCLUDED in §16 below, marked ALLOWED-TODAY vs TARGET-DENIED honestly
```

---

## 13. Requisitos normativos propuestos

For CTO/Owner review before `OD-040-002-B` is authorized:

- **OD-040-002-N1**: `project_admin`'s direct DML on `products` and `events`
  MUST be reduced to `SELECT` only, with `INSERT/UPDATE/DELETE/TRUNCATE`
  revoked, because no current RPC body requires them.
- **OD-040-002-N2**: The `D3C-2` compensating control (schedule secret +
  `actor_ref` + code allowlist) MUST be treated as the permanent minimum
  bar for any new sensitive RPC added to this project until a role split is
  platform-confirmed, not as a temporary sandbox-only measure.
- **OD-040-002-N3**: An InsForge platform capability request MUST be filed
  and its answer recorded before any design assuming per-function roles,
  per-function credentials, or a non-shared `SECURITY DEFINER` owner is
  authorized for implementation.
- **OD-040-002-N4**: `IMPL-14A-3D` (admin recovery) MUST NOT be authorized
  until a verified, human-identifiable operator authentication mechanism
  distinct from the schedule secret is designed — this is unchanged from
  the existing `IMPL-14A-2` plan §9.3 blocker and is not newly created by
  this unit.
- **OD-040-002-N5**: Main/production application of the expiry reconciler
  MUST NOT proceed while T1/T3(core)/T4/T6/T7 remain `ALLOWED` at the
  Postgres layer, unless the Project Owner explicitly accepts the
  code-allowlist-only compensating control as sufficient for that scope
  (a product/risk decision, not a technical one this unit can make).

## 14. Criterios de aceptación propuestos

- **OD-040-002-AC1**: `project_admin` has `SELECT`-only on `products` and
  `events`; a direct `UPDATE`/`INSERT`/`DELETE` attempt against either table
  fails with a permission error while `mp-create-checkout`'s existing
  catalog read continues to pass unchanged.
- **OD-040-002-AC2**: A documented, evidence-based table-privilege audit
  exists for all 21 remaining sensitive tables, stating for each
  table/privilege pair whether it is load-bearing (used inside an owner-
  executed RPC body) or not.
- **OD-040-002-AC3**: An InsForge feedback/feature-request ticket exists
  requesting confirmation of per-function role or credential scoping, with
  its ticket id and current status recorded in evidence.
- **OD-040-002-AC4**: T2 and T5 remain `DENIED`/`MITIGATED` (regression,
  not new).
- **OD-040-002-AC5**: T1/T3(core)/T4/T6/T7 are explicitly labeled
  `MITIGATED (code allowlist), NOT DENIED (Postgres grant)` in
  `WORKSPACE_STATUS.md` and this evidence file until a role split is
  platform-confirmed and implemented — no document may claim `DENIED` for
  these without the underlying grant change.
- **OD-040-002-AC6**: Existing checkout/webhook/expiry/dry-run/status test
  suites continue to pass unchanged (352/352 full suite baseline confirmed
  in this unit; 148/148 expiry-focused baseline confirmed in this unit).

---

## 15. Impacto sobre unidades de IMPL-14A

```text
3A                : no impact — closed in its own scope, not reopened
3B                : no impact — closed in its own scope, not reopened
3C                : no impact on its VALIDATED/CLOSED local+tests+sandbox
                    scope; OD-040-002-B/C would be required before Main or
                    production application of payment-pending-expiry can be
                    authorized (already the documented blocker in
                    WORKSPACE_STATUS.md)
futura 3D         : remains fully blocked; needs its own operator-auth
                    design in addition to whatever OD-040-002-B/C delivers
Main apply        : blocked by OD-040-002 exactly as already recorded;
                    this unit does not change that blocking status, it only
                    documents a concrete path and its limits
producción        : same blocking status as Main; unchanged
landing sandbox   : landing pointed only at the sandbox is a separate,
                    narrower decision (PLANB-LANDING-01, discussed earlier
                    in this conversation for Mercado Pago payment links) and
                    is NOT gated by OD-040-002, since it does not touch the
                    reconciler's DB privileges
landing productiva: gated by the same Main/production blocker above
IMPL-14A-3D       : requires OD-040-002 closure per IMPL-14A-2 plan §9.3;
                    unchanged by this unit
```

`OD-040-002` closure is necessary for: applying the expiry reconciler to
InsForge Main, activating its schedule in Main/production, and authorizing
`IMPL-14A-3D`. It is **not** necessary for a sandbox-only landing page that
does not call the reconciler with elevated privilege beyond what is already
sandbox-scoped and human-closed under `IMPL-14A-3C`.

---

## 16. Plan de implementación propuesto (not created by this unit)

### OD-040-002-B — Local least privilege implementation

```text
archivos previstos:     insforge/migrations/00XX_least-privilege-catalog.sql
                        (products/events grant narrowing only)
                        docs/implementation/evidence/
                          OD-040-002-TRUE-LEAST-PRIVILEGE.md (append results)
                        WORKSPACE_STATUS.md (status update only)
migración prevista:     REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
                        public.products, public.events FROM project_admin;
                        keep SELECT
funciones afectadas:    none directly altered; mp-create-checkout catalog
                        read is the only consumer and is SELECT-only already
pruebas unitarias:      existing checkout unit tests must remain green
pruebas de integración: negative test proving project_admin cannot UPDATE
                        products/events directly after the migration
pruebas negativas:      T3-products/events: DENIED (new); T1/T3(core)/T4/
                        T6/T7: documented as still ALLOWED, with an explicit
                        regression test asserting today's ALLOWED status so
                        a future silent platform change is detected
recursos remotos:       sandbox-only migration apply + regression, same
                        pattern as prior IMPL-14A-3* sandbox retests
rollback:               GRANT INSERT, UPDATE, DELETE, TRUNCATE back to
                        project_admin (single reversible statement)
evidencia:              append to this file; do not create a second file
gate de salida:         READY_FOR_CTO_OD_040_002_B_LOCAL_REVIEW /
                        VALIDATION_FAILED
```

### OD-040-002-C — Sandbox privilege validation and platform-capability
resolution

```text
archivos previstos:     depends entirely on the answer to the InsForge
                        feedback ticket filed under OD-040-002-N3; no file
                        list can be committed to before that answer exists
migración prevista:     UNKNOWN until platform capability is confirmed;
                        if SUPPORTED, a distinct owner/caller role split
                        migration; if NOT SUPPORTED, no further migration
                        beyond OD-040-002-B, and T1/T3(core)/T4/T6/T7 are
                        formally accepted as MITIGATED-not-DENIED risk by
                        the Project Owner
funciones afectadas:    potentially all four in-scope Edge Functions, only
                        if a role split is confirmed feasible
pruebas unitarias/neg.: full T1–T7 matrix per §9, re-run against whichever
                        design is confirmed feasible
recursos remotos:       sandbox only, same governance pattern as IMPL-14A-3*
rollback:               revert to the OD-040-002-B baseline
evidencia:              append to this file
gate de salida:         READY_FOR_CTO_OD_040_002_C_RUNTIME_REVIEW /
                        BLOCKED_BY_PLATFORM_CAPABILITY / VALIDATION_FAILED
```

### OD-040-002-D — Human closure

```text
archivos previstos:     WORKSPACE_STATUS.md, this evidence file (status
                        header only)
pruebas:                re-confirmation that all prior suites still pass
recursos remotos:       none (documentation only)
rollback:               n/a (documentation)
evidencia:              closure section appended, mirroring the IMPL-14A-3C
                        human-closure pattern already used in this project
gate de salida:         READY_FOR_CTO_OD_040_002_CLOSE_REVIEW
```

None of these three units, their files, or their migrations were created by
this unit.

---

## 17. Pruebas negativas obligatorias del diseño (for OD-040-002-B/C)

```text
PUBLIC execute sensitive RPC                    → DENIED   (already true)
anon execute sensitive RPC                      → DENIED   (already true)
authenticated execute sensitive RPC             → DENIED   (already true)
expiry identity execute expiry RPC              → ALLOWED  (already true)
expiry identity execute checkout RPC            → ALLOWED TODAY, target DENIED
                                                   (requires OD-040-002-C)
checkout identity execute expiry RPC            → ALLOWED TODAY, target DENIED
                                                   (requires OD-040-002-C)
webhook identity execute checkout-only RPC      → ALLOWED TODAY, target DENIED
                                                   (requires OD-040-002-C)
direct sensitive table INSERT/UPDATE (core 21)  → ALLOWED TODAY, target DENIED
                                                   (requires OD-040-002-C)
direct products/events INSERT/UPDATE            → DENIED after OD-040-002-B
authorized business action                      → PASS (unchanged)
audit record produced                           → PASS (unchanged)
fatal and rollback paths preserved              → PASS (unchanged)
existing checkout tests                         → PASS (352/352 baseline)
existing webhook tests                          → PASS (352/352 baseline)
existing expiry 148/148                         → PASS (confirmed this unit)
full suite 352/352 or greater                   → PASS (confirmed this unit)
rollback of grants (products/events)            → PASS (single GRANT
                                                   statement reverses
                                                   OD-040-002-B)
```

This table intentionally does **not** claim `DENIED` for cross-function RPC
invocation before the underlying grant/role work exists — doing so would
misrepresent the current Postgres-level reality documented in §9.

---

## 18. Decisiones abiertas

```text
OD-040-002 remains OPEN after this unit — this unit proposes a path, it
  does not resolve the decision
OD-040-002-N3 platform capability request — NOT YET FILED (requires
  explicit authorization to use npx @insforge/cli feedback, since this
  unit is documentation-only and did not file it)
Whether the Project Owner accepts "MITIGATED, not DENIED" for
  T1/T3(core)/T4/T6/T7 as sufficient for Main/production, pending platform
  confirmation timeline, is a product/risk decision, not a technical one
Secret visibility scoping across Edge Function Deno runtimes (§7.1) is
  NOT OBSERVABLE from this unit and would need either InsForge documentation
  not available through the CLI/docs surface used, or an authorized test
  deployment
OBS-3C-CRONVIEW-001, SBX-CREDENTIAL-003, IN-FLIGHT BATCH RESIDUAL RISK,
  PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING, OD-040-003 remain open exactly as
  recorded in WORKSPACE_STATUS.md; none are reopened, narrowed, or closed by
  this unit
```

## 19. Limitaciones de observabilidad

```text
- Table-by-table load-bearing privilege audit (§11.3) was demonstrated only
  for products/events (confirmed via full-repo grep across all migrations);
  it was not performed exhaustively for the remaining 21 sensitive tables in
  this unit — that full audit is scoped as an explicit OD-040-002-B task,
  not assumed complete here.
- Whether the @insforge/sdk admin client exposes raw/arbitrary SQL (not just
  structured select/insert/update/delete/rpc) to Edge Function code was not
  tested (T6 residual, §9) — NOT OBSERVABLE without a test deployment, which
  this ANALYZE-only unit is not authorized to perform.
- Whether InsForge scopes secret visibility per Edge Function or exposes all
  project secrets to every function's Deno process was not observable from
  static review or SQL inspection (§7.1).
- This unit inspected Main and the impl-14a-expiry sandbox only; it did not
  inspect any other environment.
```

## 20. Siguiente gate

```text
READY_FOR_CTO_OD_040_002_DESIGN_REVIEW
```

This proposal is complete and ready for CTO/Owner review as a two-track
design: (Track 1) an immediately authorizable, self-service hardening
(`OD-040-002-B`) that closes the one confirmed unused-privilege gap
(`products`/`events`) and formalizes `D3C-2` as the permanent interim
baseline; (Track 2) a platform-capability request whose answer will
determine whether `OD-040-002-C` can fully close T1/T3(core)/T4/T6/T7, or
whether the Project Owner must instead formally accept the current
mitigated (not denied) state as the ceiling for Main/production scope. This
unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`, `CLOSED`,
`READY_FOR_MAIN`, `READY_FOR_PRODUCTION`, `READY_FOR_IMPL_14A_3D`, or
`READY_FOR_LANDING_PRODUCTION`.
```

---

```text
unit: OD-040-002-B1 — Complete privilege inventory and compensating-
  hardening implementation plan
mode: ANALYZE + READ-ONLY + DOCUMENTATION
status: ANALYZING / NOT RESOLVED
date: 2026-07-30 — America/Merida
baseline: main @ bced99e5a1f27128b7b497013f283c1967223599 = origin/main (0 / 0)
authority: Project Owner authorization 2026-07-30 for OD-040-002-B1
  ("Prepare implementation traceability")
scope: exhaustive read-only inventory of all 24 domain tables, all
  sequences, all sensitive functions/RPCs, DML matrix, and a
  compensating-hardening implementation plan; no GRANT/REVOKE/ALTER
  ROLE/ALTER FUNCTION/CREATE POLICY/migration/code/test/deploy change
  was executed by this unit
does NOT authorize: APPROVED, RESOLVED, VALIDATED, CLOSED, Main writes,
  sandbox writes, production, Mercado Pago, IMPL-14A-3D, staging,
  commit, push
```

# OD-040-002-B1 — Complete Privilege Inventory and Compensating-Hardening Implementation Plan

## B1.0 Relación con `OD-040-002-A`

`OD-040-002-A` (§19, "Limitaciones de observabilidad") explicitly deferred
the exhaustive per-table audit of the 21 remaining sensitive tables
(beyond `products`/`events`) to an `OD-040-002-B` task. This unit
(`OD-040-002-B1`) performs that exhaustive audit for **all 24** domain
tables (not 21 — `event_days` and `participant_sensitive_profiles` are
now individually justified rather than grouped), inventories sequences,
completes the RPC/function inventory to all 20 current sensitive
functions (§5–§6 of `OD-040-002-A` covered only the RPCs reachable from
the 4 in-scope Edge Functions plus a partial listing), and turns the
single confirmed revocation (`products`/`events`) into a full R1/R2/R3
candidate list ready for an implementation plan (`OD-040-002-B2`) and a
sandbox validation plan (`OD-040-002-B3`). It does not change the
conclusion of `OD-040-002-A` (`TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY`);
it deepens the evidence underneath the compensating-hardening track.

Note on the tables named in the authorization text (`contacts`,
`registration_members`, `waivers`, `emergency_contacts`, `domain_events`,
`modules`, `event_modules`): the actual schema in this repository does
not contain tables with these exact names. The closest real
equivalents are `buyer_contacts` (≈ `contacts`), `team_members` (≈
`registration_members`), `waiver_documents`/`waiver_acceptances` (≈
`waivers`), and `activity_log` (≈ `domain_events`, as the append-only
audit trail). `emergency_contacts`, `modules`, and `event_modules` do
not exist in this schema at all — classified `NOT OBSERVABLE (table
does not exist)` and not fabricated. This section inventories the **24
tables that actually exist** in `public` on both Main and the
`impl-14a-expiry` sandbox (schema parity confirmed identical on both,
§B1.2).

---

## B1.1 Preflight Git

```text
git status --short        → " M WORKSPACE_STATUS.md" (carried over,
                             uncommitted, from OD-040-002-A per its own
                             authorization — commit/push were never
                             authorized for that unit either) +
                             untracked .cursor/* (out of scope, pre-
                             existing) + untracked
                             docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
                             (created by OD-040-002-A, also uncommitted)
git branch --show-current → main
git rev-parse HEAD        → bced99e5a1f27128b7b497013f283c1967223599
git fetch origin          → OK, no new refs
git rev-parse origin/main → bced99e5a1f27128b7b497013f283c1967223599
git rev-list --left-right --count HEAD...origin/main → 0  0
git diff --cached --name-only → (empty; staged = 0)
git log --oneline -5      → bced99e fix(expiry): make pending payment
                             reconciliation gateway-safe
                             65ef456 docs(payments): close IMPL-14A-3B
                             6068d5b feat(payments): implement payment
                             pending expiry transaction
                             dd2873b docs(payments): close IMPL-14A-3A
                             a801a14 fix(payments): make expiry
                             migration runner-compatible
```

Baseline matches exactly: `branch=main`, `HEAD=origin/main=bced99e5a1f27128b7b497013f283c1967223599`,
divergence `0 0`, staged `0`. `.cursor/*` remains untracked and out of
scope. The two modified/untracked documentation artifacts are the
expected, previously-authorized carry-over from `OD-040-002-A` (that
unit was explicitly never authorized to commit or push). Result:
**baseline confirmed, proceeding** (not `REPOSITORY_STATE_REQUIRES_REVIEW`).

---

## B1.2 Autoridad documental confirmada

Read for this unit: `MANIFEST.md`, `WORKSPACE_STATUS.md`,
`docs/specs/SPEC-000-GOVERNANCE.md` (already authoritative from prior
units), `docs/specs/SPEC-040-PAYMENT-PENDING-EXPIRY-RECONCILIATION.md`
v0.1.1 `APPROVED` (§16 `OD-040-002` open decision, unchanged),
`docs/implementation/IMPL-14A-2-PAYMENT-PENDING-EXPIRY-IMPLEMENTATION-PLAN.md`
(`PLAN / APPROVED` v0.2.0), `IMPL-14A-3A-SBX-RUNTIME.md`,
`IMPL-14A-3B-SBX-RUNTIME.md`, `IMPL-14A-3C-SBX-RUNTIME.md` (all
`VALIDATED / CLOSED`, no new GRANT/REVOKE/role content beyond what
`OD-040-002-A` already extracted — grepped again in this unit for
`GRANT|REVOKE|project_admin|RLS|SECURITY DEFINER|role`: 3A has no
matches, 3B repeats the `SECURITY DEFINER`/`EXECUTE=project_admin only`
facts already in `OD-040-002-A` §6, no new information), and
`OD-040-002-TRUE-LEAST-PRIVILEGE.md` (`OD-040-002-A`, this same file,
§§1–20, above). `SPEC-040`'s exact version and `OD-040-002`'s current
definition are unchanged since `OD-040-002-A`: `OD-040-002 | Exact admin
role name and authn mechanism | OPEN / non-blocking for approval | Must
satisfy R016 fail-closed`.

Migrations `0001`–`0014` were read/grepped in full for this unit
(schema in `0001`–`0003`, RPC bodies in `0005`–`0014`). All four
IMPL-14A Edge Functions (`mp-create-checkout`, `mp-webhook`,
`get-order-status`, `payment-pending-expiry`) plus the two adjacent
functions already inventoried in `OD-040-002-A` §6 (`ticket-credentials`,
`team-roster`) were re-confirmed via `.rpc(`/`.from(` grep across
`insforge/functions/**`. Related unit tests (`tests/unit/expiry/**`)
were used only to confirm behavioural intent, not as a privilege
source.

---

## B1.3 Inventario completo de las 24 tablas

Schema parity confirmed: the table list, RLS/`FORCE`/policy state, and
the `anon`/`authenticated`/`project_admin` grant set are **byte-for-byte
identical** on Main and on the `impl-14a-expiry` sandbox (verified by
running the same `information_schema.role_table_grants` +
`pg_policies` + `pg_class.relrowsecurity`/`relforcerowsecurity` query
against both environments in this unit; both returned the same 24
tables with the same 15-grant row per table: `anon`
{DELETE,INSERT,SELECT,UPDATE}, `authenticated`
{DELETE,INSERT,SELECT,UPDATE}, `project_admin`
{DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE}). RLS is
`ENABLED`+`FORCE` with **zero policies** on all 24 tables, on both
environments, confirmed again in this unit (`policy_count = 0` for
every row).

No client-side/browser code exists anywhere in this repository (no
`src/`, `web/`, `frontend/`, or similar directory; confirmed by
directory listing and by a repo-wide grep for `createClient`/`anonKey`/
`ANON_KEY`, zero matches). Every read/write to these 24 tables that
this repository can produce goes through one of the six
`project_admin`-authenticated Edge Functions (`mp-create-checkout`,
`mp-webhook`, `get-order-status`, `payment-pending-expiry`,
`ticket-credentials`, `team-roster`). There is no first-party code path
in this repository that would use the `anon` or `authenticated` grants
on these 24 tables at all.

| Tabla | Dominio | RLS | FORCE RLS | Policies | Privilegios de `project_admin` | Uso directo en Edge | Uso desde RPC | Clasificación |
|---|---:|---:|---:|---:|---|---|---|---|
| `events` | catálogo | ✔ | ✔ | 0 | SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER | `mp-create-checkout` `SELECT *` (pricing/validation) | `SELECT` in `checkout_start_tx` (0011) | `REQUIRED_DIRECTLY` for `SELECT`; `INSERT/UPDATE/DELETE/TRUNCATE` unused everywhere (grep of `0001`–`0014`: zero writes) |
| `event_days` | catálogo | ✔ | ✔ | 0 | SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER | none | none — zero references in any RPC body (`0005`–`0014`), confirmed by grep | `UNUSED_AND_REVOCABLE` (all 7 privileges; only referenced in schema/seed files `0001`–`0003`) |
| `products` | catálogo | ✔ | ✔ | 0 | SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER | `mp-create-checkout` `SELECT *` (pricing/validation) | `SELECT` in `checkout_start_tx` (0011), `team_apply_payment_outcome`/`ticket_issue_one_registration` (`v_product` lookups, 0007/0008) | `REQUIRED_DIRECTLY` for `SELECT`; `INSERT/UPDATE/DELETE/TRUNCATE` unused (same confirmation as `OD-040-002-A` §6/§8, re-verified) |
| `buyer_contacts` | identidad | ✔ | ✔ | 0 | full | none | `INSERT` in `checkout_start_tx` (0011); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only) |
| `participants` | identidad | ✔ | ✔ | 0 | full | none | `INSERT` in `checkout_start_tx` (0011), `team_roster_accept_tx` (0008); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only) |
| `participant_sensitive_profiles` | identidad / PII | ✔ | ✔ | 0 | full | none | **none** — zero references (SELECT, INSERT, UPDATE, or DELETE) in any migration `0005`–`0014`, confirmed by targeted grep | `UNUSED_AND_REVOCABLE` — flagged distinctly: this is a PII-shaped table with a full `DELETE/TRUNCATE`-capable grant to the shared runtime identity, and **zero current write or read path**; highest-value R1 candidate by sensitivity |
| `registrations` | ventas | ✔ | ✔ | 0 | full | none | `INSERT` (`checkout_start_tx` 0011, `team_roster_accept_tx` 0008); `UPDATE` (`checkout_start_tx` 0011, `webhook_apply_payment_tx` 0009, `expire_payment_pending_aggregate_tx` 0013) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE) |
| `teams` | ventas | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE` (`checkout_start_tx` 0011); `UPDATE` (`checkout_compensate_preference` 0007, `team_apply_payment_outcome` 0007, `team_roster_accept_tx` 0008) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE) |
| `team_members` | ventas | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE` (`checkout_start_tx` 0011); `UPDATE` (`team_roster_accept_tx` 0008) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE) |
| `capability_credentials` | control de acceso | ✔ | ✔ | 0 | full | none | `INSERT` (`checkout_start_tx` 0011, `ticket_issue_one_registration` 0008, `team_roster_accept_tx` 0008, `ticket_credential_reissue_tx` 0008); `UPDATE` (`expire_payment_pending_aggregate_tx` 0013, `ticket_credential_reissue_tx` 0008) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE) |
| `waiver_documents` | cumplimiento | ✔ | ✔ | 0 | full | none | `INSERT` only (`checkout_start_tx` 0011, `team_roster_accept_tx` 0008); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only) |
| `waiver_acceptances` | cumplimiento | ✔ | ✔ | 0 | full | none | `INSERT` only (`checkout_start_tx` 0011, `team_roster_accept_tx` 0008); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only) |
| `orders` | ventas | ✔ | ✔ | 0 | full | `get-order-status` `SELECT state` (by `tracking_ref`) | `INSERT` (`checkout_start_tx` 0011); `UPDATE` (`checkout_start_tx`, `checkout_attach_preference`, `checkout_compensate_preference` 0007, `webhook_apply_payment_tx` 0009, `expire_payment_pending_aggregate_tx` 0013); `SELECT … FOR UPDATE SKIP LOCKED` (`expire_payment_pending_batch_tx` 0012, candidate selection only) | `REQUIRED_DIRECTLY` for `SELECT`; `REQUIRED_ONLY_BEHIND_RPC` for `INSERT`/`UPDATE` |
| `order_items` | ventas | ✔ | ✔ | 0 | full | none | `INSERT` only (`checkout_start_tx` 0011); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only) |
| `capacity_holds` | inventario | ✔ | ✔ | 0 | full | none | `INSERT` (`checkout_start_tx` 0011); `UPDATE` (`webhook_apply_payment_tx` 0009, `expire_payment_pending_aggregate_tx` 0013, `checkout_compensate_preference` 0007) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE) |
| `payments` | pagos | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE`, exclusively inside `webhook_apply_payment_tx` (0009) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE, single-RPC surface) |
| `payment_verification_records` | pagos / auditoría | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE`, exclusively inside `webhook_apply_payment_tx` (0009) | `REQUIRED_ONLY_BEHIND_RPC` (INSERT+UPDATE, single-RPC surface) |
| `webhook_events` | pagos / auditoría | ✔ | ✔ | 0 | full | none | `SELECT`+`INSERT`+`UPDATE`, exclusively inside `webhook_apply_payment_tx` (0009) | `REQUIRED_ONLY_BEHIND_RPC` |
| `idempotency_records` | plataforma / concurrencia | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE`+`SELECT` in `checkout_start_tx` (0011), `checkout_attach_preference` (0007), `ticket_credential_reissue_tx` (0008), `team_roster_accept_tx` (0008), `acquire_/release_payment_pending_expiry_run_lease_tx` (0014) | `REQUIRED_ONLY_BEHIND_RPC` |
| `tickets` | cumplimiento | ✔ | ✔ | 0 | full | none | `INSERT` (`ticket_issue_one_registration` 0008); `UPDATE` (`ticket_credential_reissue_tx` 0008) | `REQUIRED_ONLY_BEHIND_RPC` |
| `ticket_credential_generations` | cumplimiento / credenciales | ✔ | ✔ | 0 | full | none | `INSERT`+`UPDATE` (`ticket_issue_one_registration` 0008, `ticket_credential_reissue_tx` 0008) | `REQUIRED_ONLY_BEHIND_RPC` |
| `access_entitlements` | control de acceso | ✔ | ✔ | 0 | full | none | `INSERT` only, exclusively inside `ticket_issue_one_registration` (0008); no `UPDATE`/`DELETE` observed | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only, single-RPC surface) |
| `activity_log` | auditoría | ✔ | ✔ | 0 | full | none | `INSERT` only, from nearly every RPC (`checkout_start_tx`, `checkout_attach_preference`, `checkout_compensate_preference`, `webhook_apply_payment_tx`, `ticket_issue_one_registration`, `ticket_credential_reissue_tx`, `team_roster_accept_tx`, `expire_payment_pending_aggregate_tx`) — **zero `UPDATE`/`DELETE` anywhere**, confirmed append-only by grep | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only); `UPDATE`/`DELETE`/`TRUNCATE` are a structural risk to the append-only audit guarantee itself (§B1.11) |
| `outbox_delivery_jobs` | plataforma / mensajería | ✔ | ✔ | 0 | full | none | `INSERT` only (`ticket_issue_one_registration` 0008, `webhook_apply_payment_tx` 0009, `expire_payment_pending_aggregate_tx` 0013); no consumer/worker exists yet in this repository to `UPDATE`/`DELETE` these rows | `REQUIRED_ONLY_BEHIND_RPC` (INSERT only today); `UPDATE`/`DELETE` are unused **today** but explicitly reserved for a future outbox worker (`WORKSPACE_STATUS.md`: "outbox y demás diferidos" remains open) — **not** classified `UNUSED_AND_REVOCABLE`, see R2 in §B1.9 |

24/24 tables accounted for. No table required grouping without
individual justification; `REQUIRED_FOR_PLATFORM` and `NOT_OBSERVABLE`
were not needed as classifications — every table's usage was directly
confirmed or directly refuted by source inspection.

---

## B1.4 Inventario de secuencias

```text
SELECT relname FROM pg_class WHERE relkind='S' AND relnamespace =
  'public'::regnamespace;
→ 0 rows, on both Main and impl-14a-expiry sandbox
```

| Secuencia | Tabla relacionada | Privilegio actual | Uso real | Revocable | Riesgo |
|---|---|---|---|---|---|
| *(ninguna existe)* | n/a | n/a | n/a | n/a — no hay nada que revocar | n/a |

**No sequences exist in the `public` schema on either environment.**
Every table in `0001_minimal_sales_schema.sql` uses a UUID primary key
with `DEFAULT gen_random_uuid()` (confirmed by schema read); there are
no `SERIAL`/`IDENTITY`/`BIGSERIAL` columns anywhere in `0001`–`0014`.
Consequently, no `SECURITY DEFINER` RPC depends on sequence-level
`USAGE`/`SELECT`/`UPDATE` privileges, and this dimension contributes
**zero** rows to the R1/R2/R3 revocation list in §B1.9. `pgcrypto`'s
`gen_random_uuid()` is a stable extension function owned by `postgres`
with `EXECUTE` granted to `project_admin` (and implicitly to `PUBLIC`
via `pgcrypto`'s default grants, consistent with §B1.6) — this is a
platform extension function, not a project-authored RPC, and is out of
scope for revocation (`R3`, needed by every RPC that generates a
primary key).

---

## B1.5 Inventario completo de funciones y RPC (20 funciones sensibles vigentes)

`CREATE OR REPLACE FUNCTION public.*` was grepped across all of
`0005`–`0014`; where a function name is redefined by a later migration
(`checkout_start_tx`: `0005`→`0007`→`0010`→`0011`;
`webhook_apply_payment_tx`: `0006`→`0007`→`0008`→`0009`;
`team_roster_accept_tx`: `0007`→`0008`; `expire_payment_pending_aggregate_tx`
and `expire_payment_pending_dry_run_tx`: `0012`→`0013`), only the
**highest-numbered, currently-live** definition is inventoried below,
cross-confirmed against live `pg_proc` on both Main and sandbox (owner,
`prosecdef`, `proconfig`, `proacl`). Main is missing the 5
expiry/lease functions entirely (`expire_payment_pending_aggregate_tx`,
`expire_payment_pending_batch_tx`, `expire_payment_pending_dry_run_tx`,
`acquire_payment_pending_expiry_run_lease_tx`,
`release_payment_pending_expiry_run_lease_tx` do not exist in
`pg_proc` on Main today) — this is the live, first-hand confirmation
that migrations `0011`–`0014` have **not** been applied to Main,
consistent with the governance state `InsForge Main apply = NOT
AUTHORIZED`.

| Función | Propietario | Security mode | Search path | Roles con EXECUTE | Edge Functions que la llaman | Tablas mutadas | Auditoría producida | Clasificación |
|---|---|---|---|---|---|---|---|---|
| `checkout_start_tx` (0011) | `project_admin` | `SECURITY DEFINER` | `pg_catalog, public, pg_temp` | `project_admin` only | `mp-create-checkout` | `buyer_contacts`, `participants`, `orders`, `order_items`, `registrations`, `capacity_holds`, `capability_credentials`, `waiver_documents`, `waiver_acceptances`, `teams`, `team_members`, `idempotency_records`, `activity_log` (reads `products`, `events`) | `activity_log` | `REQUIRED_BY_CHECKOUT` |
| `checkout_attach_preference` (0007) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `mp-create-checkout` | `orders`, `idempotency_records` | `activity_log` | `REQUIRED_BY_CHECKOUT` |
| `checkout_compensate_preference` (0007) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `mp-create-checkout` | `capacity_holds`, `orders`, `teams` | `activity_log` | `REQUIRED_BY_CHECKOUT` |
| `webhook_apply_payment_tx` (0009) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `mp-webhook` | `webhook_events`, `payments`, `payment_verification_records`, `orders`, `capacity_holds`, `registrations`, `outbox_delivery_jobs` | `activity_log`, `webhook_events`, `payment_verification_records` | `REQUIRED_BY_WEBHOOK` |
| `ticket_new_opaque_token` (0008) | `project_admin` | `SECURITY INVOKER` | n/a (no table access) | `project_admin` only | called internally by other ticket RPCs | none (pure token generation) | none | `REQUIRED_BY_EXPIRY`-adjacent / internal helper, cross-callable by `ticket-credentials` |
| `ticket_hash_token` (0008) | `project_admin` | `SECURITY INVOKER` | n/a | `project_admin` only | called internally | none | none | internal helper, same as above |
| `ticket_issue_one_registration` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | called internally by `ticket_issue_after_payment`/`ticket_issue_after_team_eligible` (not called directly by any Edge Function's `index.ts`) | `tickets`, `ticket_credential_generations`, `access_entitlements`, `capability_credentials`, `outbox_delivery_jobs`, `activity_log` (reads `products`) | `activity_log` | `CROSS_FUNCTION_EXCESS` candidate for direct EXECUTE (only ever invoked SQL-side by the two wrappers below, but nothing in Postgres prevents any `project_admin`-authenticated Edge Function from calling it directly) |
| `ticket_issue_after_payment` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | not observed to be called from any Edge Function `index.ts` in this repository (`ticket-credentials/index.ts` calls `ticket_credential_verify_tx`/`ticket_get_projection_tx`/`ticket_credential_reissue_tx` only) | orchestrates `ticket_issue_one_registration` (no direct table writes of its own) | (via wrapped call) | `NOT_OBSERVABLE` — no confirmed caller in the current Edge Function code; likely intended for a webhook-triggered path not yet wired, or invoked exclusively from SQL (e.g. a trigger) not inspected in this unit |
| `ticket_issue_after_team_eligible` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | same as above — `NOT_OBSERVABLE` caller | orchestrates `ticket_issue_one_registration` per team member | (via wrapped call) | `NOT_OBSERVABLE` |
| `ticket_credential_reissue_tx` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `ticket-credentials` | `ticket_credential_generations`, `tickets`, `capability_credentials`, `idempotency_records`, `activity_log` | `activity_log` | `CROSS_FUNCTION_EXCESS` (reachable by all six functions at the DB layer) |
| `ticket_credential_verify_tx` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `ticket-credentials` | none (read-only) | none observed | `CROSS_FUNCTION_EXCESS` |
| `ticket_get_projection_tx` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `ticket-credentials` | none (read-only) | none observed | `CROSS_FUNCTION_EXCESS` |
| `team_roster_accept_tx` (0008) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `team-roster` | `waiver_documents`, `participants`, `registrations`, `waiver_acceptances`, `team_members`, `capability_credentials`, `teams`, `idempotency_records`, `activity_log` | `activity_log` | `CROSS_FUNCTION_EXCESS` |
| `team_apply_payment_outcome` (0007) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | not observed to be called from any Edge Function `index.ts` (no `.rpc('team_apply_payment_outcome'` match anywhere in `insforge/functions/**`) | `teams` (reads `products` for `v_product`) | none observed | `NOT_OBSERVABLE` — defined and granted, but no confirmed caller anywhere in current Edge Function code; likely invoked from inside `webhook_apply_payment_tx` via a direct SQL function call rather than the SDK `.rpc()` surface, or reserved for a future path — **not confirmed either way in this unit** |
| `team_roster_get_tx` (0007) | `project_admin` | `SECURITY DEFINER` | fixed | `project_admin` only | `team-roster` | none (read-only) | none observed | `CROSS_FUNCTION_EXCESS` |
| `expire_payment_pending_aggregate_tx` (0013) | `project_admin` | `SECURITY DEFINER`, `VOLATILE` | fixed | `project_admin` only (**absent from Main `pg_proc` — sandbox only**) | `payment-pending-expiry` (via `expire_payment_pending_batch_tx`, and directly per `IMPL-14A-3B` evidence) | `orders`, `activity_log`, `outbox_delivery_jobs`, `capacity_holds`, `registrations`, `capability_credentials` | `activity_log` | `REQUIRED_BY_EXPIRY` |
| `expire_payment_pending_batch_tx` (0012) | `project_admin` | `SECURITY DEFINER`, `VOLATILE` | fixed | `project_admin` only (**sandbox only**) | `payment-pending-expiry` | none directly — `SELECT … FOR UPDATE SKIP LOCKED` on `orders` for candidate selection only, then calls `expire_payment_pending_aggregate_tx` per candidate inside a sub-transaction with `EXCEPTION WHEN OTHERS` isolation | `activity_log` (via the aggregate call) | `REQUIRED_BY_EXPIRY` |
| `expire_payment_pending_dry_run_tx` (0013) | `project_admin` | `SECURITY DEFINER`, `STABLE` | fixed | `project_admin` only (**sandbox only**) | `payment-pending-expiry` (dry-run/inspection mode) | none — `STABLE` marking is enforced by the Postgres engine itself, which refuses `INSERT`/`UPDATE`/`DELETE`/`SELECT … FOR UPDATE` inside a non-`VOLATILE` function; zero mutation is structurally guaranteed, not only reviewed | none (by design) | `REQUIRED_BY_EXPIRY` |
| `acquire_payment_pending_expiry_run_lease_tx` (0014) | `project_admin` | `SECURITY DEFINER`, `VOLATILE` | fixed | `project_admin` only (**sandbox only**) | `payment-pending-expiry` | `idempotency_records` (`scope='payment_pending_expiry_run'`) | none (lease state itself is the record) | `REQUIRED_BY_EXPIRY`; hard-validates `actor_ref = 'system:payment-pending-expiry'` and `ttl_seconds = 90` inside the function body — rejects any other caller-supplied value with `INVALID_INPUT` |
| `release_payment_pending_expiry_run_lease_tx` (0014) | `project_admin` | `SECURITY DEFINER`, `VOLATILE` | fixed | `project_admin` only (**sandbox only**) | `payment-pending-expiry` | `idempotency_records` (same lease row) | none | `REQUIRED_BY_EXPIRY`; only releases if `response_ref` (owner) matches the caller's `run_id` |

20/20 currently-live sensitive functions accounted for (14 on Main, 20
on sandbox — the delta is exactly the 5 expiry/lease functions plus
`expire_payment_pending_dry_run_tx`/`batch_tx` grouping already
mentioned above; recount: Main has `checkout_start_tx`,
`checkout_attach_preference`, `checkout_compensate_preference`,
`webhook_apply_payment_tx`, `ticket_new_opaque_token`,
`ticket_hash_token`, `ticket_issue_one_registration`,
`ticket_issue_after_payment`, `ticket_issue_after_team_eligible`,
`ticket_credential_reissue_tx`, `ticket_credential_verify_tx`,
`ticket_get_projection_tx`, `team_roster_accept_tx`,
`team_apply_payment_outcome`, `team_roster_get_tx` = **15**; sandbox has
those 15 plus the 5 expiry/lease functions = **20**).

`UNUSED` classification was not assigned to any function outright;
`ticket_issue_after_payment`, `ticket_issue_after_team_eligible`, and
`team_apply_payment_outcome` are marked `NOT_OBSERVABLE` rather than
`UNUSED`, because the absence of an `.rpc()` call in the four/six
`index.ts` files inspected does not prove the function is never invoked
— it may be called from inside another `SECURITY DEFINER` function via
a direct SQL function call (which does not appear as `.rpc(` in
TypeScript), which this unit's static/read-only method cannot fully
rule out without a full call-graph trace inside every PL/pgSQL body
(out of scope for this pass; flagged as a limitation in §B1.15, not
assumed `PASS` or `UNUSED`).

---

## B1.6 Call graph completo por Edge Function

The four call graphs already built in `OD-040-002-A` §5 are re-confirmed
unchanged by this unit's re-inspection (same RPC names, same direct
table access, same secrets). Restated here per the requested notation,
annotated with the additional per-call classification requested:

### `mp-create-checkout`

```text
request
→ authn: none (public/anon HTTP endpoint; identity check is CORS
  origin only, per CHECKOUT_CORS_ORIGIN — direct database access) [audit
  produced: no]
→ validación: CORS origin + body shape (application code, no DB)
→ RPC: checkout_start_tx(jsonb)          [RPC-mediated; secret: none
  beyond API_KEY; audit produced: yes — activity_log]
→ tablas: SELECT products, events (direct database access, secret:
  none beyond API_KEY; audit produced: no — read-only)
→ RPC: checkout_attach_preference(jsonb) [RPC-mediated; audit: yes]
→ RPC: checkout_compensate_preference(jsonb) on Mercado Pago failure
  [RPC-mediated; audit: yes]
→ respuesta: order/preference reference
cross-domain capability inherited but unused: EXECUTE on
  webhook_apply_payment_tx, all ticket_*, all team_*, all expire_*/
  lease_* RPCs; full DML on all 24 tables including participant_
  sensitive_profiles, payments, tickets
```

### `mp-webhook`

```text
request
→ authn: HMAC signature verification against MERCADOPAGO_WEBHOOK_SECRET
  (application code, no DB) [audit produced: no — pre-DB rejection path]
→ validación: signature + payload shape
→ RPC: webhook_apply_payment_tx(jsonb) [RPC-mediated; secret: none
  beyond API_KEY; audit produced: yes — activity_log,
  payment_verification_records, webhook_events]
→ tablas: none directly — all reads/writes happen inside the RPC
→ respuesta: 200 ack (idempotent on webhook_events dedupe key)
cross-domain capability inherited but unused: EXECUTE on
  checkout_start_tx, all ticket_*, all team_*, all expire_*/lease_*
  RPCs; full DML on all 24 tables including participant_
  sensitive_profiles, buyer_contacts
```

### `get-order-status`

```text
request
→ authn: none (public/anon HTTP endpoint by design — this is the
  customer-facing order-status poll) [audit produced: no]
→ validación: tracking_ref shape only
→ RPC: none
→ tablas: SELECT orders (state only, by tracking_ref) [direct database
  access; secret: none beyond API_KEY; audit produced: no — read-only
  projection]
→ respuesta: order state projection
cross-domain capability inherited but unused: EXECUTE on every sensitive
  RPC in the project (checkout, webhook, tickets, teams, expiry, lease);
  full DML + RLS bypass on all 24 tables — this Edge Function is the
  most over-privileged relative to its actual need (one `SELECT` column
  on one table) of the four in-scope functions
```

### `payment-pending-expiry`

```text
request (schedule-triggered only, per PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET)
→ authn: schedule secret comparison (application code, no DB) [audit:
  no — pre-DB rejection path]
→ RPC: acquire_payment_pending_expiry_run_lease_tx(jsonb) [RPC-mediated;
  secret: PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET gate before this call;
  audit produced: no direct log row, but the lease row itself is the
  durable evidence]
→ RPC: expire_payment_pending_batch_tx(jsonb) (loop until
  RUN_BUDGET_MS=20_000 exhausted or no more candidates) [RPC-mediated;
  audit produced: yes, per-candidate, inside
  expire_payment_pending_aggregate_tx → activity_log]
→ RPC: expire_payment_pending_dry_run_tx(jsonb) (dry-run/inspection
  mode only) [RPC-mediated; audit: none by design, STABLE]
→ RPC: release_payment_pending_expiry_run_lease_tx(jsonb) [RPC-mediated;
  audit: none directly, lease row updated to COMPLETED]
→ tablas: none directly — all reads/writes happen inside the RPCs
→ respuesta: outcome=partial|complete summary (gateway-safe budget report)
cross-domain capability inherited but unused: EXECUTE on checkout,
  webhook, all ticket_*, all team_* RPCs; full DML + RLS bypass on all
  24 tables including payments, payment_verification_records,
  participant_sensitive_profiles — this is the function under the
  active D3C-2 compensating control (schedule secret + fixed actor_ref
  + strict RPC allowlist in code), but the underlying database identity
  is exactly as broad as the other three
```

Structural fact restated from `OD-040-002-A` §5.5: all four (and the two
adjacent) Edge Functions collapse to the same Postgres identity
(`project_admin`); Postgres itself cannot distinguish which function is
calling.

---

## B1.7 Matriz completa de DML de `project_admin` (24 tablas × 7 privilegios)

Legend: `U` = used by at least one current RPC or direct Edge access;
`D` = dead — zero occurrences found in `0001`–`0014` for this
privilege/table pair; `—` = not evaluated at the row level for this
release (see caveat below).

| Tabla | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---|---|---|---|---|---|
| `events` | **U** (direct + RPC) | D | D | D | D | R3* | R3* |
| `event_days` | D | D | D | D | D | R3* | R3* |
| `products` | **U** (direct + RPC) | D | D | D | D | R3* | R3* |
| `buyer_contacts` | U** | **U** (INSERT) | D | D | D | R3* | R3* |
| `participants` | U** | **U** (INSERT) | D | D | D | R3* | R3* |
| `participant_sensitive_profiles` | D | D | D | D | D | R3* | R3* |
| `registrations` | U** | **U** | **U** | D | D | R3* | R3* |
| `teams` | U** | **U** | **U** | D | D | R3* | R3* |
| `team_members` | U** | **U** | **U** | D | D | R3* | R3* |
| `capability_credentials` | U** | **U** | **U** | D | D | R3* | R3* |
| `waiver_documents` | U** | **U** | D | D | D | R3* | R3* |
| `waiver_acceptances` | U** | **U** | D | D | D | R3* | R3* |
| `orders` | **U** (direct + RPC) | **U** | **U** | D | D | R3* | R3* |
| `order_items` | U** | **U** | D | D | D | R3* | R3* |
| `capacity_holds` | U** | **U** | **U** | D | D | R3* | R3* |
| `payments` | U** | **U** | **U** | D | D | R3* | R3* |
| `payment_verification_records` | U** | **U** | **U** | D | D | R3* | R3* |
| `webhook_events` | **U** (RPC dedupe read) | **U** | **U** | D | D | R3* | R3* |
| `idempotency_records` | **U** (RPC dedupe/lease read) | **U** | **U** | D | D | R3* | R3* |
| `tickets` | U** | **U** | **U** | D | D | R3* | R3* |
| `ticket_credential_generations` | U** | **U** | **U** | D | D | R3* | R3* |
| `access_entitlements` | U** | **U** | D | D | D | R3* | R3* |
| `activity_log` | U** | **U** | D | D | D | R3* | R3* |
| `outbox_delivery_jobs` | U** | **U** | D (no consumer yet) | D | D | R3* | R3* |

`*` `REFERENCES`/`TRIGGER` are DDL-time privileges, not reachable
through the `@insforge/sdk` admin client's `.from()`/`.rpc()` surface
(which only issues structured DML, never `ALTER TABLE`/`CREATE
TRIGGER`). They are needed only by whichever role executes future
`CREATE TABLE … REFERENCES …` / `CREATE TRIGGER` migrations — which,
under the current InsForge self-service model, is the same
`project_admin` role (§B1.2, `OD-040-002-A` §7). Revoking them today
would not reduce the Edge Function attack surface (they cannot be
exercised via the SDK) but would risk breaking a future migration that
adds a new foreign key or trigger against these tables. Classified
`R3` uniformly for this reason, not evaluated table-by-table beyond
that structural argument.

`**` marked `U` (not `D`) as a conservative default: every RPC that
performs an `UPDATE ... WHERE id = $1 RETURNING …` or that reads
`FOUND`/row state to branch logic requires `SELECT`-equivalent access
under Postgres's privilege model for certain plan shapes (e.g. a
`WHERE` clause referencing table columns, or a value read back via
`RETURNING`) even when a `.rpc()`-facing summary looks INSERT/UPDATE-
only. This unit did **not** attempt to mechanically prove, for each of
the 19 tables so marked, that revoking bare `SELECT` would not silently
break a specific query plan inside a `SECURITY DEFINER` body (that
would require an actual `REVOKE` + a full regression run in the
sandbox, which is out of scope for `ANALYZE + READ-ONLY`). `SELECT` is
therefore **not** proposed for revocation on any of these 19 tables in
this unit (§B1.9, R3), except for `event_days` and
`participant_sensitive_profiles`, where the "zero references at all"
finding already covers `SELECT` too.

`DELETE` and `TRUNCATE` are **`D` (dead) on all 24 tables without
exception** — a repo-wide grep for `DELETE FROM public\.` and
`TRUNCATE` across `0001`–`0014` returns zero matches. This is the
single strongest, broadest, lowest-risk revocation candidate in this
inventory (§B1.9, R1).

---

## B1.8 Amenazas T1–T7 actualizadas

| Amenaza | Estado actual | Mitigación actual | Hardening B2 esperado | Bloqueo de plataforma |
|---|---|---|---|---|
| T1 — Cross-invocation (una función usa la identidad de otra) | `ALLOWED` (structurally — same role for all six functions) | none beyond code discipline | `PARTIALLY MITIGATED` at best — allowlisting RPCs per function in application code narrows *intent*, not *capability*; the DB-level identity is unchanged | `PLATFORM BLOCKED` — needs a distinct login role or scoped credential per function, not available self-service |
| T2 — Ejecución pública (`PUBLIC`/`anon`/`authenticated` llama una RPC sensible) | `DENIED` | `REVOKE ALL … FROM PUBLIC, anon, authenticated` present on every sensitive RPC in `0005`–`0014`, re-confirmed on Main and sandbox `pg_proc.proacl` in this unit | `DENIED` (already correct; B2 does not need to touch this) | none |
| T3 — Escritura directa (el rol técnico evita la RPC protegida) | `ALLOWED` for 22 of 24 tables (writes are used, so table grant can't be revoked without a new role); `DENIED`-after-B2` for `event_days`/`participant_sensitive_profiles` (zero writes, revocable now); `PARTIALLY MITIGATED` for `products`/`events` (SELECT stays required, but INSERT/UPDATE/DELETE/TRUNCATE become revocable, narrowing the *blast radius* of a direct-write bypass without eliminating it for the 22 write-bearing tables) | none beyond RLS `FORCE`+0-policy fail-closed pattern, which does not apply to `project_admin` (`rolbypassrls=true`) | `event_days`, `participant_sensitive_profiles`, `products`, `events`: `DENIED`/`PARTIALLY MITIGATED` after B2 `REVOKE`. The other 20 tables: **unchanged**, `ALLOWED`, because the RPC's own internal writes run as the same owner/caller and would break if that role's table grant were revoked | `PLATFORM BLOCKED` for full closure on the 20 write-bearing tables |
| T4 — Llamada no autorizada a función (una función invoca una RPC que no le corresponde) | `ALLOWED` at DB layer for all 20 functions (any of the six Edge Functions can call any RPC; only their own code chooses not to) | application-code discipline only (no `.rpc('other_function_name'` calls exist today, confirmed by grep) | `PARTIALLY MITIGATED` — B2 proposes tightening `proacl` is **not possible** without per-function roles, so this stays `ALLOWED` at the DB layer; the only available compensating step is a stricter allowlist *inside* each function's own code, which is already largely the case (`payment-pending-expiry` already does this per D3C-2) | `PLATFORM BLOCKED` |
| T5 — Search path hijacking | `DENIED` (already correct) | every `SECURITY DEFINER` function sets `search_path = pg_catalog, public, pg_temp`; only `project_admin`/`postgres` have `CREATE` on schema `public` (`anon`/`authenticated` do not) — re-confirmed via `pg_proc.proconfig` and `has_schema_privilege` in this unit | `DENIED` (unchanged by B2) | none |
| T6 — Escalada por ownership (el invocador altera o reemplaza la función) | `ALLOWED` structurally (same reasoning as `OD-040-002-A` §9: any Edge Function running as `project_admin` owns every sensitive function) | none | `PARTIALLY MITIGATED` at best — B2 cannot change function ownership without a new role; this remains open | `PLATFORM BLOCKED`; whether the `@insforge/sdk` admin client can even issue arbitrary DDL from Edge Function code remains `NOT OBSERVABLE` (untested, would require a deployment, out of scope) |
| T7 — Bypass de auditoría (una escritura ocurre sin generar `activity_log`) | `PARTIALLY MITIGATED` today (every RPC that mutates a business table also inserts `activity_log` in the same transaction, confirmed function-by-function in §B1.5) but `ALLOWED` via the T3 bypass path (a direct write skipping the RPC entirely also skips its `activity_log` insert) | RPC-internal audit inserts; no independent trigger-based audit exists on the 22 write-bearing tables | `PARTIALLY MITIGATED`, unchanged in substance — B2's `event_days`/`participant_sensitive_profiles`/`products`/`events` revocations do not add trigger-based audit to the 20 tables that remain directly writable; a genuine close of T7 would need either (a) per-function roles (T3 closure) or (b) `AFTER` triggers on the 20 tables independent of RPC discipline, which is a new, unauthorized implementation surface not proposed here | `PLATFORM BLOCKED` for (a); (b) is self-service-buildable but is a **new** control, not part of B2's scope as authorized |

No claim is made that B2 closes T1, T4, or T6, and T3/T7 are explicitly
recorded as only **narrowed**, not closed, for the 20 tables whose
writes are load-bearing.

---

## B1.9 Lista exacta de revocaciones candidatas

| Recurso | Privilegio actual | Uso comprobado | Revocación candidata | Riesgo | Prueba requerida | Rollback |
|---|---|---|---|---|---|---|
| `events` | INSERT, UPDATE, DELETE, TRUNCATE (`project_admin`) | ninguno (grep 0001–0014) | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.events FROM project_admin` | muy bajo — ningún camino de código las usa | `checkout_start_tx` end-to-end (positivo) + intento negativo directo de `INSERT`/`UPDATE`/`DELETE` (esperado `DENIED`) | `GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.events TO project_admin` |
| `products` | INSERT, UPDATE, DELETE, TRUNCATE (`project_admin`) | ninguno | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM project_admin` | muy bajo | igual que arriba, para `products` | `GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.products TO project_admin` |
| `event_days` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE (`project_admin`) | ninguno (cero referencias en `0005`–`0014`) | `REVOKE ALL ON public.event_days FROM project_admin` (mantener ownership) | muy bajo — tabla no usada por ningún flujo actual | full test suite + expiry suite (confirmar cero dependencia oculta) | `GRANT ALL ON public.event_days TO project_admin` |
| `participant_sensitive_profiles` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE (`project_admin`) | ninguno (cero referencias en `0005`–`0014`) | `REVOKE ALL ON public.participant_sensitive_profiles FROM project_admin` (mantener ownership) | muy bajo funcionalmente, **alto valor de mitigación** por ser PII | full test suite + expiry suite | `GRANT ALL ON public.participant_sensitive_profiles TO project_admin` |
| `anon`, `authenticated` × las 24 tablas | SELECT, INSERT, UPDATE, DELETE (ambos roles, las 24 tablas) | ninguno — no existe código cliente en este repositorio que use `anon`/`authenticated` contra estas tablas; RLS `FORCE`+0 policies ya bloquea filas en runtime | `REVOKE DELETE, INSERT, SELECT, UPDATE ON` (las 24 tablas) `FROM anon, authenticated` | muy bajo — defensa en profundidad; hoy el bloqueo depende únicamente de RLS, esto añade una segunda capa independiente | pruebas negativas: `anon`/`authenticated` intentando `SELECT`/`INSERT`/`UPDATE`/`DELETE` directo (ya `DENIED` hoy por RLS; debe seguir `DENIED` después, ahora por doble motivo) + confirmar que ninguna función de plataforma InsForge (auth, storage, etc., fuera del dominio de negocio) dependa de estos grants por defecto | `GRANT DELETE, INSERT, SELECT, UPDATE ON` (las 24 tablas) `TO anon, authenticated` |
| todas las 24 tablas | `DELETE`, `TRUNCATE` (`project_admin`) | ninguno en ninguna tabla (grep global `0001`–`0014`: cero `DELETE FROM`, cero `TRUNCATE`) | `REVOKE DELETE, TRUNCATE ON` (las 24 tablas) `FROM project_admin` | bajo–medio — amplio pero uniformemente sin uso comprobado; requiere confirmar que ningún flujo de negocio futuro cercano (p. ej. borrado de datos por solicitud GDPR/derecho al olvido) dependa de `DELETE` directo | full test suite + expiry suite + revisión explícita del Project Owner sobre si un futuro borrado de datos personales requeriría este privilegio antes de revocarlo permanentemente | `GRANT DELETE, TRUNCATE ON` (las 24 tablas) `TO project_admin` |
| `activity_log` | `UPDATE` (`project_admin`) | ninguno (append-only por diseño, cero `UPDATE` en `0001`–`0014`) | `REVOKE UPDATE ON public.activity_log FROM project_admin` | bajo — refuerza la garantía de solo-inserción del log de auditoría a nivel de motor, no solo de disciplina de código | full test suite + intento negativo de `UPDATE` directo sobre una fila de auditoría existente | `GRANT UPDATE ON public.activity_log TO project_admin` |

### Grupo R1 — Seguro para implementación propuesta (`OD-040-002-B2`)

```text
1. products    : REVOKE INSERT, UPDATE, DELETE, TRUNCATE
2. events      : REVOKE INSERT, UPDATE, DELETE, TRUNCATE
3. event_days  : REVOKE ALL (SELECT, INSERT, UPDATE, DELETE, TRUNCATE)
4. participant_sensitive_profiles : REVOKE ALL
5. anon        : REVOKE SELECT, INSERT, UPDATE, DELETE  — on all 24 tables
6. authenticated : REVOKE SELECT, INSERT, UPDATE, DELETE — on all 24 tables
7. activity_log : REVOKE UPDATE (INSERT stays; DELETE/TRUNCATE folded into
   item 8 below, not duplicated here)
```

### Grupo R2 — Requiere prueba adicional (no incluir en la primera implementación)

```text
8. DELETE, TRUNCATE on the remaining 20 write-bearing tables (project_admin)
   — evidence says "unused today", but a blanket revocation across 20
   tables in one migration is a larger blast radius than items 1–7 and
   deserves its own explicit Project Owner sign-off given the possible
   future need for a data-deletion path (GDPR-style), not bundled into B2
9. outbox_delivery_jobs UPDATE/DELETE — currently unused because no
   consumer exists yet; revoking now is safe for today's code but would
   need to be re-granted (or handled by a distinct future role) the
   moment an outbox worker is built — deferred to whenever that work is
   authorized, not part of B2
10. team_apply_payment_outcome / ticket_issue_after_payment /
    ticket_issue_after_team_eligible EXECUTE — these three functions are
    `NOT_OBSERVABLE` for caller confirmation (§B1.5); revoking EXECUTE
    from project_admin would remove them from every Edge Function's
    reach, but this unit cannot yet prove zero SQL-side callers (e.g. a
    trigger) reference them — needs a dedicated trace before any EXECUTE
    revocation is proposed
```

### Grupo R3 — No revocar

```text
11. SELECT on products, events, orders — required directly by Edge
    Function code and by RPC bodies
12. SELECT/INSERT/UPDATE on the 20 write-bearing tables beyond the R1
    items above — load-bearing for the RPCs that share the caller's
    identity; revoking would break checkout, webhook, tickets, teams,
    or expiry today, with no available narrower role to move the RPC
    ownership to
13. REFERENCES, TRIGGER on all 24 tables — DDL-time only, unreachable
    via the SDK's DML surface, needed for future migrations run under
    the same shared role
14. EXECUTE on all 20 RPCs for project_admin — needed by at least one
    of the six Edge Functions each; cannot be narrowed per-function
    without a distinct role per function (platform-blocked)
```

No revocation in this list has been executed. `psql`/`insforge db
query --unrestricted` were used exclusively in `SELECT` mode against
`pg_catalog`/`information_schema`/`pg_proc`/`pg_class` in this unit;
zero `GRANT`/`REVOKE`/`ALTER`/`CREATE`/`DROP` statements were issued on
Main or sandbox.

---

## B1.10 Contrato compensatorio propuesto: `COMPENSATING LEAST-PRIVILEGE HARDENING`

This is explicitly **not** `TRUE LEAST PRIVILEGE`. It is the maximum
that can be guaranteed today, self-service, without a distinct
PostgreSQL role or credential per Edge Function:

```text
1.  PUBLIC, anon, authenticated retain zero EXECUTE on any sensitive
    RPC (already true; re-confirmed, not part of B2's work).
2.  Strict RPC allowlist per Edge Function in application code (already
    true for payment-pending-expiry per D3C-2; extend the same explicit
    allowlist comment/guard pattern to the other five functions as a
    B2 code-adjacent — but not code-modifying — recommendation for a
    future unit, since B2 itself is migration-only per §B1.11).
3.  Fixed logical actor per function: payment-pending-expiry already
    enforces actor_ref='system:payment-pending-expiry' at the RPC
    validation layer (0014); the other five functions do not have an
    equivalent server-side actor_ref check today — noted as a residual
    gap, not fixed by B2.
4.  Dedicated schedule secret already exists
    (PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET); B2 does not touch secrets.
5.  Fixed search_path on every SECURITY DEFINER function — already true
    for all 20 functions (re-confirmed, unchanged by B2).
6.  Qualified object references (public.<table>) — already true in
    every RPC body inspected (0005–0014), unchanged by B2.
7.  Mandatory audit inside RPCs — already true for every RPC that
    mutates a business table (§B1.5); B2 additionally revokes UPDATE
    on activity_log itself so the audit trail cannot be altered even
    by a direct-write bypass of the RPC layer.
8.  Unused direct DML revoked per Group R1 (§B1.9): products/events
    INSERT/UPDATE/DELETE/TRUNCATE; event_days and
    participant_sensitive_profiles fully revoked; anon/authenticated
    fully revoked on all 24 tables (defense-in-depth alongside RLS).
9.  Negative tests: anon/authenticated/PUBLIC against every sensitive
    RPC (already covered conceptually by OD-040-002-A §17, executed
    concretely in OD-040-002-B3, §B1.13); direct INSERT/UPDATE/DELETE
    against products/events/event_days/participant_sensitive_profiles
    from project_admin, expected DENIED after B2; existing full/expiry
    test suites as the funcional regression net.
10. Residual project_admin capability inventory after B2: EXECUTE on
    all 20 RPCs; full SELECT/INSERT/UPDATE (no DELETE/TRUNCATE) on the
    20 write-bearing tables; SELECT-only on products/events;
    REFERENCES/TRIGGER on all 24 tables (DDL, unreachable via SDK);
    rolbypassrls=true (unchanged — cannot be revoked without breaking
    every RPC's own RLS-bypassing internal reads, since RLS has zero
    policies and would otherwise return zero rows even to the RPC
    owner). This residual is the honest ceiling of what self-service
    hardening can achieve; T1/T3(remaining 20 tables)/T4/T6/T7 remain
    open pending the platform-capability answer.
```

---

## B1.11 Solicitud técnica para InsForge (borrador, no enviado)

```text
Subject: Feature request — per-Edge-Function execution role /
  scoped credential for database access

Use case:
  A single InsForge project runs multiple Edge Functions
  (mp-create-checkout, mp-webhook, get-order-status,
  payment-pending-expiry, ticket-credentials, team-roster), each of
  which should only ever be able to execute a specific, narrow set of
  SECURITY DEFINER RPCs and, in one case, read a single column of one
  table. All Edge Functions currently authenticate to the project's
  Postgres database as the same broad `project_admin` role via the
  same shared API_KEY, because InsForge's Edge Function admin client
  does not appear to support selecting a distinct database role, or
  issuing a scoped/derived credential, per function.

Current risk:
  Every Edge Function in the project is one code defect, one dependency
  compromise, or one leaked API_KEY away from being able to execute
  every sensitive RPC in the project (checkout, webhook, ticket
  issuance/reissuance, team roster mutation, payment-pending expiry,
  lease acquisition) and to read/write every domain table directly,
  bypassing every RPC's own business-rule and audit-logging guarantees.
  This is true even though each function's actual code only ever calls
  a small, fixed subset of RPCs — the restriction exists only in
  application code, not in the database.

Why project_admin + BYPASSRLS is not sufficient:
  project_admin has rolbypassrls=true, so Row-Level Security (which is
  ENABLED+FORCE with zero policies on every domain table, and correctly
  fail-closed for the anon/authenticated roles) provides no isolation
  for the identity every Edge Function actually authenticates as.
  Because every SECURITY DEFINER RPC is also owned by project_admin,
  the "least privilege via SECURITY DEFINER" pattern collapses: the
  RPC's caller and the RPC's owner are the same role, so restricting
  the caller's table grants would also break the RPC's own internal
  writes.

Isolation required:
  A way for each Edge Function (or each deployment/function slug) to
  execute database operations as its own distinct, non-login-capable
  PostgreSQL role — or, short of a full role-per-function, at minimum a
  scoped API key whose resulting database session has a Postgres
  `SET ROLE`-equivalent applied automatically, without requiring
  self-service `CREATE ROLE`/`CREATEROLE` (confirmed absent for
  project_admin on both Main and sandbox in OD-040-002-A §7).

Expected compatibility:
  Should not require changing how Edge Function code invokes
  `admin.database.rpc()`/`.from()` — the scoping should happen at the
  credential/session level (e.g. a distinct API_KEY per function that
  resolves to a distinct Postgres role at connection time), not
  require new SDK call shapes.

Concrete questions for InsForge:
  1. Does the platform support issuing more than one database-backed
     API_KEY per project today, each mapped to a distinct Postgres
     role? If so, how (not found in `insforge secrets`/`insforge`
     CLI help in the version used by this project)?
  2. If not supported today, is a platform-level custom-role
     provisioning primitive (self-service `CREATE ROLE` equivalent,
     or a managed "function identity" concept) on the roadmap?
  3. Is there a way to constrain the Deno runtime for a given Edge
     Function so that Deno.env only exposes the project secrets
     actually declared as required by that function's manifest,
     rather than every project secret to every function's process?
     (Currently NOT OBSERVABLE from this project's tooling — see
     OD-040-002-A §7.1/§19.)
  4. Does the `@insforge/sdk` admin client's `.rpc()`/`.from()` surface
     restrict callers to structured DML only, or can Edge Function
     code issue arbitrary SQL (including DDL) through it? (NOT
     OBSERVABLE without a test deployment; relevant to how severe T6
     — ownership escalation — actually is in practice.)

Evidence attached (no secrets, no ciphertext):
  - table of 24 domain tables with RLS/FORCE/policy-count/grant state
    (identical on Main and sandbox)
  - table of 20 SECURITY DEFINER functions with owner/search_path/acl
    (identical pattern; Main missing the 5 expiry/lease functions only
    because those migrations have not been applied there yet)
  - confirmation that project_admin has rolcreaterole=false and is not
    superuser on both environments

Production impact if unresolved:
  IMPL-14A-3D, InsForge Main apply, and general production go-live for
  this payment-pending-expiry capability remain blocked by Project
  Owner policy pending a resolution to OD-040-002 (per
  WORKSPACE_STATUS.md). A platform answer to this request is a
  prerequisite for closing OD-040-002 with TRUE least privilege rather
  than the compensating-hardening ceiling described in
  OD-040-002-TRUE-LEAST-PRIVILEGE.md.
```

This draft is **not sent**. It is left prepared in this document per
§15 of the authorization, for the Project Owner to review, edit, and
submit through whatever InsForge support/product channel they choose.

---

## B1.12 Plan de implementación `OD-040-002-B2` (propuesto, no creado)

```text
unit: OD-040-002-B2 — Compensating privilege hardening — local
  implementation
new migration prevista: insforge/migrations/0015_least-privilege-
  compensating-hardening.sql  (number suggested, NOT created by this
  unit)
recursos modificados:
  - REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products,
    public.events FROM project_admin
  - REVOKE ALL ON public.event_days FROM project_admin
  - REVOKE ALL ON public.participant_sensitive_profiles FROM
    project_admin
  - REVOKE DELETE, INSERT, SELECT, UPDATE ON <24 tables> FROM anon,
    authenticated
  - REVOKE UPDATE ON public.activity_log FROM project_admin
REVOKE exactos candidatos: ver §B1.9, Grupo R1 (7 statements/groups,
  applied to 4 tables individually + all-24 for anon/authenticated +
  activity_log)
rollback inverso: the exact GRANT statements listed in the "Rollback"
  column of §B1.9's table, applied in reverse order, as a companion
  "down" migration or a documented manual rollback script (InsForge's
  own migration-runner rollback semantics were not re-verified in this
  unit; SPEC-000-GOVERNANCE's existing rollback discipline applies)
tests nuevos:
  - tests/unit/expiry/*: re-run unchanged, must remain 148/148 PASS
    after B2 (no application code changes, so no new expiry unit tests
    are needed — the guarantee is at the database layer)
  - a new negative-privilege test file (name suggested, not created):
    tests/unit/privilege/least-privilege-hardening.test.ts, covering:
      * direct INSERT/UPDATE/DELETE against products/events/event_days/
        participant_sensitive_profiles as project_admin → expect denial
        surfaced through the same admin client path Edge Functions use
      * confirm checkout_start_tx/webhook_apply_payment_tx/ticket/team/
        expiry RPCs still succeed end-to-end (regression, not new
        behavior)
      * confirm anon/authenticated direct table access remains denied
        (was already denied via RLS; now also denied via GRANT)
pruebas negativas: ver arriba + §B1.13 (B3, en sandbox real)
archivos afectados (previstos, no creados):
  - insforge/migrations/0015_least-privilege-compensating-hardening.sql
  - tests/unit/privilege/least-privilege-hardening.test.ts (new)
  - docs/implementation/evidence/OD-040-002-B2-*.md (new evidence file,
    per repository convention of one evidence file per implementation
    unit)
  - WORKSPACE_STATUS.md (status line update only)
gates locales esperados:
  - full suite ≥ 352/352 PASS (or higher if new tests are added)
  - expiry suite ≥ 148/148 PASS
  - typecheck PASS, lint PASS (pre-existing warnings only)
  - git diff --check PASS
qué permanece sin resolver después de B2:
  - T1, T4, T6 (cross-invocation, unauthorized cross-function RPC call,
    ownership escalation) — all platform-blocked, unchanged
  - T3 for the 20 write-bearing tables (direct-write bypass remains
    ALLOWED for those tables — narrowed in blast radius, not closed)
  - T7 (audit bypass) for the same 20 tables
  - Group R2 items (§B1.9): broader DELETE/TRUNCATE revocation across
    20 tables, outbox_delivery_jobs future-worker privileges, and the
    3 NOT_OBSERVABLE-caller functions' EXECUTE scope
  - Main apply and production remain NOT AUTHORIZED regardless of B2's
    outcome — B2 targets sandbox-first validation only (B3)
```

---

## B1.13 Plan de sandbox `OD-040-002-B3` (propuesto, no creado)

```text
unit: OD-040-002-B3 — Sandbox privilege validation
environment: impl-14a-expiry sandbox only (never Main, never production)
fixtures:
  - reuse the existing sandbox seed data from IMPL-14A-3A/3B/3C
    (products/events already seeded); no new fixture data required for
    the R1 revocation set, since it targets currently-unused privilege
    surfaces
  - a disposable test buyer/order pair for the "authorized flow still
    works" checks (created and cleaned up by the test itself, same
    pattern as prior IMPL-14A-3x sandbox retests)
sequence:
  1. snapshot current grants (SELECT from information_schema.role_table_
     grants + pg_proc.proacl) as a pre-change baseline
  2. apply migration 0015 (from B2) to the sandbox only
  3. run the following matrix and record PASS/FAIL for each:
authorized checkout flow            → PASS (checkout_start_tx end-to-end,
                                       unchanged behavior)
authorized webhook flow             → PASS (webhook_apply_payment_tx
                                       end-to-end, unchanged behavior)
authorized status flow              → PASS (get-order-status SELECT
                                       orders, unchanged — orders is not
                                       touched by B2's REVOKE list)
authorized expiry flow              → PASS (acquire lease → batch → dry-
                                       run → release, unchanged — none
                                       of the 4 expiry/lease RPCs' tables
                                       are in B2's REVOKE list)
public sensitive RPC                → DENIED (unchanged from today,
                                       re-confirmed as a regression
                                       guard, not a new control)
anon sensitive RPC                  → DENIED (unchanged, re-confirmed)
authenticated sensitive RPC         → DENIED (unchanged, re-confirmed)
revoked direct DML                  → DENIED — direct INSERT/UPDATE/
                                       DELETE against products/events/
                                       event_days/participant_sensitive_
                                       profiles as project_admin must now
                                       fail with insufficient_privilege;
                                       direct SELECT/INSERT/UPDATE/DELETE
                                       against any of the 24 tables as
                                       anon/authenticated must now fail
                                       with insufficient_privilege (in
                                       addition to the pre-existing RLS
                                       zero-rows behavior)
audited business action             → PASS (a full checkout/webhook/
                                       expiry cycle still produces the
                                       expected activity_log rows)
rollback restoration                → PASS (apply the inverse GRANT
                                       script from §B1.12, re-run the
                                       full matrix above, confirm parity
                                       with the pre-change baseline from
                                       step 1)
limpieza: drop/rollback all sandbox-only test rows created for the
  "authorized flow" checks; restore or leave the R1 grants revoked per
  the Project Owner's decision at that time (B3 does not decide this —
  it only proves the revocation is safe and reversible)
evidencia requerida: full request/response pairs (headers + bodies,
  redacted of secrets) for each row above, plus before/after grant
  snapshots, in the same format as IMPL-14A-3A/3B/3C sandbox runtime
  evidence files
```

---

## B1.14 Impacto sobre la landing

### Landing en sandbox

```text
Classification: ALLOWED_WITH_CONDITIONS
```

Conditions:

```text
1. The landing must connect only to the impl-14a-expiry sandbox
   endpoint, never to Main, and must use its own test/synthetic
   Mercado Pago credentials (sandbox mode), consistent with the
   existing IMPL-13x sandbox E2E precedent in this repository.
2. The landing must go through the existing public Edge Functions
   (mp-create-checkout, get-order-status) exactly as any other client
   would — it must not be granted any new database credential, and
   must not bypass RLS/anon restrictions in any way not already
   available to today's public endpoints.
3. Connecting the landing does not change, accelerate, or substitute
   for OD-040-002's resolution — it is explicitly independent of
   whether B2/B3 have been implemented yet. If B2/B3 have been applied
   to the sandbox, the landing's checkout flow is additionally covered
   by the "authorized checkout flow → PASS" regression check in §B1.13.
4. This unit (B1) does not implement or wire this connection — it only
   classifies the condition under which a future, separately-authorized
   unit could do so.
```

### Landing productiva

```text
Classification: BLOCKED
```

Remains `BLOCKED` while `OD-040-002` (true least privilege) and
Main/production apply are not resolved and separately authorized, per
the governance state already recorded in `WORKSPACE_STATUS.md` and
restated at the top of this unit's authorization. Nothing in B1's
findings changes this; if anything, the newly-confirmed
`anon`/`authenticated` full-DML table grants (§B1.3, §B1.9) reinforce
that production exposure of these tables through any additional
surface should wait for the R1 hardening (`OD-040-002-B2`/`B3`) to be
implemented and validated first, in addition to the pre-existing
`OD-040-002` blocker.

---

## B1.15 Limitaciones de observabilidad de esta unidad

```text
- ticket_issue_after_payment, ticket_issue_after_team_eligible, and
  team_apply_payment_outcome have no confirmed caller anywhere in the
  six Edge Functions' index.ts files inspected. This unit could not
  rule out a SQL-side caller (e.g. another function's body calling them
  directly, or a trigger) without tracing every PL/pgSQL function body
  line-by-line for cross-calls, which was out of scope for this pass.
  Classified NOT_OBSERVABLE, not UNUSED — no EXECUTE revocation is
  proposed for these three functions in Group R1.
- Whether revoking bare SELECT on any of the 19 tables marked "U**" in
  §B1.7 would break a specific query plan inside a SECURITY DEFINER
  body was not mechanically tested (would require an actual REVOKE +
  full regression in the sandbox). SELECT is not proposed for
  revocation on any of those 19 tables in this unit.
- Whether the @insforge/sdk admin client exposes raw/arbitrary SQL to
  Edge Function code (relevant to T6 severity) remains NOT OBSERVABLE,
  same limitation already recorded in OD-040-002-A §19/§9.
- Whether InsForge's Deno runtime scopes secret visibility per Edge
  Function remains NOT OBSERVABLE, same limitation already recorded in
  OD-040-002-A §7.1/§19.
- This unit inspected Main and the impl-14a-expiry sandbox only, via
  the project's own MCP run-raw-sql tool (Main) and the insforge CLI
  db query --unrestricted (sandbox); no other environment was
  inspected.
- Sequence inventory (§B1.4) confirmed zero sequences exist; this
  finding is definitive (a direct pg_class query), not an
  observability gap.
```

---

## B1.16 Documentos modificados por esta unidad

```text
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
  (this append — a new top-level unit section, OD-040-002-A's own
  content above is untouched)
WORKSPACE_STATUS.md
  (OD-040-002-B1 = ANALYZING / NOT RESOLVED line only; no other status
  in that file is changed by this unit)
```

No second document was created; the existing evidence file already
established for `OD-040-002` was extended, consistent with §19 of the
authorization.

---

## B1.17 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B1_REVIEW
```

The inventory in this unit is complete for all 24 tables, 0 sequences,
and 20 currently-live sensitive functions, cross-checked against live
Main and sandbox catalogs. A safe, evidence-backed Group R1 revocation
list is ready to become `OD-040-002-B2`'s exact migration content, and
a corresponding `OD-040-002-B3` sandbox validation plan is ready to
follow it. This unit does not claim `APPROVED`, `RESOLVED`,
`VALIDATED`, `CLOSED`, `READY_FOR_MAIN`, `READY_FOR_PRODUCTION`,
`READY_FOR_IMPL_14A_3D`, or `READY_FOR_LANDING_PRODUCTION`.
```

---

# OD-040-002-B2 — Local compensating privilege hardening

## B2.1 Autorización

```text
unit: OD-040-002-B2 — Compensating privilege hardening — local implementation
governance date: 2026-07-30 — America/Merida
mode: EXECUTE — LOCAL ONLY
primary operation: Implementar localmente el hardening compensatorio de
  privilegios aprobado conceptualmente después de OD-040-002-B1.
authority: OD-040-002-A = CTO REVIEW PASS; OD-040-002-B1 = CTO REVIEW PASS
no remote application authorized (no sandbox apply, no Main apply, no
  production apply, no deploy, no schedule change)
```

## B2.2 Baseline

```text
repository: C:\vonde\enforma-sys\ready2hybrid
branch: main
HEAD (pre-B2): bced99e5a1f27128b7b497013f283c1967223599
origin/main (pre-B2): bced99e5a1f27128b7b497013f283c1967223599
divergence: 0 0
staged: 0
```

Working tree at the start of B2 (`git status --short`), before any B2
edit:

```text
 M WORKSPACE_STATUS.md                                              (inherited from B1, uncommitted)
?? docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md   (inherited from B1, new file, untracked)
?? .cursor/*                                                         (pre-existing, out of scope, untouched by B2)
```

No other tracked file differed from `HEAD`. `git diff --cached --name-only`
returned empty (0 staged files). This matches the baseline declared in
§3/§5 of the B2 authorization; no `REPOSITORY_STATE_REQUIRES_REVIEW`
condition applied.

SHA-256 (uppercase hex) of every existing file this unit was authorized
to modify, captured before any B2 edit:

```text
WORKSPACE_STATUS.md (pre-B2)
  3729F2DA7DF2DF144CC1064472C60B055C5611C12065A6098C97CE26F100A1BD

docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md (pre-B2, B1 content only)
  449397CC4F27AB059BD4B6381CD41E28DFF365178E069245F0F4BB29F550443F
```

SHA-256 of the three prior expiry migrations, confirmed identical to
the values declared in the B2 authorization §13 P14 (i.e. §21.9/§22 of
IMPL-14A-3C and B1's own baseline were not disturbed by anything
between B1 and B2):

```text
0012_payment-pending-expiry-transaction.sql
  E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1  (match)
0013_payment-pending-expiry-array-fix.sql
  BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A  (match)
0014_payment-pending-expiry-run-lease.sql
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000  (match)
```

Table ownership was re-confirmed via a read-only `pg_tables` query
(Main) immediately before writing the migration, to ground the
ownership caveat required by §11 of the authorization:

```text
tablename                         | tableowner
-----------------------------------+---------------
events                             | project_admin
products                           | project_admin
event_days                         | project_admin
participant_sensitive_profiles     | project_admin
activity_log                       | project_admin
```

## B2.3 Archivos creados y modificados

```text
Creado:
  insforge/migrations/0015_compensating-privilege-hardening.sql
  tests/unit/security/compensating-privilege-hardening.test.ts

Modificado (documental, alcance autorizado explícitamente):
  docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md  (esta sección)
  WORKSPACE_STATUS.md  (línea de estado OD-040-002-B2 únicamente)

No modificado (confirmado):
  insforge/migrations/0001 .. 0014  (bytes idénticos, ver §B2.2 y §B2.9)
  Edge Functions (index.ts, handler.deploy.js, _shared/*)
  frontend (src/*)
  .cursor/*
  .insforge/project.json
  docs/00-05, SPEC-040 aprobada, IMPL-14A-2 aprobado
```

No other file was created, modified, or required. The implementation
fit entirely inside the file set authorized in §7 of the B2
authorization; no `BLOCKED_BY_DESIGN_CONFLICT` condition was reached.

## B2.4 Diseño de `0015_compensating-privilege-hardening.sql`

The migration is a single `BEGIN;` / `COMMIT;` block containing only
`REVOKE` statements against existing tables and existing roles,
preceded by an extensive header comment documenting authority, scope,
the ownership caveat, and what is deliberately excluded (Group R2/R3).
It is followed by a fully commented-out (non-executable) rollback block.

It does not:

```text
CREATE ROLE / ALTER ROLE / DROP ROLE
ALTER ... OWNER TO
CREATE POLICY / DROP POLICY
ENABLE|DISABLE|FORCE ROW LEVEL SECURITY (unchanged since 0003)
CREATE OR REPLACE FUNCTION / ALTER FUNCTION
CREATE TABLE / ALTER TABLE
CREATE TRIGGER / CREATE EXTENSION
any dynamic SQL (no DO blocks, no EXECUTE format(...))
```

Every `REVOKE ... ON TABLE public.<table> FROM <role>` statement
references a qualified, already-existing table by its exact name from
the 0001 schema; if any named table did not exist, PostgreSQL would
raise `42P01 undefined_table` and abort the transaction (§8.10's
"fail clearly" requirement — no `IF EXISTS`/guard clauses were added,
matching this repository's existing migration style of unconditional,
explicit DDL/DCL statements).

## B2.5 Lista exacta de las 24 tablas (idéntica a B1 §B1.3)

```text
events, event_days, products, buyer_contacts, participants,
participant_sensitive_profiles, registrations, teams, team_members,
capability_credentials, waiver_documents, waiver_acceptances, orders,
order_items, capacity_holds, payments, payment_verification_records,
webhook_events, idempotency_records, tickets,
ticket_credential_generations, access_entitlements, activity_log,
outbox_delivery_jobs
```

No table was added to or removed from this list. `tests/unit/security/
compensating-privilege-hardening.test.ts` (P2/P12) fails if the set's
size or membership ever drifts from these exact 24 names.

## B2.6 Revocaciones de `anon` y `authenticated`

For each of the 24 tables above, the migration contains exactly one
statement of this shape (24 statements total, both roles named in the
same statement):

```sql
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.<table> FROM anon, authenticated;
```

Net effect: after this migration, `anon` and `authenticated` hold zero
direct table-level privileges on any of the 24 domain tables. No
alternative privilege, policy, or view is granted in exchange. Any
future public read (leaderboard, results, Realtime) requires a
separate, explicitly authorized unit that adds its own narrow grant or
policy — this migration deliberately does not anticipate or prepare
one.

## B2.7 Revocaciones R1 de `project_admin`

Exactly the five statements authorized by §10 of the B2 authorization,
matching B1 §B1.9 Group R1 with no additions:

```text
events    : REVOKE INSERT, UPDATE, DELETE, TRUNCATE FROM project_admin
            (SELECT retained — required by mp-create-checkout and by
            checkout_start_tx/ticket_issue_one_registration/
            team_apply_payment_outcome)
products  : REVOKE INSERT, UPDATE, DELETE, TRUNCATE FROM project_admin
            (SELECT retained — same reason as events)
event_days: REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE FROM
            project_admin (UNUSED_AND_REVOCABLE per B1 §B1.7; zero
            references in any RPC body across 0001-0014)
participant_sensitive_profiles: REVOKE SELECT, INSERT, UPDATE, DELETE,
            TRUNCATE FROM project_admin (UNUSED_AND_REVOCABLE, same
            basis as event_days)
activity_log: REVOKE UPDATE FROM project_admin (INSERT retained — every
            business RPC inserts an audit row in the same transaction;
            SELECT retained; append-only guarantee is now
            engine-enforced for this identity, not only code-review
            enforced)
```

`REFERENCES`/`TRIGGER` are **not** revoked from `project_admin` on
`event_days`/`participant_sensitive_profiles`, consistent with B1's
uniform R3 classification of those two DDL-adjacent privileges across
all 24 tables (B1 §B1.7 footnote) — they are unreachable through the
`@insforge/sdk` DML surface and may still be needed by whichever
identity runs a future migration under this same shared role.

## B2.8 Elementos R2/R3 explícitamente excluidos de `0015`

Not touched by this migration, per §10 of the B2 authorization and B1
§B1.9's Group R2/R3 boundary:

```text
- DELETE/TRUNCATE on the other 20 project_admin-write-bearing tables
  (registrations, teams, team_members, capability_credentials,
  waiver_documents, waiver_acceptances, orders, order_items,
  capacity_holds, payments, payment_verification_records,
  webhook_events, idempotency_records, tickets,
  ticket_credential_generations, access_entitlements,
  outbox_delivery_jobs, buyer_contacts, participants)
- outbox_delivery_jobs UPDATE/DELETE (reserved for a future outbox
  worker that does not exist in this repository)
- EXECUTE on ticket_issue_after_payment, ticket_issue_after_team_
  eligible, team_apply_payment_outcome (NOT_OBSERVABLE callers per B1
  §B1.5/§B1.15 — no revocation proposed without further caller proof)
- Any new RPC, any new PostgreSQL role, any new policy
- REFERENCES/TRIGGER on any of the 24 tables for project_admin (R3,
  uniform across all tables per B1 §B1.7)
```

`tests/unit/security/compensating-privilege-hardening.test.ts` (P9)
asserts none of these appear as a `project_admin` REVOKE target in
`0015`.

## B2.9 Tratamiento de ownership: ACL revocado vs. privilegio efectivo

`project_admin` owns all five tables targeted by the Group R1
`project_admin` revocations (`events`, `products`, `event_days`,
`participant_sensitive_profiles`, `activity_log`), confirmed via
`pg_tables.tableowner` immediately before this migration was written
(§B2.2).

Per the PostgreSQL privilege model (`GRANT`/`REVOKE` reference,
`docs/18/sql-revoke.html` and `docs/18/ddl-priv.html`, re-verified for
this unit):

```text
"PostgreSQL allows an object owner to revoke their own ordinary
privileges: for example, a table owner can make the table read-only to
themselves by revoking their own INSERT, UPDATE, DELETE, and TRUNCATE
privileges."

"...owners are always treated as holding all grant options, so they
can always re-grant their own privileges."
```

Two distinct facts follow, and this unit is careful not to conflate
them:

```text
1. ACL revoked (this migration's actual effect, expected to be
   IMMEDIATELY EFFECTIVE): once 0015 is applied, an attempt by
   `project_admin` to INSERT/UPDATE/DELETE/TRUNCATE against the
   restricted table/privilege pairs listed in §B2.7 should fail with
   PostgreSQL error 42501 insufficient_privilege, exactly like any
   other role whose grant was revoked. Ordinary DML privilege checks
   are independent of BYPASSRLS (BYPASSRLS only affects row-level
   security policy evaluation, not table-level GRANT/REVOKE checks),
   so `project_admin`'s BYPASSRLS attribute does not defeat this
   REVOKE.

2. Structural self-reversibility (NOT a bug, NOT this migration's
   failure, but a real and permanent limitation): because
   `project_admin` is the owner of these tables, it retains an
   implicit, un-revocable grant option over them. The SAME identity
   that is restricted by 0015 could issue its own GRANT to undo the
   restriction at any time, with no distinct enforcing role to prevent
   it. This is exactly the platform gap OD-040-002-A/B1 already
   identified (no self-service CREATEROLE, no per-function role/
   credential) — it is not introduced or worsened by 0015, but 0015
   cannot close it either.
```

This unit does **not** claim that the REVOKE creates a tamper-proof
boundary against a compromised or malicious use of the `project_admin`
identity itself. It claims only that it removes an *unused* direct-DML
surface from the identity's *current, ordinary* operating mode — a
defense-in-depth / blast-radius reduction against accidental or buggy
Edge Function code, not a substitute for the still-`BLOCKED_BY_PLATFORM_
CAPABILITY` true least privilege model.

`OD-040-002-B3` (sandbox validation, not part of this unit) must
confirm this empirically, before and after applying `0015`, using:

```sql
SELECT has_table_privilege('project_admin', 'public.<table>', '<priv>');
```

for each of the five restricted (table, privilege) pairs. Expected
result after `0015`: `false` for every revoked pair, `true` for every
retained pair (`SELECT` on `events`/`products`, `INSERT`/`SELECT` on
`activity_log`). If a B3 result ever comes back `true` for a pair this
migration revoked, the correct classification is:

```text
INEFFECTIVE_DUE_TO_OWNERSHIP
PLATFORM BLOCKED
```

and B3 must not report the hardening as effective for that pair.
Nothing in this unit asserts that outcome will occur — documented
PostgreSQL behavior predicts the REVOKE is effective — but this unit
also does not assert isolation it has not empirically tested against a
live database, per §11 of its authorization ("no falsear la
expectativa").

## B2.10 Rollback documentado

A fully commented, non-executable rollback block is appended to the
end of `0015_compensating-privilege-hardening.sql`, after `COMMIT;`.
It contains the exact inverse `GRANT` of every `REVOKE` this migration
performs — 24 `GRANT ... TO anon, authenticated` statements plus 5
`GRANT ... TO project_admin` statements — no new privilege beyond what
existed immediately before `0015`. The rollback block:

```text
- is not executed automatically by this file (every line is a SQL
  comment, verified by test P10b)
- restores anon/authenticated to their pre-0015 state, which OD-040-
  002-B1 already documented as an unsafe default (full DML, contained
  only by RLS) — the rollback intentionally does not "improve" on that
  baseline, it only reverses 0015
- restores project_admin to exactly its pre-0015 privilege set on the
  five affected tables, nothing more
- documents the has_table_privilege(...) checks to run after a
  rollback, so a future operator can confirm restoration without
  guessing
- is meant to be copied into a separate, explicitly authorized
  operation if OD-040-002-B3 fails in the sandbox — this unit does not
  create a separate "down" migration file, since none of the existing
  0001-0014 migrations use that convention either
```

## B2.11 Matriz de pruebas P1–P14 (+ 2 guardas adicionales)

All implemented in
`tests/unit/security/compensating-privilege-hardening.test.ts`,
16 `it(...)` blocks, all static (no database connection):

```text
P1  migration numbering (0015 next, 0014 intact, no duplicate 0015)      PASS
P2  exactly the 24 approved tables for anon/authenticated                PASS
P3  all 7 privileges revoked from anon+authenticated per table           PASS
P4  events: R1-only project_admin revocation, SELECT untouched           PASS
P5  products: R1-only project_admin revocation, SELECT untouched         PASS
P6  event_days: exact 5-privilege project_admin revocation               PASS
P7  participant_sensitive_profiles: exact 5-privilege revocation         PASS
P8  activity_log: UPDATE only, INSERT/SELECT untouched                   PASS
P9  Group R2 tables/resources untouched for project_admin                PASS
P10 no GRANT/CREATE ROLE/ALTER ROLE/policy/RLS/DDL in executable SQL     PASS
P10b every GRANT in the file is a commented (non-executable) line        PASS
P11 every REVOKE has an exact commented GRANT rollback counterpart       PASS
P12 drift protection on the full 24-table + 5-table R1 shape             PASS
P13 "compensating hardening" language, never "true least privilege"      PASS
P14 0012/0013/0014 byte-identical to the B1 baseline (SHA-256 match)     PASS
+   references OD-040-002-B1, documents ownership caveat and             PASS
    has_table_privilege/INEFFECTIVE_DUE_TO_OWNERSHIP terminology
```

No pre-existing test in this repository was modified, weakened, or
deleted to accommodate `0015` or this new test file.

## B2.12 Resultados de validación local

```text
tests/unit/security/compensating-privilege-hardening.test.ts : 16/16 PASS
npm test -- tests/unit/expiry                                 : 148/148 PASS (5 files)
npm test (full suite)                                         : 368/368 PASS (21 files)
                                                                 (352 pre-existing + 16 new)
npm run typecheck (tsc -b)                                     : PASS, 0 errors
npm run lint (oxlint)                                          : PASS, exit 0
                                                                 (only pre-existing warnings in
                                                                 scripts/impl12-sandbox/*.mjs,
                                                                 .cursor/*.mjs, and bundled
                                                                 handler.deploy.js files —
                                                                 none touched by B2)
git diff --check                                               : PASS, no output, exit 0
```

No production or runtime code was modified to make any test pass. No
existing assertion was removed, loosened, or skipped.

## B2.13 Confirmación de cero recursos remotos

```text
Main writes: 0
sandbox writes: 0
production writes: 0
deploys: 0
schedule changes: 0
GRANT/REVOKE/ALTER ROLE/CREATE ROLE/DROP ROLE executed against any live
  database: 0
Mercado Pago: not touched
InsForge CLI/MCP write operations: 0
```

The only remote interaction performed during this unit was a single
read-only query (`SELECT tablename, tableowner FROM pg_tables WHERE
schemaname='public' AND tablename IN (...)`) against Main, executed to
verify the ownership caveat in §B2.9 with current data rather than
relying solely on B1's earlier finding. No row was inserted, updated,
or deleted anywhere; no secret was displayed or logged.

## B2.14 Limitaciones

```text
- This unit did not (and was not authorized to) apply 0015 to any
  database. Every "should"/"expected" statement about REVOKE taking
  effect against project_admin (§B2.9) is grounded in PostgreSQL's
  documented privilege model, re-verified against the current
  PostgreSQL documentation for this unit, but remains empirically
  UNCONFIRMED against this project's actual sandbox/Main until
  OD-040-002-B3 runs the has_table_privilege(...) checks live.
- The static test suite (P1-P14) validates the migration's TEXT
  against the approved contract; it cannot and does not validate that
  PostgreSQL will execute the statements without error, or that no
  other session-level factor (connection pooling behavior, InsForge's
  own database-proxy layer, if any) alters the effective privilege
  check. This is the same NOT_OBSERVABLE platform-layer gap already
  recorded in OD-040-002-A §7.1/§19 and B1 §B1.15.
- REFERENCES/TRIGGER privileges for project_admin on the 24 tables
  were left untouched (R3) per B1's uniform classification; this unit
  did not re-derive that classification from scratch, only confirmed
  it is applied consistently in 0015.
- The InsForge platform capability gap that blocks TRUE least
  privilege (no self-service CREATEROLE, no per-function role/scoped
  credential) is unchanged by this unit. COMPENSATING HARDENING remains
  the ceiling of what B2 can deliver; it is not, and is not represented
  in this document as, TRUE LEAST PRIVILEGE.
```

## B2.15 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B2_LOCAL_REVIEW
```

This unit implemented, locally, exactly the Group R1 revocation set
authorized in §9/§10 of its authorization, with a static test suite
(P1–P14 plus 2 supporting guards, 16/16 PASS) that fails on any drift
from that exact set, without modifying any existing migration, RPC,
Edge Function, or frontend code, and without any remote write. Full
regression (368/368), typecheck, lint, and `git diff --check` all
PASS. This unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`,
`CLOSED`, `TRUE_LEAST_PRIVILEGE_ACHIEVED`, `READY_FOR_SANDBOX`,
`READY_FOR_MAIN`, `READY_FOR_PRODUCTION`, `READY_FOR_IMPL_14A_3D`, or
`READY_FOR_LANDING`. Sandbox validation (`OD-040-002-B3`, per the plan
already drafted in §B1.13) remains the next, separately-authorizable
step.

---

# OD-040-002-B3 — Sandbox privilege validation

## B3.1 Autorización

```text
unit: OD-040-002-B3 — Sandbox privilege validation
governance date: 2026-07-30 — America/Merida
mode: EXECUTE + VALIDATE — SANDBOX ONLY
primary operation: Aplicar y validar físicamente en sandbox la migración
  local 0015_compensating-privilege-hardening.sql
result: VALIDATION_FAILED (functional regression of checkout_start_tx)
```

## B3.2 Preflight Git

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = bced99e5a1f27128b7b497013f283c1967223599
divergencia = 0 0
staged = 0
git diff --check = PASS
```

Working tree at entry (separated):

```text
heredados B1/B2:
  M  WORKSPACE_STATUS.md
  ?? docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
  ?? insforge/migrations/0015_compensating-privilege-hardening.sql
  ?? tests/unit/security/compensating-privilege-hardening.test.ts
fuera de alcance:
  ?? .cursor/*  (incluye residuos de un intento B3 anterior)
```

## B3.3 Hash de `0015` y protección de migraciones

```text
0015_compensating-privilege-hardening.sql
  A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B  (match)
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1  (match)
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A  (match)
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000  (match)
test 0015 = 1D31162BD04D7F7B4B79F9230506993EE55534D960A10E33AC161D31EE524712
  (unchanged before/after B3 — no test edits authorized or performed)
```

Contract static checks (local, unchanged from B2): REVOKE-only executable
body; closed 24-table list; R1 project_admin set; commented rollback;
no ownership/role/policy/R2 changes.

## B3.4 Main antes

Read-only via MCP `run-raw-sql` against canonical Main
(`project_id=91fa34b1-e3b5-44c0-9806-b092c1dd7144`, appkey `4bg9ufz2`):

```text
max migration = 10 (spectator-multi-quantity)
0011–0015 = ausentes (migrations_ge_11 = 0)
expiry/lease functions = 0
domain tables = 24
anon events SELECT = true (pre-hardening Main baseline)
project_admin products UPDATE = true
writes by B3 = 0
```

## B3.5 Sandbox antes

Linked CLI project: `impl-14a-expiry` /
`2921e092-aed6-4abb-93be-946c42eee82a` / appkey `4bg9ufz2-2w7`.

```text
migración máxima observada al inicio de B3 = 15
0015 name = compensating-privilege-hardening
0015 created_at (runner) = 2026-07-30 12:14:33 (local listing)
0011–0014 = presentes
schedule payment-pending-expiry = Active No (inactive)
cron row exists (id present) but Active=No — not null, not firing
24 domain tables = present
roles visibles = anon, authenticated, project_admin
ownership R1 tables = project_admin (events/products/event_days/
  participant_sensitive_profiles/activity_log)
```

Critical pre-state finding:

```text
Migration history claimed 0015 applied, but live privileges matched the
PRE-0015 baseline (anon events SELECT=true; project_admin products
UPDATE=true; public_true≈192 of DML privileges). Consistent with a
prior session that applied 0015, then committed the documented GRANT
rollback while leaving system.custom_migrations version 15 recorded.
```

## B3.6 Baseline de privilegios (pre re-apply)

Spot-check immediately before re-executing REVOKE DCL:

```text
anon.events.SELECT = true
anon.events.INSERT = true
authenticated.orders.SELECT = true
project_admin.events.SELECT = true
project_admin.events.INSERT = true
project_admin.events.UPDATE = true
project_admin.products.INSERT = true
project_admin.event_days.SELECT = true
project_admin.participant_sensitive_profiles.SELECT = true
project_admin.activity_log.UPDATE = true
project_admin.activity_log.INSERT = true
```

Full 24×7×3 matrix was not re-dumped into this document (size); the
spot-check plus `information_schema.role_table_grants` on `events`
confirmed anon/authenticated held SELECT/INSERT/UPDATE/DELETE and
project_admin held full DML including UPDATE/TRUNCATE.

## B3.7 Aplicación de `0015`

Because migration version 15 was already recorded, `db migrations up`
could not re-apply the file. Authorized remediation: re-execute the
exact executable REVOKE statements from
`0015_compensating-privilege-hardening.sql` (hash above) via:

```text
mechanism: npx @insforge/cli db query --unrestricted <flat REVOKE SQL>
project: impl-14a-expiry only
hash applied: A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
local time: 2026-07-30 12:34:07 -06:00
UTC: 2026-07-30T18:34:07Z
result: Query executed successfully (EXIT=0)
migración máxima posterior: 15 (unchanged record)
```

No SQL text was edited. No 0016 created. No Main write.

## B3.8 Matriz de 336 comprobaciones (post-apply)

```text
anon + authenticated × 24 tables × 7 privileges
  public_false = 336
  public_true  = 0
```

Criterion met: direct privileges withdrawn (not merely RLS-blocked).

## B3.9 Pruebas negativas `anon`

Via sandbox REST `/api/database/records/events` with freshly retrieved
anon key (secret not documented):

```text
SELECT → HTTP 401 / code 42501 permission denied for table events
INSERT → HTTP 401 / code 42501 permission denied for table events
UPDATE → HTTP 401 / code 42501 permission denied for table events
DELETE → HTTP 401 / code 42501 permission denied for table events
```

## B3.10 Pruebas negativas `authenticated`

```text
has_table_privilege(authenticated, *, *) = false for all 168 cells
  (included in the 336 above) — PASS / mandatory
client-surface session: NOT OBSERVABLE
  - sandbox auth.users count = 0
  - prior synthetic session invalid (AUTH_UNAUTHORIZED)
  - /api/auth/signup and /api/auth/login routes returned 404
  - no reusable authenticated JWT obtainable without inventing a new
    auth bootstrap path outside this unit's tooling
```

## B3.11 Privilegios efectivos `project_admin` R1 (post-apply)

```text
events:    SELECT=true  INSERT=false UPDATE=false DELETE=false TRUNCATE=false
products:  SELECT=true  INSERT=false UPDATE=false DELETE=false TRUNCATE=false
event_days: SELECT=false INSERT=false UPDATE=false DELETE=false TRUNCATE=false
            REFERENCES=true (R3 retained)
participant_sensitive_profiles: SELECT=false INSERT=false UPDATE=false
            DELETE=false TRUNCATE=false; REFERENCES=true
activity_log: UPDATE=false; INSERT=true; SELECT=true
```

ACL revocations were effective against the owning role (not
`INEFFECTIVE_DUE_TO_OWNERSHIP` for ordinary DML). Ownership unchanged.

## B3.12 R2/R3 intactos (post-apply, pre-rollback)

```text
project_admin.orders.DELETE = true
project_admin.outbox_delivery_jobs.UPDATE = true
project_admin.event_days.REFERENCES = true
project_admin.participant_sensitive_profiles.REFERENCES = true
```

No evidence of accidental DELETE/TRUNCATE revocation on the other 20
tables in the spot-checks performed.

## B3.13 Funciones/RPC intactas

Sample of 12 sensitive RPCs (including checkout, webhook, expiry/lease,
ticket/team):

```text
owner = project_admin
security = DEFINER
search_path = pg_catalog, public, pg_temp
acl = {project_admin=X/project_admin}
```

`0015` did not alter function definitions (DCL-only migration).

## B3.14 Regresión checkout — FAIL

```text
RPC: public.checkout_start_tx(jsonb)
product fixture: SBX14A-PROD-6a05ace0-A
result: ERROR permission denied for table products
```

Root cause (verified against migration source):

```text
0005_checkout_start_transaction.sql
  SELECT * FROM public.products ... FOR UPDATE;
  SELECT * FROM public.events   ... FOR UPDATE;
```

PostgreSQL requires `UPDATE` privilege for `SELECT ... FOR UPDATE`.
Group R1 revoked `UPDATE` on `products` and `events` from
`project_admin`, which is the SECURITY DEFINER owner/runtime role.
Therefore compensating hardening R1 as written in `0015` is
**functionally incompatible** with the existing checkout RPC.

This is a design/inventory defect in the R1 matrix (B1/B2), not an
ownership-ineffectiveness issue: the REVOKE worked; the business RPC
needs the privilege that was revoked.

## B3.15–B3.18 Regresiones webhook / status / expiry / auditoría

```text
webhook: NOT EXECUTED after checkout FAIL (stop on functional failure)
get-order-status: NOT EXECUTED after checkout FAIL
payment-pending-expiry: NOT EXECUTED after checkout FAIL
audit INSERT / direct UPDATE denial: NOT COMPLETED (blocked by FAIL)
```

Note: expiry/lease RPCs use `FOR UPDATE` on write-bearing tables that
were NOT in the R1 revoke set (orders/holds/idempotency/etc.), so they
were not the observed failure mode; checkout was sufficient to fail B3.

## B3.19 Rollback (executed — committed restore, not transactional test)

Because functional validation failed, §26 required controlled rollback
of privileges. The documented GRANT inverse from `0015` was executed
via `db query --unrestricted` (sandbox only):

```text
local: 2026-07-30 12:37:22 -06:00
UTC:   2026-07-30T18:37:22Z
result: EXIT=0
```

Post-rollback spot-check:

```text
anon.events.SELECT = true
project_admin.products.UPDATE = true
project_admin.events.UPDATE = true
project_admin.activity_log.UPDATE = true
project_admin.event_days.SELECT = true
```

Post-rollback checkout progressed past the products privilege error
(next error was an unrelated fixture/schema `subtotal_cents` NOT NULL
on a synthetic call — privilege path restored; no OD-040-002-B3 buyer
rows left: count=0).

Transactional BEGIN→GRANT→ROLLBACK test of §18 was **not** used as the
recovery path because a real functional FAIL required restoring the
durable privilege baseline. Hardening is **not** left active.

## B3.20 Limpieza

```text
buyer_contacts public_ref LIKE 'OD-040-002-B3%' = 0
schedule Active = No
leases: no B3 lease fixtures created
auxiliar functions/triggers = 0 created
```

## B3.21 Sandbox después

```text
migración máxima = 15 (record remains)
0015 = recorded as applied in migration history
hardening compensatorio = NOT ACTIVE (privileges restored)
schedule = inactive (Active=No)
functions = no redeploy
roles = unchanged
ownership = unchanged
RLS/policies = unchanged
INCONSISTENCY: migration 15 recorded while privilege state matches
  pre-0015 baseline — requires human/CTO review before any future
  re-apply or Main consideration
```

## B3.22 Main después

```text
max migration = 10
0011–0015 = ausentes
expiry functions = 0
anon.events.SELECT = true
project_admin.products.UPDATE = true
writes = 0
```

Main identical to pre-B3 baseline.

## B3.23 Pruebas locales

```text
tests/unit/security/compensating-privilege-hardening.test.ts = 16/16 PASS
tests/unit/expiry = 148/148 PASS
npm test = 368/368 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
```

No code/test/migration content changes during B3.

## B3.24 Archivos modificados

```text
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md  (this section)
WORKSPACE_STATUS.md  (B3 status line)
```

Hashes of `0012`–`0015` and the 0015 unit test file unchanged.

## B3.25 Cero staging / commit / push

```text
staged = 0
commit = none
push = none
```

## B3.26 Limitaciones

```text
- authenticated client HTTP surface NOT OBSERVABLE (no auth users /
  signup route available in this sandbox tooling path)
- transactional rollback probe (§18) superseded by mandatory durable
  rollback after functional FAIL
- checkout post-rollback synthetic call hit unrelated subtotal_cents
  NOT NULL (fixture shape), not used as a privilege verdict
- prior incomplete B3 attempt left .cursor/* artifacts and the
  migration-15 / privilege-restored inconsistency that this unit found
  at entry
```

## B3.27 Riesgos abiertos

```text
1. R1 as implemented in 0015 breaks checkout_start_tx (and any other
   SECURITY DEFINER body that does SELECT FOR UPDATE on products/events).
   B1 inventory treated UPDATE on products/events as unused because no
   UPDATE/INSERT/DELETE statements target those tables; it missed the
   FOR UPDATE privilege requirement.
2. Sandbox migration history shows 15 while privileges are restored —
   operational inconsistency until a future authorized unit either
   rewrites R1 safely or reconciles the migration record under explicit
   governance.
3. OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE remains
   BLOCKED_BY_PLATFORM_CAPABILITY.
4. Main / production / IMPL-14A-3D / landing integration remain NOT
   AUTHORIZED.
```

## B3.28 Siguiente gate

```text
VALIDATION_FAILED
```

Required follow-up (not authorized in this unit): redesign R1 so that
`project_admin` retains `UPDATE` (or an equivalent lock privilege) on
`products` and `events` if `SELECT FOR UPDATE` remains in checkout (and
related) RPCs; or change those RPCs to avoid `FOR UPDATE` on catalog
tables in a separately authorized code unit. Do not re-apply `0015` as
written.

---

# OD-040-002-B2-FIX1 — Checkout-compatible compensating privilege hardening

## FIX1.1 Autorización

```text
unit: OD-040-002-B2-FIX1
  Checkout-compatible compensating privilege hardening
governance date: 2026-07-30 — America/Merida
mode: EXECUTE — LOCAL ONLY
primary operation: Crear la corrección local versionada del hardening
  compensatorio después del fallo runtime de OD-040-002-B3.
remote writes: NOT AUTHORIZED (none performed)
```

## FIX1.2 Causa raíz de B3 (confirmada localmente, sin remoto)

```text
insforge/migrations/0005_checkout_start_transaction.sql
  SELECT * INTO v_product FROM public.products ... FOR UPDATE;  (~L67-70)
  SELECT * INTO v_event   FROM public.events   ... FOR UPDATE;  (~L76-79)
```

PostgreSQL requires the table `UPDATE` privilege for `SELECT ... FOR UPDATE`.
`0015` revoked `UPDATE` on `products`/`events` from `project_admin`, so
`checkout_start_tx` (SECURITY DEFINER as `project_admin`) failed with
`permission denied for table products` in B3.

This unit does **not** modify checkout or remove `FOR UPDATE`.

## FIX1.3 Clasificación corregida

```text
project_admin UPDATE on products/events
  = REQUIRED_ONLY_BEHIND_RPC
  ≠ UNUSED_AND_REVOCABLE
```

## FIX1.4 Por qué no se elimina el bloqueo

Row-level locking via `SELECT ... FOR UPDATE` is part of the approved
checkout concurrency/capacity contract. Changing it would be a separate
authorized code unit and is out of scope for FIX1
(`BLOCKED_BY_DESIGN_CONFLICT` if it were required — it is not).

## FIX1.5 Por qué `0015` no se modifica

```text
0015 hash (immutable):
  A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
```

`0015` is already recorded as migration version 15 on the sandbox.
Retrospective edits of applied migration files are forbidden. FIX1 is
a forward, versioned correction (`0016`).

## FIX1.6 Diseño de `0016`

```text
file: insforge/migrations/0016_compensating-privilege-hardening-checkout-compatibility.sql
SHA-256: 8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2
shape: BEGIN; ... COMMIT; + commented rollback to pre-B3 baseline
idempotent DCL: REVOKE/GRANT safe to re-run
compatible with:
  - sandbox currently restored to pre-hardening baseline
  - greenfield that runs 0015 then 0016
```

## FIX1.7 Estado final objetivo

```text
anon / authenticated × 24 tables:
  SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER = revoked

project_admin.events:
  SELECT=yes, UPDATE=yes, INSERT=no, DELETE=no, TRUNCATE=no

project_admin.products:
  SELECT=yes, UPDATE=yes, INSERT=no, DELETE=no, TRUNCATE=no

project_admin.event_days:
  SELECT/INSERT/UPDATE/DELETE/TRUNCATE = revoked

project_admin.participant_sensitive_profiles:
  SELECT/INSERT/UPDATE/DELETE/TRUNCATE = revoked

project_admin.activity_log:
  UPDATE=revoked, INSERT=retained
```

## FIX1.8 `GRANT UPDATE` correctivo

Executable (not merely commented):

```sql
GRANT UPDATE ON TABLE public.events TO project_admin;
GRANT UPDATE ON TABLE public.products TO project_admin;
```

Documented as: privilege functionally required for `SELECT ... FOR UPDATE`
inside `checkout_start_tx`, but structurally excessive for a shared
`project_admin` identity (platform gap — no per-function role).

## FIX1.9 Revocaciones conservadas

```text
anon/authenticated deny-all on 24 tables (reasserted)
events/products INSERT DELETE TRUNCATE (UPDATE NOT revoked)
event_days / participant_sensitive_profiles five-privilege R1
activity_log UPDATE only
```

## FIX1.10 R2/R3 excluidos

```text
no DELETE/TRUNCATE on the other 20 project_admin tables
no outbox_delivery_jobs changes
no EXECUTE changes
no REFERENCES/TRIGGER changes for project_admin
no ownership / roles / RLS / policies / function body changes
```

## FIX1.11 Riesgo residual

```text
Direct UPDATE DML on events/products remains possible for any Edge
Function sharing project_admin. FOR UPDATE compatibility does not
constrain UPDATE to RPC-only use at the engine level.
TRUE LEAST PRIVILEGE remains BLOCKED_BY_PLATFORM_CAPABILITY.
```

## FIX1.12 Rollback

Commented block at end of `0016` restores the full pre-B3 baseline
(same GRANT set as the documented 0015 rollback), not the broken
0015-with-UPDATE-revoked intermediate. Not auto-executed.

## FIX1.13 Pruebas

```text
tests/unit/security/compensating-privilege-hardening.test.ts
  historical 0015 guards (P1–P14) retained; P1 no longer forbids 0016
  FIX1 guards F1–F17 added (0016 contract + checkout FOR UPDATE link)
  result: 33/33 PASS
checkout suite: 43/43 PASS
logical-capacity-exclusion: 24/24 PASS
expiry: 148/148 PASS
full suite: 385/385 PASS
typecheck: PASS
lint: PASS (pre-existing warnings only)
git diff --check: PASS
```

## FIX1.14 Hashes

```text
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0015 = A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B (unchanged)
0016 = 8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2 (new)
```

## FIX1.15 Cero aplicación remota

```text
sandbox writes = 0
Main writes = 0
migration apply = 0
deploy/schedule/Mercado Pago = 0
remote migration-15 record = not touched (still an open sandbox inconsistency
  for a future authorized revalidation unit)
```

## FIX1.16 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B2_FIX1_LOCAL_REVIEW
```

This unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`, `CLOSED`,
`READY_FOR_SANDBOX`, `READY_FOR_MAIN`, `READY_FOR_PRODUCTION`,
`READY_FOR_IMPL_14A_3D`, or `READY_FOR_LANDING`. A separately authorized
sandbox revalidation must apply/validate `0016` (and reconcile the
version-15 history inconsistency) before any Main consideration.

---

# OD-040-002-B3-RETEST — Sandbox validation of checkout-compatible compensating hardening

## RT.1 Autorización

```text
unit: OD-040-002-B3-RETEST
  Sandbox validation of checkout-compatible compensating hardening
governance date: 2026-07-30 — America/Merida
mode: EXECUTE + VALIDATE — SANDBOX ONLY
primary: Aplicar exclusivamente 0016 en impl-14a-expiry y validar
result: VALIDATION_FAILED (migration runner rejected 0016 TCL)
```

## RT.2 Preflight

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = same
divergencia = 0 0
staged = 0
git diff --check = PASS
```

Working tree: inherited B1/B2/B3/FIX1 docs + `0015`/`0016` + security
tests; `.cursor/*` out of scope.

## RT.3 Hashes (before remote ops; unchanged after)

```text
0015 = A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
0016 = 8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2
test = A638A8FBAB9C9BED96C73724291D11897F5DC68BAC38C51A5B9A476482B37950
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

`0016` contract contents verified locally: 24-table anon/authenticated
REVOKE; `GRANT UPDATE` + `REVOKE INSERT,DELETE,TRUNCATE` on
events/products; event_days / participant_sensitive_profiles /
activity_log R1; commented rollback; no R2/R3.

## RT.4 Main antes

```text
max migration = 10
0011–0016 = ausentes
expiry fns = 0
writes = 0
```

## RT.5 Sandbox antes

```text
project = impl-14a-expiry / 2921e092-aed6-4abb-93be-946c42eee82a / 4bg9ufz2-2w7
migration 15 = registrada (compensating-privilege-hardening)
migration 16 = ausente
schedule payment-pending-expiry = Active No (row id present; not firing)
leases (expiry/run_lease scopes) = 0
24 domain tables = present
roles = anon, authenticated, project_admin
```

## RT.6 Inconsistencia histórica 15 / baseline restaurado

```text
migration 15 recorded = YES
0015 privilege effects = REVERTED (B3 durable GRANT rollback)
baseline restored = YES
```

## RT.7 Privilegios baseline (pre-apply)

```text
anon.events.SELECT = true
project_admin.events.UPDATE = true
project_admin.products.UPDATE = true
project_admin.products.INSERT = true
project_admin.activity_log.UPDATE = true
project_admin.event_days.SELECT = true
anon+authenticated privilege cells true = 336 / 336
  (full DML+DDL-adjacent set restored by prior B3 rollback GRANTs)
```

## RT.8 Aplicación de 0016 — FAIL

```text
mechanism: temporary junction migrations -> insforge/migrations
           + npx @insforge/cli db migrations up
             0016_compensating-privilege-hardening-checkout-compatibility.sql
project: impl-14a-expiry
hash: 8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2
local: 2026-07-30 18:11:51 -06:00
UTC:   2026-07-31T00:11:51Z
error (sanitized): Transaction control statements are not allowed.
EXIT: 1
```

Root cause: InsForge migration runner wraps each migration in its own
transaction and rejects `BEGIN` / `COMMIT` / `ROLLBACK` in the SQL file
(documented in `insforge-cli` migrations reference). `0016` includes
`BEGIN;` / `COMMIT;` (inherited style from `0015` / local FIX1 design).
This unit was not authorized to modify `0016` or create `0017`.

Per failure protocol: no improvised `db query` DCL apply; no partial
fragments; no new migration.

Junction removed after the attempt (operational only; not a repo file).

## RT.9 Historial de migraciones (después del fallo)

```text
migration max = 15
0015 = registrada
0016 = NOT registered
```

## RT.10–RT.22 No ejecutados (bloqueados por fallo de apply)

```text
336 privilege checks after 0016 = NOT RUN (0016 not applied)
anon/auth client negatives = NOT RUN
project_admin final-state matrix = NOT RUN
R2/R3 post-apply compare = NOT RUN (no apply)
RPC integrity post-apply = NOT RUN (no apply)
fixtures OD-040-002-B3-RETEST = NOT CREATED
checkout / webhook / status / expiry / audit = NOT RUN
transactional rollback probe = NOT RUN
```

## RT.23 Limpieza

```text
no OD-040-002-B3-RETEST fixtures created
leases = 0
schedule = Active No
junction migrations = removed
sandbox privilege state = unchanged from baseline restored
```

## RT.24 Sandbox después

```text
migration max = 15
0016 = absent
hardening checkout-compatible = NOT ACTIVE
privileges = pre-hardening baseline (restored)
schedule = inactive
roles/ownership/RLS = unchanged
```

## RT.25 Main después

```text
max migration = 10
0011–0016 = ausentes
writes = 0
```

## RT.26 Pruebas locales

```text
security = 33/33 PASS
checkout = 43/43 PASS
logical-capacity = 24/24 PASS
expiry = 148/148 PASS
full suite = 385/385 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
0012–0016 hashes = unchanged
```

## RT.27 Archivos modificados

```text
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md  (this section)
WORKSPACE_STATUS.md  (B3-RETEST status)
```

No changes to `0015`, `0016`, tests, Edge Functions, or other code.

## RT.28 Limitaciones

```text
- Normal migration apply path cannot load 0016 as written (TCL ban).
- This unit deliberately did not bypass via db query, because the
  authorization required the normal migration mechanism to register
  version 16 and forbade improvised corrections / editing 0016.
- Historical migration 15 + reverted privileges inconsistency remains.
```

## RT.29 Riesgos residuales

```text
1. 0016 is locally correct for privilege semantics but not runner-
   compatible until TCL is removed in a separately authorized local FIX.
2. Sandbox still has migration 15 recorded without active 0015 effects.
3. OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE remains
   BLOCKED_BY_PLATFORM_CAPABILITY.
```

## RT.30 Gate

```text
VALIDATION_FAILED
```

Required follow-up (not authorized here): a local FIX unit that makes
the checkout-compatible hardening applyable via
`db migrations up` without `BEGIN`/`COMMIT` in the executable SQL
(forward migration; do not rewrite `0015`), then a new sandbox retest.

---

# OD-040-002-B2-FIX2 — InsForge runner-compatible migration correction

## F2.1 Autorización

```text
unit: OD-040-002-B2-FIX2
  InsForge runner-compatible compensating hardening migration
governance date: 2026-07-30 — America/Merida
mode: EXECUTE — LOCAL CORRECTION ONLY
primary: Corregir localmente la migración 0016 para que sea aceptada
  por el runner de migraciones de InsForge
result: LOCAL CORRECTION COMPLETE / PENDING CTO REVIEW
gate: READY_FOR_CTO_OD_040_002_B2_FIX2_LOCAL_REVIEW
```

## F2.2 Estado previo (preservado)

```text
OD-040-002-A = CTO REVIEW PASS
OD-040-002-B1 = CTO REVIEW PASS
OD-040-002-B2 = LOCAL IMPLEMENTATION COMPLETE
OD-040-002-B3 = VALIDATION_FAILED
OD-040-002-B2-FIX1 = LOCAL IMPLEMENTATION COMPLETE / CTO REVIEW PASS
OD-040-002-B3-RETEST = VALIDATION_FAILED / RUNNER REJECTED EXPLICIT TCL
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
Main / Production / IMPL-14A-3D / Landing = NOT AUTHORIZED
```

B2-FIX1 functional contract (DCL) remains the authority for privilege
semantics. This unit changes only runner wrapper compatibility.

## F2.3 Fallo de B3-RETEST (causa raíz)

```text
error (sanitized): Transaction control statements are not allowed.
mechanism: npx @insforge/cli db migrations up
           0016_compensating-privilege-hardening-checkout-compatibility.sql
```

Root cause: executable `BEGIN;` / `COMMIT;` in pre-FIX2 `0016`. The
InsForge migration runner rejects explicit TCL and wraps each migration
in its own transactional context (`CONFIRMED_BY_DOCUMENTATION` in
insforge-cli migrations reference; also observed in B3-RETEST).

This failure is **not** attributed to GRANT/REVOKE DCL content; the
runner rejected the file before any DCL executed (migration 16 remained
absent; privilege baseline unchanged).

## F2.4 Verificación remota read-only (pre-edit)

```text
sandbox = impl-14a-expiry
command = npx @insforge/cli db migrations list
migration 15 = registrada (compensating-privilege-hardening)
migration 16 = ausente
migration max = 15
```

Because migration 16 was never registered, local correction of `0016`
is permitted. Creating `0017` is **not** required and was **not**
authorized. No remote history rows were altered.

## F2.5 Hashes iniciales (pre-FIX2 edit)

```text
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0015 = A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
0016 pre-FIX2 =
  8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2
security test pre-FIX2 =
  A638A8FBAB9C9BED96C73724291D11897F5DC68BAC38C51A5B9A476482B37950
```

## F2.6 Cambio exacto en 0016

```text
removed from executable body:
  BEGIN;
  COMMIT;

added/updated comments only:
  OD-040-002-B2-FIX2 authority
  runner-compatible checkout-compatible terminology
  TRANSACTION CONTROL note (PLATFORM_MANAGED /
    CONFIRMED_BY_DOCUMENTATION for apply wrap; post-apply sandbox
    atomicity NOT OBSERVABLE until authorized retest)
  documentary note that commented rollback BEGIN/COMMIT are not
  executable
```

No GRANT/REVOKE order, privilege set, role, table set, or R2/R3
exclusion changed.

## F2.7 Contrato DCL preservado

Executable body = 31 statements, identical to pre-FIX2 DCL:

* 24× REVOKE 7 privileges FROM anon, authenticated
* GRANT UPDATE events + REVOKE INSERT/DELETE/TRUNCATE events
* GRANT UPDATE products + REVOKE INSERT/DELETE/TRUNCATE products
* REVOKE 5 privileges event_days / participant_sensitive_profiles
* REVOKE UPDATE activity_log
* R2/R3 excluded

## F2.8 Atomicidad

```text
apply-path wrap = PLATFORM_MANAGED / CONFIRMED_BY_DOCUMENTATION
end-to-end sandbox atomicity after FIX2 = NOT OBSERVABLE
  (0016 not applied in this unit)
```

Risk recorded: without a sandbox retest, runner wrap atomicity for this
file is documented but not re-observed. Executable TCL was **not**
reintroduced.

## F2.9 Rollback

Commented-only rollback block retained (inverse GRANTs +
has_table_privilege verification procedure). Documentary `-- BEGIN;` /
`-- COMMIT;` remain comments only. Restores pre-hardening baseline.

## F2.10 Matriz RCF1–RCF14

| ID | Result |
|----|--------|
| RCF1 0015 immutable | PASS |
| RCF2 remote 16 absent (documented; CLI list) | PASS |
| RCF3 no executable TCL | PASS |
| RCF4 DCL identical to pre-FIX2 | PASS |
| RCF5 24 tables | PASS |
| RCF6 events contract | PASS |
| RCF7 products contract | PASS |
| RCF8 other R1 | PASS |
| RCF9 rollback commented | PASS |
| RCF10 no widening / no R2 | PASS |
| RCF11 runner TCL guard | PASS |
| RCF12 checkout FOR UPDATE + UPDATE grants | PASS |
| RCF13 terminology | PASS |
| RCF14 0012–0015 hashes | PASS |

## F2.11 Regresiones locales

```text
security = 47/47 PASS (16 historical P + 17 FIX1 F + 14 FIX2 RCF)
checkout = 43/43 PASS
logical-capacity = 24/24 PASS
expiry = 148/148 PASS
full suite = 399/399 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
```

## F2.12 Hashes finales

```text
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1 (unchanged)
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A (unchanged)
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000 (unchanged)
0015 = A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B (unchanged)
0016 post-FIX2 =
  F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
security test post-FIX2 =
  6CCB007FA505A10A87E23F254FEAAFEAAE0C052ECC8EF0DBE5BD351EFC64452B
```

## F2.13 Archivos modificados (esta unidad)

```text
insforge/migrations/0016_compensating-privilege-hardening-checkout-compatibility.sql
tests/unit/security/compensating-privilege-hardening.test.ts
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
WORKSPACE_STATUS.md
```

Not modified: `0015`, `0001–0014`, `insforge/functions/*`, `src/*`,
docs/00-05, SPEC-040, `.cursor/*`, `.insforge/project.json`.

## F2.14 Cero escrituras remotas

```text
remote writes = 0
migration apply = not executed
GRANT/REVOKE remoto = not executed
Main writes = 0
deploy / schedule / Mercado Pago / landing = not executed
```

Only remote interaction: read-only `db migrations list`.

## F2.15 Riesgos

```text
1. Sandbox still has migration 15 recorded without active 0015 effects
   (B3 durable GRANT rollback inconsistency).
2. Runner-compatible 0016 is local only until a separately authorized
   B3 retest applies it.
3. UPDATE on events/products remains structurally excessive for shared
   project_admin (platform capability gap).
4. Post-apply atomicity of runner wrap for this file is NOT OBSERVABLE
   until retest.
5. OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE remains
   BLOCKED_BY_PLATFORM_CAPABILITY.
```

## F2.16 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B2_FIX2_LOCAL_REVIEW
```

Next authorized unit (not this one): sandbox retest applying
runner-compatible `0016` via normal `db migrations up`.

This unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`, `CLOSED`,
`READY_FOR_SANDBOX`, `READY_FOR_MAIN`, `READY_FOR_PRODUCTION`,
`READY_FOR_IMPL_14A_3D`, or `READY_FOR_LANDING`.

---

# OD-040-002-B3-RETEST2 — Physical sandbox validation of runner-compatible, checkout-compatible compensating hardening

## RT2.1 Autorización

```text
unit: OD-040-002-B3-RETEST2
  Physical sandbox validation of the runner-compatible,
  checkout-compatible compensating privilege hardening
governance date: 2026-07-30 — America/Merida
mode: EXECUTE + VALIDATE — SANDBOX ONLY
primary: Apply exclusively runner-compatible 0016 on impl-14a-expiry
  and physically validate privilege contract + functional regressions
result: SANDBOX CRITERIA MET / PENDING CTO REVIEW
gate: READY_FOR_CTO_OD_040_002_B3_RETEST2_SANDBOX_REVIEW
```

## RT2.2 Preflight Git

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = same
divergencia = 0 0
staged = 0
git diff --check = PASS
```

Working tree: inherited A/B1/B2/B3/FIX1/RETEST/FIX2 locals; this unit
only adds documentary updates. `.cursor/*` out of scope.

## RT2.3 Autoridad

Confirmed: `0015` immutable historical artifact; `0016` is the
runner-compatible checkout-compatible compensating hardening file;
`checkout_start_tx` still uses `SELECT … FOR UPDATE` on products/events.

## RT2.4 Hashes (before remote write; unchanged after)

```text
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0015 = A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
0016 post-FIX2 =
  F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
security test =
  6CCB007FA505A10A87E23F254FEAAFEAAE0C052ECC8EF0DBE5BD351EFC64452B
static 0016: TCL executable = 0; DCL statements = 31; 24 tables;
  R2/R3 absent from executable body; rollback commented-only
```

Edge function local file hashes (reference only; no redeploy):

```text
payment-pending-expiry/index.ts =
  2A74C02FF03878CB0FD1BBB41F1150CC9BCB5DEC8E644CCC41B626EAD9A0C4C0
mp-create-checkout/handler.deploy.js =
  2F205EA4D7BE1478D2FDB93669A10D6B5CC3D47F7313BBCE88D2E7FF3C3D254E
mp-webhook/handler.deploy.js =
  3E879C247602E1CB0CBB161606A546DAE4172AD4AC9FF01B2E102696D38DA625
get-order-status/handler.deploy.js =
  024D4A7177DEE04F8F04A65AD6E302FFB190F28B31974331F12B0FC04E2D914C
```

## RT2.5 Main antes

```text
linked CLI project remained impl-14a-expiry (no Main link)
Main MCP run-raw-sql / metadata = Invalid API key this session
Main live migration max via MCP = NOT OBSERVABLE
prior B3-RETEST evidence (unchanged claim): Main max migration = 10;
  0011–0016 absent on Main; Main writes in this unit = 0
INSFORGE_PROJECT_ID override did not switch credentials away from the
  linked sandbox; no Main SQL was intentionally executed
```

## RT2.6 Sandbox antes

```text
project = impl-14a-expiry / 2921e092-aed6-4abb-93be-946c42eee82a / 4bg9ufz2-2w7
migration max = 15
migration 15 = registered (compensating-privilege-hardening)
migration 16 = absent
schedule payment-pending-expiry = Active No
cronJobId present; not firing
active leases = 0
domain tables = 24
roles = anon, authenticated, project_admin
```

## RT2.7 Inconsistencia histórica migration 15

```text
migration 15 recorded = YES
0015 privilege effects before RETEST2 = REVERTED (B3 durable GRANT rollback)
baseline restored = YES (public_true_336 = 336)
```

## RT2.8 Fixture de catálogo reutilizado

```text
event = SBX14A-EVT-6a05ace0 (status EN_VENTA)
product = SBX14A-PROD-6a05ace0-A (price_cents=10000, cupo=5, journey=J5)
synthetic catalog prefix SBX14A — no real PII
not created/modified by this unit (except accidental probe cleanup below)
```

## RT2.9 Baseline de privilegios (pre-apply)

```text
public_true_336 (anon+authenticated × 24 × 7) = 336
project_admin.events.UPDATE = true
project_admin.products.UPDATE = true
project_admin.events.INSERT = true
project_admin.products.INSERT = true
project_admin.activity_log.UPDATE = true
anon.events.SELECT = true
R2 sample: project_admin.orders.DELETE/TRUNCATE = true
  outbox SELECT/DELETE = true; checkout_start_tx EXECUTE = true
  events REFERENCES/TRIGGER = true
```

## RT2.10–RT2.11 Aplicación de 0016

```text
mechanism: temporary junction migrations -> insforge/migrations
           + npx @insforge/cli db migrations up
             0016_compensating-privilege-hardening-checkout-compatibility.sql
project: impl-14a-expiry
hash: F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
local America/Merida: 2026-07-30 ~19:49
UTC: 2026-07-31T01:49:00Z
exit: 0
sanitized output: Applied 1 migration file(s).
  - 16_compensating-privilege-hardening-checkout-compatibility.sql
junction: removed after apply
```

## RT2.12 Historial después

```text
migration max = 16
migration 15 = registered
migration 16 = registered
  (compensating-privilege-hardening-checkout-compatibility)
```

## RT2.13 336 comprobaciones

```text
public_true_336 after 0016 = 0
false = 336 / true = 0 for anon+authenticated × 24 × 7
```

## RT2.14 Negativos anon (REST)

```text
anon publishable key in linked project.json / .env.local = ABSENT
REST anon surface = NOT OBSERVABLE
has_table_privilege for anon = 168 false (mandatory; PASS)
```

## RT2.15 Negativos authenticated

```text
synthetic session acquisition = FAILED (signup/login paths unusable)
authenticated client surface = NOT OBSERVABLE
has_table_privilege for authenticated = 168 false (mandatory; PASS)
```

## RT2.16 project_admin events/products

```text
events:  SELECT=true UPDATE=true INSERT=false DELETE=false TRUNCATE=false
products: SELECT=true UPDATE=true INSERT=false DELETE=false TRUNCATE=false
classification:
  FUNCTIONALLY REQUIRED BY SELECT FOR UPDATE
  STRUCTURALLY OVERBROAD DUE TO SHARED project_admin
```

## RT2.17 Demás R1 + negativos directos

```text
event_days SELECT/INSERT/UPDATE/DELETE/TRUNCATE = false
participant_sensitive_profiles same five = false
activity_log INSERT=true UPDATE=false

Direct DML as project_admin (db query without --unrestricted):
  INSERT events → permission denied
  DELETE events WHERE false → permission denied
  INSERT products → permission denied
  SELECT event_days → permission denied
  SELECT participant_sensitive_profiles → permission denied
  UPDATE activity_log WHERE false → permission denied
TRUNCATE not executed destructively; privilege cells = false
```

Note: `db query --unrestricted` runs as `postgres` and bypasses role
DCL; negatives used the normal `project_admin` query path.

## RT2.18 R2/R3 intactos

```text
post-apply equals pre-apply sample:
  project_admin.orders.DELETE/TRUNCATE = true
  outbox_delivery_jobs SELECT/DELETE = true
  checkout_start_tx EXECUTE = true
  events REFERENCES/TRIGGER = true
```

## RT2.19 Funciones/RPC intactas

```text
checkout_start_tx md5 = b4e655207f307515f2e6bf5a742f5420 (unchanged)
expire_payment_pending_batch_tx md5 = 5f4814906ae8e758246644f7b611df8e
acquire_..._lease_tx md5 = 28022f5a0cfdadc4cb158d40d807e261
release_..._lease_tx md5 = 5e6954ae907e588234508b143b118623
webhook_apply_payment_tx owner=project_admin security_definer=true
0016 is DCL-only; no function body/ACL/owner changes observed
```

## RT2.20 Checkout

```text
RPC public.checkout_start_tx(jsonb) = PASS
product = SBX14A-PROD-6a05ace0-A
ok=true; order created; tracking_ref issued
no permission denied on products/events FOR UPDATE
buyer_public_ref = OD-040-002-B3-RETEST2-buyer
```

## RT2.21 Webhook

```text
RPC public.webhook_apply_payment_tx = PASS (outcome PAID)
replay same notification = PASS (replay=true, DUPLICATE)
activity_log named_action includes WEBHOOK_PAYMENT_APPLIED
no real Mercado Pago webhook / no production credentials
```

## RT2.22 Order status

```text
Edge get-order-status = HTTP 503 CONFIGURATION_ERROR
  ("Order status is not configured.")
root cause: Origin gate MISSING_CONFIG
  (ORDER_STATUS_CORS_ORIGIN / CHECKOUT_CORS_ORIGIN absent)
  — pre-existing sandbox config; redeploy/config change NOT authorized
DB observation of RETEST2 order after webhook: state=PAID PASS
no unexpected public table grants created
classification: Edge contract CONFIG_GAP (not privilege regression)
```

## RT2.23 Expiry

```text
expire_payment_pending_batch_tx(limit=1) = PASS
  processed=0 (no PAYMENT_PENDING candidates in that call)
lease acquire (run_id + actor_ref + ttl_seconds=90) = PASS acquired
lease release = PASS released
active leases final = 0
schedule = Active No
```

## RT2.24 Auditoría

```text
CHECKOUT_START + WEBHOOK_PAYMENT_APPLIED inserts via RPC = PASS
direct UPDATE activity_log as project_admin = DENIED
audit rows cleaned where safe (correlation_id prefix) = 0 remaining
```

## RT2.25 Rollback transaccional

```text
BEGIN → inverse GRANTs → ROLLBACK via db query --unrestricted
result: Transaction control statements are not allowed
classification: NOT OBSERVABLE
hardening remained active afterward (public_true_336 = 0; INSERT false)
```

## RT2.26 Limpieza

```text
buyers / orders / payments / webhooks / tickets / order_items for
  OD-040-002-B3-RETEST2 prefix = 0
audit correlation_id prefix = 0
active leases = 0
schedule = inactive
junction migrations = removed
residual quarantined (cannot safely DELETE under hardening / FK paths):
  1× participant public_ref OD-040-002-B3-RETEST2-part-QUARANTINE
  1× event code OD-040-002-B3-RETEST2-NOPE status=CERRADO
    (accidental unrestricted INSERT during negative-probe mistake;
     updated to CERRADO/QUARANTINE; DELETE blocked by event_days path)
catalog fixture SBX14A-EVT / SBX14A-PROD-*-A = untouched
```

## RT2.27 Sandbox final

```text
migration max = 16
migration 15 = registered
migration 16 = registered
hardening runner-compatible = ACTIVE
hardening checkout-compatible = ACTIVE
anon/authenticated direct grants = withdrawn (336 false)
project_admin events/products UPDATE = allowed
project_admin events/products INSERT/DELETE/TRUNCATE = withdrawn
other R1 = withdrawn
R2/R3 = intact
checkout/webhook/expiry/audit paths = PASS (see above)
schedule = inactive
leases = 0
roles/ownership/RLS/policies = unchanged
functions = no redeploy
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
```

## RT2.28 Main final

```text
Main MCP = Invalid API key / NOT OBSERVABLE this session
no Main link performed
Main writes = 0
```

## RT2.29 Pruebas locales

```text
security = 47/47 PASS
checkout = 43/43 PASS
logical-capacity = 24/24 PASS
expiry = 148/148 PASS
full suite = 399/399 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
0015/0016 hashes unchanged
```

## RT2.30 Archivos modificados

```text
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
WORKSPACE_STATUS.md
```

No changes to migrations, tests, functions, or src.

## RT2.31 Limitaciones

```text
- Main live reconfirm NOT OBSERVABLE (MCP API key invalid this session)
- anon/authenticated REST negatives NOT OBSERVABLE (no anon key / session)
- get-order-status Edge CONFIGURATION_ERROR (missing CORS origin config)
- transactional rollback probe NOT OBSERVABLE (CLI rejects TCL)
- residual quarantined participant + closed orphan event row
- history inconsistency: migration 15 recorded; 0015 effects superseded
  by 0016 final ACL (intended convergence)
```

## RT2.32 Riesgos residuales

```text
1. Shared project_admin UPDATE on events/products remains structurally
   overbroad (platform capability gap).
2. TRUE LEAST PRIVILEGE still BLOCKED_BY_PLATFORM_CAPABILITY.
3. Main still must not receive this hardening without a separate unit.
4. Orphan quarantined synthetic rows remain in sandbox.
```

## RT2.33 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B3_RETEST2_SANDBOX_REVIEW
```

This unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`, `CLOSED`,
`TRUE LEAST PRIVILEGE ACHIEVED`, `READY_FOR_MAIN`,
`READY_FOR_PRODUCTION`, `READY_FOR_IMPL_14A_3D`, or `READY_FOR_LANDING`.

---

# OD-040-002-B3-RETEST2-FIX1 — Sandbox functional closeout

## FX1.1 Autorización

```text
unit: OD-040-002-B3-RETEST2-FIX1
  Sandbox functional closeout after successful privilege validation
governance date: 2026-07-30 — America/Merida
mode: EXECUTE + VALIDATE — SANDBOX CLOSEOUT ONLY
primary: Resolve get-order-status CONFIGURATION_ERROR, revalidate that
  flow, and close synthetic residues without modifying 0016 hardening
result: SANDBOX FUNCTIONAL CRITERIA MET / PENDING CTO REVIEW
gate: READY_FOR_CTO_OD_040_002_B3_RETEST2_FIX1_CLOSEOUT_REVIEW
```

Privilege criteria from RETEST2 remain accepted as already satisfied
(0016 apply, 336 deny, R1, checkout, webhook, expiry, audit, local 399).

## FX1.2 Preflight Git

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = same
divergencia = 0 0
staged = 0
git diff --check = PASS
```

## FX1.3 Estado inicial de 0016 / hardening abreviado

```text
project = impl-14a-expiry / 2921e092-aed6-4abb-93be-946c42eee82a / 4bg9ufz2-2w7
migration max = 16
0015 registered = YES
0016 registered = YES
schedule = Active No
active leases = 0
anon/authenticated SELECT on 24 tables true-count = 0
events: SELECT=true UPDATE=true INSERT/DELETE/TRUNCATE=false
products: SELECT=true UPDATE=true INSERT/DELETE/TRUNCATE=false
event_days SELECT = false
participant_sensitive_profiles SELECT = false
activity_log UPDATE=false INSERT=true
```

## FX1.4 Causa del 503

```text
get-order-status Origin gate → MISSING_CONFIG
when ORDER_STATUS_CORS_ORIGIN and CHECKOUT_CORS_ORIGIN are unset
→ HTTP 503 CONFIGURATION_ERROR ("Order status is not configured.")
Not caused by GRANT/REVOKE / 0016.
```

## FX1.5 Contrato CORS

```text
primary env: ORDER_STATUS_CORS_ORIGIN
fallback env: CHECKOUT_CORS_ORIGIN
reader: readConfiguredOrigin (exact trim equality; single origin)
wildcard: forbidden
evaluated: per request via Deno.env.get (not baked into deploy bundle)
redeploy: not required for secret add (confirmed by live retest)
```

## FX1.6 Fuente del origen autorizado

```text
origin = https://3e9sriq7.insforge.site
source = docs/implementation/evidence/IMPL-13E-Y-R2A-HTTPS-RETURN-PREPARATION.md
         and IMPL-13E-Y-R2B-HTTPS-AUTO-RETURN-PAYMENT.md
         (documented landing preview ORDER_STATUS_CORS_ORIGIN /
          CHECKOUT_CORS_ORIGIN for sandbox HTTPS return flows)
environment = sandbox only
production = unchanged
not used: localhost, *, productive brand domain, invented hosts
```

## FX1.7 Cambio de configuración sandbox

```text
mechanism: npx @insforge/cli secrets add ORDER_STATUS_CORS_ORIGIN <origin>
project: impl-14a-expiry (linked CLI; appkey 4bg9ufz2-2w7)
local America/Merida: 2026-07-30 ~22:34
UTC: 2026-07-31T04:34:10Z
result: created successfully
other secrets: not modified
API keys: not rotated
redeploy: not performed
```

Existence after add confirmed via `secrets list` (value not printed).

## FX1.8 Revalidación get-order-status

```text
GET /functions/get-order-status?reference=<trk_[0-9a-f]{32}>
Origin: https://3e9sriq7.insforge.site
order: trk_dd0cb0bf21b74201a224ce30fe073796
DB state: PREFERENCE_PENDING
HTTP: 200
body: {"status":"AWAITING_PAYMENT","terminal":false,"next_poll_after_seconds":3}
mapping: PREFERENCE_PENDING → AWAITING_PAYMENT (public projection) PASS
not 503 CONFIGURATION_ERROR = PASS
no unexpected table grants observed
```

Note: query param name is `reference` (not `tracking_ref`), per
`orchestrateOrderStatus`.

Gateway may still emit `Access-Control-Allow-Origin: *` (pre-existing
sandbox gateway residual documented historically). Application Origin
gate accepted the configured origin (request reached business logic).

## FX1.9 Prueba negativa CORS

```text
Origin: https://evil.example.invalid
HTTP: 403
error.code: ORIGIN_NOT_ALLOWED
message: Request origin is not allowed.
absent Origin: also 403 ORIGIN_NOT_ALLOWED
no sensitive payload
```

## FX1.10 Estado de la orden

```text
internal state unchanged by status read: PREFERENCE_PENDING
public status: AWAITING_PAYMENT
terminal: false
```

## FX1.11–FX1.12 Residuos

Before:

```text
participant id bf738784-0dba-47a1-a3e8-f3de798efdc4
  public_ref OD-040-002-B3-RETEST2-part-QUARANTINE
  state ACTIVE; created 2026-07-31T01:53:14Z; no regs/psp/team_members
  PII: none (synthetic public_ref only)

event id 008a349b-1e0d-4255-9901-416cfc0dc86f
  code OD-040-002-B3-RETEST2-NOPE
  status CERRADO; name QUARANTINE-RETEST2-ORPHAN
  products=0 event_days=0 registrations=0
  PII: none
```

Cleanup:

```text
normal DELETE blocked by FK/privilege path into R1-revoked tables
  (participant_sensitive_profiles / event_days)
authorized cleanup used session_replication_role=replica inside
  unrestricted SQL for these fully synthetic RETEST2 rows only
  (no GRANT/REVOKE changes; hardening privileges unchanged afterward)
participant residual = 0
event residual = 0
```

## FX1.13 Comprobación mínima hardening post-closeout

```text
migration max = 16
anon.events.SELECT = false
project_admin.events.UPDATE = true
project_admin.events.INSERT = false
active leases = 0
schedule = Active No
```

RETEST2 functional PASS records remain authoritative for checkout,
webhook, expiry, lease, and audit paths (not re-run in full).

## FX1.14 Trazabilidad Main

```text
CLI linked project throughout = impl-14a-expiry / 4bg9ufz2-2w7
secrets add / db query / schedules list → linked sandbox only
no repository link to Main
no Main project_id in write commands
Main MCP remained Invalid API key / unused for writes
Main direct state = NOT OBSERVABLE
Main interaction during RETEST2/FIX1 = NO EVIDENCE OF INTERACTION
```

## FX1.15 Rollback transaccional

```text
classification: NOT OBSERVABLE (CLI rejects TCL)
documentary rollback of 0016 = still in migration comments
hardening active = confirmed after closeout
```

## FX1.16 Pruebas locales

```text
security = 47/47 PASS
origin-guard / CORS tests = 13/13 PASS
full suite = 399/399 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
```

## FX1.17 Archivos modificados

```text
docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
WORKSPACE_STATUS.md
```

Remote config only: `ORDER_STATUS_CORS_ORIGIN` on impl-14a-expiry.
No migration/function/test/src changes.

## FX1.18 Limitaciones

```text
- Main live state still NOT OBSERVABLE
- Gateway ACAO * residual may still overlay responses
- transactional rollback of 0016 still NOT OBSERVABLE
- cleanup of residuals required session_replication_role because R1
  revokes block ordinary FK-check DELETE paths
```

## FX1.19 Riesgos residuales

```text
1. TRUE LEAST PRIVILEGE remains BLOCKED_BY_PLATFORM_CAPABILITY
2. Shared project_admin UPDATE on events/products remains overbroad
3. Main/production must not receive this without separate authorization
4. ORDER_STATUS_CORS_ORIGIN is sandbox-only; production unset
```

## FX1.20 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_B3_RETEST2_FIX1_CLOSEOUT_REVIEW
```

This unit does not claim `APPROVED`, `RESOLVED`, `VALIDATED`, `CLOSED`,
`TRUE LEAST PRIVILEGE ACHIEVED`, `READY_FOR_MAIN`,
`READY_FOR_PRODUCTION`, `READY_FOR_IMPL_14A_3D`, or `READY_FOR_LANDING`.

---

# OD-040-002-B4 — Human validation and compensating hardening closure

## B4.1 Autoridad humana

```text
unit: OD-040-002-B4
  Human validation and compensating hardening closure
governance date: 2026-07-30 — America/Merida
mode: EXECUTE — DOCUMENTATION ONLY
primary: Registrar la validación humana y cerrar la pista de hardening
  compensatorio de OD-040-002 en alcance local + sandbox
remote writes = 0
staging = 0
commit = 0
push = 0
```

Human authority recognizes evidence from A, B1, B2, B3, B2-FIX1,
B3-RETEST, B2-FIX2, B3-RETEST2, and B3-RETEST2-FIX1.

## B4.2 Alcance cerrado

```text
COMPENSATING HARDENING =
HUMAN VALIDATED / CLOSED
LOCAL + SANDBOX SCOPE
```

Validated scope:

```text
local implementation
+ automated tests
+ physical sandbox apply of runner-compatible 0016
+ effective privilege validation (336 deny matrix + R1)
+ sandbox functional regressions
+ sandbox ORDER_STATUS_CORS_ORIGIN configuration
+ synthetic fixture cleanup
```

## B4.3 Alcance excluido (permanece abierto / bloqueado)

```text
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
InsForge Main apply = NOT AUTHORIZED
producción = NOT AUTHORIZED
IMPL-14A-3D = NOT AUTHORIZED
landing productiva = NOT AUTHORIZED
landing sandbox integration = ELIGIBLE FOR A SEPARATE AUTHORIZED UNIT
  (not authorized by this unit)
```

## B4.4 Artefactos locales

```text
insforge/migrations/0015_compensating-privilege-hardening.sql
  SHA-256 A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
  = immutable historical artifact

insforge/migrations/0016_compensating-privilege-hardening-checkout-compatibility.sql
  SHA-256 F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
  = checkout-compatible + runner-compatible compensating hardening

tests/unit/security/compensating-privilege-hardening.test.ts
  SHA-256 6CCB007FA505A10A87E23F254FEAAFEAAE0C052ECC8EF0DBE5BD351EFC64452B
```

Protected prior migrations unchanged at B4 write time:

```text
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
```

## B4.5 Migraciones sandbox

```text
sandbox = impl-14a-expiry
migration 15 = registered (compensating-privilege-hardening)
migration 16 = registered
  (compensating-privilege-hardening-checkout-compatibility)
migration max = 16
0016 runner apply = PASS (RETEST2)
```

## B4.6 Matriz de privilegios

```text
anon + authenticated:
  24 tables × 7 privileges × 2 roles
  336 false / 0 true

project_admin.events:
  SELECT=true UPDATE=true INSERT=false DELETE=false TRUNCATE=false
project_admin.products:
  SELECT=true UPDATE=true INSERT=false DELETE=false TRUNCATE=false
project_admin.event_days R1 privileges = false
project_admin.participant_sensitive_profiles R1 privileges = false
project_admin.activity_log INSERT=true UPDATE=false
```

## B4.7–B4.11 Regresiones funcionales (aceptadas)

```text
checkout_start_tx = PASS
SELECT ... FOR UPDATE on products/events = PASS
webhook_apply_payment_tx = PASS
webhook idempotent replay = PASS
get-order-status = HTTP 200 / PASS (after FIX1 CORS)
bad or missing Origin = HTTP 403 ORIGIN_NOT_ALLOWED
expiry batch = PASS
lease acquire/release = PASS
active leases final = 0
audit INSERT via RPC = PASS
activity_log direct UPDATE = DENIED
```

## B4.12 Configuración CORS

```text
sandbox project = impl-14a-expiry
variable = ORDER_STATUS_CORS_ORIGIN
origin = https://3e9sriq7.insforge.site
source authority = IMPL-13E-Y-R2A / IMPL-13E-Y-R2B
redeploy = none
other secrets modified = none
```

## B4.13 Limpieza

```text
participant residual = 0
orphan event residual = 0
schedule = inactive
pending synthetic fixtures for RETEST2/FIX1 = 0
```

## B4.14 Pruebas locales

```text
security = 47/47 PASS
origin guard = 13/13 PASS
checkout = 43/43 PASS
logical capacity = 24/24 PASS
expiry = 148/148 PASS
full suite = 399/399 PASS
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
```

## B4.15 Fallos históricos preservados

The following failures remain intact in this evidence file and are not
rewritten; they caused the versioned corrections:

```text
OD-040-002-B3 = VALIDATION_FAILED
  cause: 0015 revoked UPDATE required by SELECT ... FOR UPDATE
  → led to B2-FIX1 / migration 0016 restoring UPDATE on events/products

OD-040-002-B3-RETEST = VALIDATION_FAILED / RUNNER TCL INCOMPATIBILITY
  cause: InsForge runner rejected explicit BEGIN/COMMIT
  → led to B2-FIX2 removing executable TCL from 0016

0015 = immutable historical artifact
0016 = checkout-compatible and runner-compatible correction
```

B2-FIX1, B2-FIX2, B3-RETEST2, and B3-RETEST2-FIX1 sections above remain
authoritative for their respective technical results.

## B4.16 Limitaciones (non-blocking for this closure)

```text
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
cause: Edge Functions share API_KEY → project_admin → BYPASSRLS;
  no distinct per-function PostgreSQL identity via self-service

project_admin UPDATE on events/products =
  FUNCTIONALLY REQUIRED BY SELECT FOR UPDATE
  but STRUCTURALLY OVERBROAD due to shared identity

rollback físico transaccional = NOT OBSERVABLE
authenticated REST negative execution =
  NOT OBSERVABLE / partially observable
  (has_table_privilege confirmed 168 false for authenticated)
Main direct state = NOT OBSERVABLE
Main interaction = NO EVIDENCE OF INTERACTION
```

These limitations are **not** reinterpreted as true least privilege
criteria satisfied.

## B4.17 Riesgos residuales

```text
1. OD-040-002 remains OPEN until true least privilege or an explicit
   superseding governance decision.
2. Shared project_admin remains structurally overbroad for UPDATE on
   catalog tables and for cross-function EXECUTE.
3. Main / production / IMPL-14A-3D remain blocked by true-LP gap.
4. Landing sandbox integration requires a separate authorized unit.
```

## B4.18 Exclusiones

```text
no Main apply
no production
no IMPL-14A-3D
no landing productiva authorization
no new implementation
no remote operations in B4
```

## B4.19 Estado de OD-040-002

```text
OD-040-002 = OPEN
OD-040-002 COMPENSATING HARDENING =
  VALIDATED / CLOSED LOCAL + SANDBOX SCOPE
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
```

## B4.20 Siguiente gate

```text
READY_FOR_CTO_OD_040_002_COMPENSATING_CLOSURE_REVIEW
```

This unit does not claim `OD-040-002 RESOLVED`,
`TRUE LEAST PRIVILEGE ACHIEVED`, `READY_FOR_MAIN`,
`READY_FOR_PRODUCTION`, `READY_FOR_IMPL_14A_3D`,
`READY_FOR_LANDING_PRODUCTION`, `READY_FOR_COMMIT`, or `READY_FOR_PUSH`.

---

# OD-040-002-B5 — Migration chain reproducibility and history reconciliation

## B5.1 Autoridad humana

```text
unit: OD-040-002-B5
  Migration chain reproducibility and history reconciliation
governance date: 2026-07-30 — America/Merida
mode: ANALYZE + READ-ONLY + DOCUMENTATION
primary: Determinar cómo hacer reproducible y gobernable la cadena
  0011–0016 antes del commit y de cualquier aplicación futura en Main
remote writes = 0
staging = 0
commit = 0
push = 0
```

Governance retained:

```text
OD-040-002 COMPENSATING HARDENING =
  VALIDATED / CLOSED LOCAL + SANDBOX SCOPE
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
Main / production / IMPL-14A-3D / landing productiva = NOT AUTHORIZED
OD-040-002-B5 = ANALYZING MIGRATION CHAIN / NOT RESOLVED
```

## B5.2 Preflight Git

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = bced99e5a1f27128b7b497013f283c1967223599
divergencia = 0 0
staged = 0
git diff --check = PASS
```

Working tree (separated):

```text
heredados OD-040-002: WORKSPACE_STATUS.md (M); evidence OD-040-002 (??);
  0015/0016 (??); tests/unit/security/ (??)
documentales B5: only evidence + WORKSPACE_STATUS.md
.cursor/* = out of scope (ops harness residues)
```

## B5.3 Hashes (local, B5 analyze time)

```text
0011_logical-capacity-expiry-exclusion.sql
  7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22
0012_payment-pending-expiry-transaction.sql
  E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013_payment-pending-expiry-array-fix.sql
  BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014_payment-pending-expiry-run-lease.sql
  92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0015_compensating-privilege-hardening.sql
  A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
  = historical immutable hash declared through B4; still contains
    executable BEGIN;/COMMIT; in local file
0016_compensating-privilege-hardening-checkout-compatibility.sql
  F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
  = post-FIX2; no executable TCL
tests/unit/security/compensating-privilege-hardening.test.ts
  6CCB007FA505A10A87E23F254FEAAFEAAE0C052ECC8EF0DBE5BD351EFC64452B
```

No migration file contents were modified by B5.

## B5.4 Inventario 0011–0016 (compatibilidad runner)

Executable TCL = top-level `BEGIN;` / `COMMIT;` / `ROLLBACK;` /
`SAVEPOINT` / `RELEASE SAVEPOINT` outside comments. PL/pgSQL `BEGIN`
inside `$$` function bodies is not TCL.

| Migración | Hash (prefix) | Reg. sandbox | Reg. Main | TCL ejecutable | DDL/DCL | Compatibilidad runner |
| --------- | ------------- | -----------: | --------: | -------------: | ------- | --------------------- |
| 0011 | 7C145C0C…F98A22 | yes (v11) | no (max 10) | no | DDL (REPLACE checkout_start_tx) | RUNNER_COMPATIBLE |
| 0012 | E27EDAD7…F5BBE1 | yes (v12) | no | no | DDL (expiry TX + indexes) | RUNNER_COMPATIBLE |
| 0013 | BCCB2AAC…63F44A | yes (v13) | no | no | DDL (array-form expiry) | RUNNER_COMPATIBLE |
| 0014 | 92068A65…69DE000 | yes (v14) | no | no | DDL (run lease) | RUNNER_COMPATIBLE |
| 0015 | A0E43B4F…A0C80B | yes (v15) | no | **yes** (`BEGIN;` L112, `COMMIT;` L183) | DCL (REVOKE) | **RUNNER_INCOMPATIBLE** |
| 0016 | F81C8021…1A346A | yes (v16) | no | no (commented only) | DCL (REVOKE/GRANT) | RUNNER_COMPATIBLE |

Confirmations:

```text
0015 contains executable TCL = YES (BEGIN; + COMMIT;)
0016 post-FIX2 contains executable TCL = NO
0011–0014 BEGIN tokens = PL/pgSQL only (not executable TCL)
```

Sandbox registration source: read-only
`npx @insforge/cli db migrations list --json` on linked
`impl-14a-expiry` (max version = 16). Main registration: prior B3
evidence (max = 10; 0011–0016 absent); live Main re-list in B5 =
NOT OBSERVABLE without Main link (not performed).

## B5.5 TCL ejecutable — detalle

```text
0015 local file:
  BEGIN;   (executable, line 112)
  … 29 REVOKE statements …
  COMMIT;  (executable, line 183)

0016 local file:
  -- BEGIN; / -- COMMIT; documentary comments only
  note in header: does NOT include executable BEGIN/COMMIT/ROLLBACK
```

Sandbox remote record for version 15 stores **29 statements**, all
`REVOKE …` DCL, **without** `BEGIN;`/`COMMIT;`. Trailing semicolons
are omitted in the stored statement strings; DCL targets/privileges/
roles match the local executable REVOKE lines (semantic DCL alignment).
Remote record keys observed: `version`, `name`, `statements`,
`createdAt` — **no content hash field**.

## B5.6 Comportamiento comprobado del runner

Sources: InsForge CLI skill `references/database/migrations.md`,
`npx @insforge/cli db migrations --help`, sanitized B3-RETEST error,
read-only `list --json`.

| Capacidad | Clasificación | Evidencia |
| --------- | ------------- | --------- |
| Wrap each migration in a transaction | SUPPORTED (documented) | migrations.md: backend wraps each migration; do not add BEGIN/COMMIT/ROLLBACK |
| Always forbid explicit TCL | SUPPORTED (documented + proven) | docs + B3-RETEST error: `Transaction control statements are not allowed.` |
| Prohibition applies to all migrations | SUPPORTED (documented) | Common mistake table applies to migration SQL generally; 0011 explicitly notes runner forbids TCL |
| dry-run | NOT SUPPORTED | CLI: list / fetch / new / up only |
| validate (preflight) | NOT SUPPORTED | not in CLI help |
| repair | NOT SUPPORTED | not in CLI help |
| mark-applied | NOT SUPPORTED | not in CLI help |
| mark-reverted | NOT SUPPORTED | not in CLI help |
| skip | NOT SUPPORTED | not in CLI help |
| Supported path to re-run corrected old migration once registered | NOT SUPPORTED | `up` fails if already applied; B3 had to use out-of-band `db query` for 0015 DCL re-apply |
| fetch overwrites divergent local history | NOT SUPPORTED | fetch skips existing paths even if contents differ |

```text
commands observed: list, fetch, new, up [--all|--to]
```

## B5.7 Simulación documental Main 10 → 16

Assumed start (prior evidence, unchanged claim): Main migration max = 10.
Local pending files: 0011 → 0016. Normal command: `db migrations up --all`
(or sequential `up` of next pending).

| Step | Precondiciones | Objetos / efectos | Dependencias | Runner | Punto de fallo | Estado posterior esperado |
| ---- | -------------- | ----------------- | ------------ | ------ | -------------- | ------------------------- |
| 0011 | max=10 | REPLACE checkout_start_tx (logical capacity) | schema through 0010 | COMPATIBLE | low (already on sandbox) | max=11 |
| 0012 | max=11 | expiry TX functions/indexes | 0011 catalog/checkout | COMPATIBLE | low | max=12 |
| 0013 | max=12 | array-form expiry REPLACE | 0012 | COMPATIBLE | low | max=13 |
| 0014 | max=13 | lease acquire/release | 0013 | COMPATIBLE | low | max=14 |
| **0015** | max=14 | intended: 29 REVOKEs | 0014 + domain tables | **INCOMPATIBLE** | **FAIL: TCL BEGIN/COMMIT** | **max stays 14; 0015 not registered; 0016 never reached** |
| 0016 | max=15 | 31 GRANT/REVOKE checkout-compatible | 0015 registered | COMPATIBLE | unreachable if 0015 fails | n/a |

Explicit answer:

```text
¿Puede el runner normal llegar desde 10 hasta 16 sin intervención manual?
NO — BLOCKED AT 0015
```

Rationale: not inferred from sandbox max=16. Inferred from (1) local
0015 still containing executable TCL, (2) proven runner rejection of
the same pattern on 0016 (B3-RETEST), (3) official runner contract.

How sandbox reached 16 without contradicting this:

```text
0015 was registered earlier (statements stored = DCL only).
B3 later re-applied DCL out-of-band because history already had v15
while privileges had been rolled back.
0016 failed once with TCL (B3-RETEST), then FIX2 removed TCL, then
RETEST2 applied 0016 via normal migrations up.
```

## B5.8 Discrepancia sandbox / Main

```text
sandbox (impl-14a-expiry):
  0015 registered (statements = 29 REVOKEs, no TCL)
  original 0015 privilege effects were rolled back in B3, then
  reimposed / corrected by 0016 path (RETEST2)
  0016 registered; migration max = 16
  final privilege state = validated compensating hardening

Main (prior evidence):
  migration max = 10
  0015 not registered
  0016 not registered
  live reconfirm in B5 = NOT OBSERVABLE (no Main link)
```

## B5.9 Reconciliación (preguntas)

1. **¿Solo número o también hash?**
   Observable fields: `version`, `name`, `statements[]`, `createdAt`.
   **No SHA-256 field.** Content is partially auditable via `statements`.

2. **¿Hash de migración registrada auditable?**
   File SHA: **NOT OBSERVABLE** in remote history.
   Statement-body audit: **SUPPORTED** via `list --json` compare.

3. **¿Cambiar localmente 0015 produciría drift detectable?**
   `fetch` will **not** overwrite an existing local path.
   Drift vs remote `statements` is detectable by manual/compare audit.
   Version number alone would **not** flag a local TCL-only edit.

4. **¿Entorno nuevo usaría contenido local actual de 0015?**
   **YES** — pending apply reads local files. Current local 0015 with
   TCL would be submitted and is expected to fail under current runner.

5. **¿Cómo conservar evidencia del hash histórico?**
   Keep `A0E43B4F…A0C80B` in this evidence file (B2–B4) as the
   immutable pre-FIX historical artifact hash; any future TCL-only
   amendment must record old→new SHA without deleting history.

6. **¿Procedimiento para que Main alcance 16 sin historia falsa?**
   Recommended: exceptional TCL-only correction of local 0015
   **before** any Main apply (Alt A / B5-FIX1), then normal
   `migrations up` 0011→0016 so Main history records real applies of
   the same DCL bodies. Out-of-band DCL + fake mark-applied is
   **NOT SUPPORTED** / not governable.

## B5.10 Alternativas A–D

### A — Corrección excepcional de `0015` (TCL only)

Remove executable `BEGIN;`/`COMMIT;` only; preserve all REVOKE DCL.
Do **not** execute in B5.

| Criterio | Evaluación |
| -------- | ---------- |
| Soportada oficialmente | YES — matches migrations.md (no TCL; runner wraps TX) |
| Reproducible en entorno limpio | YES — after edit, 0011–0016 expected runnable |
| Conserva historia auditable | YES — old hash retained in evidence; new hash recorded; remote sandbox statements already omit TCL |
| Evita intervención manual no gobernada | YES for future applies; sandbox already at 16 needs no re-apply |
| Compatible con sandbox actual | YES — v15 already applied; local edit does not re-run |
| Compatible con Main desde 10 | YES — unblocks step 0015 |
| Compatible con futuros entornos | YES |
| Riesgo de drift | LOW for DCL semantics (already aligned with remote statements); file SHA changes — must be documented |
| Complejidad operativa | LOW (two-line structural delete + tests) |
| Rollback | Document prior hash; restore file from git/evidence if needed before any apply |

### B — Aplicación controlada fuera del runner

Apply 0015 DCL via `db query` / import, then somehow advance history.

| Criterio | Evaluación |
| -------- | ---------- |
| Soportada oficialmente | NO as migration path (B3 emergency only) |
| Reproducible limpio | WEAK — depends on manual sequencing |
| Historia auditable | NO / false if mark-applied invented; mark-applied NOT SUPPORTED |
| Evita intervención manual | NO |
| Sandbox actual | N/A (already past) |
| Main desde 10 | UNSAFE / NOT GOVERNABLE |
| Futuros entornos | NO |
| Drift | HIGH |
| Complejidad | HIGH |
| Rollback | poor atomicity vs runner wrap |

### C — Baseline / promoción Main 10→16 sin pasar 0015

| Criterio | Evaluación |
| -------- | ---------- |
| Soportada oficialmente | NOT PROVEN / no CLI promotion command |
| Reproducible limpio | splits histories (sandbox 15+16 vs Main jump) |
| Historia auditable | WEAK |
| Evita intervención manual | NO |
| Sandbox | creates long-term divergence |
| Main desde 10 | possible only with custom artifact (not designed here) |
| Futuros entornos | BAD — new envs still need 0011–0016 files |
| Drift | HIGH |
| Complejidad | HIGH |
| Rollback | unclear |

### D — repair / skip / mark

```text
SUPPORTED? NO — NOT SUPPORTED by CLI help and migrations.md
```

No invented commands proposed.

## B5.11 Recomendación

```text
RECOMMENDED = Alternativa A
  (exceptional TCL-only correction of 0015 in a later authorized unit)
```

Not based on convenience alone: it is the only option that is
(1) officially documented runner contract, (2) proven by the 0016
FIX2 path, (3) aligned with already-stored sandbox statements for v15,
(4) preserves auditable DCL intent, and (5) makes clean Main 10→16
reproducible without unsupported history surgery.

## B5.12 Decisión sobre commit

```text
PACKAGE BLOCKED BEFORE COMMIT
```

Reason: the repository still contains a local `0015` that would fail
on a clean InsForge environment under the current runner before `0016`
can apply. Hardening validation (B4) remains valid for local+sandbox
scope, but the **migration package** is not yet reproducible for Main
or new environments.

```text
commit = NOT AUTHORIZED
push = NOT AUTHORIZED
```

Option 3 (commit with non-deployable status) is **not** selected:
governance asked to resolve this risk before commit; Alt A is small
and supported.

## B5.13 Riesgos

```text
1. Committing 0015-with-TCL freezes a non-deployable chain on main.
2. Editing 0015 changes the declared "immutable" file SHA — must be
   framed as exceptional runner-compatibility amendment with hash
   lineage (same pattern as 0016 FIX2), not silent history rewrite.
3. Sandbox remote statements already omit TCL; leaving local TCL
   maintains file≠applied-wrapper drift until Alt A.
4. Main live max remains prior-evidence-based (NOT OBSERVABLE in B5).
5. True least privilege / OD-040-002 remain open; B5 does not authorize
   Main apply even after FIX1.
```

## B5.14 Siguiente unidad (no ejecutada)

```text
OD-040-002-B5-FIX1
  Exceptional runner-compatibility correction of 0015 (TCL only)
```

Planned (authorization required before execute):

```text
operation:
  Remove executable BEGIN;/COMMIT; from
  insforge/migrations/0015_compensating-privilege-hardening.sql only.
  Preserve every REVOKE DCL line unchanged.
  Update security static tests if they assert TCL presence/absence.
  Record old hash A0E43B4F…A0C80B → new SHA-256 in evidence.
  Do not create 0017. Do not edit 0016. Do not apply remotely.

files expected:
  insforge/migrations/0015_compensating-privilege-hardening.sql
  tests/unit/security/compensating-privilege-hardening.test.ts
    (only if assertions require update)
  docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md
  WORKSPACE_STATUS.md

protected:
  0011–0014, 0016, Edge Functions, src/*, docs/00-05, SPEC-040,
  .cursor/*, .insforge/project.json, Main, production

tests:
  compensating-privilege-hardening unit suite
  full npm test / typecheck / lint / git diff --check
  static grep: no executable BEGIN;/COMMIT; in 0015–0016

rollback:
  restore 0015 bytes from pre-FIX1 hash via git/evidence;
  no remote rollback needed if FIX1 is local-only

gate (proposed):
  READY_FOR_CTO_OD_040_002_B5_FIX1_LOCAL_REVIEW
  then separately: OD-040-002-PRE-COMMIT-PACKAGE-REVIEW

human authorization required for:
  editing previously "immutable" 0015
  any later sandbox/Main apply
  commit / push
```

## B5.15 Exclusiones B5

```text
no edit of 0011–0016 in this unit
no 0017
no migration apply / repair / mark / skip
no remote SQL writes
no deploy / schedule / Main / production
no commit / push
```

## B5.16 Estado agregado

```text
OD-040-002 COMPENSATING HARDENING =
  VALIDATED / CLOSED LOCAL + SANDBOX SCOPE
OD-040-002-B5 =
  MIGRATION CHAIN UNDER REVIEW / NOT RESOLVED
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
PACKAGE = BLOCKED BEFORE COMMIT
```

## B5.17 Gate

```text
READY_FOR_CTO_OD_040_002_B5_MIGRATION_CHAIN_REVIEW
```

This unit does not claim `READY_FOR_MAIN`, `READY_FOR_PRODUCTION`,
`READY_FOR_COMMIT`, `READY_FOR_PUSH`, `OD-040-002 RESOLVED`, or
`TRUE LEAST PRIVILEGE ACHIEVED`.

---

# OD-040-002-B5-FIX1 — Runner-compatible canonicalization of migration 0015

## FX15.1 Autoridad humana

```text
unit: OD-040-002-B5-FIX1
  Runner-compatible correction of migration 0015
governance date: 2026-07-31 — America/Merida
mode: EXECUTE — LOCAL CORRECTION ONLY
primary: Eliminar exclusivamente el TCL ejecutable de 0015,
  preservar íntegramente su contrato DCL y demostrar
  la reproducibilidad estática de la cadena 0011–0016
remote writes = 0
staging = 0
commit = 0
push = 0
```

## FX15.2 Baseline / preflight

```text
branch = main
HEAD = bced99e5a1f27128b7b497013f283c1967223599
origin/main = same
divergencia = 0 0
staged = 0
git diff --check = PASS
```

## FX15.3 Bloqueo detectado en B5

```text
Main pending chain from max 10:
  0011 → 0012 → 0013 → 0014 → 0015 → 0016
0015 = RUNNER_INCOMPATIBLE (executable BEGIN; / COMMIT;)
runner: wraps each migration; rejects explicit TCL
sanitized error (B3-RETEST on 0016): Transaction control statements are not allowed.
```

## FX15.4 Alternativa aplicada

```text
Alternativa A (B5 recommendation) = APPLIED LOCALLY
  remove executable BEGIN;/COMMIT; only
  preserve 29 REVOKE DCL statements unchanged
```

## FX15.5–FX15.6 Linaje de hashes de 0015

### Artefacto histórico (pre-B5-FIX1)

```text
hash =
A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
estado = historical local source used during B2/B3 evidence
limitación = runner-incompatible due exclusively to executable TCL
```

### Artefacto canónico (post-B5-FIX1)

```text
hash =
0F6484819A0DCA8B00C12FD1729BEFA9B45DEBAA8B3F2A61B96578CF50159E4C
estado = canonical runner-compatible source for clean environments
semantic delta = none in DCL
textual delta = executable BEGIN/COMMIT removed + runner-control comment
```

Lineage note:

```text
historical hash superseded for future clean applies
historical evidence (B2/B3/B4/B5) remains valid for its execution time
DCL identity was verified (normalized hash match)
```

Prior sections that record `A0E43B4F…C80B` are not rewritten.

## FX15.7 Cambio textual exacto

Executable removals only:

```sql
BEGIN;
COMMIT;
```

Added header note (comments only):

```text
No explicit transaction-control statements are included because
the InsForge migration runner manages the migration transaction
and rejects executable BEGIN/COMMIT.
```

Plus authority line for OD-040-002-B5-FIX1 and historical-hash lineage comment.
No REVOKE line order, tables, roles, or privileges changed.

## FX15.8–FX15.9 Comparación DCL / hash normalizado

Normalization: strip comments; strip top-level TCL; strip trailing `;`;
collapse whitespace; upper-case; join with `\n`; SHA-256.

```text
pre-FIX1 DCL statements = 29
post-FIX1 DCL statements = 29
semantic diff = 0
normalized DCL hash before =
  5E98DBC2C0A9E4BC23082D1FA34CDDF794C1251B56934F93CCC3C644E85F949A
normalized DCL hash after =
  5E98DBC2C0A9E4BC23082D1FA34CDDF794C1251B56934F93CCC3C644E85F949A
match = true
```

## FX15.10–FX15.11 Alineación sandbox / ausencia de hash remoto

From B5 read-only `db migrations list --json` (not re-queried in FIX1):

```text
sandbox migration 15 statements[] = 29 REVOKEs (no TCL)
remote record keys = version, name, statements, createdAt
remote file SHA field = ABSENT
local corrected DCL statements = 29
semantic match = true
  (storage omits trailing `;`; normalized form aligns)
```

## FX15.12 Compatibilidad estática 0011–0016

```text
0011 = RUNNER_COMPATIBLE
0012 = RUNNER_COMPATIBLE
0013 = RUNNER_COMPATIBLE
0014 = RUNNER_COMPATIBLE
0015 post-FIX1 = RUNNER_COMPATIBLE
0016 post-FIX2 = RUNNER_COMPATIBLE
sequence = 10 → 11 → 12 → 13 → 14 → 15 → 16
NO KNOWN RUNNER TCL BLOCKERS
PHYSICALLY PROVEN ON MAIN = NOT CLAIMED / NOT AUTHORIZED
```

Protected hashes unchanged:

```text
0011 = 7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22
0012 = E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1
0013 = BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A
0014 = 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
0016 = F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A
```

## FX15.13 Tests MCF1–MCF16

Implemented in
`tests/unit/security/compensating-privilege-hardening.test.ts`
(describe OD-040-002-B5-FIX1). Result at unit close: all MCF PASS
within security suite (61/61 including prior P/F/RCF guards updated for
canonical 0015 lineage).

## FX15.14 Regresiones locales

```text
security hardening suite = 61/61 PASS
checkout = 43/43 PASS
logical capacity = 24/24 PASS (included in full suite)
expiry = 148/148 PASS
full suite = 413/413 PASS (≥ 399)
typecheck = PASS
lint = PASS (pre-existing warnings only)
git diff --check = PASS
```

## FX15.15 Cero operaciones remotas

```text
remote writes = 0
no migration apply / repair / mark / skip
no db query writes
no deploy / schedule / Main / sandbox privilege changes
```

## FX15.16 Limitaciones

```text
physical Main apply = NOT AUTHORIZED / NOT PERFORMED
sandbox re-apply of 0015 = NOT AUTHORIZED (already registered)
runner wrap atomicity post-apply = NOT OBSERVABLE in this unit
TRUE LEAST PRIVILEGE = still BLOCKED_BY_PLATFORM_CAPABILITY
OD-040-002 = still OPEN
```

## FX15.17 Riesgos

```text
1. Sandbox already registered v15 from historical content path;
   local canonical file will not re-run there automatically.
2. Commit still requires separate human authorization after CTO review.
3. Main physical apply still blocked by OD-040-002 / true-LP gates.
```

## FX15.18 Decisión de paquete

```text
MIGRATION CHAIN =
  NO KNOWN STATIC RUNNER BLOCKERS
  PENDING CTO REVIEW
commit = NOT AUTHORIZED
push = NOT AUTHORIZED
READY_FOR_MAIN = NOT CLAIMED
READY_FOR_PRODUCTION = NOT CLAIMED
```

Prior B5 decision `PACKAGE BLOCKED BEFORE COMMIT` is superseded for the
**static TCL blocker** only; package commit remains NOT AUTHORIZED pending
CTO review of this FIX1 and a separate pre-commit package unit.

## FX15.19 Estado agregado / gate

```text
OD-040-002 COMPENSATING HARDENING =
  VALIDATED / CLOSED LOCAL + SANDBOX SCOPE
OD-040-002-B5 =
  MIGRATION CHAIN REVIEW COMPLETE / BLOCKED AT 0015 PRE-FIX
OD-040-002-B5-FIX1 =
  LOCAL CORRECTION COMPLETE / PENDING CTO REVIEW
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
```

```text
READY_FOR_CTO_OD_040_002_B5_FIX1_LOCAL_REVIEW
```

This unit does not claim `READY_FOR_MAIN`, `READY_FOR_PRODUCTION`,
`READY_FOR_COMMIT`, `READY_FOR_PUSH`, `OD-040-002 RESOLVED`, or
`TRUE LEAST PRIVILEGE ACHIEVED`.
