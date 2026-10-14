# HTML Module Code-Task Authoring

Everything needed to author HTML code tasks in a composed lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Composed Lesson and HTML Module

```yaml
id: html-heading
type: composed
title: HTML Headings
description: Add headings with HTML tags.
level: 1
modules:
  - id: html-practice
    type: html
    sandbox:
      sandboxStarterFiles:   # optional — pre-loaded files in this module's sandbox
        - name: index.html
          type: html
          content: |
            <!DOCTYPE html><html><body></body></html>
```

---

## Code Task Fields

```yaml
  - title: Add a heading
    moduleType: html
    moduleId: html-practice  # optional — omit when one HTML workspace is enough
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
    codeStages: []            # optional — intermediate stages (label, role?, files, entryFile?)
    carryCodeFrom: 1          # optional — carry files from task ID (matched by filename)
    # carryCodeFromLesson: { lesson: html-1-11, task: 4 }  # optional instead — the student's own files from an earlier lesson
    interactionMode: run      # optional — run (default) | submit
    inspector:                # optional — the HTML Inspector on the preview (see below)
      enabled: true
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

**Carry from an earlier lesson.** `carryCodeFromLesson: { lesson, task }` starts the task from each student's own saved files on that task of an earlier lesson (two-lesson projects), matched to this task's `starterFiles` by filename. Use the stock lesson id. Students the tutor hasn't matched to the class list wait; anyone with nothing saved gets the starter files. Not with `carryCodeFrom` on the same task. See [Two-lesson projects](AUTHORING_GUIDE.md#two-lesson-projects-carry-from-an-earlier-lesson).

## Line Hints

Put instructions **next to** a line of a starter file instead of in an HTML comment. A line whose trimmed text is `<!--> … -->` (note the `>` straight after `<!--`) is a **line hint**: it is removed from the file and its text is shown beside the next line — a 💡 in the editor gutter (hover for the text) and faded grey text after the line.

```yaml
    starterFiles:
      - name: index.html
        type: html
        content: |
          <!DOCTYPE html>
          <html>
            <body>
              <!--> Change this heading to your name -->
              <h1>Hello</h1>
              <!--> Add a <p> paragraph about yourself here -->

            </body>
          </html>
```

- A marker attaches to the **next non-marker line** of the same file; indentation doesn't matter. Several markers in a row stack onto the same line; one on a blank line marks where to write.
- A marker with no line after it (the last thing in the file) gets a new empty line at the end of the file, marking where the student starts typing.
- Markers work in `starterFiles`, `completeFiles` and the `files` of every code stage. Ordinary `<!-- comments -->` are left alone.
- Markers are stripped before the files are shown, saved, previewed, checked (`code_contains`, regex, element checks), carried or mirrored to the teacher. The Builder's editor shows the raw markers; its Run and check buttons strip them.
- When a student returns to saved files, each hint re-attaches to the line that still reads the same (ignoring indentation), or is dropped when that line is gone or ambiguous. See [python.md](python.md#line-hints) for the full rules.

---

## Side-quests

An HTML code task can carry up to three optional, unchecked `sideQuests` (`title`, `kind`,
`explainer`, `starter`, which becomes the side-quest's `index.html`) that a student opens in their own scratch HTML editor and preview once they pass
the task. They never change the task's code or what `carryCodeFrom` copies. See
[Side-quests](AUTHORING_GUIDE.md#side-quests).

## HTML Inspector

`inspector` adds an **Inspect** button to the task's preview. It's off unless `enabled: true`.
Use it when a task is about *why* the page looks the way it does: the box model, the cascade
(selectors, inheritance, specificity) or flexbox and grid.

```yaml
  - id: 52
    moduleType: html
    title: Why is the card's text blue?
    inspector:
      enabled: true               # required to show it
      open: true                  # optional — start with inspect mode on
      focus: ".card p"            # optional — pre-select the first element this matches
      show: [box, cascade]        # optional — any of box, cascade, layout (default: all three)
