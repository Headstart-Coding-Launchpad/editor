# CODEBASE_MAP.md

One-line role for every source file. When a pull request adds, moves, or removes a source component or test target, update this map and consider the corresponding inventory in `TESTING.md`.

Referenced from `AGENTS.md`. Use this as a navigation index: search headings or open only the section relevant to the current task instead of loading the whole file by default.

---

## Entry Points

| File | Role |
|---|---|
| `src/main.jsx` | App DOM entry — renders App into #root |
| `src/App.jsx` | Root router (HashRouter): `/login`, `/lesson/:lessonId`, `/admin`, `/builder`, and fallback to LandingPage |
| `src/index.css` | Global styles: brand CSS custom properties, button variants, status dots, animations, syntax highlight overrides |
| `src/builder/App.jsx` | Builder route component: lesson lifecycle, localStorage auto-save, lesson type chooser, restore/save dialogs |
| `src/builder/spritePresets.js` | Pure reusable Scratch sprite preset validation and unique lesson-sprite creation helpers |

---

## Auth (`src/auth/`)

| File | Role |
|---|---|
| `AuthContext.jsx` | `AuthProvider` — `onAuthStateChanged` listener; provides `{ user, role, loading }` via React context |
| `useAuth.js` | `useAuth()` hook — thin re-export of `AuthContext` |
| `ProtectedRoute.jsx` | Route guard — shows loading screen, then redirects to `/login?redirect=…` if unauthenticated or wrong role |

---

## Admin Portal (`src/admin/`)

| File | Role |
|---|---|
| `AdminPortal.jsx` | Admin portal shell: header with sign-out, tab switcher between Lessons, Topics, Shared Assets, Accounts, and Feedback panels |
| `AccountManagement.jsx` | Firestore `users` real-time list; create/role/disable/enable/delete via Cloud Functions |
| `LessonPanel.jsx` | Firestore `lessons` list grouped by type then level; Launch as Teacher link and Copy Student Link per lesson |
| `TopicLibraryPanel.jsx` | Firestore `topicLibrary` CRUD editor: searchable topic list, full topic form with MarkdownFieldEditor for description/syntax fields |
| `FeedbackPanel.jsx` | Firestore `platformFeedback` real-time list; displays date, teacher email, lesson/task context, and feedback text |
| `SharedAssetsPanel.jsx` | `lessonTypeAssets` Firestore CRUD: per-type Firebase Storage file upload/delete and Scratch default sprite editor |

---

## Classroom Views (`src/app/views/`)

| File | Role |
|---|---|
| `LandingPage.jsx` | Entry screen: student types lesson ID to navigate to `/lesson/:lessonId` |
| `LoginPage.jsx` | Email/password sign-in form; reads `?redirect` param and navigates after success |
| `LessonRoute.jsx` | URL dispatcher: reads `:lessonId` + query params; auth-guards teacher paths, routes to TeacherView or StudentView |
| `StudentView.jsx` | Main student experience: all phases (loading → waiting → name-entry → lesson/sandbox/solo → ended) |
| `TeacherView.jsx` | Teacher dashboard: collapsible 3-panel layout, session lifecycle controls, student grid |

---

## Classroom Modules (`src/app/`)

| File | Role |
|---|---|
| `studentStorage.js` | Student task/file localStorage key construction and saved-work persistence helpers; personal sandbox load/save helpers |
| `studentTaskContent.js` | Pure student task-content selection and carry-through precedence helpers |
| `studentLiveDisplay.js` | Pure student teacher-live/view display selection and live HTML file conversion helpers |
| `studentQuizContent.js` | Pure quiz suggestion helpers: maps wrong answers to option/task/check hint feedback |
| `teacherSandboxContent.js` | Pure teacher sandbox starter/configured content selection and fallback rules |
| `teacherLivePayload.js` | Pure student-to-teacherLive broadcast payload construction |

---

## Classroom Components (`src/app/components/`)

