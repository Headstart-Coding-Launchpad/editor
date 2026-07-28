# HTML Code Task Fields

Field reference for `html` module code tasks in a `composed` lesson. Set `moduleType: html` on each such task; use `moduleId` when it belongs to a named HTML workspace. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For HTML check types see `docs/authoring/html.md`.

---

## Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterFiles` | No | file array | Files shown as editor tabs. |
| `completeFiles` | No | file array | Reference solution files. |
| `codeStages` | No | stage array | Intermediate stages (`label`, `files`, `entryFile?`, optional `role`, optional `revealable`). Revealable stages open read-only without replacing student files. |
| `entryFile` | No | string | HTML file rendered in the iframe. Defaults to `index.html`. |
| `completeEntryFile` | No | string | Entry file for `completeFiles`. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved files from (matched by filename). |
| `interactionMode` | No | string | `run` (default) or `submit`. |

**File object:** `{ name: string, type: "html"|"css"|"javascript", content: string }`.

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Support stages need `revealable: true` to be offerable as read-only references; a Complete stage is revealable without that flag. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

**Carry-through behaviour:**
- Files matching by name are carried; new `starterFiles` in the current task use their defined content.
- Files from the carried task not in current `starterFiles` are hidden.

---

## Minimal Example

```yaml
id: html-minimal
type: composed
title: HTML Minimal
description: A short HTML lesson.
tasks:
  - id: 1
    moduleType: html
    title: Heading
    explainer: Add a heading.
    entryFile: index.html
    starterFiles:
      - name: index.html
        type: html
        content: "<!DOCTYPE html><html><body></body></html>"
    check:
      type: html_element
      operator: exists
      selector: h1
```
