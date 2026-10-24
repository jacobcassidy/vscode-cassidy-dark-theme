# Cassidy Dark color system proposal

Status: proposed design rules for the next palette revision. The [v1.3 palette](v1.3-palette.md) supplies the starting colors; the shipped theme remains the source of truth for released behavior. This document proposes a build step but does not implement it or change theme colors.

## Recommendation

Use an OKLCH palette with eight fixed hue anchors, a shared rule for generating variants, and semantic tokens that describe where each color is used. Preserve the different lightness levels that give Cassidy Dark its character. Consistency should mean predictable relationships and usage, while allowing yellow strings to stay lighter than red keywords.

The palette history already supports this direction:

- The v0.1–v0.3 references use HSL and several names for related variants, including Bright and Gold.
- The v0.5 reference introduces OKLCH and deliberate lightness differences between syntax families.
- The v1.0 reference establishes the current hue anchors and a muted/base/deep/background structure.
- The v1.3 reference and current experiments move toward a shared relationship between lightness and chroma, with five variants per family.

The cleanup is primarily to formalize these relationships, use ordered tone numbers with an explicit muted modifier, and separate palette design from component behavior.

## Palette primitives

### Hue anchors and base colors

Use the latest known lightness and hue values as the starting parameters, including blue at L75 and both yellow candidates. The hex values are the existing v1.3 base colors for comparison, not regenerated exports of the targets. Pink uses 0°, equivalent to the historical 360°. Base chroma here is the visual target before the gamut limit described below.

| Family | Hue  | Base lightness | Base chroma | Existing v1.3 base hex | Main syntax role            |
| ------ | ---- | -------------- | ----------- | ---------------------- | --------------------------- |
| Blue   | 255° | 0.750          | 0.1250      | `#80b7fc`              | Storage types               |
| Cyan   | 195° | 0.850          | 0.0750      | `#92dedd`              | Functions, classes, objects |
| Green  | 135° | 0.800          | 0.1000      | `#a2cd8b`              | Properties                  |
| Orange | 60°  | 0.800          | 0.1000      | `#eeae7b`              | Parameters                  |
| Pink   | 0°   | 0.850          | 0.0750      | `#f8bacc`              | Variables                   |
| Purple | 315° | 0.750          | 0.1250      | `#cc95e4`              | Constants                   |
| Red    | 30°  | 0.750          | 0.1250      | `#f38e7e`              | Keywords                    |
| Yellow | 90°  | 0.875          | 0.0625      | `#e6d5a7`              | Strings                     |

Yellow at L90 is an alternative with target chroma 0.0500. Keep L87.5 as the reference default until the two candidates are compared in syntax samples.

Keep the existing offset hue spacing: every anchor already sits on a 15° grid, including yellow at 90°. The hue anchors are explicit design choices, while the variant generation rules are shared across families.

### Choosing chroma from the anchors

Lightness and hue determine which chroma values fit the output gamut, but they cannot determine the preferred visual intensity. Choose one global strength parameter, starting at 0.5 because it reproduces most of the current base colors, and use the gamut as a limit:

```text
strength = 0.5
gamutFraction = 0.9

Ctarget(L) = strength × (1 − L)
Cusable(L, H) = min(Ctarget(L), gamutFraction × CmaxSRGB(L, H))
```

`CmaxSRGB(L, H)` is the largest chroma whose linear sRGB channels all remain in 0–1 at the chosen lightness and hue. Find it with the chroma search in the export policy. The 90% fraction leaves some chroma headroom below that boundary; it is a proposed design setting, not a color science constant or a guarantee of balanced appearance. Setting it to 1 uses all available chroma up to the boundary.

This keeps the visual target separate from the display limit. Do not choose chroma solely as a fixed fraction of the maximum: at these anchors, green's maximum is approximately 0.234 while pink's is approximately 0.089. A common gamut fraction alone would give green much more absolute chroma. Equal gamut fractions do not imply equal perceptual chroma.

The following base candidates use strength 0.5 and gamut fraction 0.9. Measurements are calculated in sRGB; displayed chroma values are rounded, while hex values are generated from the unrounded values.