| File | Role |
|---|---|
| `TopBar.jsx` | Header: lesson title, level badge, SOLO/LIVE/SANDBOX badge, student name, progress dots slot |
| `TaskNavigator.jsx` | Left sidebar: task list with group collapse, run/check stats, sandbox and pause controls |
| `TaskProgressDots.jsx` | Top bar progress indicator: clickable past dots, locked future dots, current highlighted |
| `ExplainerPanel.jsx` | Collapsible Markdown explainer panel above the editor |
| `PythonEditor.jsx` | Python CodeEditor wrapper with Pyodide loading/error status |
| `OutputPanel.jsx` | Python output with retro typing animation and inline `input()` prompt |
| `HtmlEditor.jsx` | Tabbed HTML/CSS/JS editor with optional asset browser drawer |
| `IframePreview.jsx` | Sandboxed iframe output with console log capture tab (receives postMessage from iframe) |
| `CollapsibleIframePreview.jsx` | Slide-in toggle wrapper around IframePreview |
| `ScratchWorkspace.jsx` | Full Scratch IDE: multi-sprite Blockly workspaces, stage canvas, sprite drag, check evaluation |
| `QuizTask.jsx` | Polymorphic quiz: multiple-choice (grid), match (drag-drop), fill-blank (drag/type), short-answer, confidence (1–5 rating) |
| `CheckFeedbackBanner.jsx` | Pass/fail banner with optional hint and "see complete code" action |
| `WaitingRoom.jsx` | Full-screen modal: lesson title + animated "your teacher is getting ready" message |
| `JoinChoiceScreen.jsx` | Choice screen: Wait for Teacher or Work Solo (shown when no active session) |
| `JoinSessionPrompt.jsx` | Modal: option to join a live session that started during solo work |
| `NameEntry.jsx` | Student name input with duplicate-suffix handling and solo fallback |
| `StudentGrid.jsx` | Grid of StudentCards with collapse toggle and check conditions display |
| `PresenceBadge.jsx` | Shared online/offline/waiting badge used by StudentCard and StudentModal |
| `StudentCard.jsx` | Compact card: name, online/run/check badges, code/output/quiz snippet, expand button |
| `StudentModal.jsx` | Full-width modal: student workspace view + teacher actions (Go Live, Remote Reset, Check Override, Rename, Remove) |
| `LiveActivityToast.jsx` | Transient live-view notice for editor copy, paste, and click activity |
| `TeacherTimers.jsx` | Timer strip for elapsed lesson time, planned duration, and active-task countdown |
| `TeacherSessionControls.jsx` | Teacher top-bar task navigation, presentation/share links, and session action controls |
| `TeacherCodeTabs.jsx` | Starter/stage/complete tab strip shown above teacher code editors; includes "Send to all" action |
| `TeacherPreviewBanner.jsx` | Status banner shown when the teacher previews a task without moving students |
| `TeacherSandboxBanner.jsx` | Status banner shown in sandbox staging/live mode with action buttons |
| `TeacherEndSessionModal.jsx` | Confirmation modal for ending a live session, with End and End+Home actions |
| `TeacherFeedbackModal.jsx` | Two-tab modal for submitting lesson feedback (per-task, stored in Firestore subcollection) or platform feedback (stored in `platformFeedback` collection) |
| `InformationTask.jsx` | Read-only information/introduction task rendering for lesson flow |
| `FilesystemTask.jsx` | Student-facing Windows Explorer-style virtual filesystem UI: folder tree, icon grid, drag-and-drop move, inline rename, CodeMirror file editor |
| `CollapsiblePanelControls.jsx` | Shared collapse/expand tab controls for classroom and builder panels |
| `TaskSlideTransition.jsx` | Animated slide transition wrapper used when switching between tasks |
| `StudentEditorHeader.jsx` | Shared editor header bar (Code label + Run/Submit/Reset buttons) for HTML task editors |
| `LoadingScreen.jsx` | Centred loading/error message screen for StudentView phases |
| `SessionEndedScreen.jsx` | "Session ended" screen with Continue Solo action — rendered when phase === 'ended' |
| `StudentStatusBanners.jsx` | Teacher-live, viewing-previous, and personal-sandbox notification banners shown above the task body |
| `LessonTaskContent.jsx` | Task content area: TaskSlideTransition wrapper, ExplainerPanel, CheckFeedbackBanner, and task-type dispatch (Python, HTML desktop/mobile, Scratch, Filesystem, Quiz, Information) |
| `SoloNav.jsx` | Bottom prev/next navigation bar for solo mode; includes Open Sandbox shortcut |

