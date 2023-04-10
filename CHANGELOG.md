# Changelog - Cassidy Dark Theme

All notable changes to this project will be documented in this file.

## v0.1.2

- Added `meta.embedded.line` to match punctuation syntax color.

## v0.1.1

*2023-04-07*

- Added `keyword.other.special-method` to cyan color syntax for Ruby loops and other special methods
- Deleted `support.function.construct` to fall back to `support.function` for syntax colors used for PHP echo, array(), etc to match other support.function instead of keywords color.

## v0.1.0

*2023-04-06*

- Replaced `punctuation.section.embedded` with `punctuation.section.embedded.begin.php` and `punctuation.section.embedded.end.php` so Ruby string interpolation is not colorized incorrectly.

## v0.0.9

*2023-03-19*

- Changed "variable.other.object.property" syntax color from light gray to green to match property color.

*2023-03-14*

- Added variable.parameter.misc.css to red color for CSS clamp operators, such as +

## v0.0.7

*2023-03-06*

- Added problems panel icon colors for workbench
- Added editorHint 3 dot underline color for workbench
- Added "entity.other.attribute-name.namespace" with bright purple for namespaces
- Added "meta.other.valid-ampersand.markdown" with yellow for headings
- Added "punctuation.definition.constant.xml" with purple for constants

## v0.0.6

*2023-03-05*

- Added galleryBanner color for VSCode marketplace banner

## v0.0.5

*2023-03-05*

- Added errors and warnings foreground colors
- Updated theme screenshot
- Updated installation instructions in README for marketplace


## v0.0.4

*2023-03-05*

- Added theme logo
- Added MIT License
- Moved development files out of production directory
- Packaged theme for publishing on Visual Studio Code marketplace

## v0.0.3

*2023-03-04*

- Corrected cyan color from `#97dddd` to `#96dfdf` to match `hsla(180, 53%, 73%, 1)`
- Corrected green color from `#b3d98c` to `#badf96` to match `hsla(90, 53%, 73%, 1)`
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

- Updated theme colors:

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

- Added starter syntax and workbench theme colors
