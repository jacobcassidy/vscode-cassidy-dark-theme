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

Use Node.js 24 and `npm ci`, then run `npm run build` and `npm run watch`. Reload VS Code after initial setup and select a **Cassidy Dark Preview** theme. Ordinary color edits load live; registration/setup changes print a reload reminder.

The [development guide](docs/guides/development-guide.md) covers paired family inputs, palettes, shared categorized token data, generators, explicit upstream description updates, validation, [visual language samples](samples/grammar/), packaging, and release/recovery workflows. `npm run check` validates generated artifacts, documentation, legacy consumers, formatting, lint, themes, and recursive behavioral suites.

Shared data lives in [`src/token-data/`](src/token-data/); authored themes live in [`src/themes/`](src/themes/). Generated previews and preserved snapshots live in [`preview/`](preview/). Use `npm run sync:preview` to retry preview setup without recompiling themes.
