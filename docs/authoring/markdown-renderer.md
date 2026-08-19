# Markdown Renderer Reference

The `explainer`, `description`, and `syntax` fields are rendered by the shared `MarkdownRenderer` (`src/shared/markdown.jsx`).

---

## Headings

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
```

`h5` and `h6` are not supported.

---

## Paragraphs and Line Breaks

Plain text becomes a paragraph. A single line break in the source becomes a `<br>` (remark-breaks is active), so each new line starts a new visual line without needing a blank line.

---

## Bold and Italic

```
**bold text**
*italic text*
```

Bold text renders in the brand primary colour.

---

## Inline Code

A bare backtick span renders in lavender-tinted monospace.

**Language-prefixed inline code** triggers syntax highlighting:

| Prefix | Example | Effect |
|---|---|---|
| `python:` | `` `python:print("hi")` `` | Syntax-highlighted Python |
| `html:` | `` `html:<h1>Title</h1>` `` | Syntax-highlighted HTML |
| `css:` | `` `css:color: red;` `` | Syntax-highlighted CSS |
| `js:` | `` `js:console.log(x)` `` | Syntax-highlighted JavaScript |
| `scratch:` | `` `scratch:move (10) steps` `` | Coloured Scratch block pill |

Inline code does not auto-detect Scratch blocks by pattern — use the explicit `scratch:` prefix. Pattern-based auto-detection (no prefix needed) only applies to **fenced** code blocks with no language tag; see below.

---

## Fenced Code Blocks

````
```python
for i in range(5):
    print(i)
```
````

| Language tag | Effect |
|---|---|
| `python` | Syntax-highlighted Python |
| `html` | Syntax-highlighted HTML |
| `css` | Syntax-highlighted CSS |
| `javascript` | Syntax-highlighted JavaScript |
| `scratch` | Stacked Scratch block visual |
| *(none)* | Auto-renders as Scratch if all non-empty lines match patterns; otherwise plain monospace |

A fence opening directly under a paragraph line, with **no blank line** in between, still renders as its own code block and correctly interrupts the paragraph — this is standard CommonMark fenced-code-block-interrupts-paragraph behaviour, honoured by default by the renderer's `remark-parse`/micromark pipeline. No blank line is required before a fence.

---

## Scratch Blocks (fenced)

For the complete canonical list of block text, including every accepted shape and alias, see [Scratch Markdown Block Reference](scratch-markdown-blocks.md).

The `scratch` fenced block renders each non-empty line as a coloured Scratch block. Indent with two spaces per level to place blocks inside C-block mouths. Use `else` for the second mouth of an if/else block, and `end` to close the current mouth without rendering an extra block.

````
```scratch
when green flag clicked
repeat (10)
  move (10) steps
  turn (15) degrees
end
```
````

**Block colours:**

| Colour | Category | Example blocks |
|---|---|---|
| Orange `#FFAB19` | Events | `when green flag clicked`, `when [space] key pressed`, `broadcast [message]` |
| Orange `#FFAB19` | Control | `repeat (10)`, `forever`, `if <> then`, `wait (1) seconds`, `stop all` |
| Blue `#4C97FF` | Motion | `move (10) steps`, `turn (15) degrees`, `go to x: (0) y: (0)` |
| Purple `#9966FF` | Looks | `say [Hello!] for (2) seconds`, `think [Hmm]`, `show`, `hide`, `set size to (100)%` |
| Mauve `#CF63CF` | Sound | `play sound [meow]`, `stop all sounds` |
| Light blue `#5CB1D6` | Sensing | `ask [What is your name?] and wait`, `answer`, `key [space] pressed?` |
| Green `#59C059` | Operators | `join [hello] [world]`, expressions with `+`, `-`, `=`, `<`, `>`, `and`, `or` |
| Amber `#FF8C1A` | Variables | `set [score] to (0)`, `change [score] by (1)` |
| Grey `#7c7c7c` | Unknown | Any unrecognised block text |

Scratch block bodies are drawn with SVG paths for Blockly-like geometry. Hat blocks (`when ...`) have rounded tops. Stack blocks have top notch cut-outs and bottom connector tabs, and connected blocks sit tightly together. Cap blocks have rounded bottoms and no bottom connector. Reporter blocks render as ovals, Boolean blocks render as hexagons, and C-blocks draw a continuous shape with one or two transparent statement mouths.

