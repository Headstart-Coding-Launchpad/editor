# Filesystem Code Task Fields

Field reference for `filesystem`-type lesson code tasks. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For Filesystem check types see `docs/authoring/filesystem.md`.

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
| `codeStages` | No | Array of `{ label, fs, role?, revealable? }` snapshots. Stage role metadata is available for teacher labelling; read-only reveal UI is currently implemented for Python/HTML stages only. |
| `carryFsFrom` | No | Task ID to carry the saved filesystem from. |
| `startsInDir` | No | Directory path the explorer opens in. Defaults to `/`. Must end with `/`. |

**Stage object:** `role` may be `support`, `core`, `extension`, or `solution`; omitted `role` defaults to `support`. `revealable: true` may be stored on any role, but runtime read-only reveal is currently implemented for Python/HTML stages only.

---

## Minimal Example

```yaml
id: filesystem-minimal
type: filesystem
title: Filesystem Minimal
description: Organise your files.
tasks:
  - id: 1
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