| Family | L     | H    | Target C | Maximum sRGB C | Chosen C | Candidate hex |
| ------ | ----- | ---- | -------- | -------------- | -------- | ------------- |
| Yellow | 0.900 | 90°  | 0.0500   | 0.1282         | 0.0500   | `#ebddb9`     |
| Yellow | 0.875 | 90°  | 0.0625   | 0.1613         | 0.0625   | `#e6d5a7`     |
| Cyan   | 0.850 | 195° | 0.0750   | 0.1450         | 0.0750   | `#92dedd`     |
| Pink   | 0.850 | 0°   | 0.0750   | 0.0886         | 0.0750   | `#f8bacc`     |
| Green  | 0.800 | 135° | 0.1000   | 0.2336         | 0.1000   | `#a2cd8b`     |
| Orange | 0.800 | 60°  | 0.1000   | 0.1403         | 0.1000   | `#eeae7b`     |
| Blue   | 0.750 | 255° | 0.1250   | 0.1306         | 0.1176   | `#7ab1f7`     |
| Purple | 0.750 | 315° | 0.1250   | 0.1897         | 0.1250   | `#cc95e4`     |
| Red    | 0.750 | 30°  | 0.1250   | 0.1512         | 0.1250   | `#f38e7e`     |

Only blue's base is limited by the proposed 90% setting. Its target of 0.125 already fits sRGB, so the reduction to approximately 0.1176 is an intentional design choice. Other variants may reach their limits independently. Smaller strength values produce quieter targets; larger values increase chroma until the gamut limit takes over for each color.

Judge the bases together on the actual editor background before changing these settings. Keep per-family overrides available for specific visual problems, with a recorded reason. Chroma generation does not establish text contrast; keep the foreground/background checks described below.

### Numbered tones and muted modifier

Use `palette.<family>.<tone>` for primitives, with `300`, `400`, `500`, and `600` as progressively darker tones. Tone `400` is the base color for every family. Use `400-muted` for its lower-chroma alternative, replacing v1.3's `200` label. Keep tone IDs as strings so `400-muted` follows the same reference format as the numeric tones.

The numbers describe relative lightness within each family; they do not imply the same lightness across families or prescribe UI roles. `400-muted` is a chroma modifier of `400`, not another step in the lightness scale.

Let `Lb` be the family's base lightness. Recalculate `Cusable` at each tone's lightness and the family's fixed hue. For `400-muted`, halve the resolved `400` chroma so the relationship survives a gamut limit.

| Tone        | Target lightness        | Chroma rule            | Previous v1.3 label | Intended purpose                                                    |
| ----------- | ----------------------- | ---------------------- | ------------------- | ------------------------------------------------------------------- |
| `300`       | `min(Lb + 0.10, 0.975)` | `Cusable(L, H)`        | 300                 | Light emphasis or foreground on a sufficiently dark colored surface |
| `400`       | `Lb`                    | `Cusable(L, H)`        | 400                 | Base color for normal syntax and colored foregrounds                |
| `400-muted` | `Lb`                    | `0.5 × Cusable(Lb, H)` | 200                 | Lower chroma syntax, such as blue type hints                        |
| `500`       | `Lb − 0.10`             | `Cusable(L, H)`        | 500                 | Deeper accents and candidate diagnostic colors                      |
| `600`       | `Lb − 0.20`             | `Cusable(L, H)`        | 600                 | Candidate opaque fills; validate the foreground separately          |

This is a Cassidy Dark design rule inferred from the current experiments, not a color science requirement. At strength 0.5, the chroma target increases by 0.05 for every 0.10 reduction in lightness. Actual chroma may stop increasing or decrease when a tone reaches its gamut limit. `400-muted` keeps the authored base lightness and halves its resolved chroma, creating a quieter variant without lowering its lightness target.

For example, orange's targets before the gamut limit become:

| Primitive                  | Authored OKLCH target |
| -------------------------- | --------------------- |
| `palette.orange.300`       | `oklch(90% 0.05 60)`  |
| `palette.orange.400`       | `oklch(80% 0.10 60)`  |
| `palette.orange.400-muted` | `oklch(80% 0.05 60)`  |
| `palette.orange.500`       | `oklch(70% 0.15 60)`  |
| `palette.orange.600`       | `oklch(60% 0.20 60)`  |

Some targets exceed sRGB; the chroma limit and export policy resolve that consistently. The lightness ceiling of 0.975 prevents the L90 yellow candidate from producing pure white at L100. Yellow `300` is still nearly white, so reserve it for an actual need. Keep unused tones available as reference without assigning each one a theme role.

