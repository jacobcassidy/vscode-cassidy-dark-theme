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

See the [development guide](docs/references/development-guide.md) for project structure, local previewing, validation, packaging, and releases.

See the [color system proposal](docs/plans/color-system-proposal.md) for suggested palette rules, semantic color roles, and contrast checks based on the v1.3 palette.

Edit hue, lightness, and optional `baseChroma` inputs in [`src/production/themes/default/colors/palette.jsonc`](src/production/themes/default/colors/palette.jsonc), then run `npm run build:palette` to generate the [full palette and swatches](docs/palettes/generated-reports/default/palette.md). Edit named color variables and their optional [`details` metadata](docs/references/token-details.md) in [`src/production/themes/default/colors/variables.jsonc`](src/production/themes/default/colors/variables.jsonc), using `color` for a palette/token reference or a documented hex exception and including `alpha` only for opacity below 1. Run `npm run build:theme` to also resolve these variables and rebuild all production themes. Local themes live under `src/local/themes/<name>/`; omitted input files inherit the production default, and `npm run build:dev` generates their previews and palette reports. `npm run dev:sync` builds both groups and refreshes the local preview extension. `npm run check:generated` checks that committed outputs match the source files.
