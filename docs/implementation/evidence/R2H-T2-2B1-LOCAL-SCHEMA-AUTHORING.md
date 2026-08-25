# R2H-T2-2B1 — Local schema authoring evidence

```text
unit: R2H-T2-2B1 — LOCAL SCHEMA AUTHORING
mode: LOCAL FILE AUTHORING ONLY
status: VALIDATED / CLOSED
scope: LOCAL AUTHORING + STATIC VALIDATION SCOPE
date: 2026-08-02
baseline: main @ c5068a4820cd912cca5f28060cb50b14319a6f0e = origin/main (0 0)
```

```text
R2H-T2-2B1 =
VALIDATED / CLOSED
LOCAL AUTHORING + STATIC VALIDATION SCOPE
```

Human approval: Project Owner after CTO READ_ONLY validation unit
`R2H-T2-2B1-V` (2026-08-02 America/Merida). Closure does **not** assert
InsForge runtime support for `btree_gist` / `EXCLUDE`, concurrency proof,
`R2H-T2-2B` fully VALIDATED / CLOSED, or authorization of T2-2C.

## 1. Authority

- Project Owner approval of R2H-T2-2B definition (canonical operational identity
  and assignment schema).
- Explicit authorization limited to **R2H-T2-2B1** local authoring only;
  subsequently closed as VALIDATED / CLOSED for local authoring + static
  validation scope only.
- SPEC-060 v0.1.0 APPROVED; R2H-T2-1B VALIDATED / CLOSED at baseline HEAD.
- Does **not** authorize sandbox creation, SQL apply, InsForge writes, Main,
  production, commit, or push.

## 2. Baseline Git (preflight)