OKLCH provides separate lightness, chroma, and hue coordinates, which makes these relationships practical to author. Equal lightness does not by itself guarantee equal contrast on a background. See [CSS Color 4: Oklab and OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab).

## Semantic tokens

Give usage decisions their own names, then map those names to primitives. A primitive may serve multiple roles without making those roles equivalent.

| Proposed semantic token         | Starting reference       | Decision                                                                |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `syntax.typeHint`               | `palette.blue.400-muted` | Keep type hints quieter through chroma                                  |
| `syntax.storageType`            | `palette.blue.400`       | Preserve the current blue syntax identity                               |
| `syntax.function`               | `palette.cyan.400`       | Preserve the current function identity                                  |
| `syntax.property`               | `palette.green.400`      | Preserve the current property identity                                  |
| `syntax.parameter`              | `palette.orange.400`     | Preserve the current parameter identity                                 |
| `syntax.variable`               | `palette.pink.400`       | Preserve the current variable identity                                  |
| `syntax.constant`               | `palette.purple.400`     | Preserve the current constant identity                                  |
| `syntax.keyword`                | `palette.red.400`        | Preserve the current keyword identity                                   |
| `syntax.string`                 | `palette.yellow.400`     | Preserve the current string identity                                    |
| `ui.link.foreground`            | `palette.blue.500`       | Verify on every surface where links appear                              |
| `ui.action.primary.background`  | `palette.blue.600`       | Starting candidate; adjust the semantic fill if its text fails contrast |
| `ui.action.primary.foreground`  | A neutral foreground     | Select together with the action background                              |
| `diagnostic.error.foreground`   | `palette.red.500`        | Validate independently from red syntax and error fills                  |
| `diagnostic.warning.foreground` | `palette.orange.400`     | Keep warning text readable on dark UI surfaces                          |
| `diff.added.foreground`         | `palette.green.400`      | Pair with a separate translucent diff background                        |

These aliases describe a future source model. VS Code theme entries still receive resolved hex colors; there is no token resolver in this repository today. The proposed build below separates palette parameters, usage aliases, and theme mappings while making them one authoritative source set for the generated theme.

Do not automatically equate `500` with hover, `600` with selection, or a diagnostic foreground with its background. Define hover and pressed states per component, keep their hue stable, and check their text and boundary contrast. Prefer adjusting a semantic UI color over distorting every syntax color to fix a button.

Treat terminal normal and bright colors as a separate semantic mapping. The references often map `ansiBright*` to a darker, more chromatic variant; explicitly review that choice for legibility rather than deriving it from the word Bright.

## Export and gamut policy

Author in OKLCH and export sRGB hex for this theme. Keep both the authored target and the actual exported result visible. Wide-gamut experiments can remain in the references with their color space labeled.

For this system, use a deterministic chroma-reduction policy:

1. Convert the target to linear sRGB and check whether all channels are in the range 0–1.
2. For generated colors, find `CmaxSRGB` at fixed lightness and hue by expanding an upper chroma bound until it is outside sRGB, then binary-searching between zero and that bound. Use a fixed chroma tolerance, such as 0.000001. Choose `Cusable` using the strength and gamut-fraction settings; halve the resolved `400` chroma for `400-muted`. For explicit OKLCH overrides, preserve their intended chroma if it fits sRGB, otherwise reduce it at fixed lightness and hue to the gamut boundary. Overrides deliberately bypass the automatic headroom rule; document why. Exact hex overrides are already sRGB.
3. Encode sRGB and round once to 8-bit hex. Allow only numerical cleanup of negligible channel overshoot; do not use independent channel clipping as the gamut mapping method.
4. Convert the final hex back to OKLCH for the exported-value column. Record any semantic overrides and rerun contrast checks on the rounded hex.

This is the proposed palette's export policy, not a claim to implement the full CSS gamut mapping algorithm. Chroma reduction in OKLCH is also discussed in [CSS Color 4: gamut mapping](https://www.w3.org/TR/css-color-4/#gamut-mapping).

The current references illustrate why this distinction matters: orange `600` targets `oklch(60% 0.20 60)`, while `#bb6800` measures approximately `oklch(59.95% 0.1404 60.12)`. Yellow's current `#bc9000` measures about 86.75° in hue rather than its 90° anchor. A consistent export policy makes these departures explainable and repeatable.

Use columns such as `Token`, `Target OKLCH`, `Exported hex`, `Exported OKLCH`, and `Semantic uses`. The empty OKLCH column in the main v1.3 table should eventually be populated with clearly identified targets or measured exports, rather than mixing the two.

