# Filesystem Module Code-Task Authoring

Everything needed to author Filesystem code tasks in a composed lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Composed Lesson and Filesystem Module

```yaml
id: file-organiser
type: composed
title: File Organiser
description: Practise organising files and folders.
level: 1
modules:
  - id: filesystem-practice
    type: filesystem
    sandbox:
      sandboxStarterFs:      # optional — initial filesystem for this module's sandbox
        "/":
          type: dir
```

---

## Code Task Fields

```yaml
  - title: Create a folder
    moduleType: filesystem
    moduleId: filesystem-practice # optional — omit when one Filesystem workspace is enough
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
      type: fs_path
      operator: exists
      itemType: dir
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

`feedbackChecks` use the same filesystem check shapes and require a completion `check`. Use `show: on_idle` for guidance after the learner pauses file operations or editing, or `show: after_attempt` for feedback when the automatic check cycle runs. `mode: blocking` fails completion when matched; `mode: nudge` shows guidance without failing. `incorrectChecks` is a legacy alias for blocking feedback.

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

| Type | Operators | Fields | Notes |
|---|---|---|---|
| `fs_path` | `exists`, `not_exists` | `path`, `itemType: file \| dir \| any` | File path, folder path, or any path exists/does not exist (wildcards supported) |
| `fs_file_content` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | `path`, `value`, optional `flags` | File content comparison |
| `fs_file_line_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | `path`, `value` | Compare number of lines in a file |
| `fs_file_location` | `in_folder` | `path`, `dir` | File exists and its direct parent equals `dir` |
| `fs_folder_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | `path`, `itemType: file \| dir`, `value` | Count direct child files or folders |
| `fs_opened` | `is_open` | `path`, `itemType: file \| dir` | Student opened the file or navigated to the folder |

Legacy aliases such as `fs_file_exists`, `fs_dir_exists`, `fs_not_exists`, `fs_content_contains`, `fs_content_equals`, `fs_file_in_dir`, `fs_dir_opened`, and `fs_file_opened` still load, but new lessons should use the canonical form above.

`matches_regex` and `not_matches_regex` use JavaScript `RegExp(pattern, flags)`, with the pattern in `value` and optional flags such as `i` or `m` in `flags`. Non-regex content checks normalise `\r\n` to `\n` and compare case-insensitively. Line counts ignore trailing blank lines created only by final newline characters.

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
      "check": { "type": "fs_path", "operator": "exists", "itemType": "dir", "path": "/Documents/" }
    }
  ]
}
```
