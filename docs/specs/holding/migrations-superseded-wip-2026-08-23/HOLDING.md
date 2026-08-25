# HOLDING — superseded migration WIP 0018 / 0019

```text
STATUS: NON_AUTHORITATIVE
        SUPERSEDED_WIP
        BYTE_HISTORICAL_PRESERVATION_ONLY
        NOT_IN_ACTIVE_MIGRATION_DISCOVERY_PATH
```

Captured: 2026-08-23 America/Merida  
Branch: main  
HEAD base: `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`)

These files were relocated out of `insforge/migrations/` so InsForge CLI
`db migrations up` cannot discover or apply them. Bodies were not edited.

`0017_operational-identity-assignments.sql` was not moved.

| File | SHA-256 |
|---|---|
| `0018_staged-commercial-pricing.sql` | `998a05ab283be2070850005e9ffe02bee6fd44c01e5a2b7b6c81958edd898389` |
| `0019_relaunch-v0-3-commercial-data.sql` | `fcb6dbd20557bf53550030ab50a93d79a29fccdd12564888f2dfe018d7ec374d` |

**Cross-link:** `0018` is also contract-**BLOCKED** under SPEC-030 v0.4.0 (quota /
HWM / cupo SOLD_OUT). See
`docs/specs/holding/migrations-blocked/BLOCKED.md` (same policy family as
blocked `0021` in that folder). `0019` is superseded relaunch WIP in this
lot; do not return either file to `insforge/migrations/`.

Do not apply. Do not rewrite. Successor commercial SQL on Main is
`0020_v04-commercial-authority-successor.sql` (already applied).
