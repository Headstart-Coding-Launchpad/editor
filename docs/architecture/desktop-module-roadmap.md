# Desktop Module Roadmap

**Status:** Phases 1–2 shipped (2026-08-04, branch `feature/digital-literacy-desktop-module`). Phases 3–4 are scoped below but not yet designed in detail — each needs its own short planning pass before implementation.

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

## Phase 3 — Simulated Browser + Search Engine (not started)

The largest remaining piece — nothing in the codebase to reuse beyond the Blob-URL/sandboxed-iframe technique in `src/modules/html/iframe.js` as a rendering precedent.

- A lesson-authored "site graph": pages, links, search index, sponsored/irrelevant/misleading results, broken pages, downloadable files.
- Browser chrome: address bar, tabs, Back/Forward/Refresh/Home, loading state.
- A simulated search engine: free-text query matching, ranked results, sponsored-result distinction, and a check type that can inspect the pupil's query.
- Controlled downloads that write into the desktop's `/Downloads/` folder (the folder already exists in `desktopState.js`'s default fs — Phase 1 seeded it for this).
- Unlocks Unit 3 (Lessons 8–11) — the largest single unit in the course.

## Phase 4 — Paint, hints, teacher streaming, accessibility (not started)

- Paint app: new canvas, informed by Arcade Kit's pixel-paint interaction pattern in `ArcadeDesignStudio.jsx`.
- Extend the existing support-stage/hint escalation (`useCheckFeedback.js`, `supportRevealLog`) to the spec's 4-level ladder (restate outcome → identify app/area → name control/action → highlight control). The fail-count-driven state machine already exists; "highlight the control" has no analog yet.
- Extend teacher live-view from a JSON-snapshot `code` field to real window/app state streaming in `teacherLive` payloads, plus a richer `DesktopTeacherLiveView`.
- Accessibility pass: a UI-scale token, reduced-visual-complexity mode, and adjustable difficulty (file/folder count, control size, guidance amount, search distractors, app count).
- Needed for Lesson 12's consolidation challenge (combines file management, Recycle Bin, browsing, search, downloads in one scenario) and general polish.

## Usually changes with

Per `docs/architecture/feature-impact-map.md`'s "Lesson Type Modules" pattern: `src/modules/desktop/`, `src/modules/registry.js`, `src/modules/__tests__/moduleInterface.test.js`, `src/app/hooks/useStudentCodeState.js`, `src/app/hooks/useTeacherLivePublish.js`, `src/app/views/StudentView.jsx`, `src/app/views/TeacherView.jsx`, `src/app/views/teacher/TeacherEditorPanel.jsx`, `src/builder/lessonUtils.js`, `cli/validate.mjs`, `src/shared/composedLesson.js`, `src/shared/taskUtils.js`, `docs/authoring/desktop.md`, `docs/authoring/CHANGELOG.md`, and this file.
