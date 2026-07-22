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
    copyCode: |               # optional — read-only panel above the student editor
      <h1>Hello</h1>
    codeStages: []            # optional — intermediate stages (label, role?, revealable?, files, entryFile?)
    carryCodeFrom: 1          # optional — carry files from task ID (matched by filename)
    interactionMode: run      # optional — run (default) | submit
    check:
      type: html_element
      operator: exists
      selector: h1
```

**File object:** `{ name: string, type: "html"|"css"|"javascript", content: string }`.

**Carry-through behaviour:** files matching by name are carried; new `starterFiles` in the current task use their defined content. Files from the carried task not in current `starterFiles` are hidden.

**`interactionMode` combinations:**
- `run` or omitted: Run renders the iframe; checks run against DOM/output/code.
- `submit`: Submit checks code text only; use only submit-compatible checks (`type: code`).

---

## HTML Element Checks (run mode only)

All element checks require a `selector` (CSS selector).

| Type | Operators | Extra fields | Notes |
|---|---|---|---|
| `html_element` | `exists` | `selector` | At least one element matches |
| `html_element_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | `selector`, `value` | Compare number of matching elements |
| `html_element_value` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | `selector`, `value`, optional `flags` | Element text/value |
| `html_element_attribute` | `exists`, `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | `selector`, `attribute`, optional `value`, optional `flags` | Attribute on the selected element |
| `html_element_style_property` | `exists`, `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | `selector`, `property`, optional `value`, optional `flags` | Computed CSS property; URL values are normalised to filenames for equality/contains |

Legacy aliases such as `element_exists`, `element_count`, `element_value`, `element_value_equals`, `element_attribute`, and `element_style_property` still load, but new lessons should use the canonical `html_element_*` form.

---

## Output and Code Checks (shared with Python)

Prefer the canonical `type` + `operator` form:

| Type | Operators | Run | Submit | Fields |
|---|---|:---:|:---:|---|
| `output` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | N | `value`, optional `flags` for regex |
| `output_line_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | Y | N | `value` |
| `code` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | Y | `value`, optional `flags` for regex |
| `output_not_empty` / `output_empty` | none | Y | N | Legacy convenience checks |

Legacy aliases such as `output_contains`, `output_equals`, `output_matches_regex`, `code_contains`, `code_does_not_contain`, and `code_matches_regex` still load, but new lessons should use the canonical form above.

**Submit mode** only accepts `type: code` checks. Output and DOM checks require a run/render.

**Regex:** `matches_regex` and `not_matches_regex` use JavaScript `RegExp(pattern, flags)`. Put the regex pattern in `value`; put flags such as `i`, `m`, or `s` in `flags`. Regex is case-sensitive unless `flags: i` is set.

**Normalisation:** output checks normalise `\r\n` to `\n` and compare case-insensitively except regex. Exact output checks trim trailing newline characters only. Code checks normalise whitespace outside quoted strings before contains/equality checks; regex checks see that same normalised source. Element text/value checks use the rendered text or input value.

**Wildcards and multi-option contains:** for non-regex contains/equality checks, `*` matches any sequence including newlines. A value written as `"opt1","opt2"` passes `contains` if any option is present.

## Feedback Checks

HTML tasks support `feedbackChecks`. They use the same check shapes as completion checks and require a completion `check`. `show: after_attempt` runs after Run/Submit; `show: on_idle` runs after the learner pauses editing and is limited to code-safe checks so it cannot read stale DOM/output from an old preview. DOM/output feedback checks should use `show: after_attempt`. `incorrectChecks` is a legacy alias for blocking feedback.

```yaml
feedbackChecks:
  - type: html_element_value
    selector: h1
    operator: equals
    value: Heading
    mode: blocking        # blocking | nudge
    show: after_attempt   # after_attempt | on_idle
    hint: Use the exact heading text from the task.
```

If a completion check passes but a blocking feedback check also matches, the task fails and the feedback hint is shown. A matching `mode: nudge` hint is shown without failing the task. If a blocking feedback check has no `hint`, students see `Not quite.` and the builder warns authors to add one.

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
      "check": { "type": "html_element", "operator": "exists", "selector": "h1" }
    }
  ]
}
```
