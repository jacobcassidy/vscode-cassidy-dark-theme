# Consolidate theme sources and document disabled entries

Status: implemented. See the [development guide](../guides/development-guide.md#editing-theme-inputs) and [token authoring guide](../guides/token-details.md) for the resulting format.

## Summary

Combine styling and targeting into one token file per section. Separate descriptive details from token definitions, and support disabled entries that appear as explained comments in generated themes.

```text
<theme-name>/
  palette/
    generated/
      palette.json
      palette.md
      palette.svg
    palette-config.jsonc
  tokens/
    base.jsonc
    semantic.jsonc
    syntax.jsonc
    ui.jsonc
  details/
    base.jsonc
    semantic.jsonc
    syntax.jsonc
    ui.jsonc
  metadata.jsonc
```

Apply this beneath existing `src/themes/{prod,dev}/<theme-name>/` directories.

## Token definitions and details

- **Base:** Nested `surface`, `text`, `diagnostic`, and `diff` roles exposing `base.*` aliases without emitting theme entries.
- **UI:** A flat object keyed by VS Code settings. Each entry defines its style and corresponding `ui.*` alias.
- **Semantic:** A flat object keyed by selectors, including dotted and wildcard selectors. Support color and `bold`, `italic`, `underline`, and `strikethrough` booleans; allow formatting-only entries.
- **Syntax:** An ordered array preserving names, scopes, and precedence. Optional `id` identifies a rule for documentation and exposes its foreground as `syntax.<id>`.
- Color descriptors contain `color`, optional `alpha`, and `colorReason`. Syntax rules use these fields directly alongside `fontStyle`; optional `background` contains its own color descriptor.
- Rename `reason` to `colorReason` throughout token definitions, palette overrides, generated palette records, validation, tests, and documentation. Use “Color reason” for the palette report column.
- Require a nonempty `colorReason` for literal token colors and every palette override, including retained disabled styles. Validate it whenever supplied.
- Preserve existing explanations; document migrated dev literals using existing comments or their preview purpose.

Details support these optional fields:

| Field                  | Meaning                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `for`                  | Nonempty description of the token’s purpose or usage.                                                             |
| `inherits`             | Sources used when no explicit styling applies.                                                                    |
| `overrides`            | Tokens this token takes precedence over, including conditional or component-specific relationships.               |
| `globallyOverriddenBy` | Tokens that unconditionally replace this token everywhere in the effective theme, leaving its own styling unused. |

Relationship fields contain nonempty arrays of unique, nonempty token or scope names, following the existing documentation naming conventions. Omit empty fields and undocumented entries.

For `globallyOverriddenBy`:

- Require complete replacement across all consumers and fallback paths. Omit it if the original token still has any applicable use.
- Exclude relationships limited to particular components, states, or surfaces.
- Populate it through reviewed evidence; do not infer it by reversing `overrides`.
- Require the corresponding effective token definition to have `disabled: true` and a valid `disabledReason`. Fail validation otherwise.
- Support it for UI entries, semantic entries, and named syntax rules. Reject it for base roles, which are not emitted theme entries.
- Treat it as a reviewed assertion; the builder validates its structure and disabling requirement rather than proving runtime precedence.

## Disabled entries and generated comments

Support `disabled` and `disabledReason` on UI entries, semantic entries, and syntax rules:

```jsonc
{
  "button.background": {
    "color": "#1c6bc4",
    "colorReason": "Maintain sufficient contrast with the button text.",
    "disabled": true,
    "disabledReason": "Use the default button background in this comparison.",
  },
}
```

Generated output:

```jsonc
// "button.background": "#1c6bc4" // Use the default button background in this comparison.
```

- `disabled` defaults to `false`; base roles accept neither disabling field.
- Require a nonempty `disabledReason` when disabled. Validate it whenever supplied, but allow retaining it while enabled.
- Use `disabledReason` as the generated annotation, normalizing whitespace to one line. Do not substitute `colorReason` or relationship metadata for it.
- Show resolved configured styles inside comments. Without styling, use commented `null` for UI/semantic entries and empty settings for syntax rules.
- Comment out entire syntax rules, retaining names and scopes; attach the explanation to the first commented line.
- Disabled entries may omit styling and remain documentation targets. Configured colors remain available as aliases; references to entries without colors fail clearly.
- Validate retained styles normally and strip source-only fields from compiled entries.
- Include only explicitly disabled entries; do not automatically populate missing tokens.

## Compilation, fallback, and migration

- Collect named colors before resolving forward and cross-section aliases. Preserve alpha replacement behavior; reject unknown references, duplicate IDs, and cycles.
- Compile UI entries into `colors`, semantic entries into style objects in `semanticTokenColors`, and ordered syntax rules into `tokenColors`.
- Emit ordered JSONC with correct active-entry commas and deliberate disabled-entry comments. Continue omitting ordinary source comments.
- Key details by base paths, exact UI/semantic keys, or syntax IDs, without a `"details"` wrapper. Validate against effective authored entries, including disabled ones.
- Keep relationships independent of alias resolution. Only `globallyOverriddenBy` introduces the additional requirement to disable its corresponding token.
- Apply independent whole-file default fallback to every authored input. Require complete default inputs; supplied files replace their counterparts entirely. Allow `{}` details files to suppress documentation fallback.
- Migrate dev details where necessary and keep existing active entries enabled unless a reviewed global replacement requires disabling them.
- Move palette configuration and reports to the agreed paths; update provenance, stale-output detection, watcher exclusions, fixtures, and active documentation.
- Keep palette-only builds independent of tokens, details, and metadata. Remove legacy paths and field names without compatibility loaders.
- Update README/changelog and commit completed changes using the repository’s existing style.

## Validation

- Confirm equivalent generated active styles and ordering, allowing semantic string-to-object normalization and explicitly reviewed disabling changes.
- Confirm identical palette values and measurements, allowing renamed `colorReason` fields and updated provenance.
- Verify disabled entries are absent from parsed themes while comments show their explanations and retained styles or placeholders.
- Test required, blank, malformed, multiline, and retained explanations; distinguish `colorReason` from `disabledReason`.
- Test `globallyOverriddenBy` validation, rejection on enabled tokens and base roles, and enforcement after independent token/details fallback.
- Confirm existing conditional override lists are not automatically converted into global replacement metadata.
- Cover disabled entries in every position, entirely disabled sections, syntax backgrounds, formatting-only rules, aliases, and stable repeat formatting.
- Test fallback, details validation, selectors, literal reasons, alpha, cycles, and duplicate IDs.
- Confirm documentation-only edits leave outputs unchanged, failures preserve existing artifacts, and watcher exclusions prevent rebuild loops.
- Run `npm run check`.
