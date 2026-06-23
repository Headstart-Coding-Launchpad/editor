# Filesystem Lesson Authoring

Everything needed to author a Filesystem lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Lesson Envelope (Filesystem-specific)

```yaml
id: file-organiser
type: filesystem
title: File Organiser
description: Practise organising files and folders.
level: 1
sandboxStarterFs:            # optional — initial filesystem for sandbox
  "/":
    type: dir
```

---

## Code Task Fields

```yaml
  - title: Create a folder
    explainer: Create a folder called **Documents**.
    starterFs:                # optional — initial filesystem state
      "/":
        type: dir
    completeFs:               # optional — reference solution
      "/":
        type: dir
      "/Documents/":
        type: dir
    codeStages: []            # optional — array of { label, fs } snapshots
    carryFsFrom: null         # optional — carry filesystem from task ID
    startsInDir: /            # optional — which dir the explorer opens in (must end with /)
    check:
      type: fs_dir_exists
      path: /Documents/
```

**Filesystem state model:** a flat path map. Directories end with `/`; files do not. Root `/` always exists.

```json
{
  "/": { "type": "dir" },
  "/Documents/": { "type": "dir" },
  "/Documents/notes.txt": { "type": "file", "content": "Hello!" }
}
```

Checks evaluate **automatically** after each student operation — there is no Run button.

---

## Filesystem Check Types

All `path` and `dir` fields are matched **case-insensitively**, so `Documents` and `documents` are treated the same.

`path` also supports glob wildcards:

| Pattern | Matches |
|---|---|
| `*` | Any sequence of characters except `/` |
| `**` | Any sequence of characters including `/` |
| `?` | Exactly one character (not `/`) |

Examples: `/Documents/*.txt`, `/Pro*/`, `/**/*.py`

| Type | Fields | Notes |
|---|---|---|
| `fs_file_exists` | `path` | File at path exists (wildcards supported) |
| `fs_dir_exists` | `path` | Directory at path exists (wildcards supported) |
| `fs_not_exists` | `path` | Path (file or dir) does not exist (wildcards supported) |
| `fs_content_contains` | `path`, `value` | File content contains value (case-insensitive) |
| `fs_content_equals` | `path`, `value` | File content equals value (trimmed, case-insensitive) |
| `fs_file_in_dir` | `path`, `dir` | File exists and its direct parent equals dir (case-insensitive) |
| `fs_dir_opened` | `path` | Student navigated to the folder (wildcards supported) |
| `fs_file_opened` | `path` | Student opened the file (wildcards supported) |

---

## Minimal JSON Example

```json
{
  "id": "filesystem-minimal",
  "type": "filesystem",
  "title": "Filesystem Minimal",
  "description": "Organise your files.",
  "tasks": [
    {
      "id": 1,
      "title": "Create a Documents folder",
      "explainer": "Create a folder called **Documents** in the root folder.",
      "starterFs": { "/": { "type": "dir" } },
      "check": { "type": "fs_dir_exists", "path": "/Documents/" }
    }
  ]
}
```
