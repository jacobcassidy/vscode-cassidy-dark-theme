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

See the [color system proposal](docs/references/generated/color-system-proposal.md) for suggested palette rules, semantic color roles, and contrast checks based on the v1.3 palette.

Edit hue, lightness, and optional `baseChroma` inputs in [`src/themes/prod/default/colors/palette.jsonc`](src/themes/prod/default/colors/palette.jsonc), then run `npm run build:palette` to generate the [full palette and swatches](src/themes/prod/default/colors/generated-palette/palette.md). Edit named color variables and their optional [`details` metadata](docs/references/generated/token-details.md) in [`src/themes/prod/default/colors/variables.jsonc`](src/themes/prod/default/colors/variables.jsonc), using `color` for a palette/token reference or a documented hex exception and including `alpha` only for opacity below 1. Run `npm run build:prod` to also resolve these variables and rebuild all prod themes. Dev themes live under `src/themes/dev/<name>/`; omitted input files inherit the prod default, and `npm run build:dev` generates their previews and palette reports. `npm run build` builds both prod and dev themes. `npm run dev:sync` runs that combined build and refreshes the dev preview extension. `npm run check:generated` checks that committed outputs match the source files.

Run `npm run watch` to build prod and dev themes, sync the dev preview extension, and rebuild automatically as you save theme sources. Reload VS Code after initial setup, select a **Cassidy Dark Dev** theme, and leave the command running while editing. See the [watch guide](docs/guides/development-guide.md#watch-theme-changes) for registration changes and shutdown behavior.