## Neutrals, overlays, and contrast

Keep the existing neutral axis at zero chroma and retain its ordered numeric names. Its main steps already use regular 0.08 lightness intervals. Additional surface levels such as 0.28, 0.30, and 0.32 are useful for the workbench; name their usage with aliases such as `surface.editor`, `surface.sidebar`, and `surface.input`.

Create a small named opacity set for overlays, starting with the existing 10% and 20% diff layers. Add selection and search opacities only as needed. An opaque fill and a translucent overlay serve different purposes. Evaluate the final composited background, including nested diff, selection, search, and hover layers.

Use 4.5:1 as the minimum design target for ordinary text, including comments and syntax. Use 3:1 for visual information needed to identify controls and states against adjacent colors. These targets follow the [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). They are checks on specific pairs, not certification of the entire theme.

The following measurements use the existing v1.3 hex values and WCAG sRGB relative luminance. Ratios are rounded for display; pass/fail decisions use unrounded values.

| Existing pair                                | Contrast       | Implication                                                        |
| -------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Eight base syntax colors on editor `#242424` | 6.64:1–10.67:1 | The current base colors provide a useful starting point            |
| Comment `#7a7a7a` on editor `#242424`        | 3.62:1         | Raise the comment token if adopting the 4.5:1 text target          |
| Comment `#929292` on editor `#242424`        | 4.99:1         | Existing neutral 400 is one candidate for editor comments          |
| White text `#f8f8f8` on blue 600 `#0071f1`   | 4.27:1         | The v1.3 button candidate needs adjustment for ordinary white text |
| White text `#f8f8f8` on cyan 600 `#00a7a8`   | 2.79:1         | Tone 600 cannot share a universal white foreground across families |
| White text `#f8f8f8` on purple 600 `#a034c9` | 5.16:1         | A deeper fill can support the same white foreground                |

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

An excerpt from `src/palette.jsonc` could look like this. Each family generates tones `300`, `400`, `500`, and `600`, plus `400-muted`, using the shared chroma settings. Neutral lightness values use the 0–1 scale, zero chroma, and a conventional hue of zero.

```jsonc
{
  "chroma": {
    "strength": 0.5,
    "gamutFraction": 0.9,
  },
  "families": {
    "blue": { "hue": 255, "lightness": 0.75 },
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

Internally, this produces primitive IDs such as `palette.cyan.400` and `palette.gray.900`. The complete configuration would include all eight families and every neutral required by the theme. Allow primitive overrides with either explicit OKLCH coordinates or an exact sRGB hex, plus a required reason. Exact hex overrides support a migration that preserves the released colors; OKLCH overrides still pass through the export policy.

Use a flat map of semantic IDs in `src/tokens.jsonc`. Dots are part of each ID, and references are looked up by their complete name:

```jsonc
{
  "surface.editor": { "ref": "palette.gray.900" },
  "text.default": { "ref": "palette.gray.200" },
  "syntax.typeHint": { "ref": "palette.blue.400-muted" },
  "syntax.function": { "ref": "palette.cyan.400" },
  "syntax.property": { "ref": "palette.green.400" },
  "diff.added.foreground": { "ref": "palette.green.400" },
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

1. Parse every JSONC input, allowing comments and trailing commas, and report syntax errors with its file and location. Reject duplicate keys, unknown configuration fields, non-finite numbers, invalid parameter ranges, and generated lightness outside 0–1. Validate chroma and strength as nonnegative, gamut fraction in 0–1, and hue anchors in the range 0–360, excluding 360.
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

1. Agree on the hue anchors, base lightness values, tone numbering, and export policy before changing hex values.
2. Populate a new palette revision from these parameters, preserving v1.3 as the comparison reference. Record targets separately from exported measurements.
3. Map syntax and workbench roles independently. Document each exception with the affected semantic token and its contrast reason.
4. Preview the existing grammar samples with semantic highlighting on and off, then inspect comments, links, buttons, diagnostics, terminal ANSI colors, and text under selection, search, and diff overlays.
5. Check actual foreground/background pairs and review with color vision deficiency simulations. Keep icons, underlines, and labels where color communicates state.
6. If adopting variable-based authoring, implement the proposed build and verify a migration that preserves current colors first. Then apply the reviewed palette through the source files, commit the generated theme, and update release notes.
