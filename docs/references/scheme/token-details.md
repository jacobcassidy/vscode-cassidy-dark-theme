# Token details

`src/tokens.jsonc` keeps color documentation in an optional `details` object after `color` and optional `alpha`. The builder validates this metadata and leaves it out of the generated theme and palette reports. Editing details alone does not change generated files.

```jsonc
{
  "ui": {
    "activityBar": {
      "dropBorder": {
        "color": "palette.gray.white",
        "alpha": 0.5,
        "details": {
          "for": "Activity bar drag and drop indicators.",
          "inherits": ["activityBar.foreground"],
          "overrides": ["activityBar.foreground"],
        },
      },
    },
  },
}
```

## Fields

| Field           | Value                         | Meaning                                                                                                                        |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `for`           | Brief string                  | Where the token is used.                                                                                                       |
| `inherits`      | Array of token or scope names | Sources used when this token has no explicit color, including transformed defaults and conditional consumer fallbacks.         |
| `overridden-by` | Array of token or scope names | Known more specific tokens that can replace this token's inherited contribution, or take precedence for a particular UI state. |
| `overrides`     | Array of token or scope names | Fallback contributions or less specific state colors replaced by explicitly setting this token for its own use.                |

Omit empty fields and omit `details` entirely when there is nothing to document. Relationship arrays contain unique, nonempty names. Keep `alpha` only when it differs from 1. Literal color exceptions still require their separate `reason` field.

Workbench relationships use VS Code color IDs, such as `activityBar.foreground`, without the authoring-only `ui.` prefix. Semantic selectors use `semantic.function`, for example; `scope:support.function` identifies a TextMate fallback probe. These are documentation names, so they can reference colors and selectors that this theme does not explicitly set. Only `color` controls the actual Cassidy Dark palette/token alias.

For example, `activityBar.dropBorder` defaults to `activityBar.foreground`. Setting `dropBorder` replaces that default for the drag indicator; it does not change the foreground of the activity bar icons. Therefore the drag token lists the foreground in both `inherits` and `overrides`, and the foreground lists the drag token in `overridden-by`. Relationships describe direct links; transitive dependents are not repeated.

## Source review

The initial details were reviewed against the existing token comments and the [VS Code 1.143.1 source](https://github.com/microsoft/vscode/tree/1.143.1) on 2026-10-24, using the stable snapshot from the [workbench color audit](workbench-color-audit.md). All 243 authored workbench colors have registrations in that snapshot. Usage text is shortened from registration descriptions and existing examples; old color labels, literal core defaults, and intentional visual matches were discarded.

There is a way to obtain exact registration data: VS Code's internal [`getColorRegistry().getColors()`](https://github.com/microsoft/vscode/blob/1.143.1/src/vs/platform/theme/common/colorUtils.ts#L222) returns the registered IDs, descriptions, and defaults in a running source build. The runtime JSON schema exposes descriptions, but not a complete inheritance or precedence graph. Source inspection also works without building VS Code:

1. Inspect `registerColor(id, defaults, description)` calls in production TypeScript and color contributions in bundled extension manifests. Resolve imported constants and re-exports to their registered IDs.
2. Select the `dark` default for this dark theme. Record direct token references, including inputs to `transparent`, `lighten`, `darken`, `opaque`, `lessProminent`, and `oneOf`. A literal hex, literal `Color`, or `null` contributes no inherited token. These transformations and alternatives are not encoded by the relationship name alone.
3. Reverse those references to identify more specific tokens that can replace an inherited contribution on their own surfaces. Include registered dependents even when Cassidy Dark does not set them.
4. Inspect consumers for fallbacks and state precedence absent from registrations. Check semantic selector matching and TextMate probes separately.

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
