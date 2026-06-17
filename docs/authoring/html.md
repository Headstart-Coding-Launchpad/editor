# HTML Lesson Authoring

Everything needed to author an HTML lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Lesson Envelope (HTML-specific)

```yaml
id: html-heading
type: html
title: HTML Headings
description: Add headings with HTML tags.
level: 1
sandboxStarterFiles:         # optional — pre-loaded files shown in the sandbox
  - name: index.html
    type: html
    content: |
      <!DOCTYPE html><html><body></body></html>
```

---

## Code Task Fields

```yaml
  - title: Add a heading
    explainer: Add an `<h1>` tag.
    entryFile: index.html     # optional — defaults to index.html
    starterFiles:
      - name: index.html
        type: html            # html | css | javascript
        content: |
          <!DOCTYPE html><html><body></body></html>
      - name: style.css
        type: css
        content: "body { font-family: sans-serif; }"
    completeFiles:            # optional — reference solution
      - name: index.html
        type: html
        content: |
          <!DOCTYPE html><html><body><h1>Hello</h1></body></html>
    codeStages: []            # optional — intermediate stages (label, files, entryFile?)
    carryCodeFrom: 1          # optional — carry files from task ID (matched by filename)
    interactionMode: run      # optional — run (default) | submit
    check:
      type: element_exists
      selector: h1
```

**File object:** `{ name: string, type: "html"|"css"|"javascript", content: string }`.

**Carry-through behaviour:** files matching by name are carried; new `starterFiles` in the current task use their defined content. Files from the carried task not in current `starterFiles` are hidden.

**`interactionMode` combinations:**
- `run` or omitted: Run renders the iframe; checks run against DOM/output/code.
- `submit`: Submit checks code text only; use only submit-compatible check types (`code_contains`, `code_does_not_contain`, `code_equals`, `code_not_equals`, `code_matches_regex`).

---

## HTML Element Checks (run mode only)

All element checks require a `selector` (CSS selector).

| Type | Extra fields | Notes |
|---|---|---|
| `element_exists` | `selector` | At least one element matches |
| `element_count` | `selector`, `value` | Exactly N matching elements |
| `element_value` | `selector`, `value` | Element text/value contains value |
| `element_value_equals` | `selector`, `value` | Element text/value equals value |
| `element_value_not_contains` | `selector`, `value` | Does not contain value |
| `element_value_not_equals` | `selector`, `value` | Does not equal value |
| `element_value_matches_regex` | `selector`, `value` | Matches regex (case-sensitive) |
| `element_attribute` | `selector`, `attribute`, `value`? | Attribute exists; if `value` provided, must match |
| `element_style_property` | `selector`, `property`, `value`? | Computed CSS property exists; if `value` provided, must match (URL normalised to filename) |

---

## Output and Code Checks (shared with Python)

| Type | Fields | Run | Submit | Notes |
|---|---|:---:|:---:|---|
| `output_contains` | `type`, `value` | Y | N | iframe body text contains value |
| `output_equals` | `type`, `value` | Y | N | Exact match (trailing newlines trimmed) |
| `output_not_contains` | `type`, `value` | Y | N | Does not contain value |
| `output_not_equals` | `type`, `value` | Y | N | Does not equal value |
| `output_matches_regex` | `type`, `value` | Y | N | Matches regex (case-sensitive) |
| `output_line_count` | `type`, `value` | Y | N | Exactly N lines |
| `output_not_empty` | `type` | Y | N | Output is not empty |
| `output_empty` | `type` | Y | N | Output is empty / whitespace-only |
| `code_contains` | `type`, `value` | Y | Y | Source contains value (whitespace ignored outside quotes) |
| `code_does_not_contain` | `type`, `value` | Y | Y | Source does not contain value |
| `code_equals` | `type`, `value` | Y | Y | Source equals value |
| `code_not_equals` | `type`, `value` | Y | Y | Source does not equal value |
| `code_matches_regex` | `type`, `value` | Y | Y | Source matches regex (whitespace normalised) |

**Submit mode** only accepts: `code_contains`, `code_does_not_contain`, `code_equals`, `code_not_equals`, `code_matches_regex`.

**Wildcards:** `*` matches any sequence (including newlines). **Multi-option:** `"opt1","opt2"` passes if the actual value contains any option (works for `output_contains`, `code_contains`, `element_value`). **Case sensitivity:** regex checks are case-sensitive; all other comparisons are case-insensitive.

---

## Minimal JSON Example

```json
{
  "id": "html-minimal",
  "type": "html",
  "title": "HTML Minimal",
  "description": "A short HTML lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Heading",
      "explainer": "Add a heading.",
      "entryFile": "index.html",
      "starterFiles": [{ "name": "index.html", "type": "html", "content": "<!DOCTYPE html><html><body></body></html>" }],
      "check": { "type": "element_exists", "selector": "h1" }
    }
  ]
}
```