```

What students get:

- **Inspect mode.** Pointing at part of the page (tapping on a tablet) outlines it with labelled,
  coloured bands for **margin**, **border**, **padding** and **content**, with px sizes. Clicking
  (or tapping) chooses it. Parent, First child, Previous and Next buttons move the choice by
  keyboard or touch.
- **The panel** (a side panel; a bottom sheet on narrow screens) shows the element's tag, id and
  classes, and one section per `show` entry:
  - `box`: the four nested boxes with their sizes.
  - `cascade` ("Why this …?"): pick a property (text colour, background colour, text size,
    font, margin, padding, border, width, display, gap and others). Every rule that sets it on
    the element is listed strongest first: the winner highlighted, each loser struck through with
    a plain-words reason: **less specific**, **earlier in the file** (or **loaded earlier** for
    another stylesheet), **overridden by !important**, or **beaten by the style="…" on the
    tag**. Specificity numbers show second, as `(ids,classes,tags)`. When nothing sets an
    inherited property (text colour, font and so on), it says which parent it is **inherited
    from**; when nothing sets it at all, it is the browser's default. Stylesheets from another
    website can't be read; the panel says so.
  - `layout`: on a flex container, the main axis (solid arrow), cross axis (dashed arrow) and
    gaps; on a grid container, the numbered grid lines and gaps.
- Each Run rebuilds the page; the chosen element is found again by its position in the page.

Notes:

- No new checks. The Inspector reads the page but never changes it, so `html_*` element checks
  and the student's page work exactly as before.
- `focus` is a CSS selector. A selector that matches nothing just leaves nothing chosen.
- A submit-mode task has no preview, so the Inspector warns and does nothing there. On any
  other module `inspector` is ignored with a warning.
- **Tutor:** in Go Live, the tutor's inspect mode, chosen element and property show on every
  student's screen. The tutor can also inspect a student's page in the student's card view.
  The session report records whether each student used the Inspector on the task
  ([session reports](session-reports.md)).

## Live scrubbing (`scrub`)

`scrub` lets students drag CSS numbers and pick colours, and the preview updates as the value
changes. It's off unless set. Same field as Python: see
[Python → Live scrubbing](python.md#live-scrubbing-scrub) for the options, devices and keyboard
use.

```yaml
  - id: 53
    moduleType: html
    title: Give the card more room
    scrub:
      enabled: true
      ranges:
        - line: 4          # a line of whichever file is open
          min: 0
          max: 60
```

What can be scrubbed:

- **CSS values** in `<style>` blocks, `.css` files and `style="…"` attributes: numbers keep their
  unit (`margin: 20px`, `font-size: 1.5em`, `width: 50%`), and colours are names or hex
  (`color: red`, `background: #fff`).
- **Attribute values** that are a whole number or a colour: `width="200"`, `fill="#f00"`.
- Not text on the page, links, ids, classes or JavaScript.

While a value moves, the student's own preview re-renders about every 200 ms (a preview: no
attempt, checks or save). A watching tutor's view still updates only when the student runs, as
always. When the drag ends the value is a normal edit, saved and sent like typing. `ranges` lines
count in the file being edited, in every file. The session report counts each student's scrubs
(`scrubs`).

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

**Wildcards and option lists:** for non-regex contains/equality checks, `*` matches any sequence including newlines. A value written as `"opt1","opt2"` passes `contains` if any option is present, and passes `not_contains` only if none of them are. An invalid regex fails both `matches_regex` and `not_matches_regex`, so a typo in a pattern never lets every student pass.

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

## Drag-and-Drop Runnable Code (`code_arrange`)

Instead of a free-typed editor, an HTML task can be `taskType: code_arrange`:
each line is built from fixed text and blanks — a line that's just one blank
is dragged into place as a whole line. Every blank draws from one shared
tile pool (the task's `distractors` plus every blank's own correct value).
The assembled lines become `entryFile`'s content and are rendered/checked
through this same iframe pipeline. Full field reference:
`docs/authoring/lesson-schema.md` ("Code Arrange Task Fields").

```yaml
- title: Arrange a heading and paragraph
  taskType: code_arrange
  moduleType: html
  explainer: Build the page by arranging the lines.
  entryFile: index.html
  starterFiles:
    - name: index.html
      type: html
      content: ""
  lines:
    - id: L1
      parts:
        - type: slot
          id: L1
          code: "<h1>Hello</h1>"
    - id: L2
      parts:
        - type: slot
          id: L2
          code: "<p>Welcome to my page.</p>"
  distractors:
    - id: D1
      code: "<h2>Hello</h2>"
  check:
    type: html_element
    operator: exists
    selector: h1
```

---

## Minimal JSON Example

```json
{
  "id": "html-minimal",
  "type": "composed",
  "title": "HTML Minimal",
  "description": "A short HTML lesson.",
  "tasks": [
    {
      "id": 1,
      "moduleType": "html",
      "title": "Heading",
      "explainer": "Add a heading.",
      "entryFile": "index.html",
      "starterFiles": [{ "name": "index.html", "type": "html", "content": "<!DOCTYPE html><html><body></body></html>" }],
      "check": { "type": "html_element", "operator": "exists", "selector": "h1" }
    }
  ]
}
```
