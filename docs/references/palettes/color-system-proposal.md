# Cassidy Dark color system proposal

Status: proposed design rules for the next palette revision. The [v1.3 palette](v1.3-palette.md) supplies the starting colors; the shipped theme remains the source of truth for released behavior. This document proposes a build step but does not implement it or change theme colors.

## Recommendation

Use an OKLCH palette with eight fixed hue anchors, a shared rule for generating variants, and semantic tokens that describe where each color is used. Preserve the different lightness levels that give Cassidy Dark its character. Consistency should mean predictable relationships and usage, while allowing yellow strings to stay lighter than red keywords.

The palette history already supports this direction:

- The v0.1–v0.3 references use HSL and several names for related variants, including Bright and Gold.
- The v0.5 reference introduces OKLCH and deliberate lightness differences between syntax families.
- The v1.0 reference establishes the current hue anchors and a muted/base/deep/background structure.
- The v1.3 reference and current experiments move toward a shared relationship between lightness and chroma, with five variants per family.

The cleanup is primarily to formalize these relationships, replace ambiguous variant names, and separate palette design from component behavior.

## Palette primitives

### Hue anchors and base colors

Use these authored targets as the starting parameters. The hex values are the existing v1.3 base colors for comparison, not regenerated exports of the targets. Pink uses 0°, equivalent to the historical 360°.

| Family | Hue  | Base lightness | Base chroma | Existing v1.3 base hex | Main syntax role            |
| ------ | ---- | -------------- | ----------- | ---------------------- | --------------------------- |
| Blue   | 255° | 0.768          | 0.1160      | `#80b7fc`              | Storage types               |
| Cyan   | 195° | 0.850          | 0.0750      | `#92dedd`              | Functions, classes, objects |
| Green  | 135° | 0.800          | 0.1000      | `#a2cd8b`              | Properties                  |
| Orange | 60°  | 0.800          | 0.1000      | `#eeae7b`              | Parameters                  |
| Pink   | 0°   | 0.850          | 0.0750      | `#f8bacc`              | Variables                   |
| Purple | 315° | 0.750          | 0.1250      | `#cc95e4`              | Constants                   |
| Red    | 30°  | 0.750          | 0.1250      | `#f38e7e`              | Keywords                    |
| Yellow | 90°  | 0.875          | 0.0625      | `#e6d5a7`              | Strings                     |

Blue's calibrated lightness comes from the current experiments. Keep it explicit rather than hiding it inside a special conversion rule. Keep the existing offset hue spacing: every anchor already sits on a 15° grid, including yellow at 90°. The hue anchors are explicit design choices, while the variant generation rules are shared across families.

### Five named variants

Use `palette.<family>.<variant>` for primitives. Retire the numeric chromatic labels when adopting the system: v1.3's 200 is approximately as light as 400, while 300 is lighter than both. These labels currently encode roles rather than an ordered lightness scale.

Let `Lb` be the family's base lightness. Apply the following rule to every family:

```text
Ctarget(L) = 0.5 × (1 − L)
```

| Variant  | Target lightness | Target chroma      | v1.3 label | Intended purpose                                                    |
| -------- | ---------------- | ------------------ | ---------- | ------------------------------------------------------------------- |
| `light`  | `Lb + 0.10`      | `Ctarget(L)`       | 300        | Light emphasis or foreground on a sufficiently dark colored surface |
| `muted`  | `Lb`             | `0.5 × Ctarget(L)` | 200        | Lower chroma syntax, such as blue type hints                        |
| `base`   | `Lb`             | `Ctarget(L)`       | 400        | Normal syntax and colored foregrounds                               |
| `strong` | `Lb − 0.10`      | `Ctarget(L)`       | 500        | Deeper accents and candidate diagnostic colors                      |
| `solid`  | `Lb − 0.20`      | `Ctarget(L)`       | 600        | Candidate opaque fills; validate the foreground separately          |

