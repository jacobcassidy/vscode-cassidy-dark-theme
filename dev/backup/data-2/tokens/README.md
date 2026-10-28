# Shared token data

Shared definitions control UI/semantic inventory and category membership; shared details provide reusable documentation. Builds read these files locally and never refresh descriptions. Syntax data is details-only; variables remain theme-owned.

After removing `src/data/tokens/`, recreate shared files with `npm run bootstrap:tokens`. Supply every extension checkout that contributes nonstandard UI or semantic tokens using repeatable `--extension-source` arguments. Nonstandard shared detail records carry a sorted `source` array of verified publisher and extension IDs; standard token provenance is recorded in `upstream-sources.jsonc`.

Shared UI definitions map dotted group paths to arrays of exact property names. Semantic definitions use exact selector strings. Shared definitions contain no styling; generators supply one common placeholder style for new theme entries.

See the [development guide](../../../dev/docs/guides/development-guide.md) for authoring, scope evidence, description history, upstream refresh, and recovery. Historical processing provenance is recorded in each file's comments; unknown revisions remain unknown.
