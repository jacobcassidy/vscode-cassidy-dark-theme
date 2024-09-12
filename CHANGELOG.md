# Changelog - Cassidy Dark Theme

All notable changes to this project are documented in this file.

## Unreleased

- Full refactor of workbench colors
- Added `missing-scss-comparison-operators.injection`
- Added VSCode workplace `settings.json` file
- Updated `terminal.ansiBrightBlack` to #929292 from #636363.
- Updated semanticTokenColors namespace from purple-deep to purple-base color.

## v1.1.2

_2024-08-30_

- Added note of bug with `editorOverviewRuler.selectionHighlightForeground` setting.
- Updated find match with purple-base color.
- Updated definition highlights with pink-base color.

## v1.1.1

_2024-08-28_

- Added `variable.other.constant.object.js` to purple color.
- Added `keyword.other.phpdoc.php` to gray medium (punctuation) color.
- Added `sideBarStickyScroll.background` to #2e2e2e color.
- Added `terminalOverviewRuler.border` to match terminal background color.
- Updated `editorOverviewRuler.background` to #0000000d (black at 5% opacity).
- Updated `editorOverviewRuler.border` to #0000001a (black at 10% opacity).

## v1.1.0

_2024-08-27_

- Added comments with examples of what specific tokens colorize.
- Added "Output Colorizer" extension syntax highlighting for `code.log support` and `code.log invalid`.
- Added syntax highlighting for the following tokens:
  - `editorStickyScrollHover.background`
  - `keyword.operator.type.annotation.ts`
  - `support.type.primitive.ts`
  - `editorOverviewRuler.selectionHighlightForeground`
  - `editorOverviewRuler.wordHighlightForeground`
  - `editorOverviewRuler.wordHighlightStrongForeground`
  - `editorOverviewRuler.wordHighlightTextForeground`
- Moved Rainbow CSV extension syntax highlighting to its own section.
- Organized order of gray shade tokens.
- Replaced theme screenshot for v1.1.0.
- Updated Readme "Found an Issue?" title to "Issues?".
- Updated red used for diff from red-deep to red-base.
- Updated logo with v1.1.0 colors.
- Updated "-color--blue-base" to "-color--blue-deep" where deep blue is used.
- Updated colors for `textBlockQuote.background` and `textBlockQuote.border`.

## v1.0.9

_2024-08-25_

- Added syntax highlighting for the following tokens:
  - `support.function.builtin.shell`
  - `meta.expression.assignment.modified.shell`
  - `entity.name.section.group-title`
  - `variable.other.assignment.shell`
  - `constant.other.symbol.hashkey.ruby`
  - `constant.other.symbol.ruby`
  - `log.date`
  - `log.error`
  - `log.warning`
  - `meta.jsx.children`
  - `meta.other.type.phpdoc.php`
  - `variable.parameter.url`
- Updated README.md Table of Contents.

## v1.0.8

_2024-08-25_

- Updated `README.md` "Issues" content.

## v1.0.7

_2024-08-25_

- Added `keyword.operator.return-value.php` for PHP return typehint syntax color.
- Updated `textCodeBlock.background` and `textPreformat.background` to `#ffffff1a` (-color--white at 10% opacity).
- Commented out `comment keyword.other.type.php` since it is already covered with `keyword.other.type.php`.

## v1.0.6

_2024-08-23_

- Updated color and gray-scale schemes based on OKLCH for uniformity.
- Updated 'find/match' colors to provide better contrast and kind differentiation.
- Added `textPreformat.background`.
- Added `editorStickyScroll.background`.
- Added PHP type hinting syntax.
- Removed scrollbar border.

## v1.0.5

_2024-06-27_

- Updated `meta.function-call.arguments.python` to theme pink for Python arguments to match variable highlighting

## v1.0.4

_2024-06-26_

- Added `meta.function-call.generic.python` to theme cyan for Python non-defined function calls in docs.
- Added `meta.function-call.arguments.python` to theme orange for Python arguments in non-defined function calls in docs.