This is a Cassidy Dark design rule inferred from the current experiments, not a color science requirement. The chroma target increases by 0.05 for every 0.10 reduction in lightness. Muted keeps the authored base lightness and halves its chroma, creating a quieter variant without lowering its lightness target.

For example, orange becomes:

| Variant  | Authored OKLCH target |
| -------- | --------------------- |
| `light`  | `oklch(90% 0.05 60)`  |
| `muted`  | `oklch(80% 0.05 60)`  |
| `base`   | `oklch(80% 0.10 60)`  |
| `strong` | `oklch(70% 0.15 60)`  |
| `solid`  | `oklch(60% 0.20 60)`  |

Some targets exceed sRGB; the export policy below resolves that consistently. Keep unused variants available as reference without assigning each one a theme role. Yellow light is nearly white by design, so reserve it for an actual need.

OKLCH provides separate lightness, chroma, and hue coordinates, which makes these relationships practical to author. Equal lightness does not by itself guarantee equal contrast on a background. See [CSS Color 4: Oklab and OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab).

## Semantic tokens

Give usage decisions their own names, then map those names to primitives. A primitive may serve multiple roles without making those roles equivalent.

| Proposed semantic token         | Starting reference    | Decision                                                                |
| ------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `syntax.typeHint`               | `palette.blue.muted`  | Keep type hints quieter through chroma                                  |
| `syntax.storageType`            | `palette.blue.base`   | Preserve the current blue syntax identity                               |
| `syntax.function`               | `palette.cyan.base`   | Preserve the current function identity                                  |
| `syntax.property`               | `palette.green.base`  | Preserve the current property identity                                  |
| `syntax.parameter`              | `palette.orange.base` | Preserve the current parameter identity                                 |
| `syntax.variable`               | `palette.pink.base`   | Preserve the current variable identity                                  |
| `syntax.constant`               | `palette.purple.base` | Preserve the current constant identity                                  |
| `syntax.keyword`                | `palette.red.base`    | Preserve the current keyword identity                                   |
| `syntax.string`                 | `palette.yellow.base` | Preserve the current string identity                                    |
| `ui.link.foreground`            | `palette.blue.strong` | Verify on every surface where links appear                              |
| `ui.action.primary.background`  | `palette.blue.solid`  | Starting candidate; adjust the semantic fill if its text fails contrast |
| `ui.action.primary.foreground`  | A neutral foreground  | Select together with the action background                              |
| `diagnostic.error.foreground`   | `palette.red.strong`  | Validate independently from red syntax and error fills                  |
| `diagnostic.warning.foreground` | `palette.orange.base` | Keep warning text readable on dark UI surfaces                          |
| `diff.added.foreground`         | `palette.green.base`  | Pair with a separate translucent diff background                        |

These aliases describe a future source model. VS Code theme entries still receive resolved hex colors; there is no token resolver in this repository today. The proposed build below separates palette parameters, usage aliases, and theme mappings while making them one authoritative source set for the generated theme.

Do not automatically equate `strong` with hover, `solid` with selection, or a diagnostic foreground with its background. Define hover and pressed states per component, keep their hue stable, and check their text and boundary contrast. Prefer adjusting a semantic UI color over distorting every syntax color to fix a button.

Treat terminal normal and bright colors as a separate semantic mapping. The references often map `ansiBright*` to a darker, more chromatic variant; explicitly review that choice for legibility rather than deriving it from the word Bright.

## Export and gamut policy

Author in OKLCH and export sRGB hex for this theme. Keep both the authored target and the actual exported result visible. Wide-gamut experiments can remain in the references with their color space labeled.

For this system, use a deterministic chroma-reduction policy:

1. Convert the target to linear sRGB and check whether all channels are in the range 0–1.
2. If it is outside sRGB, hold lightness and hue fixed and binary-search chroma between zero and the target for the largest in-gamut value. Use a fixed chroma tolerance, such as 0.000001.
3. Encode sRGB and round once to 8-bit hex. Allow only numerical cleanup of negligible channel overshoot; do not use independent channel clipping as the gamut mapping method.
4. Convert the final hex back to OKLCH for the exported-value column. Record any semantic overrides and rerun contrast checks on the rounded hex.