**Value pills inside block text:**
- Numbers and quoted strings -> white pill with dark text
- `(input)` spans -> white rounded input bubble with dark text
- `[dropdown]` spans -> darker coloured dropdown field with a small arrow
- `<condition>` spans -> Boolean-shaped slot; recognised Boolean blocks render as nested hexagonal blocks

**Scratch block system:**

The renderer is backed by `src/shared/scratchBlockCatalog.js`. The catalog stores each block's opcode, category, colour, author-facing sample text, visual shape, aliases, and mouth metadata. `src/shared/markdown/ScratchBlocks.jsx` uses that catalog to parse inline Scratch blocks and fenced Scratch stacks, then renders SVG/path block bodies with HTML overlays for text and input fields. `src/shared/markdown/editorOptions.js` uses the same catalog for the markdown toolbar insertion menu.

The catalog currently covers every opcode in `SCRATCH_BLOCK_DEFINITIONS` and every block exposed by the Scratch toolbox picker. Tests in `src/shared/__tests__/markdown.test.jsx` enforce that coverage.

**Supported Scratch shapes:**

| Shape | Used for | Example |
|---|---|---|
| `hat` | Event starters | `when green flag clicked`, `when I start as a clone` |
| `stack` | Normal command blocks | `move (10) steps`, `broadcast [message1]` |
| `cap` | Ending blocks | `stop all`, `delete this clone` |
| `reporter` | Value blocks that fit inside inputs | `x position`, `pick random (1) to (10)` |
| `boolean` | Condition blocks that fit inside `<...>` inputs | `touching [edge]?`, `(1) > (2)` |
| `c` | Blocks with statement mouths | `forever`, `repeat (10)`, `if <> then` |

**Maintenance contract:**

When adding, renaming, or removing Scratch blocks, update `src/shared/scratchBlockCatalog.js` in the same change as the runtime/editor block definitions. A new Scratch block is not complete until the markdown renderer, toolbar insertion list, opcode references, and tests are updated together.

**Nested fenced syntax examples:**

````markdown
```scratch
when green flag clicked
forever
  if <touching [edge]?> then
    turn right (15) degrees
  else
    move (pick random (1) to (10)) steps
  end
end
```
````

````markdown
```scratch
when I start as a clone
repeat until <(score) > (10)>
  change [score] by (1)
end
delete this clone
```
````

---

## Lists

```
- Unordered item
- Another item

1. Ordered item
2. Another item
```

---

## Tables

GFM pipe tables with optional column alignment:

```
| Column A | Column B |
|---|---:|
| left     |    right |
```

Alignment: `---` (left), `---:` (right), `:---:` (centre). Table cells support inline Markdown.

---

## Blockquotes and Callouts

```
> Standard callout.

> :warning Warning callout.
> :error Error callout.
> :success Success callout.
> :info Info callout.
```

| Variant | Border | Background |
|---|---|---|
| `:warning` | Amber | Yellow-tinted white |
| `:error` | Red | Red-tinted white |
| `:success` | Green | Green-tinted white |
| `:info` | Blue | Blue-tinted white |
| *(plain `>`)* | Brand secondary | Warm white |

The marker text is stripped from rendered output.

---

## Images

```
![alt text](url)
```

Block-level, `max-width: 100%`, small border radius.

Information tasks (`InformationTask.jsx`) are the one exception: there, every image floats
beside its surrounding paragraph text instead of always breaking onto its own line (stacks
full-width again below ~640px). This is automatic — authors write the same `![alt](url)`
markdown, nothing to opt into — driven by `MarkdownRenderer`'s `imageLayout="float"` prop.

---

## Links

```
[link text](https://example.com)
```

Topic library links (`parseTopicHref`, `src/shared/markdown.jsx`) work anywhere `MarkdownRenderer`/`InlineMarkdown` is used — `explainer`, `description`, and `syntax` fields alike:
```
[link text](#topic/topic-id)
```

---

## Wiki-Links

Both lesson explainers and topic library fields support double-bracket wiki-link syntax:

```
[[topic-id]]                 # label is the topic's title
[[topic-id|Custom label]]    # custom label
```

Wiki-links are expanded before Markdown rendering and are **not** expanded inside inline code or fenced blocks. In rendered output they appear as styled buttons — hover shows a preview card, click opens the Topic Library dialog.
