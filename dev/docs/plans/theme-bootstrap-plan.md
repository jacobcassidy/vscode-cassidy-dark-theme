# Add a clean-project bootstrap command

## Summary

Add `npm run bootstrap` to create a small, neutral `src/themes/prod/default` theme and verified shared token data under `src/data/tokens/`. It will work when both directories are absent. If either directory exists, including as an empty directory or symlink, it will stop before writing and tell the user which directories to delete manually.

## Implementation

- Bundle starter theme templates outside `src/`. Create metadata named from `package.json` (`displayName`, falling back to `name`), a valid neutral palette, paired token definitions and details, editor background and foreground colors, one semantic variable, and one syntax comment rule.
- Reuse the existing verified upstream token bootstrap, including repeatable `--extension-source <checkout>` arguments. Let it read the prepared default theme before that theme exists on disk, and validate any other authored themes against the generated shared data.
- Prepare and validate every source file, including `src/data/tokens/README.md`, before applying them in one guarded, rollback-capable transaction. Keep `bootstrap:tokens` available for shared-data-only maintenance. Show progress during quiet stages and print `npm run build` after success; bootstrap itself will create source files only.
- Document the command and its manual-deletion rule in the README, development guide, and changelog. Follow the repository's script ordering and JavaScript documentation rules, then commit only this feature's changes.

## Tests

- In isolated projects, verify successful bootstrap with both directories absent and confirm the resulting sources build.
- Verify that either existing directory, a partial directory, or a symlink blocks all writes with a manual-deletion message.
- Verify upstream, validation, cancellation, and injected application failures leave no partial source tree; a clean retry succeeds.
- Verify existing additional themes and extension sources are included in validation. Run the relevant checks and `npm pack --dry-run` to confirm the command and templates are packaged.

## Assumptions

- Package users run `npm run bootstrap` from a copied or cloned project containing its `package.json`; publishing the npm package is a later task.
- The unanswered naming preference defaults to the project's package metadata.
- The current working-tree deletions and default-theme edit are user changes and must be preserved.