This is the proposed palette's export policy, not a claim to implement the full CSS gamut mapping algorithm. Chroma reduction in OKLCH is also discussed in [CSS Color 4: gamut mapping](https://www.w3.org/TR/css-color-4/#gamut-mapping).

The current references illustrate why this distinction matters: orange solid targets `oklch(60% 0.20 60)`, while `#bb6800` measures approximately `oklch(59.95% 0.1404 60.12)`. Yellow's current `#bc9000` measures about 86.75° in hue rather than its 90° anchor. A consistent export policy makes these departures explainable and repeatable.

Use columns such as `Token`, `Target OKLCH`, `Exported hex`, `Exported OKLCH`, and `Semantic uses`. The empty OKLCH column in the main v1.3 table should eventually be populated with clearly identified targets or measured exports, rather than mixing the two.

## Neutrals, overlays, and contrast

Keep the existing neutral axis at zero chroma and retain its ordered numeric names. Its main steps already use regular 0.08 lightness intervals. Additional surface levels such as 0.28, 0.30, and 0.32 are useful for the workbench; name their usage with aliases such as `surface.editor`, `surface.sidebar`, and `surface.input`.

Create a small named opacity set for overlays, starting with the existing 10% and 20% diff layers. Add selection and search opacities only as needed. An opaque `solid` color and a translucent overlay serve different purposes. Evaluate the final composited background, including nested diff, selection, search, and hover layers.

Use 4.5:1 as the minimum design target for ordinary text, including comments and syntax. Use 3:1 for visual information needed to identify controls and states against adjacent colors. These targets follow the [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). They are checks on specific pairs, not certification of the entire theme.

The following measurements use the existing v1.3 hex values and WCAG sRGB relative luminance. Ratios are rounded for display; pass/fail decisions use unrounded values.

| Existing pair                                  | Contrast       | Implication                                                        |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Eight base syntax colors on editor `#242424`   | 6.64:1–10.67:1 | The current base colors provide a useful starting point            |
| Comment `#7a7a7a` on editor `#242424`          | 3.62:1         | Raise the comment token if adopting the 4.5:1 text target          |
| Comment `#929292` on editor `#242424`          | 4.99:1         | Existing neutral 400 is one candidate for editor comments          |
| White text `#f8f8f8` on blue solid `#0071f1`   | 4.27:1         | The v1.3 button candidate needs adjustment for ordinary white text |
| White text `#f8f8f8` on cyan solid `#00a7a8`   | 2.79:1         | Solid variants cannot share a universal white foreground           |
| White text `#f8f8f8` on purple solid `#a034c9` | 5.16:1         | A deeper fill can support the same white foreground                |

These are palette candidate checks, not a report that these pairs all ship today. For example, the production button still uses `#006fd9`, while v1.3 lists `#0071f1`.

Do not make comments globally equal to neutral 400 without checking their other surfaces: `#929292` on input `#383838` is only 3.77:1. Likewise, choose foregrounds individually for filled controls; some fills may need a darker background or a lighter neutral rather than a simple light/dark foreground switch.

## Proposed theme build

Use a small Node.js script that resolves color variables during development and packaging. VS Code continues to load the generated theme at the path already declared in `package.json`. No runtime color resolver is needed.

### Source and output files

These are proposed paths, not files or commands available today:

| Path                                   | Purpose                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/palette.jsonc`                    | Authored hue/lightness parameters, neutrals, and documented primitive overrides                                  |
| `src/tokens.jsonc`                     | Semantic aliases and explicit alpha values for overlays                                                          |
| `src/cassidy-dark-color-theme.jsonc`   | Full theme template with named color references, comments, scope arrays, and font styles                         |
| `scripts/build-theme.js`               | Parameter validation, palette generation, alias resolution, template substitution, and output comparison/writing |
| `themes/cassidy-dark-color-theme.json` | Committed generated theme; edit the source files after migration                                                 |

The dependency flow is:

```text
palette parameters → gamut-mapped primitives → semantic aliases
                                                       ↓
