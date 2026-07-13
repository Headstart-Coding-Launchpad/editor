# HTML Code Task Fields

Field reference for `html`-type lesson code tasks. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For check types see `docs/authoring/checks.md`.

---

## Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterFiles` | No | file array | Files shown as editor tabs. |
| `completeFiles` | No | file array | Reference solution files. |
| `codeStages` | No | stage array | Intermediate stages (`label`, `files`, `entryFile?`). |
| `entryFile` | No | string | HTML file rendered in the iframe. Defaults to `index.html`. |
| `completeEntryFile` | No | string | Entry file for `completeFiles`. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved files from (matched by filename). |
| `interactionMode` | No | string | `run` (default) or `submit`. |

**File object:** `{ name: string, type: "html"|"css"|"javascript", content: string }`.

**Carry-through behaviour:**
- Files matching by name are carried; new `starterFiles` in the current task use their defined content.
- Files from the carried task not in current `starterFiles` are hidden.

---

## Minimal Example

```yaml
id: html-minimal
type: html
title: HTML Minimal
description: A short HTML lesson.
tasks:
  - id: 1
    title: Heading
    explainer: Add a heading.
    entryFile: index.html
    starterFiles:
      - name: index.html
        type: html
        content: "<!DOCTYPE html><html><body></body></html>"
    check:
      type: element_exists
      selector: h1
```