---

## Classroom Hooks (`src/app/hooks/`)

| File | Role |
|---|---|
| `useIdentity.js` | Anonymous ID and display name management; localStorage persistence; session timestamp comparison |
| `useSession.js` | Firebase session listener and full command layer: session lifecycle, student sync, sandbox, teacherLive, remote reset |
| `useLessonLoader.js` | Firestore lesson fetch (or lessonProp pass-through); returns `{ lesson, lessonLoading, firstTaskId }` |
| `useStudentPhase.js` | Student phase state machine (loading → waiting → name-entry → lesson → sandbox → solo → ended); owns `phase`, `currentTaskId`, `viewingTaskId` |
| `useStudentCodeState.js` | All student editor/code workspace state: code, files, output, check results, personal sandbox, run/stop handlers; composes the four sub-hooks below |
| `usePyodideState.js` | Pyodide warm-up effect, `pyodideStatus` state, and `initPyodideIfNeeded()` helper |
| `useCheckFeedback.js` | Check result state (`checkPassed`, `checkAttempted`, `checkSuggestion`, `repeatedSuggestionCount`, `testResults`); `resetCheckFeedback` / `applyCheckFeedback`; teacher check-override effect |
| `createStudentPersistence.js` | Conditional localStorage save helpers: routes each write to the sandbox or normal task key based on `inPersonalSandboxRef` |
| `useTeacherLivePublish.js` | Teacher-live broadcast helpers (`canPublishTeacherLive`, `currentTeacherLivePayload`, `publishTeacherLive`), `teacherLiveIframeSrc` and `htmlPreviewCollapsed` state, and the two teacher-live sync effects |
| `useTileDragAndDrop.js` | Shared drag-and-drop + tap-to-place hook for tile-based quizzes (MatchQuiz, FillBlankQuiz); also exports `readDraggedTileId`, `writeDraggedTileId`, `setLiftedDragImage`, `removeTileFromState` |

---

## Builder Views (`src/builder/views/`)

| File | Role |
|---|---|
| `BuilderView.jsx` | Main builder layout: 3-pane (meta / task list / editor), download/upload/print/publish handlers |
| `PreviewView.jsx` | Preview mode: wraps StudentView read-only so teacher can test the student experience |

---

## Builder Modules (`src/builder/`)

| File | Role |
|---|---|
| `lessonUtils.js` | Pure builder lesson validation and export normalisation rules |
| `printLesson.js` | `buildPrintHtml(lesson)` — generates printable HTML string from lesson JSON (no DOM) |

---

## Builder Hooks (`src/builder/hooks/`)

| File | Role |
|---|---|
| `useBuilderState.js` | Task CRUD state and handlers (add, duplicate, delete, reorder, subtasks) plus derived state (errors, warnings, flatTasks, selectedTask/Group) — no DOM, independently unit-testable |
| `useTaskEditorState.js` | Run/check/output state and handlers for the task editor: `handleRun`, `handleRunTests`, `handleStop`, `handleTestChecks`, `handleQuizPreviewSelect`, `handleInputSubmit`, `resetRunState` |

---

## Builder Components (`src/builder/components/`)

