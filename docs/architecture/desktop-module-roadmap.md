# Desktop Module Roadmap

**Status:** Phases 1–3 shipped, plus Paint and a teacher-live-view fix from Phase 4 (2026-08-18, branch `feature/digital-literacy-desktop-module`). The rest of Phase 4 — a graduated textual hint ladder and an accessibility/difficulty-scaling pass — needs its own design pass before implementation; see the notes under Phase 4 below for why.

## Purpose

`docs/architecture/Digital Literacy Foundations.pdf` specifies a 12-lesson course (ages 7–12) teaching practical computer/web literacy — mouse/keyboard, windows, files/folders, browsing/searching/evaluating — rather than programming. Its "Platform Requirements" section asks for a simulated desktop OS: movable/resizable windows, a taskbar, a Recycle Bin, a File Manager, a Text Editor, Paint, an Image Viewer, and a simulated browser + search engine with lesson-authored fake websites.

This is being built as a new `desktop` lesson module to replace/supersede the plain single-panel `filesystem` module for lessons that need windowed, multi-app desktop interaction. `docs/architecture/composed-lessons-spec.md` explicitly scoped "Virtual OS/VFS work" out of its own delivery — this roadmap is that deferred work.

For the authoring contract of what's shipped, see `docs/authoring/desktop.md`. This doc tracks what's built vs. what's left.

## Phase 1 — shipped

A new `desktop` module (`src/modules/desktop/`): a window manager (drag/resize/minimize/maximize/focus), a desktop shell (icon grid, taskbar, clock), and a File Manager app wrapping the existing `FilesystemTask` component with a Recycle Bin (soft-delete/restore), search, and sort.

Wired end-to-end: new check types (`fs_recycle_bin`, `window_state`, `windows_arranged_side_by_side` — plus every existing `fs_*` check type works unchanged), Builder authoring UI and validation (`src/builder/lessonUtils.js` and `cli/validate.mjs`), carry-through, remote reset, personal sandbox, and teacher live-view/sandbox editing (`useStudentCodeState.js`, `useTeacherLivePublish.js`, `StudentView.jsx`, `TeacherView.jsx`, `TeacherEditorPanel.jsx`, `composedLesson.js`, `taskUtils.js`).

Covers Unit 2 of the course (Lessons 5–7: Files and Folders) and the window-management half of Unit 1 (Lessons 1 and 4).

Verified: full `npm test` suite (127 files / 1724 tests, zero regressions), `npm run docs:check`, and a production `vite build`.

### Known gaps left in Phase 1 on purpose

