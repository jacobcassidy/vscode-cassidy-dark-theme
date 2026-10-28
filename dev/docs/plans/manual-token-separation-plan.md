# Separate generated token data from manual token data

## Summary

Move extracted token data and reviewed additions into separate layers. Bootstrap and refresh write only the generated layer; manual definitions and details remain authored inputs. The build loader merges both layers into one validated token snapshot.

## Changes

- Store verified VS Code and extension output under src/data/tokens/generated/: UI and semantic definitions/details, syntax details, and upstream source history. Store curated additions and overrides under src/data/tokens/manual/ with matching family/file structure.
- Update bootstrap to create or replace only generated files. Once token data is ready, scaffold src/themes/prod/default/ from the merged token inventory if it is missing. Keep manual files intact.
- Update refresh and generated-data checks to read and write only the generated layer. Add deterministic alphabetization to generated output.
- Update the shared-data loader to merge generated and manual layers before theme validation and builds:
  - Manual detail fields override generated fields for the same ID; unspecified fields remain generated.
  - Manual definitions may add IDs absent from generated inventories, with source attribution required for nonstandard tokens.
  - A manual definition may not reclassify an ID already defined in generated data; conflicting categories fail with a clear diagnostic.
  - Preserve verified generated source attribution; manual data cannot replace it.
- Update schemas, watchers, docs checks, reachability checks, and documentation for the new paths and merged behavior. Keep syntax rule order unchanged.

## Validation

- Load and build from generated-only, manual-only additions, and combined layers.
- Verify manual detail overrides survive bootstrap and refresh unchanged, while generated files remain deterministic.
- Verify manual-only tokens require valid nonstandard source attribution and conflicting categories fail before writes.
- Verify missing-default bootstrap generates token data first, then creates a buildable default theme.
- Run the relevant schema, documentation, theme, lint, and transaction checks.

## Assumptions

- Manual detail fields override generated fields at the same token ID; arrays replace the generated array when both layers define one.
- Manual definitions may add tokens, but cannot change the generated category of an existing token.
- When no preference was provided for manual-only definitions, require source attribution for nonstandard entries.
- The current uncommitted deletions and edits remain user-owned and must be preserved during implementation.