| File | Role |
|---|---|
| `LessonMetaPanel.jsx` | Lesson-level metadata: id, type, title, description, level, assets, sandbox config modals |
| `TaskList.jsx` | Left sidebar: task/group tree with drag-reorder, selection, creation, validation summary |
| `TaskEditor.jsx` | Task editor composition root (≤500 lines): orchestrates sub-components and workspace panels; delegates run/check state to `useTaskEditorState`; re-exports `ScratchToolboxPicker`, `SpriteManager`, `BackdropManager` |
| `ExplainerEditor.jsx` | Markdown editor with Edit/Preview tabs; live rendering via MarkdownRenderer |
| `FileManager.jsx` | HTML file list: add/delete/type-change, entry file picker, HTML+CSS+JS template generator |
| `BuilderOutputPanel.jsx` | Output panel with check results, retro typing animation, and `input()` prompt for builder |
| `GroupEditor.jsx` | Inline editor for a task group's title and subtask count summary |
| `ValidationPanel.jsx` | Collapsible errors/warnings panel with tabbed view and per-warning ignore action |
| `TaskFeedbackPanel.jsx` | Collapsible panel showing teacher-submitted lesson feedback items for the selected task |
| `BuilderToolbar.jsx` | Top toolbar: branding, dirty indicator, and all action buttons (new/upload/preview/print/download/publish) |

### Task Editor Sub-modules (`src/builder/components/task-editor/`)

| File | Role |
|---|---|
| `styles.js` | Shared inline style object `s` and `CODE_FONT_STYLE` used across all task-editor sub-modules |
| `TaskEditorFields.jsx` | Shared primitives: `Field`, `QuizTypeIcon`, `TaskFormatIcon`, `CodeWorkspaceTabs`, `Modal`, `CarryThroughPicker`, `SpriteManager`, `CostumeManager`, `BackdropManager` |
| `QuizEditors.jsx` | Quiz-type builders: `QuizTypePicker`, `MatchPairsBuilder`, `FillBlankBuilder`, `ShortAnswerBuilder`, `QuizOptionsBuilder` |
| `CheckEditors.jsx` | Check utilities and editors: `subjectOpFromType`, `typeFromSubjectOp`, `getOperatorOptions`, `makeCheckSkeleton`, `CheckValueEditor`, `CheckListEditor` |
| `ScratchEditors.jsx` | Scratch toolbox data, `buildScratchToolboxXml`, `parseScratchToolboxXml`, `ScratchToolboxPicker`, `ScratchCheckListEditor`, `ScratchCheckEditor` |
| `FilesystemEditors.jsx` | Builder sub-module: `FsTreeEditor` (visual starter/complete FS editor) and `FsCheckListEditor` (filesystem check builder) |
| `TestsEditor.jsx` | Builder sub-module: `TestsEditor` — CRUD UI for Python task test cases (inputs + check per test) |
| `TaskPreviewPanel.jsx` | Titled wrapper panel used to render the student-facing quiz/information preview in the builder |
| `TaskCheckResults.jsx` | Pass/fail check result banner shown after running or testing checks in the builder |
| `TaskRunControls.jsx` | Run/Stop/Run Tests button row for the Python task builder |
| `TaskTestResults.jsx` | Output + test-suite results panel for the Python task builder; wraps `BuilderOutputPanel` |
| `TaskOptionsSection.jsx` | Collapsible "Task options" section: carry-through, interaction mode, completion check, incorrect checks, and tests |
| `PythonTaskWorkspace.jsx` | Python code editor + run controls panel for the builder (starter/complete/stage tabs) |
| `FilesystemTaskWorkspace.jsx` | Filesystem tree editor panel for the builder (starter/complete/stage tabs) |
| `HtmlTaskWorkspace.jsx` | HTML editor with file manager + live preview split pane for the builder |
| `ScratchTaskSetup.jsx` | Scratch block editor modal and setup summary; owns all scratch-specific state and handlers |

---

## Shared Modules (`src/shared/`)