- `SandboxStarterModal.jsx` (the Builder's lesson-level sandbox-starter authoring UI) was not extended to Desktop — a lesson-level `sandboxStarterDesktop` works at runtime but must be hand-edited as JSON; there's no visual editor for it yet.
- `printLesson.js` (PDF lesson export) was not extended — a Desktop lesson exports without its starter/complete desktop fields rendered.
- `windows_arranged_side_by_side` assumes a fixed 1200px viewport rather than the student's actual window size.
- The support-stage hint-reveal ladder is not available for Desktop tasks, matching the Filesystem module's current behaviour.

## Phase 2 — Text Editor + Image Viewer — shipped

A plain-text Text Editor app (`apps/textEditor/TextEditorApp.jsx`) and a read-only Image Viewer
app (`apps/imageViewer/ImageViewerApp.jsx`), plus a shared Open/Save/Save As dialog
(`apps/shared/FileDialog.jsx`) — the first explicit-save UI in the platform; every other module
type autosaves continuously.

- Opening a file in File Manager now launches Text Editor or Image Viewer (by extension) as a
  separate window instead of File Manager's old inline preview; `FilesystemTask.jsx` gained an
  optional `onOpenFile` prop for this (unset everywhere else, so the plain `filesystem` module's
  inline preview is unchanged).
- Windows gained two optional fields: `filePath` (which file a window shows) and `draftContent`
  (Text Editor's unsaved buffer). `openWindow` now dedupes by `(appId, filePath)` instead of
  `appId` alone, so several Text Editor windows can be open at once. A generic
  `isWindowDirty(win, fs)` helper drives both the title-bar `•` indicator and a confirm-before-
  close prompt in `WindowManager.jsx` — any app that sets `draftContent` gets this for free.
- Rich-text formatting (bold/italic/underline/alignment) was explicitly deferred — Text Editor
  ships plain-text only, per the user's sign-off, avoiding a new dependency per AGENTS.md.
- `availableApps` now has a checkbox picker in the Builder (`DesktopTaskWorkspace.jsx`); it only
  gates which icons appear on the desktop — opening a file always launches the right viewer
  regardless of `availableApps`.
- No new check types: `window_state` already worked generically by `appId`, and `fs_opened`
  already worked off the existing `desktopInteraction.openFile` context field — both apps just
  call the same `onInteraction` callback File Manager already used.
- Unlocks the rest of Unit 1 (Lessons 2–3).

### Known gaps left in Phase 2 on purpose

- No rich-text formatting (see above).
- `window_state` matches the first window found for an `appId` — it can't target one specific
  file among several open Text Editor windows.
- Text Editor's Open dialog doesn't filter out image files (opening one shows an empty/garbled
  buffer since image entries don't carry meaningful `content`).

## Phase 3 — Simulated Browser + Search Engine — shipped

A **Browser** app (`apps/browser/BrowserApp.jsx`) over a lesson-authored, read-only `siteGraph`
(`apps/browser/siteGraph.js`): pages with content and links, a `sponsored` flag for ad-style
search results, `kind: 'broken'` unreachable pages, and `kind: 'download'` pages whose Download
button writes into the desktop's `/Downloads/` folder (reusing `filesystem.js`'s `createEntry` —
no new check type needed, `fs_path`/`fs_file_content` already verify it, matching Phase 2's
"reuse what already exists" pattern).

- Browser chrome: Back/Forward/Refresh/Home and an editable address bar that resolves a typed URL
  against `siteGraph` page `url`s (case-insensitive, trailing-slash tolerant), or shows an
  unreachable-page message.
- A simulated search engine: free-text query matching over each page's optional `searchable`
  field (title > keywords > snippet scoring), with `sponsored` results pinned ahead of organic
  ones and labelled "Ad". The engine does not itself judge relevance/truthfulness — ranking a
  misleading/irrelevant authored page correctly is the pupil's job, not the platform's, per spec.
- Two new check types: `browser_visited` (has the pupil ever navigated to a given page id) and
  `search_query` (does the last submitted search query match). Both read off two new desktop-state
  fields, `browserVisited` (dedup visit log) and `lastSearchQuery` — plain arrays/strings alongside
  `fs`/`recycleBin`/`windows`, following the exact pattern `recycleBin` already established.
- Unlocks Unit 3 (Lessons 8–11) — the largest single unit in the course.

Verified: full `npm test` suite (132 files / 1764 tests, zero regressions).

### Known gaps left in Phase 3 on purpose

- `siteGraph` has no visual Builder editor — hand-authored JSON/YAML on the task, the same gap
  `sandboxStarterDesktop` has (see Phase 1's known gaps).
- Back/forward history and the current page are local to a Browser window's session, not
  persisted desktop state — closing and reopening a window resets to the homepage. Only *that* a
  page was ever visited, and the *last* search query, persist (via `browserVisited`/`lastSearchQuery`).
- No tabs — one page/search-result view per Browser window, same one-view-per-window model as
  Text Editor/Image Viewer.
- `window_state` still matches the first window found for an `appId`, so it can't target one
  specific Browser window among several open at once (same known Phase 2 gap, now also true of
  Browser windows).

## Phase 4 — Paint, hints, teacher streaming, accessibility

### Paint — shipped

A freehand canvas app (`apps/paint/PaintApp.jsx`): Brush/Eraser, an 8-colour palette plus a custom
colour picker, three brush sizes, per-session Undo (up to 20 steps), and Clear. Explicit-save,
same model as Text Editor (`draftContent`/dirty tracking, Open/Save/Save As via the shared
`FileDialog`). Saved files store their image directly as a `data:image/png;base64,...` URL on
`content` — this required extending `imagePreviewSrc` (`FilesystemTask.jsx`) to fall back to
inline `content` when there's no authored `src`/asset, since previously it only resolved
lesson-authored asset images. That extension is what lets Image Viewer and File Manager preview a
Paint drawing with no other change needed. No new check type — `window_state` and `fs_*` checks
already cover it.

While wiring Paint into `TeacherLiveView.jsx`, found and fixed a real gap Phase 3 shipped with:
the Browser app was never registered there, so a teacher observing a student's live desktop
session couldn't see the Browser icon or any open Browser window at all (`Desktop.jsx`/
`WindowManager.jsx` both silently skip a window when `apps[appId]` is missing). Browser and Paint
are both now registered in the teacher live view.

### Teacher live-view streaming — already substantially covered, doc corrected

This roadmap previously described teacher live-view as needing to move "from a JSON-snapshot
`code` field to real window/app state streaming." That undersold what Phase 1 already built:
`useTeacherLivePublish.js` re-publishes the *entire* `desktopState` (fs, recycleBin, windows,
browserVisited, lastSearchQuery — everything) as JSON in the `code` field on every state change,
and `DesktopTeacherLiveView.jsx` renders that through the same interactive `Desktop` shell the
student uses, not a static snapshot. A teacher already sees window drags, app opens, file edits,
Browser navigation, and Paint strokes as they happen (each committed change, not sub-stroke/
sub-drag granularity — there's no equivalent yet of the continuous cursor/drag streaming the
Scratch live-view added for block dragging). If that finer granularity turns out to matter for
Desktop specifically, it's a separate, scoped follow-up — not a gap in today's live view.

### Remaining: graduated hint ladder, accessibility pass (not started)

- The source spec's 4-level hint ladder (restate outcome → identify app/area → name control/
  action → highlight control) is a *different* feature from the "reveal next `codeStages`
  checkpoint" mechanism Phase 1 already exposed generically for Desktop (in solo mode, after 2
  failed attempts) — that mechanism replaces the student's whole state with an authored snapshot;
  it isn't graduated textual hint copy. Building the real ladder needs a design decision this
  session didn't make: where does each level's hint text live (a new authored field per check?
  per task?), and what does "highlight this control" even mean generically across File Manager/
  Text Editor/Paint/Browser's very different UIs. `useCheckFeedback.js`'s `checkFailCount` is the
  right signal to key off; the authored-content model is the open question.
- Accessibility pass: a UI-scale token, reduced-visual-complexity mode. "Adjustable difficulty"
  (file/folder count, guidance amount, search distractors, app count) is already achievable today
  through how a lesson is authored — that part isn't a platform gap, just an authoring choice.
- Needed for Lesson 12's consolidation challenge (combines file management, Recycle Bin, browsing, search, downloads in one scenario) and general polish.

## Usually changes with

Per `docs/architecture/feature-impact-map.md`'s "Lesson Type Modules" pattern: `src/modules/desktop/`, `src/modules/registry.js`, `src/modules/__tests__/moduleInterface.test.js`, `src/app/hooks/useStudentCodeState.js`, `src/app/hooks/useTeacherLivePublish.js`, `src/app/views/StudentView.jsx`, `src/app/views/TeacherView.jsx`, `src/app/views/teacher/TeacherEditorPanel.jsx`, `src/builder/lessonUtils.js`, `cli/validate.mjs`, `src/shared/composedLesson.js`, `src/shared/taskUtils.js`, `docs/authoring/desktop.md`, `docs/authoring/CHANGELOG.md`, and this file.
