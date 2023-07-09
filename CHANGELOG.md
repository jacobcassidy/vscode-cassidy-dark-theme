# Changelog - Cassidy Dark Theme

All notable changes to this project are documented in this file.

## v0.2.3

*2023-07-09*

- Updated blue color from `#8cc3fb` to `#89c3ff` for greater contrast from cyan.
- Updated cyan color from `#8fe2e1` back to `#8ee2e2` for a slightly deeper color.
- Updated red color from `#f18a79` to `#f4877f ` for greater contrast from orange.
- Update red deep color from `#ff7f6d` to `#ff7e77` to match red color change.

## v0.2.2

*2023-07-08*

- Moved `meta.attribute.crossorigin entity.other.attribute-name` to theme purple to match HTML link tag's `defer` and `async` attributes.
- Added `variable.other.property.php punctuation.definition.variable.php` to theme green to match other property colors.
- Added `entity.other.inherited-class.php` for extends class and `entity.other.alias.php` use as to theme cyan highlighting.
- Added `meta.parameter-expansion` for zsh to theme gray medium highlighting.
- Added `comment support` and `comment storage.modifier` to match comment color highlighting.
- Tweaked colors to provide slightly better contrast and balance between them...

### Updated Syntax Colors for v0.2.2

| OKLCH VALUES              | v0.2.2 HEX | v0.1.5 HEX | COLORS       |
| ------------------------- | ---------- | ---------- | ------------ |
| `oklch(74% 0.12893 30)`   | `#f18a79`  | `#f48587`  | Red          |
| `oklch(80% 0.1142 70)`    | `#edb068`  | `#ebb077`  | Orange       |
| `oklch(92% 0.06615 90)`   | `#f6e3b3`  | `#f5e3b4`  | Yellow       |
| `oklch(80% 0.1213 140)`   | `#93d185`  | `#9bce90`  | Green        |
| `oklch(86% 0.08074 195)`  | `#8fe2e1`  | `#8ee2e2`  | Cyan         |
| `oklch(80% 0.098898 250)` | `#8cc3fb`  | `#8cc3fc`  | Blue         |
| `oklch(80% 0.1143 305)`   | `#cfabf9`  | `#cdaef2`  | Purple       |
| NO CHANGE                 | `#ffbbcf`  | `#ffbbcf`  | Pink         |
| -                         |            |            |              |
| `oklch(74% 0.15893 30`    | `#ff7f6d`  | `#ef646b`  | Deep Red     |
| `oklch(80% 0.1622 70)`    | `#ffa82a`  | `#e59742`  | Deep Orange  |
| `oklch(92% 0.10215 90)`   | `#ffe294`  | `#d7bb70`  | Deep Yellow  |
| `oklch(80% 0.1891 140)`   | `#74da5d`  | `#7ac06b`  | Deep Green   |
| `oklch(86% 0.1137 195)`   | `#67e8e8`  | `#65d2d2`  | Deep Cyan    |
| NO CHANGE                 | `#0089ea`  | `#0089ea`  | Deep Blue    |
| `oklch(74% 0.1685 305)`   | `#c48cff`  | `#bf94ef`  | Deep Purple  |
| `oklch(80% 0.1245 360)`   | `#ff9bba`  | `#f3a3bb`  | Deep Pink    |


## v0.2.1

*2023-06-07*

- Added `meta.function.method.with-arguments.ruby storage.type` for Ruby's parameter block `&` operator to match punctuation syntax highlighting color.
- Added `meta.element.structure.svg.text.html` for `<svg>` inner text color highlighting with theme yellow to match strings.
- Added `meta.embedded.line.php` for closing bracket `}` punctuation color highlighting  when opening a new PHP tag.
- Added `meta.attribute.srcset.html string` with theme blue to match links.
- Added `meta.attribute.async.html entity.other.attribute-name` for HTML async attribute color highlighting with theme purple.
- Added `meta.attribute.defer.html entity.other.attribute-name` for HTML defer attribute color highlighting with theme purple.
- Removed unneeded `source` from `meta.embedded.block.php source`.


## v0.2.0

*2023-06-01*

- Updated `#missing-pseudo-classes` for correct syntax highlighting when nesting additional pseudo-classes.

## v0.1.9

*2023-05-31*

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

*2023-04-30*

- Updated `editorOverviewRuler` foreground colors.
- Added `comment meta.tag.inline` to comment color.

## v0.1.7

*2023-04-27*

- Added textmate grammar for missing CSS #property-keywords: `auto-fit` using the `support.constant.property-value.css` token.

## v0.1.6

*2023-04-24*

- Updated logo to match v0.1.5 color updates.
- Edited README wording.

## v0.1.5

*2023-04-24*

Two big changes have been added in this update:
1. Syntax colors have been refactored based on the `oklch` format to improve how the colors look together with specific lightness and chroma values (see table below).
2. Missing CSS & SCSS syntax grammar have been added to tokenize elements for color highlighting (see details below).