theme template ───────────────────────────────────→ resolved theme
```

Keep development and historical themes in `dev/themes/` independent. Do not infer mappings by globally replacing matching hex strings: two uses of the same hex can have different semantic roles.

### Color variables and template references

An excerpt from `src/palette.jsonc` could look like this. Each family generates the five variants defined above, using the same chroma rule. Neutral lightness values use the 0–1 scale, zero chroma, and a conventional hue of zero.

```jsonc
{
  "families": {
    "blue": { "hue": 255, "lightness": 0.768 },
    "cyan": { "hue": 195, "lightness": 0.85 },
    "green": { "hue": 135, "lightness": 0.8 },
    "yellow": { "hue": 90, "lightness": 0.875 },
  },
  "neutrals": {
    "900": 0.26,
    "200": 0.82,
    "000": 0.98,
  },
  "overrides": {},
}
```

Internally, this produces primitive IDs such as `palette.cyan.base` and `palette.gray.900`. The complete configuration would include all eight families and every neutral required by the theme. Allow primitive overrides with either explicit OKLCH coordinates or an exact sRGB hex, plus a required reason. Exact hex overrides support a migration that preserves the released colors; OKLCH overrides still pass through the export policy.

Use a flat map of semantic IDs in `src/tokens.jsonc`. Dots are part of each ID, and references are looked up by their complete name:

```jsonc
{
  "surface.editor": { "ref": "palette.gray.900" },
  "text.default": { "ref": "palette.gray.200" },
  "syntax.function": { "ref": "palette.cyan.base" },
  "syntax.property": { "ref": "palette.green.base" },
  "diff.added.foreground": { "ref": "palette.green.base" },
  "diff.added.background": { "ref": "diff.added.foreground", "alpha": 0.1 },
}
```

Define `alpha` as an absolute opacity in the range 0–1, applied after resolving the referenced color. Emit lowercase `#rrggbb` for opaque colors and `#rrggbbaa` otherwise, with the alpha byte rounded from `255 × alpha`. For example, 0.1 produces `1a`. A new alpha replaces an inherited alpha; it does not multiply it. Preserve RGB channels without flattening the overlay onto a background.

The theme template uses whole-string references of the form `{token.id}` in color-value positions:

```jsonc
{
  "name": "Cassidy Dark",
  "type": "dark",
  "colors": {
    "editor.background": "{surface.editor}",
    "editor.foreground": "{text.default}",
    "diffEditor.insertedLineBackground": "{diff.added.background}",
  },
  "semanticHighlighting": true,
  "semanticTokenColors": {
    "function": "{syntax.function}",
    "property": { "foreground": "{syntax.property}" },
  },
  "tokenColors": [
    {
      "name": "Functions",
      "scope": ["entity.name.function"],
      "settings": {
        "foreground": "{syntax.function}",
      },
    },
  ],
}
```

This is an illustrative excerpt. Migrate the complete existing theme, including its author, schema, metadata, comments, and ordered scope rules. Support workbench color values, semantic token shorthand strings and object foregrounds, and TextMate settings foreground/background values. Preserve font styles and other non-color fields. Reject variable references outside supported color positions. Literal hex values may be retained during migration, then moved into named tokens as their roles are reviewed.

### Build behavior

Implement one render function shared by write mode and check mode:

