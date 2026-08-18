# Desktop Module Code-Task Authoring

Everything needed to author Desktop code tasks in a composed lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

The Desktop module renders a windowed desktop shell (icons, taskbar, draggable/resizable windows) around one or more "apps." Five apps ship so far: **File Manager**, which wraps the Filesystem module's file/folder UI and adds a Recycle Bin, search, and sort; **Text Editor**, a plain-text editor with explicit Open/Save/Save As actions; **Image Viewer**, a read-only image viewer with zoom and next/prev navigation; **Paint**, a freehand drawing canvas with the same explicit-save model; and **Browser**, a simulated web browser over a lesson-authored `siteGraph` of fake pages, with a search engine, sponsored/broken/download pages, and controlled downloads into `/Downloads/`. It is the richer, window-based successor to a plain Filesystem task; use Filesystem when a task only needs a single file-manager panel, and Desktop when the lesson is teaching window/desktop skills (opening/closing/arranging apps) alongside file management.

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
    availableApps: [fileManager] # optional — defaults to ["fileManager"]; also: textEditor, imageViewer, paint, browser
    siteGraph:                    # optional — only meaningful when availableApps includes "browser"; see "Browser" below
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

**Desktop state model:** `{ fs, recycleBin, windows, browserVisited, lastSearchQuery }`.

- `fs` is the same flat path map as the Filesystem module (see `docs/authoring/filesystem.md`) and is seeded with a `/Downloads/` folder by default.
- `recycleBin` is an array of soft-deleted items (`{ path, entries, originalParent, deletedAt }`), populated automatically as the student deletes files — do not author this by hand except to pre-seed a "restore this" starting scenario.
- `windows` is the initial window layout: an array of `{ id, appId, x, y, width, height, minimized, maximized, zIndex, filePath?, draftContent?, pageId?, searchQuery? }`. Leave empty (`[]`) to start with a bare desktop the student must open apps from, or pre-populate to start a task with a window already open (e.g. mid-lesson checkpoints).
  - `filePath` (Text Editor, Image Viewer) — the file that window is showing; omit for a blank/untitled window.
  - `draftContent` (Text Editor only) — the window's current unsaved buffer. Text Editor does **not** autosave: typing updates `draftContent` on the window, and only Save/Save As writes it into `fs`. A window is "dirty" (title shows a `•`, closing asks for confirmation) whenever `draftContent` differs from the saved file content.
  - `pageId` / `searchQuery` (Browser only) — which `siteGraph` page the window shows, or the search query if it's showing search results. Omit both to start on the site graph's homepage.
- `browserVisited` is a dedup array of every `siteGraph` page id the student has ever navigated to, across every Browser window — populated automatically; back it with the `browser_visited` check. Defaults to `[]`.
- `lastSearchQuery` is the most recent free-text query submitted to the simulated search engine, or `null` — populated automatically; back it with the `search_query` check.

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

## Paint

A freehand drawing canvas: Brush/Eraser tools, an 8-colour palette plus a custom colour picker,
three brush sizes, Undo (per-session, up to 20 steps), and Clear. Like Text Editor, it does
**not** autosave — drawing updates the window's `draftContent` (a PNG `data:` URL snapshot taken
after each stroke), and only Save/Save As writes it into `fs`. Opening a different file while the
current window has unsaved edits opens a **new** Paint window, same as Text Editor.

Saved files carry their image data directly on `content` as a `data:image/png;base64,...` URL —
Image Viewer and File Manager both already read that as a fallback when there's no authored
`src`/asset (see `imagePreviewSrc` in `docs/authoring/filesystem.md`'s underlying code), so a
Paint drawing previews correctly everywhere a lesson-authored image does. Opening an image from
File Manager always launches **Image Viewer** (read-only), never Paint — to edit an existing
drawing, open it from inside Paint's own Open dialog instead. Paint's Open dialog only lists
`.png` files whose content is actually a `data:image/` URL (i.e. files Paint itself saved); an
author-provided static asset image can't be loaded into the canvas for editing.

---

## Browser

A simulated web browser: Back/Forward/Refresh/Home chrome, an editable address bar, and a
lesson-authored `siteGraph` of fake pages instead of the real internet. Nothing it shows ever
makes a real network request.

```yaml
    siteGraph:
      homepageId: home              # optional — defaults to the first page if omitted/invalid
      pages:
        home:
          url: https://kidsearch.example
          title: KidSearch
          kind: search               # 'page' (default) | 'search' | 'broken' | 'download'
          content: A safe search engine for practising research skills.
          links: []
        wildlife-facts:
          url: https://wildlife.example/facts
          title: Wildlife Facts
          content: Blue whales are the largest animal ever known to have lived.
          links:
            - { label: Back to KidSearch, to: home }
          searchable:                 # present => indexed by the search engine; omit to hide a page from search
            keywords: [whale, animal, wildlife]
            snippet: Facts about blue whales and other wildlife.
        sponsored-ad:
          url: https://buy-whale-plushies.example
          title: Buy Whale Plushies Now!
          content: Cuddly whale toys for sale.
          sponsored: true            # pins this result above organic ones, labelled "Ad"
          searchable:
            keywords: [whale]
            snippet: Shop cute whale merchandise.
        poster-download:
          url: https://wildlife.example/poster
          title: Ocean Poster
          kind: download
          content: Get a printable poster about ocean animals.
          download: { fileName: ocean-poster.txt, content: "A poster about ocean animals." }
        dead-link:
          url: https://wildlife.example/old-page
          title: Old Page
          kind: broken
```

- `homepageId` picks which page Home/a fresh Browser window opens on. Falls back to the site
  graph's first authored page if omitted or invalid.
- Each page's `kind` controls how it renders: `page` (default) shows `content` and `links`;
  `search` additionally shows an inline search box (author exactly one such page per site graph —
  typically the homepage); `broken` shows an unreachable-page message and nothing else; `download`
  shows a Download button that writes `download.content` into `fs` at `/Downloads/download.fileName`
  (reuse the existing `fs_path`/`fs_file_content` checks to verify a download happened).
- `links` navigate to another page by id. A `to` that doesn't resolve to a page (e.g. simulating a
  dead link without authoring the target) shows the same unreachable-page message as `kind: broken`.
