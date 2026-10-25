---
description: Markdown front matter highlighting probe
draft: true
tags: [syntax, highlighting]
---

<!-- markdownlint-disable MD003 MD004 MD025 MD033 MD034 MD035 MD046 MD048 MD049 MD050 -->
<!-- Intentional probes: heading/bullet/emphasis/fence/rule styles, multiple H1s, raw HTML, bare URLs, and indented code. -->

# Markdown token gallery

Inspect this source in VS Code with Cassidy Dark Dev. Preview rendering and extension support vary; the goal is to compare token scopes in the editor.

## ATX heading level two

### ATX heading level three

#### ATX heading level four

##### ATX heading level five

###### ATX heading level six

<!-- prettier-ignore -->
Setext heading level one
========================

<!-- prettier-ignore -->
Setext heading level two
------------------------

## Inline markup

<!-- prettier-ignore -->
Plain text, Unicode café 日本語 🚀, *asterisk emphasis*, **asterisk strong**, and ***combined emphasis***.

<!-- prettier-ignore -->
_Underscore emphasis_, __underscore strong__, ___combined underscores___, **strong with _nested emphasis_**, and ~~strikethrough~~.

Inline `code`, ``code containing `backticks` ``, and `const color = "#92c1fd";`.

Escaped punctuation: \*literal stars\*, \_underscores\_, \`backticks\`, \[brackets\], \# hash, \! exclamation, and \\ backslash.

Entities: &amp; &lt; &gt; &quot; &copy; &nbsp; &#9733; &#x1F680;.

A hard break with a backslash follows here.\
This is the next source line.

## Links and images

[Inline link](https://example.com/path?mode=dark&count=2#tokens "Double-quoted title")

<!-- prettier-ignore -->
[Relative link](./html-grammar-sample.html 'Single-quoted title')

<!-- prettier-ignore -->
[Parenthesized title](https://example.com/ (A parenthesized title))

[Reference link][palette] and [collapsed reference][] and [shortcut reference].

<https://example.com/autolink?mode=dark> and <reader@example.com>.

Bare GFM URL: https://example.com/gallery and email: reader@example.com.

![Inline image alt text](https://example.com/swatch.png "Image title")

![Reference image][swatch]

[![Linked image](https://example.com/badge.svg)](https://example.com/)

[palette]: https://example.com/palette "Palette reference"
[collapsed reference]: https://example.com/collapsed
[shortcut reference]: https://example.com/shortcut
[swatch]: https://example.com/swatch.png "Reference image title"

## Lists and task markers

- Unordered item with **strong** text.
  - Nested item with `inline code`.
    - Third nesting level.
- Another unordered item.

<!-- prettier-ignore -->
* Asterisk bullet probe.
* Second asterisk item.

<!-- prettier-ignore -->
+ Plus bullet probe.
+ Second plus item.

1. Ordered item.
2. Second ordered item.
   1. Nested ordered item.
   2. Another nested item.
3. Item with a continuation paragraph.

   Continuation text with [a link](https://example.com/).

<!-- prettier-ignore -->
- [ ] Unchecked task.
- [x] Checked task.
- [X] Uppercase checked marker.
  - [ ] Nested task.

## Block quotations and rules

> A block quote with _emphasis_ and `code`.
>
> > A nested quotation.
>
> - A quoted list item.
> - Another quoted list item.

> [!NOTE]
> Alert-style text may receive additional scopes from Markdown extensions.

---

<!-- prettier-ignore -->
***

<!-- prettier-ignore -->
___

## Tables

| Left aligned       | Center aligned | Right aligned |
| :----------------- | :------------: | ------------: |
| `keyword`          |   **strong**   |            42 |
| a \| b             |   _emphasis_   |          3.14 |
| [Palette][palette] |  ~~removed~~   |        `null` |

## Code blocks and embedded languages

```html
<article class="card" data-state="ready">Text &amp; entities</article>
```

```css
:root {
  --accent: #92c1fd;
}
.card:hover::before {
  content: "Label";
  color: var(--accent);
}
```

```scss
$accent: #92c1fd;
.card {
  color: $accent;
  &__title {
    font-weight: bold;
  }
}
```

```json
{ "name": "accent", "count": -1.5e2, "enabled": true, "missing": null }
```

```yaml
palette: &palette { accent: "#92c1fd" }
copy: *palette
```

```toml
[theme]
accent = "#92c1fd"
```

```ruby
class Swatch
  def label(name = :accent)
    "Color: #{name}"
  end
end
```

```xml
<?xml version="1.0"?>
<swatch name="accent"><![CDATA[<literal>]]></swatch>
```

```diff
- const color = "#000000";
+ const color = "#92c1fd";
```

<!-- prettier-ignore -->
~~~text
Tilde-fenced plain text: **literal markup** and `literal backticks`.
~~~

````markdown
```javascript
const nestedFence = true;
```
````

    Indented code block
    <tag>literal text</tag>
    const count = 42;

## Raw HTML and extension probes

<!-- An HTML comment with <tags>, "quotes", and TODO text. -->

<details open>
<summary>HTML disclosure</summary>

**Markdown inside an HTML block**, separated with blank lines.

</details>

<div class="sample" data-count="42"><span style="color: #92c1fd">Inline HTML &amp; entities</span></div>

Footnote reference[^token] and another reference[^token].

[^token]: Footnote definition with **markup** and `code`; support depends on the Markdown grammar.

Inline math $x^2 + y^2 = z^2$ and display math (extension-dependent):

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
