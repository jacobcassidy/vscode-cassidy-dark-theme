# Tokens and details

## Table of Contents

| Ch  | Section                                                                 |
| --- | ----------------------------------------------------------------------- |
| 1   | [Token definitions and aliases](#token-definitions-and-aliases)         |
| 2   | [Separate documentation](#separate-documentation)                       |
| 3   | [Disabled entries](#disabled-entries)                                   |
| 4   | [Source review](#source-review)                                         |
| 5   | [Verified examples and corrections](#verified-examples-and-corrections) |

Each theme under `src/themes/{prod,dev}/<name>/` has consolidated styling in `tokens/` and independent documentation in `details/`. Both directories contain `variables.jsonc`, `ui.jsonc`, `semantic.jsonc`, and `syntax.jsonc`. The default theme supplies every file. Every target requires an explicit `palette/palette-config.jsonc`; `{ "useDefaultPalette": true }` selects the default palette. Other targets inherit omitted token, details, and metadata files independently; supplying `{}` in a details file suppresses its documentation fallback. Details are validated against the effective authored tokens, including disabled entries. Editing documentation alone leaves generated files unchanged.

## Token definitions and aliases

| File                     | Structure and output                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/variables.jsonc` | Internal color variables grouped by `surface`, `text`, `diagnostic`, and `diff` expose `variables.*` aliases without emitting theme entries.                                                                                                                                                                                             |
| `tokens/ui.jsonc`        | Flat VS Code setting keys define color descriptors and expose `ui.<key>` aliases. Entries compile into `colors`.                                                                                                                                                                                                                         |
| `tokens/semantic.jsonc`  | Exact selectors, including `function.defaultLibrary` and `*.readonly`, define color and/or boolean `bold`, `italic`, `underline`, and `strikethrough` flags. Entries compile into style objects in `semanticTokenColors`.                                                                                                                |
| `tokens/syntax.jsonc`    | An ordered array retains names, scopes, and precedence. Rules use color descriptor fields directly alongside `fontStyle`; optional `background` holds its own color descriptor. A unique `id` exposes the foreground as `syntax.<id>` and identifies the rule in details; it is required in `prod/default` and optional in other themes. |

Color descriptors contain `color`, optional `alpha`, and optional `colorReason`. A color references a generated palette primitive or another token alias directly, without braces. Every literal hex color requires a nonempty `colorReason`. Every palette override in `palette/palette-config.jsonc` also requires `colorReason`, which appears in generated palette records and the report's **Color reason** column. Whenever supplied, `colorReason` must be a nonempty string, including for reference colors and disabled styles.

For example, these two files define an alias chain:

```jsonc
// tokens/variables.jsonc
{
  "diagnostic": {
    "error": {
      "foreground": { "color": "palette.red.500" },
    },
  },
}
```

```jsonc
// tokens/ui.jsonc
{
  "errorForeground": { "color": "variables.diagnostic.error.foreground" },
}
```

All aliases are collected before resolution, so forward and cross-section references work. An alias keeps the referenced opacity unless it supplies `alpha`, which replaces that opacity rather than multiplying it. Unknown references and cycles fail, including unused or disabled colors. References to entries without configured colors fail with a specific diagnostic. Relationships in details do not participate in color resolution.

Formatting-only semantic entries are supported, including explicit `false` flags. Syntax formatting uses `fontStyle`, such as `"bold italic"` or `""` to reset formatting. Rule order and scope order are preserved.

## Separate documentation

Details files are flat objects keyed by variable paths such as `diagnostic.error.foreground`, exact UI or semantic keys, or syntax IDs. There is no `details` wrapper:

```jsonc
// details/ui.jsonc
{
  "activityBar.dropBorder": {
    "for": "Activity bar drag and drop indicators.",
    "inherits": ["activityBar.foreground"],
  },
}
```

| Field                  | Meaning                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `for`                  | Nonempty description of purpose or usage.                                                                               |
| `inherits`             | Sources used when no explicit styling applies, including transformed defaults and conditional fallbacks.                |
| `overrides`            | Tokens this token takes precedence over, including conditional, state-specific, and component-specific relationships.   |
| `globallyOverriddenBy` | Tokens that unconditionally replace this token across every consumer and fallback path, leaving its own styling unused. |

Every token in `prod/default` requires a matching entry with a nonempty `for` description in the corresponding details file. Variable keys use flattened leaf paths; UI and semantic keys match exactly; every syntax rule, including formatting-only and disabled rules, requires a unique `id` and matching details. Both production and development builds validate this default before writing outputs. Other themes may omit undocumented entries or supply empty detail files to suppress fallback. Omit empty fields. Relationship fields contain nonempty arrays of unique, nonempty token or scope names. Workbench names use VS Code IDs such as `activityBar.foreground`, without the authoring-only `ui.` prefix. Semantic names use `semantic.function`; TextMate fallback probes use `scope:support.function`. These documentation names may identify tokens absent from this theme.

Run `npm run add:properties -- prod/default` to fill missing entries after reference token additions. The command reads the offline [purpose catalog](../lookups/token-details.jsonc), derives variable and syntax purposes when absent from that catalog, and flags unknown UI and semantic purposes with `UNREVIEWED`. It also fills absent or blank `for` fields without replacing existing relationships. Unnamed syntax rules receive persistent IDs derived from their names, with numeric collision suffixes; rule order, scope order, and existing IDs are retained. All selected inputs and prepared JSONC edits are validated before any writes, and repeated runs leave complete files untouched.

`globallyOverriddenBy` is a reviewed assertion. Establish complete replacement across all consumers and fallback paths before adding it. Omit it if any applicable use remains, or if replacement is limited to components, states, or surfaces. Do not infer it by reversing `overrides`. It requires the corresponding effective UI entry, semantic entry, or named syntax rule to have `disabled: true` and a nonempty `disabledReason`. Internal variables reject it because they emit no theme entries. The builder validates the assertion's structure and disabling requirement, including after independent token/details fallback; it does not prove runtime precedence.

The existing status bar override lists describe conditional state behavior and remain `overrides`. For example, debugging colors take precedence only while debugging colors are enabled. Default inheritance and state precedence are separate: a token may appear in both lists when it independently has both relationships. Equal colors and shared aliases do not establish either relationship.

## Disabled entries

UI, semantic, and syntax entries accept `disabled` (default `false`) and `disabledReason`. Internal variables accept neither field. A disabled entry requires a nonempty `disabledReason`; it may omit styling and remain a documentation target. Retained styles validate normally, and configured foreground colors remain available as aliases. A valid `disabledReason` may be retained while the entry is enabled.

```jsonc
{
  "button.background": {
    "color": "#1c6bc4",
    "colorReason": "Maintain contrast with the button text.",
    "disabled": true,
    "disabledReason": "Use the default button background in this comparison.",
  },
}
```

Generated output contains the resolved configured style as a comment:

```jsonc
// "button.background": "#1c6bc4" // Use the default button background in this comparison.
```

The annotation comes only from `disabledReason`, with whitespace normalized to one line. UI and semantic placeholders without styling use commented `null`. Syntax rules are commented in full, including names, scopes, and retained settings, with the explanation on the first commented line; placeholders have empty settings. Disabled entries are absent from the parsed theme. Only explicitly disabled entries are included; missing tokens are never added automatically. Ordinary source comments are omitted from generated themes.

## Source review

The initial details were reviewed against the existing token comments and the [VS Code 1.143.1 source](https://github.com/microsoft/vscode/tree/1.143.1) on 2026-10-24, using the stable snapshot from the [workbench color audit](workbench-color-audit.md). All 243 authored workbench colors have registrations in that snapshot. Usage text is shortened from registration descriptions and existing examples; old color labels, literal core defaults, and intentional visual matches were discarded.

On 2026-10-27, matching purposes were completed for all 1,031 UI properties, 59 semantic selectors, six internal variables, and 46 syntax rules. The offline catalog combines existing reviewed purposes with descriptions from that audit's stable and [pinned main](https://github.com/microsoft/vscode/tree/1184ad4d45794110deb6b897ea83b15aac44ed89) registration snapshots. The 29 legacy or extension-owned UI IDs absent from those registrations are explicitly identified in their descriptions; their intended surfaces do not establish current support. Core semantic meanings were checked against the [token classification registry](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/platform/theme/common/tokenClassificationRegistry.ts); provider-defined selectors are labeled accordingly and depend on the installed language provider. Syntax purposes describe the authored scopes and formatting. Newly added purposes do not assert inheritance or runtime precedence. Normal command runs use the checked-in catalog without fetching sources; review that catalog when adding or changing registered properties.

There is a way to obtain exact registration data: VS Code's internal [`getColorRegistry().getColors()`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/platform/theme/common/colorUtils.ts#L222) returns the registered IDs, descriptions, and defaults in a running source build. The runtime JSON schema exposes descriptions, but not a complete inheritance or precedence graph. Source inspection also works without building VS Code:

1. Inspect `registerColor(id, defaults, description)` calls in production TypeScript and color contributions in bundled extension manifests. Resolve imported constants and re-exports to their registered IDs.
2. Select the `dark` default for this dark theme. Record direct token references, including inputs to `transparent`, `lighten`, `darken`, `opaque`, `lessProminent`, and `oneOf`. A literal hex, literal `Color`, or `null` contributes no inherited token. These transformations and alternatives are not encoded by the relationship name alone.
3. Inspect consumers for fallbacks absent from registrations and add those links only to `inherits`. Check semantic selector matching and TextMate probes separately; scope probes and base-selector fallbacks also belong in `inherits`.
4. Inspect state selection in consumers to populate `overrides` on authored tokens. Registration dependencies alone do not establish state precedence.

The relationship lists are a reviewed snapshot, not a complete runtime precedence model. Conditions such as terminal location, hover, focus, debugging, application surface, and extension contributions can affect which source is used. User color customizations also take precedence over theme colors in [`ColorThemeData.getColor`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/services/themes/common/colorThemeData.ts#L152); this setting is documented here rather than repeated as though it were a color token in every list. Normal theme builds do not fetch VS Code source or refresh these details.

## Verified examples and corrections

- [`activityBar.activeBackground`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/common/theme.ts#L449) has a `null` registered default. Matching `sideBar.background` in Cassidy Dark was an intentional palette choice, so it is not listed as inheritance.
- [`activityBar.inactiveForeground`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/common/theme.ts#L421) derives from `activityBar.foreground` through transparency. The `inherits` name records the source, not a promise of identical RGBA values.
- The [`editor.findMatchForeground` and `editor.findMatchHighlightForeground` registrations](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/platform/theme/common/colors/editorColors.ts) are both `null`. The old cross-reference between them was not an inheritance link.
- [`terminal.background`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts#L2962) falls back to `editor.background`, `panel.background`, or `sideBar.background` according to where the terminal is hosted. This fallback lives in its consumer, not its `null` registration.
- [`dropdown.listBackground`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/base/browser/ui/selectBox/selectBoxCustom.ts#L473) falls back to `dropdown.background` in the custom select widget.
- The [`status bar renderer`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/browser/parts/statusbar/statusbarPart.ts#L720) selects workspace, empty-window, and inactive-window colors. The [`debug status bar provider`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/contrib/debug/browser/statusbarColorProvider.ts#L56) supplies a higher-priority debugging style. These state overrides are recorded separately from default inheritance.
- [`Semantic token defaults`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/platform/theme/common/tokenClassificationRegistry.ts#L552) specify TextMate scopes to probe. [`Semantic style resolution`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/workbench/services/themes/common/colorThemeData.ts#L175) matches explicit selectors before filling undefined properties from those defaults. A `function.defaultLibrary` rule can therefore supersede `function`, while explicit semantic styles supersede their TextMate fallback probes.

When updating the source snapshot, recheck these consumer cases as well as the registrations. Equal colors, shared palette aliases, and old comments saying “match” do not establish VS Code inheritance.
