# Topic Library Schema

The topic library lives in the Firestore `topicLibrary` collection. Each document's ID is the topic `id`; the document fields mirror the topic object below. It is edited via the **Topic Library** tab in the Admin Portal (`/admin`).

The static file `public/assets/topic-library.json` is kept for reference and can be seeded to Firestore using `scripts/migrate-topic-library.mjs`.

The library provides reference cards for coding concepts, functions, and language features. Cards are shown as hover-previews on `[[wiki-links]]` in Markdown and in the full Topic Library dialog.

---

## Topic Object

```json
{
  "id": "print",
  "title": "print()",
  "types": ["python"],
  "category": "Function",
  "summary": "Displays a value in the Python output console.",
  "description": "Put **text**, numbers or variables inside the brackets. Strings must be surrounded by quotation marks.\n\nFor example, `python:print(\"Hello!\")` displays a greeting.",
  "syntax": "Use `python:print(\"Hello, world!\")` to display a message.",
  "aliases": ["print", "printing"],
  "related": ["strings", "variables"]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | string | Unique slug. Used in wiki-links (`[[id]]`) and URL hash (`#topic/id`). Lowercase letters, digits, dots, underscores, and hyphens only. |
| `title` | Yes | string | Display name shown in the library list and hover card. |
| `types` | No | string array | Lesson types this topic applies to. Empty array (or omitted) means the topic is shown for all lesson types. See [Type filtering](#type-filtering). |
| `category` | No | string | Short label shown under the title in the list and detail pane (e.g. `"Function"`, `"Concept"`, `"CSS property"`). |
| `summary` | No | string | One-sentence description shown in the hover card and as the bold lead-in on the detail pane. Plain text only — no Markdown. |
| `description` | No | string | Full body text rendered with the Markdown renderer. See [Markdown reference](#markdown-reference). |
| `syntax` | No | string | Syntax or usage example rendered with the Markdown renderer below the description. See [Markdown reference](#markdown-reference). Typically contains a fenced code block or an inline code example. |
| `aliases` | No | string array | Alternative names and spellings used by the search index and the auto-suggestion engine. The `id` itself does not need to be repeated here. |
| `related` | No | string array | IDs of related topics shown as clickable pills at the bottom of the detail pane. Non-existent IDs are silently skipped. |

---

## Type Filtering

The `types` array controls which lesson types show this topic.

| `types` value | When shown |
|---|---|
| `[]` or field omitted | All lesson types |
| `["python"]` | Python lessons only |
| `["html"]` | HTML lessons only |
| `["scratch"]` | Scratch lessons only |
| `["python", "scratch"]` | Python and Scratch lessons |

Valid type strings are `"python"`, `"html"`, and `"scratch"`. Any unknown string is accepted but will never match a lesson type.

---

## Wiki-link Syntax

Both the `description` and `syntax` fields, and any lesson explainer Markdown, can reference topic library entries using double-bracket wiki-link syntax:

| Syntax | Rendered as |
|---|---|
| `[[topic-id]]` | Link whose label is the topic's `title` |
| `[[topic-id\|Custom label]]` | Link with the supplied label |

Wiki-links are expanded into topic-href links before Markdown rendering. They are **not** expanded inside inline code spans (`` ` `` … `` ` ``) or fenced code blocks.

In the rendered output, a wiki-link becomes a styled button. Hovering it shows a small preview card; clicking opens the Topic Library dialog with that topic selected.

---

## Markdown Reference

The `description` and `syntax` fields are rendered by `MarkdownRenderer` (`src/shared/markdown.jsx`). The following elements are supported.

### Headings

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
```

Rendered in the brand title font at decreasing sizes. `h5` and `h6` are not supported (they pass through as plain text).

### Paragraphs and line breaks

Plain text becomes a paragraph. A single line break in the source becomes a `<br>` (remark-breaks is active), so each new line in the JSON string starts a new visual line without needing a blank line between paragraphs.

### Bold and italic

```
**bold text**
*italic text*
```

Bold text is rendered in the brand primary colour (or inherited colour in callouts).

### Inline code

A bare backtick span renders in a lavender-tinted monospace style.

**Language-prefixed inline code** triggers syntax highlighting or Scratch block rendering:

| Prefix | Example | Effect |
|---|---|---|
| `python:` | `` `python:print("hi")` `` | Syntax-highlighted Python inline code |
| `html:` | `` `html:<h1>Title</h1>` `` | Syntax-highlighted HTML inline code |
| `css:` | `` `css:color: red;` `` | Syntax-highlighted CSS inline code |
| `js:` | `` `js:console.log(x)` `` | Syntax-highlighted JavaScript inline code |
| `scratch:` | `` `scratch:move (10) steps` `` | Rendered as a coloured Scratch block pill |

**Auto-Scratch detection:** if inline code text matches a recognised Scratch block pattern (e.g. `move (10) steps`, `when green flag clicked`) it is automatically rendered as a Scratch block pill without the `scratch:` prefix.

### Fenced code blocks

````
```python
for i in range(5):
    print(i)
```
````

| Language tag | Effect |
|---|---|
| `python` | Syntax-highlighted Python block |
| `html` | Syntax-highlighted HTML block |
| `css` | Syntax-highlighted CSS block |
| `javascript` | Syntax-highlighted JavaScript block |
| `scratch` | Stacked Scratch block visual (see [Scratch blocks](#scratch-blocks)) |
| *(none)* | If every non-empty line matches a Scratch block pattern, auto-renders as Scratch visual; otherwise plain monospace block |

### Scratch blocks

The `scratch` fenced code block (or an auto-detected plain block) renders each non-empty line as a coloured, stacked Scratch block. Lines can be indented with two spaces per level to show nesting inside C-blocks.

Block colours are determined automatically from the block text:

| Colour | Category | Example blocks |
|---|---|---|
| Orange `#FFAB19` | Events | `when green flag clicked`, `when [space] key pressed`, `broadcast [message]` |
| Orange `#FFAB19` | Control | `repeat (10)`, `forever`, `if <condition> then`, `wait (1) seconds`, `stop all` |
| Blue `#4C97FF` | Motion | `move (10) steps`, `turn (15) degrees`, `go to x: (0) y: (0)`, `set x to (0)` |
| Purple `#9966FF` | Looks | `say [Hello!] for (2) seconds`, `think [Hmm]`, `show`, `hide`, `set size to (100)%` |
| Mauve `#CF63CF` | Sound | `play sound [meow]`, `start sound [meow]`, `stop all sounds` |
| Light blue `#5CB1D6` | Sensing | `ask [What is your name?] and wait`, `answer`, `mouse down?`, `key [space] pressed?` |
| Green `#59C059` | Operators | `join [hello] [world]`, `not <condition>`, expressions with `+`, `-`, `=`, `<`, `>`, `and`, `or` |
| Amber `#FF8C1A` | Variables | `set [score] to (0)`, `change [score] by (1)` |
| Grey `#7c7c7c` | Unknown | Any block text not matching the above patterns |

Hat blocks (event blocks starting with `when`) have rounded top corners. C-blocks (`forever`, `repeat`, `if … then`, `else`) display a small chevron indicator.

Value pills inside block text:
- Numbers and quoted strings → white pill with dark text
- `(input)` and `[dropdown]` spans → white pill
- `<condition>` spans → green pill with white text
- `(answer)` → light-blue pill with white text (sensing reporter style)

The special text `end` is silently skipped (used to close C-block indentation visually without rendering an extra block).

### Inline Scratch block pills

Inline code matching a Scratch block pattern renders as a compact coloured pill inline with text, identical in colour rules to the block table above but smaller and with no nesting indicators.

### Lists

```
- Unordered item
- Another item

1. Ordered item
2. Another item
```

### Tables

GFM pipe tables are supported with optional column alignment:

```
| Column A | Column B |
|---|---:|
| left | right |
```

Alignment markers: `---` (left), `---:` (right), `:---:` (centre). Table cells support inline Markdown (bold, italic, inline code, wiki-links).

### Blockquotes and callouts

A plain blockquote uses the brand secondary colour styling:

```
> This is a standard callout.
```

A callout variant is triggered by adding a type marker as the first text inside the quote:

```
> :warning This is a warning callout.
> :error This is an error callout.
> :success This is a success callout.
> :info This is an info callout.
```

| Variant | Border | Background | Text |
|---|---|---|---|
| `:warning` | Amber | Yellow-tinted white | Dark brown |
| `:error` | Red | Red-tinted white | Dark red |
| `:success` | Green | Green-tinted white | Dark green |
| `:info` | Blue | Blue-tinted white | Dark blue |
| *(plain `>`)* | Brand secondary | Warm white | Brand text |

The marker text (`:warning` etc.) is stripped from the rendered output.

### Images

```
![alt text](url)
```

Images are rendered block-level with `max-width: 100%` and a small border radius. The `alt` attribute is optional.

### Links

Standard Markdown links work in `description` and `syntax`:

```
[link text](https://example.com)
```

Topic library links can also be written directly as a topic href (this is the form produced by wiki-link expansion):

```
[link text](#topic/topic-id)
```

These render as styled topic-reference buttons (hover card + dialog) rather than navigating away.

---

## Search Behaviour

The library search indexes the following fields for each topic:

- `title`
- `category`
- `summary`
- `description`
- all entries in `aliases`

The `id`, `syntax`, and `related` fields are not searched. Search is case-insensitive substring matching.

The auto-suggestion engine (`findTopicSuggestion`) scans lesson explainer content for exact word-boundary matches against `title` and `aliases` (minimum 3 characters). The first match found is surfaced as a suggestion to wrap in a wiki-link. Code spans and existing wiki-links are excluded from scanning.

---

## Full Example

```json
{
  "topics": [
    {
      "id": "for-loop",
      "title": "For loops",
      "types": ["python"],
      "category": "Loop",
      "summary": "Repeats indented code once for each item in a sequence.",
      "description": "Use `python:range()` when you want to repeat code a particular number of times.\n\n> :info The loop variable `i` counts up automatically — you do not need to update it yourself.",
      "syntax": "```python\nfor i in range(5):\n    print(i)\n```",
      "aliases": ["for loop", "for loops"],
      "related": ["range", "variables"]
    },
    {
      "id": "event-block",
      "title": "Event blocks",
      "types": ["scratch"],
      "category": "Scratch event",
      "summary": "Hat blocks that start scripts when something happens.",
      "description": "A green-flag or key-pressed event starts the blocks connected beneath it.\n\nYou can have multiple scripts starting from the same event.",
      "syntax": "```scratch\nwhen green flag clicked\n  move (10) steps\n```",
      "aliases": ["event block", "events", "green flag"],
      "related": ["motion-block", "repeat-block"]
    }
  ]
}
```