1. Parse every JSONC input, allowing comments and trailing commas, and report syntax errors with its file and location. Reject duplicate keys, unknown configuration fields, non-finite numbers, invalid parameter ranges, and generated lightness outside 0–1. Validate chroma as nonnegative and hue anchors in the range 0–360, excluding 360.
2. Generate palette targets, apply documented overrides, and convert OKLCH colors to hex using the export policy. Keep target and exported measurements available for a future generated palette reference.
3. Resolve aliases recursively with memoization. Reject unknown references and cycles, reporting the full reference chain. Validate unused aliases too, so dormant errors cannot accumulate.
4. Resolve references only in supported template color positions. Validate literal and resolved colors, and fail on unresolved placeholders in active values. Disabled examples inside comments remain comments.
5. Preserve template comments and ordering with the existing [`jsonc-parser`](https://github.com/microsoft/node-jsonc-parser) dependency. Its syntax tree provides offsets for replacing string values, and its edit APIs can apply those changes without serializing the document from scratch. Add a stable generated-file header directing edits to `src/`.
6. Format the result using the installed [Prettier API](https://prettier.io/docs/api), explicitly loading the repository configuration and applying the output file's overrides with `parser: "jsonc"`. Reparse the rendered result and validate its theme structure before writing. Keep output deterministic: no timestamps, host paths, or reordered scope arrays.
7. In normal mode, write only when the generated bytes differ. In `--check` mode, render in memory, compare against the committed output, and exit nonzero on missing or stale output with instructions to run `npm run build:theme`. Check mode must not rewrite files.

Finish validation before replacing the output; use a temporary sibling file and rename it after successful rendering. A failed build must leave the previous theme intact.

### Commands and release integration

Add these npm scripts when implementing the builder:

```json
{
  "build:theme": "node scripts/build-theme.js",
  "check:generated": "node scripts/build-theme.js --check"
}
```

Integrate them with the existing workflow:

- Put `npm run check:generated` first in `npm run check`, followed by the existing formatting, linting, theme validation, and tests. CI should report stale committed output before any command can overwrite it.
- Run `npm run build:theme` before the current `dev:sync` script so the linked development extension loads the latest generated theme. Rebuild after editing palette inputs; a watch command can be added later if needed.
- Put `npm run check:generated` before VSIX creation in `scripts/release/package.sh`. The Azure pipeline already runs `npm run check`, so it inherits the same check. A standalone local packaging command must also refuse stale output.
- Add `src/` to `.vscodeignore`; the existing exclusions already omit scripts and development dependencies. Package the resolved theme, and keep the manifest's theme path unchanged.
- Commit the source edits and generated output together. Update the development guide to identify `src/` as the authoring source and `themes/` as generated output. README and release notes should explain the new build command.

### Migration and verification

Separate build adoption from palette redesign. First copy the current theme to the template and replace colors with references based on their intended roles. Use exact hex overrides where needed to reproduce every current color, including eight-digit alpha values. Compare parsed themes for deep equality so metadata, scope order, font styles, and color assignments remain identical; review comments separately because a parsed comparison cannot check them.

After that migration passes, apply the proposed OKLCH palette as a separate reviewed change. This avoids making a palette redesign a prerequisite for variable-based authoring.

Before adopting the builder, add focused tests for alias chains and cycles, missing references, alpha rounding and replacement, duplicate-key errors, invalid parameters, known OKLCH/sRGB conversions, and out-of-gamut chroma reduction. Integration checks should cover all supported color positions, preservation of scope order and comments, deterministic output, read-only stale-output detection, and leaving the previous file intact after a failed build. The existing theme validator currently checks basic structure and asset paths; it does not replace these build-specific checks.

## Adoption sequence

1. Agree on the hue anchors, base lightness values, variant names, and export policy before changing hex values.
2. Populate a new palette revision from these parameters, preserving v1.3 as the comparison reference. Record targets separately from exported measurements.
3. Map syntax and workbench roles independently. Document each exception with the affected semantic token and its contrast reason.
4. Preview the existing grammar samples with semantic highlighting on and off, then inspect comments, links, buttons, diagnostics, terminal ANSI colors, and text under selection, search, and diff overlays.
5. Check actual foreground/background pairs and review with color vision deficiency simulations. Keep icons, underlines, and labels where color communicates state.
6. If adopting variable-based authoring, implement the proposed build and verify a migration that preserves current colors first. Then apply the reviewed palette through the source files, commit the generated theme, and update release notes.