## v1.0.3

_2024-03-08_

- Added syntax colors for the [nginx.conf syntax extension by shanoor](https://marketplace.visualstudio.com/items?itemName=shanoor.vscode-nginx).
- Added syntax colors for the [Better Dockerfile Syntax extension by Jeff Hykin](https://marketplace.visualstudio.com/items?itemName=jeff-hykin.better-dockerfile-syntax).

## v1.0.2

_2024-03-07_

- Added `php-class-typehint-syntax.json` file to include syntax customization for a PHP Class typehint using the `keyword.other.type.cassidydark.php` token.
- Added a new theme color at 50% of theme blue chroma for typehint syntax color.
- Added `keyword.other.type.php`, `keyword.operator.nullable-type.php`, `keyword.other.type.cassidydark.php`, `meta.function.php storage.type.php`, and `meta.function.php support.class.php` to typehint syntax color.

## v1.0.1

_2024-03-06_

- Added `comment keyword.operator.nullable-type` for PHPdoc nullable type hint such as ?array.

## v1.0.0

_2024-02-27_

- Jumping to using 1.x.x versioning since the theme is no longer in beta.
- Added `keyword.operator.nullable-type` to theme blue for nullable types using the question mark, such as `?callable` in PHP.

## v0.3.7

_2024-02-26_

- Added syntax highlighting color scheme for Rainbow CSV extension.

## v0.3.6

_2024-02-25_

- Added italic style to `invalid`.
- Added `meta.at-rule support.function` to theme cyan for functions such as `calc` and `var`.
- Added `support.constant.container-name.container.css` to theme orange for `@container` names. (Note: this token is from my [CSS Nesting Syntax Highlighting extension](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.css-nesting-syntax-highlighting).)
- Added `comment keyword` for keywords in PHPdoc comment.
- Added `comment keyword.other.type.php` for types PHPdoc comment.
- Added `comment support.class` for classes in PHPdoc comment.
- Added `meta.function.url string.quoted.double` to theme blue for CSS url() function.
- Added `meta.function.url string.quoted.single` to theme blue for CSS url() function.
- Added `support.constant.boolean.container.css` to theme purple for @container `<style-query>` boolean property-value. (Note: this token is from my [CSS Nesting Syntax Highlighting extension](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.css-nesting-syntax-highlighting).)
- Added `entity.name.type.namespace.php` to theme purple for namespace names.
- Changed `entity.name.type.class` to `entity.name.type` to include other types such as `traits` in PHP.
- Updated `editorLineNumber.foreground` and `editorLineNumber.activeForeground` to a brighter gray color for better contrast in diff view.

## v0.3.5

_2024-02-25_

- Moved `variable.parameter.misc.css` from theme red to theme orange for parameters such as "count" in `property-name: counter(count, decimal);`
- Added `entity.other.attribute-name.parent-selector-suffix.css punctuation` to theme green style for highlighting SCSS &`__name`.
- Added README note announcing the availability of the free [CSS Nesting Syntax Highlighting extension](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.css-nesting-syntax-highlighting) I recently published.
- Removed `meta.at-rule.media.header` from styles (individual items in header are styled instead).

## v0.3.4

_2024-02-11_

- Added `keyword.other.type.php` for parameter and other type casting to theme blue.
- Added `keyword.operator.return-value.php` for function return value type casting colon to theme gray matching punctuation.

## v0.3.3

_2024-02-03_

- Removed missing CSS syntax that is now merged into VSCode.
- Updated ghost text and background syntax colors.

## v0.3.2

_2023-12-23_

- Refactored deprecated VSCode properties.
- Added `string.quoted.double.php punctuation.definition.variable.php` to punctuation's color for the `{}` braces syntax used in string interpolation.
- Added `string.quoted.double.php variable.other.php punctuation.definition.variable.php` to variable's color for the `$` dollar sign used in string interpolation.

## v0.3.1

_2023-10-24_

- Added `string.quoted.single.php` and `string.quoted.double.php` to theme yellow syntax highlighting to override `meta.attribute.src.html string` theme blue.

## v0.3.0

_2023-08-28_

Updated group 2 colors:

| GROUP 1 OKLCH         | v0.3.0 HEX | COLOR         | UPDATED |
| --------------------- | ---------- | ------------- | ------- |
| oklch(74% 0.12 27.5)  | #ed8c81    | RED           | NO      |
| oklch(80% 0.1 65)     | #ebb077    | ORANGE        | NO      |
| oklch(92% 0.06 90)    | #f4e4b8    | YELLOW        | NO      |
| oklch(80% 0.1 140)    | #9bce90    | GREEN         | NO      |
| -                     | -          | -             | -       |
| oklch(74% 0.158 27.5) | #ff7f72    | BRIGHT RED    | NO      |
| oklch(80% 0.1499 65)  | #ffa747    | BRIGHT ORANGE | NO      |
| oklch(92% 0.102 90)   | #ffe294    | BRIGHT YELLOW | NO      |
| oklch(80% 0.15 140)   | #87d576    | BRIGHT GREEN  | YES     |

| GROUP 2 OKLCH           | v0.3.0 HEX | COLOR         | UPDATED |
| ----------------------- | ---------- | ------------- | ------- |
| oklch(86% 0.08 202.5)   | #90e1e8    | CYAN          | YES     |
| oklch(80% 0.1 255)      | #92c1fd    | BLUE          | YES     |
| oklch(80% 0.1 307.5))   | #cfadf0    | PURPLE        | YES     |
| oklch(86% 0.08 360)     | #febccf    | PINK          | NO      |
| -                       | -          | -             | -       |
| oklch(86% 0.13 202.5)   | #49eaf6    | BRIGHT CYAN   | YES     |
| oklch(56% 0.18 255)     | #0a72da    | BRIGHT BLUE   | YES     |
| oklch(80% 0.1308 307.5) | #d4a6ff    | BRIGHT PURPLE | YES     |
| oklch(80% 0.124 360)    | #ff9bba    | BRIGHT PINK   | YES     |

- Updated theme logo with the current color scheme.
- Updated theme screenshot with the current color scheme.

## v0.2.9

_2023-08-027_

- Updated bright green with lower chroma to be more in line with other color's max chromas. From `oklch(80% 0.2575 140)` to `oklch(80% 0.175 140)` (#7bd867).
- Updated theme logo to match the current color scheme.
- Updated theme screenshot to match the updated color scheme.

## v0.2.8

_2023-08-27_

Updated the color scheme with a split into two distinct groups:

- Group 1 contains Hue values between 0 and 180.
- Group 2 contains Hue values between 180 and 360.

| GROUP 1 OKLCH           | v0.2.8 HEX | COLOR         |
| ----------------------- | ---------- | ------------- |
| `oklch(74% 0.12 27.5)`  | `#ed8c81`  | RED           |
| `oklch(80% 0.1 65)`     | `#ebb077`  | ORANGE        |
| `oklch(92% 0.06 90)`    | `#f4e4b8`  | YELLOW        |
| `oklch(80% 0.1 140)`    | `#9bce90`  | GREEN         |
| -                       |            |               |
| `oklch(74% 0.158 27.5)` | `#ff7f72`  | BRIGHT RED    |
| `oklch(80% 0.1499 65)`  | `#ffa747`  | BRIGHT ORANGE |
| `oklch(92% 0.102 90)`   | `#ffe294`  | BRIGHT YELLOW |
| `oklch(80% 0.2575 140)` | `#47e200`  | BRIGHT GREEN  |

| GROUP 2 OKLCH           | v0.2.8 HEX | COLOR         |
| ----------------------- | ---------- | ------------- |
| `oklch(86% 0.08 210)`   | `#91e0ee`  | CYAN          |
| `oklch(80% 0.1 260)`    | `#98bffe`  | BLUE          |
| `oklch(80% 0.1 310)`    | `#d2acee`  | PURPLE        |
| `oklch(86% 0.08 360)`   | `#febccf`  | PINK          |
| -                       |            |               |
| `oklch(86% 0.127 210)`  | `#52e7ff`  | BRIGHT CYAN   |
| `oklch(62% 0.205 260)`  | `#317fff`  | BRIGHT BLUE   |
| `oklch(80% 0.1359 310)` | `#d9a4ff`  | BRIGHT PURPLE |
| `oklch(80% 0.1 360)`    | `#f3a3bb ` | BRIGHT PINK   |

## v0.2.7

_2023-08-27_

- Updated OKLCH chroma on color scheme for better balance. Now Cyan and Green have better contrast between them and Green OKLCH chroma matches other colors.

### Updated Syntax Colors for v0.2.7

| OKLCH VALUES            | v0.2.7 HEX | v0.2.2 HEX | COLORS        |
| ----------------------- | ---------- | ---------- | ------------- |
| `oklch(74% 0.12 20)`    | `#ed8b8b`  | `#f18a79`  | Red           |
| `oklch(80% 0.1 70)`     | `#e7b375`  | `#edb068`  | Orange        |
| `oklch(92% 0.06 95)`    | `#f1e5b8`  | `#f6e3b3`  | Yellow        |
| `oklch(80% 0.1 145)`    | `#95cf96`  | `#93d185`  | Green         |
| `oklch(86% 0.08 210)`   | `#91e0ee`  | `#8fe2e1`  | Cyan          |
| `oklch(80% 0.1 260)`    | `#98bffe`  | `#8cc3fb`  | Blue          |
| `oklch(80% 0.1 310)`    | `#d2acee`  | `#cfabf9`  | Purple        |
| `oklch(86% 0.08 360)`   | `#febccf`  | `#ffbbcf`  | Pink          |
| -                       |            |            |               |
| `oklch(74% 0.1587 20)`  | `#ff7d80`  | `#ff7f6d`  | Bright Red    |
| `oklch(80% 0.1622 70)`  | `#ffa82a`  | `#ffa82a`  | Bright Orange |
| `oklch(92% 0.1269 95)`  | `#ffe47d`  | `#ffe294`  | Bright Yellow |
| `oklch(80% 0.2516 145)` | `#00e541`  | `#74da5d`  | Bright Green  |
| `oklch(86% 0.127 210)`  | `#52e7ff`  | `#67e8e8`  | Bright Cyan   |
| `oklch(62% 0.205 260)`  | `#317fff`  | `#0089ea`  | Bright Blue   |
| `oklch(80% 0.1359 310)` | `#d9a4ff`  | `#c48cff`  | Bright Purple |
| `oklch(86% 0.081 360)`  | `#ffbbcf`  | `#ff9bba`  | Bright Pink   |

## v0.2.6

_2023-08-26_

- Added `auto-fill` syntax highlight grammar for CSS `repeat()` function.
- Removed `variable.parameter.url.scss` to keep syntax highlighting consistent with CSS.
- Removed `missing-pseudo-classes` from grammar additions since the syntax is now merged into the official microsoft/vscode-css repo.

## v0.2.5

_2023-08-23_

- Updated bright green color from `#74da5d` to `#73da5b` to be half way from max chroma and normal green color.
- Updated yellow deep from `#ffe294` to `#eece74` for greater contrast between yellow and orange colors. Which makes it minus 0.0600 below max chroma of `oklch(86% 0.17574 90)`.
- Added GhostText workbench syntax highlighting for GitHub Copilot suggestions.

## v0.2.4

_2023-07-16_

- Updated green color from `#93d185` to `#91d283` to bring chroma to minus 0.1320 from max OKLCH chroma.
- Reverted cyan color back to `#8fe2e1` for chroma match.

## v0.2.3

_2023-07-09_

- Updated blue color from `#8cc3fb` to `#89c3ff` for greater contrast from cyan.
- Updated cyan color from `#8fe2e1` back to `#8ee2e2` for a slightly deeper color.
- Updated red color from `#f18a79` to `#f4877f ` for greater contrast from orange.
- Updated red deep color from `#ff7f6d` to `#ff7e77` to match red color change.

## v0.2.2

_2023-07-08_

- Moved `meta.attribute.crossorigin entity.other.attribute-name` to theme purple to match HTML link tag's `defer` and `async` attributes.
- Added `variable.other.property.php punctuation.definition.variable.php` to theme green to match other property colors.
- Added `entity.other.inherited-class.php` for extends class and `entity.other.alias.php` use as to theme cyan highlighting.
- Added `meta.parameter-expansion` for zsh to theme gray medium highlighting.
- Added `comment support` and `comment storage.modifier` to match comment color highlighting.
- Tweaked colors to provide slightly better contrast and balance between them...

### Updated Syntax Colors for v0.2.2

| OKLCH VALUES              | v0.2.2 HEX | v0.1.5 HEX | COLORS      |
| ------------------------- | ---------- | ---------- | ----------- |
| `oklch(74% 0.12893 30)`   | `#f18a79`  | `#f48587`  | Red         |
| `oklch(80% 0.1142 70)`    | `#edb068`  | `#ebb077`  | Orange      |
| `oklch(92% 0.06615 90)`   | `#f6e3b3`  | `#f5e3b4`  | Yellow      |
| `oklch(80% 0.1213 140)`   | `#93d185`  | `#9bce90`  | Green       |
| `oklch(86% 0.08074 195)`  | `#8fe2e1`  | `#8ee2e2`  | Cyan        |
| `oklch(80% 0.098898 250)` | `#8cc3fb`  | `#8cc3fc`  | Blue        |
| `oklch(80% 0.1143 305)`   | `#cfabf9`  | `#cdaef2`  | Purple      |
| NO CHANGE                 | `#ffbbcf`  | `#ffbbcf`  | Pink        |
| -                         |            |            |             |
| `oklch(74% 0.15893 30`    | `#ff7f6d`  | `#ef646b`  | Deep Red    |
| `oklch(80% 0.1622 70)`    | `#ffa82a`  | `#e59742`  | Deep Orange |
| `oklch(92% 0.10215 90)`   | `#ffe294`  | `#d7bb70`  | Deep Yellow |
| `oklch(80% 0.1891 140)`   | `#74da5d`  | `#7ac06b`  | Deep Green  |
| `oklch(86% 0.1137 195)`   | `#67e8e8`  | `#65d2d2`  | Deep Cyan   |
| NO CHANGE                 | `#0089ea`  | `#0089ea`  | Deep Blue   |
| `oklch(74% 0.1685 305)`   | `#c48cff`  | `#bf94ef`  | Deep Purple |
| `oklch(80% 0.1245 360)`   | `#ff9bba`  | `#f3a3bb`  | Deep Pink   |

## v0.2.1

_2023-06-07_

- Added `meta.function.method.with-arguments.ruby storage.type` for Ruby's parameter block `&` operator to match punctuation syntax highlighting color.
- Added `meta.element.structure.svg.text.html` for `<svg>` inner text color highlighting with theme yellow to match strings.
- Added `meta.embedded.line.php` for closing bracket `}` punctuation color highlighting when opening a new PHP tag.
- Added `meta.attribute.srcset.html string` with theme blue to match links.
- Added `meta.attribute.async.html entity.other.attribute-name` for HTML async attribute color highlighting with theme purple.
- Added `meta.attribute.defer.html entity.other.attribute-name` for HTML defer attribute color highlighting with theme purple.
- Removed unneeded `source` from `meta.embedded.block.php source`.

## v0.2.0

_2023-06-01_

- Updated `#missing-pseudo-classes` for correct syntax highlighting when nesting additional pseudo-classes.

## v0.1.9

_2023-05-31_

- Added `support.function.basic_functions` to base function color for PHP.
- Added strikethrough and punctuation color to `markup.strikethrough.markdown`.
- Updated `entity.other.keyframe-offset` without postfix `.percentage` to apply to more CSS styles.
- Flipped green and bright green colors for terminal.
- Added `meta.function.calc.css` for parentheses color when nesting in calc function.
- Added `meta.embedded.block.php source` for else colon when using alternative syntax.
- Added `meta.attribute.unrecognized.xmlns.html string` to theme blue for link.
- Added `meta.attribute.unrecognized.xmlns:xlink.html string` to theme blue for link.
- Added `entity.name.goto-label.php` to theme red for 'else' keyword when using alternative syntax.
- Added syntax color highlighting for apacheconf when using Apache Conf extension:
  - Added `entity.helper.apacheconf` to theme white.
  - Added `string.path.apacheconf` to theme blue.
  - Added `entity.tag.apacheconf` to theme cyan.
  - Added `entity.mime-type.apacheconf` to theme green.
  - Added `string.replacement.apacheconf` to theme orange.
  - Added `entity.status.apacheconf` to theme purple.

## v0.1.8

_2023-04-30_

- Updated `editorOverviewRuler` foreground colors.
- Added `comment meta.tag.inline` to comment color.

## v0.1.7

_2023-04-27_

- Added textmate grammar for missing CSS #property-keywords: `auto-fit` using the `support.constant.property-value.css` token.

## v0.1.6

_2023-04-24_

- Updated logo to match v0.1.5 color updates.
- Edited README wording.

## v0.1.5

_2023-04-24_

Two big changes have been added in this update:

1. Syntax colors have been refactored based on the `oklch` format to improve how the colors look together with specific lightness and chroma values (see table below).
2. Missing CSS & SCSS syntax grammar have been added to tokenize elements for color highlighting (see details below).

### 1. Updated Syntax Colors

| OKLCH VALUES         | v0.1.5 HEX | v0.0.3 HEX | COLORS      |
| -------------------- | ---------- | ---------- | ----------- |
| oklch(92% 0.064 90)  | `#f5e3b4`  | `#f8e6b0`  | Yellow      |
| oklch(86% 0.082 195) | `#8ee2e2`  | `#96dfdf`  | Cyan        |
| oklch(86% 0.082 360) | `#ffbbcf`  | `#ffc2d1`  | Pink        |
| oklch(80% 0.1 65)    | `#ebb077`  | `#f3ba81`  | Orange      |
| oklch(80% 0.1 140)   | `#9bce90`  | `#badf96`  | Green       |
| oklch(80% 0.1 250)   | `#8cc3fc`  | `#81baf3`  | Blue        |
| oklch(80% 0.1 305)   | `#cdaef2`  | `#d4b0f8`  | Purple      |
| oklch(74% 0.136 20)  | `#f48587`  | `#f38181`  | Red         |
| -                    |
| oklch(80% 0.1 90)    | `#d7bb70`  | `#efc852`  | Deep Yellow |
| oklch(80% 0.1 195)   | `#65d2d2`  | `#6fd3d3`  | Deep Cyan   |
| oklch(80% 0.1 360)   | `#f3a3bb`  | `#e68fa4`  | Deep Pink   |
| oklch(74% 0.136 65)  | `#e59742`  | `#eb8724`  | Deep Orange |
| oklch(74% 0.136 140) | `#7ac06b`  | `#96df96`  | Deep Green  |
| oklch(74% 0.136 305) | `#bf94ef`  | `#ba81f3`  | Deep Purple |
| oklch(68% 0.172 20)  | `#ef646b`  | `#ef5252`  | Deep Red    |
| oklch(62% 0.175 250) | `#0089ea`  | `#2487eb`  | Deep Blue   |

### 2. Added Missing CSS & SCSS Syntax Grammar for VSCode

For both CSS & SCSS:

- `:is()` and `:where()` pseudo classes are now tokenized using `entity.other.attribute-name.pseudo-class.css`. This matches other pseudo classes that are already defined in VSCode such as `:not()` and `:has()`.

For SCSS only:

- `,` commas are now tokenized using `punctuation.separator.list.comma.scss`.
- `>>`, `>`, `+`, `~` keyword operator combinator are now tokenized using `keyword.operator.combinator.scss`.
- `content`, `cursor`, `filter`, `font`, and `mask` property names are now tokenized using `support.type.property-name.scss`. This matches other property names already defined in VSCode.

### 3. Other Updates in v0.1.5

- Replaced theme screenshot to show new syntax highlighting.
- Added additional regex tokens to purple syntax highlighting
- Changed Markdown heading syntax highlighting from yellow to green
- Added green syntax highlighting to heading hash `#`.
- Added `meta.attribute.src.html string` to blue syntax highlighting.
- Fixed opacity for `editorRuler.foreground`.
- Renamed `Bright` to `Deep` for secondary colors.
- Added `meta.function.parameters.php` to orange syntax highlighting to match global parameter color.
- Updated `diffEditorGutter` opacity to match `diffEditor`.

## v0.1.4

_2023-04-18_

- Added `editorRuler.foreground` with theme orange color at 10% opacity to use as warning guides.

## v0.1.3

_2023-04-18_

- Added `entity.name.tag.yaml` to match support name syntax color.

## v0.1.2

_2023-04-10_

- Added `meta.embedded.line` to match punctuation syntax color.

## v0.1.1

_2023-04-07_

- Added `keyword.other.special-method` to cyan color syntax for Ruby loops and other special methods.
- Deleted `support.function.construct` to fall back to `support.function` for syntax colors used for PHP echo, array(), etc to match other support.function instead of keywords color.

## v0.1.0

_2023-04-06_

- Replaced `punctuation.section.embedded` with `punctuation.section.embedded.begin.php` and `punctuation.section.embedded.end.php` so Ruby string interpolation is not colorized incorrectly.

## v0.0.9

_2023-03-19_

- Changed `variable.other.object.property` syntax color from light gray to green to match property color.

_2023-03-14_

- Added `variable.parameter.misc.css` to red color for CSS clamp operators, such as `+`.

## v0.0.7

_2023-03-06_

- Added problems panel icon colors for workbench.
- Added `editorHint` 3-dot underline color for workbench.
- Added `entity.other.attribute-name.namespace` with bright purple for namespaces.
- Added `meta.other.valid-ampersand.markdown` with yellow for headings.
- Added `punctuation.definition.constant.xml` with purple for constants.

## v0.0.6

_2023-03-05_

- Added `galleryBanner` color for VSCode marketplace banner.

## v0.0.5

_2023-03-05_

- Added errors and warnings foreground colors.
- Updated theme screenshot.
- Updated installation instructions in README for marketplace.

## v0.0.4

_2023-03-05_

- Added theme logo.
- Added MIT License.
- Moved development files out of production directory.
- Packaged theme for publishing on Visual Studio Code marketplace.

## v0.0.3

_2023-03-04_

- Corrected cyan color from `#97dddd` to `#96dfdf` to match `hsla(180, 53%, 73%, 1)`.
- Corrected green color from `#b3d98c` to `#badf96` to match `hsla(90, 53%, 73%, 1)`.
- Updated and added additional theme bright colors:

| COLOR         | v0.0.2 HSL                | v0.0.2 HEX | v0.0.3 HSL               | v0.0.3 HEX |
| ------------- | ------------------------- | ---------- | ------------------------ | ---------- |
| Red           | `hsla(0, 83%, 73%, 1)`    | `#f38181`  | No Change                |            |
| Red Bright    | `hsla(0, 100%, 70%, 1)`   | `#ff6666`  | `hsla(0, 83%, 63%, 1)`   | `#ef5252`  |
| Orange        | `hsla(30, 83%, 73%, 1)`   | `#f3ba81`  | No Change                |            |
| Orange Bright | `hsla(30, 83%, 53%, 1)`   | `#eb8724`  | No Change                |            |
| Yellow        | `hsla(45, 83%, 83%, 1)`   | `#f8e6b0`  | No Change                |            |
| Yellow Bright | `hsla(45, 83%, 73%, 1)`   | `#f3d781`  | `hsla(45, 83%, 63%, 1)`  | `#efc852`  |
| Green         | `hsla(90, 53%, 73%, 1)`   | `#badf96`  | No Change                |            |
| Green Bright  | `hsla(120, 53%, 73%, 1)`  | `#96df96`  | No Change                |            |
| Cyan          | `hsla(180, 53%, 73%, 1)`  | `#96dfdf`  | No Change                |            |
| Cyan Bright   | `hsla(180, 100%, 70%, 1)` | `#66ffff`  | `hsla(180, 53%, 63%, 1)` | `#6fd3d3`  |
| Blue          | `hsla(210, 83%, 73%, 1)`  | `#81baf3`  | No Change                |            |
| Blue Bright   | `hsla(210, 83%, 53%, 1)`  | `#2487eb`  | No Change                |            |
| Purple        | `hsla(270, 83%, 83%, 1)`  | `#d4b0f8`  | No Change                |            |
| Purple Bright | -                         | -          | `hsla(270, 83%, 73%, 1)` | `#ba81f3`  |
| Pink          | `hsla(345, 63%, 83%, 1)`  | `#ffc2d1`  | No Change                |            |
| Pink Bright   | -                         | -          | `hsla(345, 63%, 73%, 1)` | `#e68fa4`  |

## v0.0.2

_2023-02-27_

Updated theme colors:

| COLOR         | v0.0.1 HSL                | v0.0.1 HEX | v0.0.2 HSL               | v0.0.2 HEX |
| ------------- | ------------------------- | ---------- | ------------------------ | ---------- |
| Red           | `hsla(0, 83%, 70%, 1)`    | `#f27373`  | `hsla(0, 83%, 73%, 1)`   | `#f38181`  |
| Orange        | `hsla(30, 83%, 70%, 1)`   | `#f2b373`  | `hsla(30, 83%, 73%, 1)`  | `#f3ba81`  |
| Orange Bright | `hsla(30, 100%, 70%, 1)`  | `#ffb366`  | `hsla(30, 83%, 53%, 1)`  | `#eb8724`  |
| Yellow        | `hsla(45, 83%, 83%, 1)`   | `#f8e6b0`  | No Change                |            |
| Yellow Gold   | `hsla(45, 83%, 70%, 1)`   | `#f2d273`  | `hsla(45, 83%, 73%, 1)`  | `#f3d781`  |
| Green         | `hsla(80, 50%, 70%, 1)`   | `#b3d98c`  | `hsla(90, 53%, 73%, 1)`  | `#badf96`  |
| Green Bright  | `hsla(120, 50%, 70%, 1)`  | `#8cd98c`  | `hsla(120, 53%, 73%, 1)` | `#96df96`  |
| Cyan          | `hsla(180, 50%, 70%, 1)`  | `#8cd9d9`  | `hsla(180, 53%, 73%, 1)` | `#97dddd`  |
| Blue          | `hsla(210, 83%, 70%, 1)`  | `#73b2f2`  | `hsla(210, 83%, 73%, 1)` | `#81baf3`  |
| Blue Bright   | `hsla(210, 83%, 50%, 1)`  | `#167fe9`  | `hsla(210, 83%, 53%, 1)` | `#2487eb`  |
| Purple        | `hsla(270, 100%, 83%, 1)` | `#d4a8ff`  | `hsla(270, 83%, 83%, 1)` | `#d4b0f8`  |
| Pink          | `hsla(345, 100%, 88%, 1)` | `#ffc2d1`  | `hsla(345, 63%, 83%, 1)` | `#efb8c6`  |

## v0.0.1

- Added starter syntax and workbench theme colors.
