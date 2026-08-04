# Desktop Module Code-Task Authoring

Everything needed to author Desktop code tasks in a composed lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

The Desktop module renders a windowed desktop shell (icons, taskbar, draggable/resizable windows) around one or more "apps." Three apps ship so far: **File Manager**, which wraps the Filesystem module's file/folder UI and adds a Recycle Bin, search, and sort; **Text Editor**, a plain-text editor with explicit Open/Save/Save As actions; and **Image Viewer**, a read-only image viewer with zoom and next/prev navigation. It is the richer, window-based successor to a plain Filesystem task; use Filesystem when a task only needs a single file-manager panel, and Desktop when the lesson is teaching window/desktop skills (opening/closing/arranging apps) alongside file management.

Opening a file from File Manager always launches Text Editor or Image Viewer as appropriate (by file extension) — this happens regardless of `availableApps`, which only controls which app icons appear directly on the desktop for standalone launch.

---

## Composed Lesson and Desktop Module

```yaml
id: desktop-basics
type: composed
title: Desktop Basics
description: Practise opening apps and organising files on a windowed desktop.
level: 1
modules:
  - id: desktop-practice
    type: desktop
    sandbox:
      sandboxStarterDesktop:      # optional — initial desktop for this module's sandbox
        fs:
          "/":
            type: dir
          "/Downloads/":
            type: dir
        recycleBin: []
        windows: []
```

---

## Code Task Fields

```yaml
  - title: Open the File Manager
    moduleType: desktop
    moduleId: desktop-practice   # optional — omit when one Desktop workspace is enough
    explainer: Open **File Manager** from the desktop and create a folder called **Documents**.
    availableApps: [fileManager] # optional — defaults to ["fileManager"]; also: textEditor, imageViewer
    starterDesktop:               # optional — initial desktop state
      fs:
        "/":
          type: dir
      recycleBin: []
      windows: []                 # start with no windows open; the student opens File Manager themselves
    completeDesktop:              # optional — reference solution
      fs:
        "/":
          type: dir
        "/Documents/":
          type: dir
      recycleBin: []
      windows: []
    codeStages: []                 # optional — array of { label, desktop } snapshots
    carryDesktopFrom: null         # optional — carry desktop state from task ID
    startsInDir: /                 # optional — which dir the File Manager window opens in (must end with /)
    check:
      type: fs_path
      operator: exists
      itemType: dir
      path: /Documents/
```

**Desktop state model:** `{ fs, recycleBin, windows }`.

- `fs` is the same flat path map as the Filesystem module (see `docs/authoring/filesystem.md`) and is seeded with a `/Downloads/` folder by default.
- `recycleBin` is an array of soft-deleted items (`{ path, entries, originalParent, deletedAt }`), populated automatically as the student deletes files — do not author this by hand except to pre-seed a "restore this" starting scenario.
- `windows` is the initial window layout: an array of `{ id, appId, x, y, width, height, minimized, maximized, zIndex, filePath?, draftContent? }`. Leave empty (`[]`) to start with a bare desktop the student must open apps from, or pre-populate to start a task with a window already open (e.g. mid-lesson checkpoints).
  - `filePath` (Text Editor, Image Viewer) — the file that window is showing; omit for a blank/untitled window.
  - `draftContent` (Text Editor only) — the window's current unsaved buffer. Text Editor does **not** autosave: typing updates `draftContent` on the window, and only Save/Save As writes it into `fs`. A window is "dirty" (title shows a `•`, closing asks for confirmation) whenever `draftContent` differs from the saved file content.

```json
{
  "fs": { "/": { "type": "dir" }, "/Downloads/": { "type": "dir" } },
  "recycleBin": [],
  "windows": [
    { "id": "fileManager-1", "appId": "fileManager", "x": 80, "y": 60, "width": 640, "height": 420, "minimized": false, "maximized": false, "zIndex": 1 }
  ]
}
```

Checks evaluate **automatically** after each student operation — there is no Run button, same as the Filesystem module.

---

## Text Editor and Image Viewer

Opening a file in File Manager (click, or creating a new file) launches it in its own **Text
Editor** window, or **Image Viewer** for image extensions (`.png .jpg .jpeg .gif .svg .webp
.bmp`) — this always happens, whether or not `textEditor`/`imageViewer` are in `availableApps`.
Both apps can also be launched blank from a desktop icon when listed in `availableApps`.

- **Text Editor** is plain text only (no bold/italic/formatting yet). It has its own Open, Save,
  and Save As actions (also Ctrl+S for Save) using a shared file-picker dialog — content is not
  autosaved as the student types, unlike every other module type. Opening a different file while
  the current window has unsaved edits opens a **new** Text Editor window rather than discarding
  them; opening while clean navigates the same window to the new file.
- **Image Viewer** is read-only: zoom in/out/reset, and Previous/Next cycle through the other
  image files in the same folder (sorted by name).
- The Save As / Open dialog supports folder navigation and **New Folder**, and warns before
  overwriting an existing file.

---

## Desktop Check Types

Every Filesystem check type works unchanged against a Desktop task's `fs` — see `docs/authoring/filesystem.md` for `fs_path`, `fs_file_content`, `fs_file_line_count`, `fs_file_location`, `fs_folder_count`, and `fs_opened`.

Additional Desktop-only check types:

| Type | Operators | Fields | Notes |
|---|---|---|---|
| `fs_recycle_bin` | `is_in`, `not_in` | `path` | Whether an item (matched by its original path) is currently in the Recycle Bin |
| `window_state` | `opened`, `closed`, `minimized`, `maximized` | `appId` | State of the named app's window (`fileManager`, `textEditor`, or `imageViewer`) |
| `windows_arranged_side_by_side` | `is_arranged` | `appIds` (two app IDs) | Tolerant geometry check: both windows visible, each occupying a meaningful share of the screen, minimal overlap. Assesses "arranged side by side" as an outcome, not exact pixel positions |

---

## Minimal JSON Example

```json
{
  "id": "desktop-minimal",
  "type": "desktop",
  "title": "Desktop Minimal",
  "description": "Organise your files on the desktop.",
  "tasks": [
    {
      "id": 1,
      "title": "Create a Documents folder",
      "explainer": "Open **File Manager** and create a folder called **Documents** in the root folder.",
      "starterDesktop": { "fs": { "/": { "type": "dir" } }, "recycleBin": [], "windows": [] },
      "check": { "type": "fs_path", "operator": "exists", "itemType": "dir", "path": "/Documents/" }
    }
  ]
}
```

---

## Known limitations

- Text Editor is plain text only — bold/italic/underline/alignment formatting, Paint, and a
  simulated Browser/search engine are planned for later releases and are not part of this
  contract yet.
- `window_state` matches the *first* window found for an `appId`; it doesn't distinguish between
  several simultaneously-open Text Editor windows showing different files.
- Recycle-Bin/Downloads/window-layout/unsaved-draft state is stored in the same localStorage/RTDB
  fields as other module types — it does not survive a browser or device switch for anonymous
  students, the same caveat that already applies to Python `.launchpad` backups.
- The support-stage reveal ladder (progressive hints) is not available for Desktop tasks yet, matching the Filesystem module's current behaviour.
- `windows_arranged_side_by_side` compares window geometry against an assumed 1200px-wide viewport rather than the student's actual window size.