- `searchable` opts a page into the search index: `keywords` and title score highest, `snippet`
  scores lowest, and results are ranked by total match score. `sponsored: true` pins a result to
  the top of its results list (ahead of organic matches) and labels it "Ad" — the search engine
  does not otherwise judge relevance or truthfulness; an authored irrelevant/misleading page ranks
  exactly as well as its keywords earn. That's deliberate — Unit 3 teaches pupils to *tell apart*
  a sponsored/misleading/irrelevant result from a genuine one, not to have the platform filter it
  out for them.
- Typing an address that doesn't match any page's `url` (case-insensitive, trailing slash
  ignored) shows the unreachable-page message rather than navigating.
- `siteGraph` is only meaningful when `availableApps` includes `browser`, and is currently
  hand-authored as JSON/YAML — there is no visual site-graph editor in the Builder yet (the same
  gap `sandboxStarterDesktop` has).

---

## Desktop Check Types

Every Filesystem check type works unchanged against a Desktop task's `fs` — see `docs/authoring/filesystem.md` for `fs_path`, `fs_file_content`, `fs_file_line_count`, `fs_file_location`, `fs_folder_count`, and `fs_opened`.

Additional Desktop-only check types:

| Type | Operators | Fields | Notes |
|---|---|---|---|
| `fs_recycle_bin` | `is_in`, `not_in` | `path` | Whether an item (matched by its original path) is currently in the Recycle Bin |
| `window_state` | `opened`, `closed`, `minimized`, `maximized` | `appId` | State of the named app's window (`fileManager`, `textEditor`, `imageViewer`, `paint`, or `browser`) |
| `windows_arranged_side_by_side` | `is_arranged` | `appIds` (two app IDs) | Tolerant geometry check: both windows visible, each occupying a meaningful share of the screen, minimal overlap. Assesses "arranged side by side" as an outcome, not exact pixel positions |
| `browser_visited` | `visited`, `not_visited` | `pageId` | Whether the student has ever navigated to that `siteGraph` page id, in any Browser window |
| `search_query` | `contains`, `not_contains`, `equals` | `text` | Compares the most recent search-engine query (case-insensitive) against `text` |

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

- Text Editor is plain text only — bold/italic/underline/alignment formatting are planned for a
  later release and are not part of this contract yet.
- `window_state` matches the *first* window found for an `appId`; it doesn't distinguish between
  several simultaneously-open Text Editor, Paint, or Browser windows.
- Paint's Undo is per-window-session only (not persisted) and capped at 20 steps; there's no Redo.
  It has no shape/fill/text tools — freehand brush and eraser only.
- `siteGraph` has no visual Builder editor yet — author it as hand-written JSON/YAML on the task,
  the same gap `sandboxStarterDesktop` has.
- There's no 4-level graduated hint ladder (restate outcome → identify app/area → name control →
  highlight control) from the source spec yet. The existing generic "reveal the next `codeStages`
  checkpoint after repeated failures" mechanism already works for Desktop tasks in solo mode (it's
  gated by lesson type, not module type), but that replaces the student's whole state with an
  authored snapshot — it isn't a graduated textual hint, and there's no "highlight this control"
  UI primitive yet. This needs its own authored-content design (where would per-level hint text
  live?) before it can be built.
- No dedicated accessibility/difficulty-scaling pass (UI-scale token, reduced-visual-complexity
  mode) yet — an author can already vary difficulty indirectly (file/folder count, `siteGraph`
  page/distractor count, app count) through what they author, but there's no platform-level control
  for it.
- The Browser's back/forward history and current page are local to a window session — closing and
  reopening a Browser window resets to the site graph's homepage; only *that a page was ever
  visited* (`browserVisited`) and the *last* search query (`lastSearchQuery`) persist.
- Recycle-Bin/Downloads/window-layout/unsaved-draft/browser-visit state is stored in the same
  localStorage/RTDB fields as other module types — it does not survive a browser or device switch
  for anonymous students, the same caveat that already applies to Python `.launchpad` backups.
- The support-stage reveal ladder (progressive hints) is not available for Desktop tasks yet, matching the Filesystem module's current behaviour.
- `windows_arranged_side_by_side` compares window geometry against an assumed 1200px-wide viewport rather than the student's actual window size.
