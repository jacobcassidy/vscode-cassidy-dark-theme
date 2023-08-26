# Cassidy Dark Theme

![Cassidy Dark theme screenshot](https://raw.githubusercontent.com/jacobcassidy/vscode-cassidy-dark-theme/main/images/cassidy-dark-theme-screenshot.png)

Cassidy Dark is a clean, modern Visual Studio Code theme originally inspired by the Monokai color palette.

The theme was designed with pure shades of gray for the workbench so the syntax color highlighting pops with no bias towards any single color.

## Includes Missing CSS & SCSS Syntax Highlighting Grammar

Since VSCode does not often update syntax grammar, the Cassidy Dark theme updates the CSS and SCSS grammar to include syntax highlighting for modern features. When possible, these updates will be pushed and merged into the official VSCode CSS grammar repo and then removed from here.

**Added tokens:**
- `,` comma token for SCSS.
- `>>`, `>`, `+`, `~` keyword operator combinator tokens for SCSS.
- `content`, `cursor`, `filter`, `font`, and `mask` property names tokens for SCSS.
- `auto-fit` and `auto-fill` property value token for the CSS `repeat()` function. _(Currently being merged into the official grammar.)_

**Removed tokens:**
- `:is()` and `:where()` tokens are now merged into the official [vscode-css repo](https://github.com/microsoft/vscode-css).


## Installation

Search for `Cassidy Dark Theme` in the Visual Studio Code's Extensions Marketplace or click the install button on the [Cassidy Dark Theme Marketplace page](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.cassidy-dark).

You can also manually install the theme by cloning the [github repository](https://github.com/jacobcassidy/vscode-cassidy-dark-theme) into `~/.vscode/extensions` and restarting the VSCode editor.

## What's New?

View the [Changelog](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/blob/main/CHANGELOG.md)

## Issues?

If you come across any issues, please feel free to report them [here](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/issues).
