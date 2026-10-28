# Shared token data

Shared definitions control UI/semantic inventory and category membership; shared details provide reusable documentation. Builds read these files locally and never refresh descriptions. Syntax data is details-only; variables remain theme-owned.

Each shared definition uses `"$token": true` to mark an exact inventory ID, including IDs that also have child IDs. Optional `use` metadata belongs only on `nonStandard` entries. Shared definitions contain no styling; generators supply one common placeholder style for new theme entries.

See the [development guide](../../docs/guides/development-guide.md) for authoring, scope evidence, description history, upstream refresh, and recovery. Historical processing provenance is recorded in each file's comments; unknown revisions remain unknown.
