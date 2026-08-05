# Topic Library Schema

The topic library lives in the Firestore `topicLibrary` collection. Each document ID is the topic `id`. Managed via the **Topic Library** tab in the Admin Portal (`/admin`). The static file `public/assets/topic-library.json` can be seeded to Firestore using `scripts/migrate-topic-library.mjs`.

Topics provide reference cards for coding concepts shown as hover-previews on `[[wiki-links]]` in Markdown and in the full Topic Library dialog.

**Markdown renderer reference:** `docs/authoring/markdown-renderer.md`

---

## YAML Authoring

Topics can be authored and published as YAML:

```yaml
topics:
  - id: for-loop
    title: For loops
    types: [python]
    category: Loop
    summary: Repeats indented code once for each item in a sequence.
    description: |
      Use `python:range()` when you want to repeat code a particular number of times.

      > :info The loop variable `i` counts up automatically.
    syntax: |
      ```python
      for i in range(5):
          print(i)
      ```
    aliases:
      - for loop
      - for loops
    related:
      - range
      - variables
```

```bash
node cli/cli.mjs topics publish-yaml topics.yaml   # upsert all topics to Firestore
node cli/cli.mjs topics yaml-to-json topics.yaml   # validate without Firebase
node cli/cli.mjs topics json-to-yaml topics.json topics.yaml
node cli/cli.mjs topics get for-loop --format yaml
node cli/cli.mjs topics upsert topic.yaml          # upsert a single topic
```

`topics publish-yaml` upserts every topic in the file; it does not delete topics absent from the file.

### Single-Topic Upsert

`topics upsert [file]` (reads from stdin when `file` is omitted) writes **one topic** and expects a **bare topic object** — not the `topics:` array wrapper used by `publish-yaml` and `upsert-library`:

```yaml
id: for-loop
title: For loops
types: [python]
category: Loop
summary: Repeats indented code once for each item in a sequence.
```

A single-item `topics:` array (or bare single-item array) is also accepted as a convenience and is unwrapped automatically; any other array length is rejected with `Expected exactly one topic, received N`. Use `upsert-library` or `publish-yaml` to write more than one topic in a call.

---

## Topic Object

```json
{
  "id": "print",
  "title": "print()",
  "types": ["python"],
  "category": "Function",
  "summary": "Displays a value in the Python output console.",
  "description": "Put **text**, numbers or variables inside the brackets.\n\nFor example, `python:print(\"Hello!\")` displays a greeting.",
  "syntax": "Use `python:print(\"Hello, world!\")` to display a message.",
  "aliases": ["print", "printing"],
  "related": ["strings", "variables"]
}
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Unique slug. Used in `[[wiki-links]]` and URL hash. Lowercase letters, digits, dots, underscores, and hyphens only. |
| `title` | Yes | string | Display name in the library list and hover card. |
| `types` | No | string array | Lesson types this topic applies to. Empty or omitted = all types. Valid values: `"python"`, `"html"`, `"scratch"`. |
| `category` | No | string | Short label under the title (e.g. `"Function"`, `"Concept"`, `"CSS property"`). |
| `summary` | No | string | One-sentence description in the hover card. **Plain text only — no Markdown.** |
| `description` | No | string | Full body text rendered with the Markdown renderer. |
| `syntax` | No | string | Syntax/usage example rendered below the description. Typically a fenced code block. |
| `aliases` | No | string array | Alternative names used by search and the auto-suggestion engine. The `id` does not need repeating here. |
| `related` | No | string array | IDs of related topics shown as clickable pills. Non-existent IDs are silently skipped. |

---

## Type Filtering

| `types` value | When shown |
|---|---|
| `[]` or omitted | All lesson types |
| `["python"]` | Python lessons only |
| `["html"]` | HTML lessons only |
| `["scratch"]` | Scratch lessons only |
| `["python", "scratch"]` | Python and Scratch lessons |

---

## Wiki-Link Syntax

Both lesson explainers and topic `description` / `syntax` fields support wiki-links:

| Syntax | Rendered as |
|---|---|
| `[[topic-id]]` | Link whose label is the topic's `title` |
| `[[topic-id\|Custom label]]` | Link with the supplied label |

Not expanded inside inline code spans or fenced blocks. Clicking opens the Topic Library dialog with that topic selected.

---

## Search Behaviour

The library search indexes: `title`, `category`, `summary`, `description`, and all `aliases`. The `id`, `syntax`, and `related` fields are not searched. Search is case-insensitive substring matching.

The auto-suggestion engine scans lesson explainer content for word-boundary matches against `title` and `aliases` (minimum 3 characters). The first match is surfaced as a suggestion to wrap in a wiki-link. Code spans and existing wiki-links are excluded from scanning.