| File | Role |
|---|---|
| `CodeEditor.jsx` | Shared CodeMirror React wrapper: language/readOnly via compartments, no remount on prop change |
| `SplitPane.jsx` | Draggable two-pane splitter: [15%, 85%] clamped, collapsible right pane with fixed width option |
| `AssetBrowser.jsx` | Read-only lesson asset browser: file tree, click-to-copy paths, image hover preview |
| `AssetImagePreview.jsx` | Shared asset image thumbnail and preview presentation |
| `AssetPicker.jsx` | Dropdown asset picker for builder inputs: grouped by lesson/shared/common sources, manual fallback |
| `assetPaths.js` | Encoded absolute asset URL construction for iframe and Scratch consumers |
| `useAssets.js` | Hook for fetching `public/assets/manifest.json` (returns empty arrays when absent); exposes `lessonAssets`, `sharedAssets`, `lessonFolderAssets` for static asset paths — currently returns empty everywhere |
| `useTypeAssets.js` | Hook for fetching `lessonTypeAssets/{type}` from Firestore; returns `typeStorageAssets` and `defaultSprites` for type-wide shared files and Scratch sprite defaults |
| `topicLibrary.js` | Topic-library Firestore loader (`topicLibrary` collection) plus type-filtered search, wiki-link expansion, author suggestion helpers, and `clearTopicCache()` |
| `TopicLibraryView.jsx` | Topic hover-card and searchable dialog presentation used by Markdown explanations |
| `checks.js` | Check evaluation engine: `evaluateCheckResults()`, `evaluateSingleCheck()`, `CHECK_TYPES` constants — delegates `fs_*` types to `filesystem.js` |
| `fileKeys.js` | Pure helpers for Firebase file key encoding: `encodeFileKey(name)` and `decodeFileKey(key)` — dots encoded as `__dot__` |
| `filesystem.js` | Virtual filesystem engine: flat path-map state, `createEntry`, `deleteEntry`, `renameEntry`, `moveEntry`, `listChildren`, `evaluateFsCheck`, `FS_CHECK_TYPES` |
| `codemirror.js` | CodeMirror config: `headstartTheme`, `headstartHighlight`, `createBaseExtensions(type, readOnly)`, `getTabSize(type)` |
| `firebase.js` | Firebase app init from Vite env vars; exports `db` (Realtime Database), `auth`, `firestore`, `functions`, `storage` |
| `iframe.js` | `buildIframeSrc()`: Blob URL filesystem, cross-reference rewriting, CSP + console interceptor injection |
| `markdown.jsx` | Markdown renderer: tables, callouts, fenced code blocks, Scratch block pills, topic links, `InlineMarkdown` |
| `MarkdownFieldEditor.jsx` | Markdown editor with Edit/Preview tabs, formatting toolbar, topic-library link picker, Scratch block insertion, and asset image picker; exports `MarkdownFieldEditor`, `MarkdownToolbar`, `getInlineCodeOptions` |
| `pyodide.js` | Pyodide Web Worker manager: `initPyodide()`, `runPython()`, `stopPython()`, `provideInput()`, `isPyodideReady()` |
| `pyodide.worker.js` | Web Worker: Pyodide loader, AST-based async `input()` transform, stdout/stderr event streaming |
| `scratch.js` | Custom Scratch interpreter: 62 block definitions, multi-sprite state, broadcast, sounds; re-exports from sub-modules |
| `scratchChecks.js` | Pure Scratch check evaluation: `evaluateScratchCheck`, `compare`, `createSpriteState`, `DEFAULT_SPRITES` |
| `scratchPersistence.js` | Workspace serialization and state migration: `saveWorkspace`, `loadWorkspace`, `migrateBroadcastState`, `migrateVariableFields` |
| `lessonLinks.js` | `getLessonLinks(lessonId)` — shared lesson URL builder (live + solo links); used by TeacherView and LessonPanel |
| `taskUtils.js` | Task flattening/group helpers plus estimated-duration total and formatting |
| `lessonService.js` | Shared lesson loading helpers: `fetchLessonById()` from Firestore `lessons` collection, plus `fetchLessonList()` |
| `workspaceData.js` | Pure scratch state clone/parse and decoded session file-list helpers |
| `useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` — media query hook for responsive layout |
| `Banner.jsx` | Tinted notification banner: `accent` hex colour drives rgba background/border; accepts `color`, `style`, `children` |
| `fileKeys.js` | Pure helpers for Firebase file key encoding: `encodeFileKey(name)` and `decodeFileKey(key)` — dots encoded as `__dot__` |

