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

Run `npm run refresh` to refresh shared token descriptions, `npm run fill -- prod/default dev/test` to fill missing theme properties and documentation, or `npm run create -- dev/my-theme` to create a theme.

The [development guide](dev/docs/guides/development-guide.md) covers paired family inputs, palettes, shared categorized token data, generators, explicit upstream description updates, validation, [visual language samples](dev/samples/grammar/), packaging, and release/recovery workflows. `npm run check` validates generated artifacts, documentation, executable reachability, formatting, lint, themes, and recursive behavioral suites.

`npm run check:visual` compares the published theme in a pinned Linux VS Code container, locally and in Ubuntu CI. Docker is required; update baselines explicitly with `npm run check:visual -- --update`.

Shared data lives in [`src/data/tokens/`](src/data/tokens/); authored themes live in [`src/themes/`](src/themes/). Development documentation, samples, scripts, tests, tooling, generated previews, snapshots, and local VSIX packages live in [`dev/`](dev/). Theme builds and watch synchronize preview setup automatically. After updating from an earlier layout, remove the installed preview extension's `preview` symlink only after confirming it points to this checkout's old `preview/` directory, then rebuild to create the new link.
