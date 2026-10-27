# Cassidy Dark Theme

[![Star on GitHub](https://img.shields.io/badge/GitHub-Star-blue?logo=github&logoColor=white)](https://github.com/jacobcassidy/vscode-cassidy-dark-theme) [![Install from VS Code Marketplace](https://img.shields.io/badge/VS_Code_Marketplace-Install-007ACC)](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.cassidy-dark)

Cassidy Dark is a clean, modern Visual Studio Code theme initially inspired by the Monokai color palette.

The theme was designed with pure shades of gray for the workbench, so the syntax color highlighting pops with no bias towards any single color.

![Cassidy Dark theme screenshot](https://raw.githubusercontent.com/jacobcassidy/vscode-cassidy-dark-theme/main/images/cassidy-dark-theme-screenshot.png)

## Installation

Search for _Cassidy Dark Theme_ in the Visual Studio Code's Extensions Marketplace or click the install button on the [Cassidy Dark Theme Marketplace page](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.cassidy-dark).

You can also manually install the theme by cloning the [github repository](https://github.com/jacobcassidy/vscode-cassidy-dark-theme) into `~/.vscode/extensions` and restarting the VSCode editor.

## What's New?

View the [Changelog](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/blob/main/CHANGELOG.md) to see the latest changes to the Cassidy Dark theme.

## Issues?

If you come across any issues, please feel free to [report them here](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/issues). You can also [create a pull request](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/pulls) to add any improvements.

## Development

See the [development guide](docs/guides/development-guide.md) for project structure, dev previewing, validation, packaging, and releases.

Use the [syntax samples](docs/guides/development-guide.md#syntax-samples) in `docs/grammar-samples/` to inspect highlighting across programming, markup, stylesheet, configuration, and log formats.

See the [color system proposal](docs/guides/color-system-proposal.md) for suggested palette rules, semantic color roles, and contrast checks based on the v1.3 palette.

Edit palette anchors in [`palette/palette-config.jsonc`](src/themes/prod/default/palette/palette-config.jsonc), then run `npm run build:palette` to generate the [palette report and swatches](src/themes/prod/default/palette/generated/palette.md). Edit consolidated base, UI, semantic, and syntax definitions in [`tokens/`](src/themes/prod/default/tokens/) and their separate documentation in [`details/`](src/themes/prod/default/details/). Literal colors and palette overrides require `colorReason`. Explicitly disabled entries appear as explained comments in generated themes. See [tokens and details](docs/guides/token-details.md) for aliases, formatting, and disabled entries.

Run `npm run build:prod` to rebuild prod themes. Dev themes live under `src/themes/dev/<name>/`; each theme requires a `palette/palette-config.jsonc`, using `{ "useDefaultPalette": true }` to select the default palette or complete settings to generate its own. Omitted metadata, token, and details files independently inherit the prod default. `npm run build:dev` generates their previews and either palette reports or a `palette/default-palette.txt` note. Builds remove `palette/generated/` when using the default palette, then recreate it and remove the note when custom palette generation is enabled. `npm run build` builds both groups, `npm run sync` also refreshes the preview extension, and `npm run check:generated` checks committed outputs against the sources.

Run `npm run add:theme -- dev/my-theme` or `npm run add:theme -- prod/my-theme` to create a theme with five source files: a palette config containing only `"useDefaultPalette": true`, UI and semantic token files populated through `add:properties`, and two empty matching details files that suppress documentation fallback. Metadata, base tokens, syntax rules, and their details inherit the default theme. Every reference UI and semantic property starts with the `#0ff` placeholder and an `UNREVIEWED` color reason. Existing names and destinations are rejected; failed setup removes the new theme directory. The command prints the next build command without building or syncing. See [theme setup](docs/guides/development-guide.md#editing-theme-inputs).

Run `npm run watch` to build prod and dev themes, sync the dev preview extension, and rebuild automatically as you save theme sources. Reload VS Code after initial setup, select a **Cassidy Dark Preview** theme, and leave the command running while editing. See the [watch guide](docs/guides/development-guide.md#watch-theme-changes) for registration changes and shutdown behavior.

Run `npm run add:properties -- dev/my-theme` to fill missing UI and semantic entries for explicit targets from [`all-theme-properties.json`](docs/references/all-theme-properties.json). Multiple `prod/name` or `dev/name` targets are accepted. With no arguments, `includedThemes` in [`scripts/themes/add-properties.js`](scripts/themes/add-properties.js) selects the targets; it initially includes `prod/default` and `dev/test`. New entries are inserted alphabetically using case-sensitive lexical ordering and receive `color: "#0ff"` with an `UNREVIEWED` color reason. Existing entries, disabled states, and comments are preserved. If a token file is inherited, additions create a local copy of its effective contents; unchanged inherited files remain omitted. Search for `UNREVIEWED`, replace each placeholder with an intentional color and reason, then run `npm run build` or `npm run sync` to refresh generated themes. Repeated runs leave existing properties untouched.

When `prod/default` is selected, the command also fills matching `details/*.jsonc` entries for every base role, UI property, semantic selector, and syntax rule, including disabled tokens and newly added placeholders. It uses the offline [property purpose catalog](docs/references/theme-property-details.jsonc), derives base and syntax descriptions from their definitions, and marks unknown UI or semantic purposes `UNREVIEWED`. Missing syntax IDs are assigned once from rule names, with numeric suffixes to avoid collisions. Existing IDs, descriptions, relationships, and rule order are preserved. Default-theme builds require a nonempty `for` description for every entry and an ID on every syntax rule; other themes may still omit documentation.
