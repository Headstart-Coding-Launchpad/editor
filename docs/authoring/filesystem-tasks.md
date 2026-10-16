# Filesystem Code Task Fields

Field reference for `filesystem` module code tasks in a `composed` lesson. Set `moduleType: filesystem` on each such task; use `moduleId` when it belongs to a named Filesystem workspace. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For Filesystem check types see `docs/authoring/filesystem.md`.

The `filesystem` type presents a virtual Windows Explorer-style file manager. Checks evaluate automatically — there is no Run button.

---

## Filesystem State Model

A flat path map. Directories end with `/`; files do not. Root `/` always exists.

```yaml
"/":
  type: dir
"/Documents/":
  type: dir
"/Documents/notes.txt":
  type: file
  content: "Hello!"
```

## Fields

| Field | Required | Notes |
|---|:---:|---|
| `starterFs` | No | Initial filesystem when no carry-through exists. Defaults to `{ "/": { type: "dir" } }`. |
| `completeFs` | No | Reference solution shown in "See complete". |
| `codeStages` | No | Array of `{ label, fs, role? }` snapshots. See "How students reach the stages" below. |
| `carryFsFrom` | No | Task ID to carry the saved filesystem from. |
| `startsInDir` | No | Directory path the explorer opens in. Defaults to `/`. Must end with `/`. |

**Stage object:** `role` is `starter`, `support` or `complete`; omitted `role` defaults to `support`. (`core` and `extension` are legacy names for `support`, and `solution` for `complete`.)

**How students reach the stages (solo mode):** there is no read-only reveal here (that's Python and HTML). Instead, after a student's check has failed **twice** on the task, solo mode offers to load the next stage into their workspace, replacing their work; after the last stage it offers the complete solution. Live students don't get the offer: the tutor applies stages from the teacher view.
 As with every task type, the `check` is defined once on the task, never on a stage — see "Code stage runtime behaviour" in `docs/authoring/lesson-schema.md`.

---

## Minimal Example

```yaml
id: filesystem-minimal
type: composed
title: Filesystem Minimal
description: Organise your files.
tasks:
  - id: 1
    moduleType: filesystem
    title: Create a Documents folder
    explainer: Create a folder called **Documents** in the root folder.
    starterFs:
      "/":
        type: dir
    check:
      type: fs_path
      operator: exists
      itemType: dir
      path: /Documents/
```