### 1. Updated Syntax Colors

| OKLCH VALUES         | v0.1.5 HEX | v0.0.3 HEX | COLORS       |
| -------------------- | ---------- | ---------- | ------------ |
| oklch(92% 0.064 90)  | `#f5e3b4`  | `#f8e6b0`  | Yellow       |
| oklch(86% 0.082 195) | `#8ee2e2`  | `#96dfdf`  | Cyan         |
| oklch(86% 0.082 360) | `#ffbbcf`  | `#ffc2d1`  | Pink         |
| oklch(80% 0.1 65)    | `#ebb077`  | `#f3ba81`  | Orange       |
| oklch(80% 0.1 140)   | `#9bce90`  | `#badf96`  | Green        |
| oklch(80% 0.1 250)   | `#8cc3fc`  | `#81baf3`  | Blue         |
| oklch(80% 0.1 305)   | `#cdaef2`  | `#d4b0f8`  | Purple       |
| oklch(74% 0.136 20)  | `#f48587`  | `#f38181`  | Red          |
| -                                                             |
| oklch(80% 0.1 90)    | `#d7bb70`  | `#efc852`  | Deep Yellow  |
| oklch(80% 0.1 195)   | `#65d2d2`  | `#6fd3d3`  | Deep Cyan    |
| oklch(80% 0.1 360)   | `#f3a3bb`  | `#e68fa4`  | Deep Pink    |
| oklch(74% 0.136 65)  | `#e59742`  | `#eb8724`  | Deep Orange  |
| oklch(74% 0.136 140) | `#7ac06b`  | `#96df96`  | Deep Green   |
| oklch(74% 0.136 305) | `#bf94ef`  | `#ba81f3`  | Deep Purple  |
| oklch(68% 0.172 20)  | `#ef646b`  | `#ef5252`  | Deep Red     |
| oklch(62% 0.175 250) | `#0089ea`  | `#2487eb`  | Deep Blue    |

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

*2023-04-18*

- Added `editorRuler.foreground` with theme orange color at 10% opacity to use as warning guides.

## v0.1.3

*2023-04-18*

- Added `entity.name.tag.yaml` to match support name syntax color.

## v0.1.2

*2023-04-10*

- Added `meta.embedded.line` to match punctuation syntax color.

## v0.1.1

*2023-04-07*

- Added `keyword.other.special-method` to cyan color syntax for Ruby loops and other special methods.
- Deleted `support.function.construct` to fall back to `support.function` for syntax colors used for PHP echo, array(), etc to match other support.function instead of keywords color.

## v0.1.0

*2023-04-06*

- Replaced `punctuation.section.embedded` with `punctuation.section.embedded.begin.php` and `punctuation.section.embedded.end.php` so Ruby string interpolation is not colorized incorrectly.

## v0.0.9

*2023-03-19*

- Changed `variable.other.object.property` syntax color from light gray to green to match property color.

*2023-03-14*

- Added `variable.parameter.misc.css` to red color for CSS clamp operators, such as `+`.

## v0.0.7

*2023-03-06*

- Added problems panel icon colors for workbench.
- Added `editorHint` 3-dot underline color for workbench.
- Added `entity.other.attribute-name.namespace` with bright purple for namespaces.
- Added `meta.other.valid-ampersand.markdown` with yellow for headings.
- Added `punctuation.definition.constant.xml` with purple for constants.

## v0.0.6

*2023-03-05*

- Added `galleryBanner` color for VSCode marketplace banner.

## v0.0.5

*2023-03-05*

- Added errors and warnings foreground colors.
- Updated theme screenshot.
- Updated installation instructions in README for marketplace.


## v0.0.4

*2023-03-05*

- Added theme logo.
- Added MIT License.
- Moved development files out of production directory.
- Packaged theme for publishing on Visual Studio Code marketplace.

## v0.0.3

*2023-03-04*

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

*2023-02-27*

Updated theme colors:

| COLOR         | v0.0.1 HSL                | v0.0.1 HEX | v0.0.2 HSL               | v0.0.2 HEX |
| ------------- | ------------------------- | ---------- | ------------------------ | ---------- |
| Red           | `hsla(0, 83%, 70%, 1)`    | `#f27373`  | `hsla(0, 83%, 73%, 1)`   | `#f38181`  |
| Orange        | `hsla(30, 83%, 70%, 1)`   | `#f2b373`  | `hsla(30, 83%, 73%, 1)`  | `#f3ba81`  |
| Orange Bright | `hsla(30, 100%, 70%, 1)`  | `#ffb366`  | `hsla(30, 83%, 53%, 1)`  | `#eb8724`  |
| Yellow        | `hsla(45, 83%, 83%, 1)`   | `#f8e6b0`  |  No Change               |            |
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