---

## Cloud Functions (`functions/`)

| File | Role |
|---|---|
| `functions/index.js` | HTTPS callable functions: `createAccount`, `setUserRole`, `disableAccount`, `enableAccount`, `deleteAccount` |
| `functions/package.json` | Cloud Functions Node.js package (firebase-admin, firebase-functions) |

---

## Scripts (`scripts/`)

| File | Role |
|---|---|
| `scripts/yaml-to-json.mjs` | CLI tool: converts a YAML lesson file to lesson JSON — `node scripts/yaml-to-json.mjs input.yaml [output.json]` |

---

## Firebase Config

| File | Role |
|---|---|
| `firebase.json` | Firebase project config: Firestore rules, Storage rules, and Cloud Functions source |
| `.firebaserc` | Firebase project alias (`headstartcoding-repl`) |
| `firestore.rules` | Firestore security rules: lessons public read; users admin/self read; all writes via Cloud Functions |
| `storage.rules` | Firebase Storage security rules: lesson assets public read; admin write only |

---

## CLI Tool (`cli/`)

Node.js CLI for lesson and topic library management against Firestore and Firebase Storage. Isolated sub-package — run `cd cli && npm install` separately. Entry point: `node cli/cli.mjs`.

| File | Role |
|---|---|
| `cli/package.json` | Sub-package manifest (`type: module`); deps: `firebase-admin`, `js-yaml`, `yargs` |
| `cli/cli.mjs` | Entry point: yargs CLI with `lessons`, `tasks`, `topics`, `feedback`, and `assets` subcommand groups |
| `cli/firebase.mjs` | Firebase Admin SDK init via `GOOGLE_APPLICATION_CREDENTIALS`; exports `db` (Firestore) and `storage`; exits on missing credentials |
| `cli/validate.mjs` | `validateLessonForMcp(lesson)` — standalone lesson validation (no Firebase dependency) |
| `cli/topic-utils.mjs` | Standalone topic-library normalization and validation helpers used by CLI conversion/publish commands |
| `cli/yaml-converter.mjs` | YAML conversion helpers for lessons and topic libraries, including lesson/topic JSON-to-YAML serialization |
| `cli/lessons.mjs` | Exports async functions: `listLessons`, `getLesson`, `getLessonSkeleton`, `getTask`, `upsertTask`, `appendTask`, `upsertLesson`, `deleteLesson`, `yamlToLesson`, `publishYamlLesson` |
| `cli/topics.mjs` | Exports topic Firestore functions plus bulk topic-library YAML/JSON publish helpers |
| `cli/feedback.mjs` | Exports read-only Firestore feedback listing helpers for platform, lesson, and combined feedback |
| `cli/assets.mjs` | Exports async functions: `listLessonAssets`, `uploadLessonAsset`, `deleteLessonAsset` |

---

## Config & Build

| File | Role |
|---|---|
| `vite.config.js` | Vite build config for both classroom and builder apps |
| `package.json` | Dependencies and scripts |
| `index.html` | Classroom app HTML shell |
| `builder/index.html` | Lesson builder HTML shell |

---

## Agent Reference Docs

| File | Role |
|---|---|
| `AGENTS.md` | Short, agent-neutral session entrypoint and routing index |
| `docs/agents/project-rules.md` | Agent reference for platform rules, stack, shared modules, admin, and CLI |
| `docs/agents/runtime-model.md` | Agent reference for Firebase, localStorage, URLs, session states, and identity |
| `docs/agents/classroom-behaviours.md` | Agent reference for live view, teacher broadcast, sandbox, carry-through, Pyodide, and file-key behaviour |
| `docs/agents/workflows.md` | Agent reference for git, PRs, reviews, testing, worktrees, and doc hygiene |