| Check | Result |
|---|---|
| branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` |
| origin/main | `c5068a4820cd912cca5f28060cb50b14319a6f0e` |
| divergencia | `0 0` |
| staged | empty |
| prior `0017_*` | none (no `MIGRATION_NUMBER_CONFLICT`) |
| working tree noise | `.cursor/*` / `.claude/*` only (protected) |

## 3. Files created / necessary support (exact inventory)

| Path | Role |
|---|---|
| `insforge/migrations/0017_operational-identity-assignments.sql` | Schema migration |
| `tests/unit/ops/operational-identity-migration-static.test.ts` | Static guards |
| `docs/implementation/evidence/R2H-T2-2B1-LOCAL-SCHEMA-AUTHORING.md` | This evidence |
| `tests/unit/security/compensating-privilege-hardening.test.ts` | **NECESSARY_SUPPORT** — three historical assertions that forbade any `0017_*` updated to accept exactly `0017_operational-identity-assignments.sql` so OD-040-002 chain tests remain green without blocking the authorized next migration |

## 4. Frozen decisions implemented

| Decision | In 0017 |
|---|---|
| Role/assignment = DATABASE_RELATION | tables + constraints |
| No OWNER / auth_user_id in migration | no INSERT / no hardcoded ids |
| `operational_areas` minimal entity | table; no real area seeds |
| Multi-assignment with no ACTIVE overlap | GiST EXCLUDE + `[)` only |
| Supersede column single | `supersedes_assignment_id` only |
| EXPIRED not persisted | status CHECK excludes EXPIRED |
| `source_version bigint DEFAULT 1` | yes |
| Overlap strategy single / deterministic | `btree_gist` + EXCLUDE only |
| No EXISTS-trigger overlap fallback | absent by design |

## 5. Confirmed real schema (0001–0016)

| Object | Confirmed |
|---|---|
| `events.id` | `uuid` PK |
| `events.code` | `text` · `UNIQUE (code)` · `UNIQUE (id, code)` |
| `event_days.id` | `uuid` PK |
| `event_days.event_code` | `text` FK → `events(code)` |
| `event_days.event_id` | **does not exist** |
| Additive key in 0017 | `uq_event_days_id_event_code UNIQUE (id, event_code)` |

## 6. Invariants encoded

- Composite FKs: assignment/area → `events(id,code)`, → `event_days(id,event_code)`, assignment → area `(id,event_id,event_code)`.
- `ON DELETE RESTRICT` on historical FKs; no `ON DELETE CASCADE`.
- CHECKIN_STAFF / SOLUTION_DESK require `area_id`; OWNER / OPS_MANAGER may omit.
- REVOKED requires revoke fields; ACTIVE/SUSPENDED require them NULL.
- Nonempty `btrim` checks on identity/actor/code strings.
- Internal triggers only: area day-scope match; supersede same operator+event.
- RLS ENABLE + FORCE; REVOKE PUBLIC/anon/authenticated; zero policies.
- `TRUE LEAST PRIVILEGE = NOT CLAIMED`; `project_admin / BYPASSRLS = PLATFORM LIMITATION`.

## 7. Overlap strategy

```text
CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCLUDE USING gist (
  operator_id WITH =,
  event_id WITH =,
  event_day_id WITH =,
  tstzrange(valid_from, valid_until, '[)') WITH &&
) WHERE (status = 'ACTIVE');
```

If B3 apply rejects `btree_gist` / `EXCLUDE` → stop, no weaker substitute,
`INSFORGE_PERMISSION_MODEL_BLOCKER`, separate CTO review. Not degradable in 0017.

## 8. RLS and grants

| Control | Applied |
|---|---|
| ENABLE + FORCE RLS | three operational tables |
| REVOKE ALL FROM PUBLIC | yes |
| REVOKE ALL FROM anon, authenticated | yes |
| CREATE POLICY | **0** |
| Direct browser table GRANTs | **0** |
| Function EXECUTE to PUBLIC/anon/authenticated | revoked |

## 9. Tests executed (local)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — **29 files / 445 tests** (was 434 before T2-1B closure baseline + B1 static + prior suite growth) |
| `tests/unit/ops/operational-identity-migration-static.test.ts` | PASS (11) |
| `npm run lint` | exit 0 (historical Edge bundle warnings out of T2-2B1 scope) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — **10/10** (T2-1B regression green) |
| `git diff --check` | PASS (exit 0) |

## 10. Limits of this unit

```text
SQL applied = 0
sandbox created = 0
InsForge writes = 0
Main / production = intact
staged = must remain empty unless later commit unit
commit = 0
push = 0
T2-2B VALIDATED / CLOSED = NOT DECLARED
impl-t2-ops = NOT CREATED
bootstrap OWNER = NOT DONE
frontend / RPC / Edge = NOT DONE
```

## 11. Risks deferred to T2-2B3

- Runtime availability of `btree_gist` / GiST EXCLUDE on `impl-t2-ops`.
- Concurrent overlap proof (case D).
- Compensating rollback practice on sandbox only.
- Platform `project_admin` / BYPASSRLS remains a limitation (not closed here).

## 12. Human closure

| Item | State |
|---|---|
| R2H-T2-2B1 | **VALIDATED / CLOSED** (local authoring + static validation) |
| Artifacts closed | `0017` migration; ops static tests; this evidence; OD-040 exact allowlist support edit |
| Gates at closure | typecheck PASS; 445/445 tests; 11/11 ops static; 10/10 e2e; lint/build/`git diff --check` PASS |
| OD-040 control weakening | 0 |
| scope / sensitive | 0 |
| SQL / sandbox / InsForge / Main / prod | untouched by B1 |
| commit / push | still NOT AUTHORIZED by this closure record |
| R2H-T2-2B (full) | NOT VALIDATED / CLOSED (awaits B2/B3) |
| T2-2C | NOT AUTHORIZED |

## 13. Exit gate after human closure

```text
READY_FOR_R2H_T2_2B_SANDBOX_PREPARATION
```

Creating `impl-t2-ops`, applying baseline/0017, or any InsForge write still
requires a **separate** human authorization unit.
