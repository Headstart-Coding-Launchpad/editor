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
| `AccountSettings.jsx` | Authenticated account page where teachers/admins change their own Firebase Auth password |

---

## Admin Portal (`src/admin/`)

| File | Role |
|---|---|
| `AdminPortal.jsx` | Admin portal shell: header with account/sign-out actions and tab switcher between Lessons, Levels, Classes, Sessions, Topics, Shared Assets, Accounts, and Feedback panels |
| `AdminUi.jsx` | Shared Admin Portal UI primitives for panels, buttons, status pills, filters, and empty states |
| `AccountManagement.jsx` | Firestore `users` real-time list; create/role/password/disable/enable/delete via Cloud Functions |
| `LessonPanel.jsx` | Firestore `lessons`, `lessonLevels`, `classes`, `sessionReports`, and feedback collection-group view; reusable level/class management, class fork creation, lesson actions, report/feedback collapsibles |
| `SessionsPanel.jsx` | Realtime Database `sessions` list filtered to non-`ended` states; shows lesson, state, paused flag, student/online counts, and open duration; "Close Session" removes the session node so teachers who left a session open can be cleaned up |
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
| `studentTaskContent.js` | Pure student task-content selection and authored carry-chain precedence helpers |
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
| `ExplainerPanel.jsx` | Collapsible Markdown explainer panel above the editor; `disableCopy` prop blocks selection/copy (used for student-facing renders only) |
| `CopyCodePanel.jsx` | Student-facing read-only reference code block with selection/copy blocked, shown for Python/HTML tasks with `copyCode` |
| `SupportStagePanel.jsx` | Student-facing read-only code-stage reference panel with reveal control and copy/selection blocking |
| `OutputPanel.jsx` | Python output with retro typing animation and inline `input()` prompt |
| `IframePreview.jsx` | Sandboxed iframe output with console log capture tab (receives postMessage from iframe) |
| `CollapsibleIframePreview.jsx` | Slide-in toggle wrapper around IframePreview |
| `QuizTask.jsx` | Polymorphic quiz: multiple-choice (grid), match (drag-drop), fill-blank (drag/type), short-answer, confidence (1–5 rating) |
| `CheckFeedbackBanner.jsx` | Pass/fail banner with optional hint and "see complete code" action |
| `WaitingRoom.jsx` | Full-screen modal: lesson title + animated "your teacher is getting ready" message |
| `JoinChoiceScreen.jsx` | Choice screen: Wait for Teacher or Work Solo (shown when no active session) |
| `JoinSessionPrompt.jsx` | Modal: option to join a live session that started during solo work |
| `NameEntry.jsx` | Student name input with duplicate-suffix handling and solo fallback |
| `StudentGrid.jsx` | Grid of StudentCards with collapse toggle and check conditions display |
| `PresenceBadge.jsx` | Shared online/offline/waiting badge used by StudentCard and StudentModal |
| `StudentCard.jsx` | Compact card: name, online/run/check/support badges, code/output/quiz snippet, expand button |
| `StudentModal.jsx` | Full-width modal: student workspace view + teacher actions (Go Live, Remote Reset, Check Override, Rename, Remove) |
| `LiveActivityToast.jsx` | Transient live-view notice for editor copy, paste, and click activity |
| `TeacherMessageToast.jsx` | Friendly dismissible toast shown to a student when a teacher sends them a personal message |
| `TeacherTimers.jsx` | Timer strip for elapsed lesson time, planned duration, and active-task countdown |
| `TeacherSessionControls.jsx` | Teacher top-bar task navigation, presentation/share links, and session action controls |
| `TeacherCodeTabs.jsx` | Starter/stage/complete tab strip shown above teacher code editors; includes "Send to all" action |
| `TeacherPreviewBanner.jsx` | Status banner shown when the teacher previews a task without moving students |
| `TeacherSandboxBanner.jsx` | Status banner shown in sandbox staging/live mode with action buttons |
| `TeacherEndSessionModal.jsx` | Confirmation modal for ending a live session, with End and End+Home actions |
| `TeacherFeedbackModal.jsx` | Two-tab modal for submitting lesson feedback (per-task, stored in Firestore subcollection) or platform feedback (stored in `platformFeedback` collection) |
| `TeacherReportModal.jsx` | Post-session report modal shown right after ending a session: per-student per-task results, distinct attempts, YAML export via `reportToYamlText` |
| `TeacherReportsPanel.jsx` | Persistent list of past session reports for a lesson, reachable any time from the Reports button; queries `sessionReports` ordered by `startedAt` desc and opens `TeacherReportModal` per report |
| `EditLessonModal.jsx` | Reuses the builder's `TaskList`/`TaskEditor`/`GroupEditor`/`useBuilderState` to edit a lesson's tasks from TeacherView; "Apply for This Session" broadcasts via the session's `lessonOverrideTasks` (teacher and admin), "Save Permanently" (admin only) also writes Firestore |
| `InformationTask.jsx` | Read-only information/introduction task rendering for lesson flow |
| `CollapsiblePanelControls.jsx` | Shared collapse/expand tab controls for classroom and builder panels |
| `TaskSlideTransition.jsx` | Animated slide transition wrapper used when switching between tasks |
| `StudentEditorHeader.jsx` | Shared editor header bar (Code label + Run/Submit/Reset buttons) for HTML task editors |
| `LoadingScreen.jsx` | Branded reusable spinner/loading/error message screen for route, auth, and StudentView phases |
| `SessionEndedScreen.jsx` | "Session ended" screen with Continue Solo action — rendered when phase === 'ended' |
| `StudentStatusBanners.jsx` | Teacher-live, viewing-previous, and personal-sandbox notification banners shown above the task body |
| `LessonTaskContent.jsx` | Task content area: TaskSlideTransition wrapper, ExplainerPanel, CheckFeedbackBanner, and task-type dispatch via `getLessonModule()` registry (Quiz and Information rendered inline; all code types delegated to their module's `StudentWorkspace`) |
| `SoloNav.jsx` | Bottom prev/next navigation bar for solo mode; includes Open Sandbox shortcut |

### Quiz Components (`src/app/components/quiz/`)

| File | Role |
|---|---|
| `MultipleChoiceQuiz.jsx` | Multiple-choice quiz renderer with stable per-task option shuffle and answer reveal states |
| `MatchQuiz.jsx` | Drag/tap match quiz renderer using `useTileDragAndDrop` |
| `FillBlankQuiz.jsx` | Fill-in-the-blank quiz renderer for drag and typed modes, including inline/code-block blank parsing |
| `ShortAnswerQuiz.jsx` | Short-answer quiz renderer with submit and result feedback |
| `ConfidenceQuiz.jsx` | Confidence-scale quiz renderer |
| `quizUtils.js` | Shared quiz constants, styles, answer parsing, option lookup, fill-blank helpers, and question panel |

### Student Modal Sub-components (`src/app/components/student-modal/`)

| File | Role |
|---|---|
| `DropdownMenu.jsx` | Reusable popover/dropdown primitive used by StudentModal actions |
| `OverrideDropdown.jsx` | Teacher check-override menu and fail-hint modal |
| `MessageCompose.jsx` | Personal teacher message composer for one student |
| `StageDropdown.jsx` | Teacher request menu for sending starter/stage/complete code to a student |
| `StudentWorkspaceBody.jsx` | Lesson-type-specific student workspace display inside the teacher modal |
| `constants.js` | StudentModal highlight emoji options and shared modal constants |

### Teacher View Sub-modules (`src/app/views/teacher/`)

| File | Role |
|---|---|
| `TeacherEditorPanel.jsx` | Module-generic teacher editor/live-view panel, including starter/stage/complete tabs |
| `CheckConditionsPanel.jsx` | Collapsible teacher-facing display of current task check conditions |
| `checkFormatting.js` | Human-readable check formatting helper used by `CheckConditionsPanel` |

---

## Classroom Hooks (`src/app/hooks/`)

| File | Role |
|---|---|
| `useIdentity.js` | Anonymous ID and display name management; localStorage persistence; session timestamp comparison |
| `useSession.js` | Firebase session listener and full command layer: session lifecycle, student sync, sandbox, teacherLive, remote reset, carry fallback/support reveal logging, session-only lesson task override (`pushLessonOverride`/`clearLessonOverride`) |
| `useLessonLoader.js` | Firestore lesson fetch (or lessonProp pass-through); returns `{ lesson, lessonLoading, firstTaskId }` |
| `useStudentPhase.js` | Student phase state machine (loading → waiting → name-entry → lesson → sandbox → solo → ended); owns `phase`, `currentTaskId`, `viewingTaskId` |
| `useStudentCodeState.js` | All student editor/code workspace state: code, files, output, check results, personal sandbox, run/stop handlers; composes the four sub-hooks below |
| `usePyodideState.js` | Pyodide warm-up effect, `pyodideStatus` state, and `initPyodideIfNeeded()` helper |
| `useCheckFeedback.js` | Check result state (`checkPassed`, `checkAttempted`, `checkSuggestion`, `repeatedSuggestionCount`, `testResults`); `resetCheckFeedback` / `applyCheckFeedback`; teacher check-override effect |
| `studentOutputBuffer.js` | Buffered output helper used by student run state to batch streaming output updates |
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
| `LessonMetaPanel.jsx` | Lesson-level metadata: id, type, title, description, level, topic summary/proposals, assets, sandbox config modals |
| `LessonTopicSummary.jsx` | Derived existing/missing/unused topic report and editor for lesson-level topic proposals |
| `TaskList.jsx` | Left sidebar: task/group tree with drag-reorder, selection, creation, validation summary |
| `TaskEditor.jsx` | Task editor composition root: orchestrates sub-components and workspace panels; dispatches to lesson-type `BuilderWorkspace` via registry; delegates run/check state to `useTaskEditorState`; re-exports `ScratchToolboxPicker`, `SpriteManager`, `BackdropManager` |
| `ExplainerEditor.jsx` | Markdown editor with Edit/Preview tabs; live rendering via MarkdownRenderer |
| `FileManager.jsx` | HTML file list: add/delete/type-change, entry file picker, HTML+CSS+JS template generator |
| `BuilderOutputPanel.jsx` | Output panel with check results, retro typing animation, and `input()` prompt for builder |
| `GroupEditor.jsx` | Inline editor for a task group's title and subtask count summary |
| `ValidationPanel.jsx` | Collapsible errors/warnings panel with tabbed view and per-warning ignore action |
| `TaskFeedbackPanel.jsx` | Collapsible panel showing teacher-submitted lesson feedback items for the selected task |
| `BuilderToolbar.jsx` | Top toolbar: branding, dirty indicator, and all action buttons (new/upload/preview/print/download/publish) |

### Lesson Meta Sub-components (`src/builder/components/lesson-meta/`)

| File | Role |
|---|---|
| `SandboxStarterModal.jsx` | Type-specific sandbox starter editor for Python, HTML, Scratch, Filesystem, and Electronics lessons |
| `StorageAssetUploader.jsx` | Firebase Storage upload/delete UI for lesson-level assets |
| `SharedAssetsSelector.jsx` | Lesson-level selector for type-wide shared HTML assets |
| `AssetSummary.jsx` | Lesson asset summary and embedded read-only asset browser |
| `Field.jsx` | Shared labelled field wrapper for lesson metadata forms |
| `Modal.jsx` | Shared modal shell used by lesson metadata editors |
| `styles.js` | Shared inline style objects for lesson metadata sub-components |

### Task Editor Sub-modules (`src/builder/components/task-editor/`)

| File | Role |
|---|---|
| `TaskEditorFields.jsx` | Shared primitives: `Field`, `QuizTypeIcon`, `TaskFormatIcon`, `CodeWorkspaceTabs`, `Modal`, `CarryThroughPicker`, `SpriteManager`, `CostumeManager`, `BackdropManager` |
| `DraftTaskEditor.jsx` | Lightweight task editor for draft-stage lessons (`taskType: 'draft'`): kind/title/notes fields only, no code workspace |
| `QuizEditors.jsx` | Quiz-type builders: `QuizTypePicker`, `MatchPairsBuilder`, `FillBlankBuilder`, `ShortAnswerBuilder`, `QuizOptionsBuilder` |
| `CheckEditors.jsx` | Check utilities and editors: `subjectOpFromType`, `typeFromSubjectOp`, `getOperatorOptions`, `makeCheckSkeleton`, `CheckValueEditor`, `CheckListEditor` |
| `TestsEditor.jsx` | Builder sub-module: `TestsEditor` — CRUD UI for Python task test cases (inputs + check per test) |
| `TaskPreviewPanel.jsx` | Titled wrapper panel used to render the student-facing quiz/information preview in the builder |
| `TaskCheckResults.jsx` | Pass/fail check result banner shown after running or testing checks in the builder |
| `TaskRunControls.jsx` | Run/Stop/Run Tests button row for the Python task builder |
| `TaskTestResults.jsx` | Output + test-suite results panel for the Python task builder; wraps `BuilderOutputPanel` |
| `TaskOptionsSection.jsx` | Collapsible "Task options" section: carry-through, interaction mode, completion check (via module `CheckEditor` + `defaultCheck`), incorrect checks, and tests; all type-specific behaviour driven by module properties (`supportsInteractionMode`, `supportsIncorrectChecks`, `supportsTests`) |
| `PythonTaskWorkspace.jsx` | Python code editor + run controls panel for the builder (starter/complete/stage tabs) |
| `FilesystemTaskWorkspace.jsx` | Filesystem tree editor panel for the builder (starter/complete/stage tabs) |
| `HtmlTaskWorkspace.jsx` | HTML editor with file manager + live preview split pane for the builder |
| `ScratchTaskSetup.jsx` | Scratch block editor modal and setup summary; owns all scratch-specific state and handlers |

### Check Editor Helpers (`src/builder/components/task-editor/check-editors/`)

| File | Role |
|---|---|
| `checkEditorUtils.js` | Pure check editor mapping helpers: subject/operator/type conversion, option lists, check skeletons, regex detection, and failure formatting |

---

## Lesson Type Modules (`src/modules/`)

Each lesson type is a self-contained module folder. Adding a new type requires only a new folder and one line in the registry.

| File | Role |
|---|---|
| `registry.js` | Maps `lesson.type` strings → module objects; exports `getLessonModule`, `getStudentWorkspace`, `getBuilderWorkspace`, `getCheckEditor` |
| `checks.js` | Check evaluation dispatcher: canonical `type` + `operator` aliases, feedback-check precedence, `evaluateSingleCheck`, `evaluateCheck`, `evaluateCheckResults`, `evaluateCheckWithFeedback`, `normalizeChecks`, `CHECK_TYPES` — delegates filesystem, Python variable, HTML element, and electronics checks to their module evaluators |
| `sharedStyles.js` | Shared lesson-module layout style factories used by scroll-style modules |
| `python/index.js` | Python module: layout styles, `makeCodeTaskFields`, `makeNewStage`, `initCompleteTab`, `defaultCheck`, capability flags |
| `python/checks.js` | Python-exclusive check evaluation: `PYTHON_CHECK_TYPES`, `evaluatePythonCheck` — all `variable_*` types |
| `python/PythonEditor.jsx` | Python CodeEditor wrapper with Pyodide loading/error status |
| `python/StudentWorkspace.jsx` | Student Python editor + Run/Stop/Output panel (extracted from `LessonTaskContent`) |
| `python/BuilderWorkspace.jsx` | Re-export of `PythonTaskWorkspace` |
| `python/CheckEditor.jsx` | `CheckListEditor` wrapper with Python-appropriate flags |
| `python/pyodide.js` | Pyodide Web Worker manager: `initPyodide()`, `runPython()`, `stopPython()`, `provideInput()`, `isPyodideReady()` |
| `python/pyodide.worker.js` | Web Worker: Pyodide loader, AST-based async `input()` transform, stdout/stderr event streaming |
| `html/index.js` | HTML module definition |
| `html/checks.js` | HTML-exclusive check evaluation: `HTML_CHECK_TYPES`, `evaluateHtmlCheck` — all `element_*` types |
| `html/iframe.js` | `buildIframeSrc()`: Blob URL filesystem, cross-reference rewriting, CSP + console interceptor injection |
| `html/HtmlEditor.jsx` | Tabbed HTML/CSS/JS editor with optional asset browser drawer |
| `html/StudentWorkspace.jsx` | Student HTML editor + iframe preview; handles mobile/desktop split; owns `useTypeAssets` call |
| `html/BuilderWorkspace.jsx` | Re-export of `HtmlTaskWorkspace` |
| `html/CheckEditor.jsx` | `CheckListEditor` wrapper with HTML flags; includes `allowDomChecks` |
| `scratch/index.js` | Scratch module definition |
| `scratch/checks.js` | Pure Scratch check evaluation: `evaluateScratchCheck`, `compare`, `createSpriteState`, `DEFAULT_SPRITES`, `normalizeSequenceItem` |
| `scratch/scratch.js` | Custom Scratch interpreter: block definitions, multi-sprite state, broadcast, sounds; re-exports check/state helpers from `checks.js` and persistence helpers from `scratchPersistence.js` |
| `scratch/scratchEditors.jsx` | Scratch toolbox data, `buildScratchToolboxXml`, `parseScratchToolboxXml`, `ScratchToolboxPicker`, `ScratchCheckListEditor`, `ScratchCheckEditor`, variables, and prebuilt stack editors |
| `scratch/scratchPersistence.js` | Workspace serialization and state migration: `saveWorkspace`, `loadWorkspace`, `migrateBroadcastState`, `migrateVariableFields` |
| `scratch/ScratchWorkspace.jsx` | Full Scratch IDE: multi-sprite Blockly workspaces, stage canvas, sprite drag, check evaluation |
| `scratch/StudentWorkspace.jsx` | Scratch workspace with Reset Blocks button (extracted from `LessonTaskContent`) |
| `scratch/BuilderWorkspace.jsx` | Re-export of `ScratchTaskSetup` |
| `scratch/CheckEditor.jsx` | `ScratchCheckListEditor` wrapper |
| `filesystem/index.js` | Filesystem module definition |
| `filesystem/checks.js` | Filesystem check evaluation: `FS_CHECK_TYPES`, `evaluateFsCheck` — all `fs_*` types |
| `filesystem/filesystem.js` | Virtual filesystem engine: flat path-map state, CRUD helpers, path normalization, and parent/child lookup |
| `filesystem/filesystemEditors.jsx` | Builder sub-module: `FsTreeEditor` visual starter/complete editor and `FsCheckListEditor` filesystem check builder |
| `filesystem/FilesystemTask.jsx` | Student-facing Windows Explorer-style virtual filesystem UI: folder tree, icon grid, drag-and-drop move, inline rename, CodeMirror file editor |
| `filesystem/StudentWorkspace.jsx` | `FilesystemTask` wrapper with initialDir derivation |
| `filesystem/BuilderWorkspace.jsx` | Re-export of `FilesystemTaskWorkspace` |
| `filesystem/CheckEditor.jsx` | `FsCheckListEditor` wrapper |
| `electronics/index.js` | Electronics module definition: breadboard state helpers, builder/student/teacher workspaces, checks, carry-through, sandbox state, and MicroPython runtime bridge |
| `electronics/circuit.js` | Pure electronics circuit model helpers: default board, clone/parse/serialize, component creation, connectivity, short detection, simulated states, and `circuit_*` check evaluation |
| `electronics/ElectronicsWorkspace.jsx` | Shared breadboard UI: drag/drop palette and board, visual parts, animated pin-to-pin wiring, component inspector with Micro Controller GPIO editing, MicroPython Code tab, and output panel |
| `electronics/StudentWorkspace.jsx` | Student electronics workspace wrapper: serialized circuit state, reset/check actions, teacher-live/read-only handling |
| `electronics/BuilderWorkspace.jsx` | Builder electronics workspace: starter/complete/stage board tabs, board sizing, and available component controls |
| `electronics/TeacherLiveView.jsx` | Read-only or sandbox-editable teacher electronics board view |
| `electronics/CheckEditor.jsx` | Electronics check list editor for `circuit_*` completion and feedback checks |

### Module interface

Each `index.js` exports a default object with:

| Property | Type | Purpose |
|---|---|---|
| `type` | `string` | Matches `lesson.type` value |
| `StudentWorkspace` | `Component` | Student coding view |
| `BuilderWorkspace` | `Component` | Builder task editor |
| `CheckEditor` | `Component` | Check configuration UI |
| `TeacherLiveView` | `Component \| null` | Teacher-side live/sandbox view for the module |
| `getDisplayState(task, stage, liveState, tab)` | `fn` | Selects the displayed state for starter/complete/stage tabs |
| `getLayoutStyles(isMobile)` | `fn → {taskContentStyle, editorAreaStyle}` | CSS layout for the task area |
| `makeCodeTaskFields(task)` | `fn → object` | Initial fields when switching a task to code format |
| `makeNewStage(task, existing)` | `fn \| null` | Initial fields for a new code stage |
| `initCompleteTab(task, ctx)` | `fn \| null` | Called when switching to the Complete tab in the builder |
| `initStageTab(stage, ctx)` | `fn \| null` | Called when switching to a Stage tab in the builder |
| `defaultCheck(interactionMode)` | `fn → check[]` | Default check array when enabling a check |
| `supportsInteractionMode` | `boolean` | Show Run/Submit mode picker |
| `supportsIncorrectChecks` | `boolean` | Show incorrect-checks section |
| `supportsTests` | `boolean` | Show TestsEditor; also gates `allowVariableChecks` |
| `supportsVariableChecks` | `boolean` | Allow Python-style variable checks |
| `supportsDomChecks` | `boolean` | Allow HTML DOM/element checks |
| `supportsCopyCode` | `boolean` | Show the builder field and student copy-code panel for task-level `copyCode` snippets |
| `carryThroughField` | `string` | Task field used for carry-through source selection |
| `carryThroughLabel` | `string` | Builder label for the carry-through picker |
| `getCarryThroughUpdates(sourceTask)` | `fn` | Produces starter-state updates when carrying from another task |
| `getNewStarterUpdates(task)` | `fn` | Produces starter-state updates for a fresh starter |
| `stageLabels` | `{starterLabel, completeLabel}` | Tab label strings |
| `explainerInlineCodeLanguages` | `string[]` | Languages offered in the explainer inline-code picker |
| `defaultState` | `any` | Default student state value |
| `initialState(task)` | `fn` | Initial student state for a task |
| `serializeState(state)` | `fn \| null` | Optional persistence serializer |
| `deserializeState(raw)` | `fn \| null` | Optional persistence deserializer |
| `getSandboxState(lesson, task)` | `fn` | Initial sandbox state |
| `runtime` | `object \| null` | Optional runtime bridge with `init`, `isReady`, `stop`, and module-specific helpers |

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
| `storageAssets.js` | Pure Firebase Storage asset metadata merge helper: folder listing is inventory, schema entries preserve per-file options |
| `useAssets.js` | Hook for fetching `public/assets/manifest.json` (returns empty arrays when absent); exposes `lessonAssets`, `sharedAssets`, `lessonFolderAssets` for static asset paths — currently returns empty everywhere |
| `useLessonStorageAssets.js` | Hook for listing `lessons/{lessonId}/assets/` in Firebase Storage and merging discovered files with optional `lesson.storageAssets` metadata |
| `useTypeAssets.js` | Hook for fetching `lessonTypeAssets/{type}` from Firestore; returns `typeStorageAssets` and `defaultSprites` for type-wide shared files and Scratch sprite defaults |
| `topicLibrary.js` | Topic-library Firestore loader (`topicLibrary` collection) plus type-filtered search, wiki-link expansion, author suggestion helpers, and `clearTopicCache()` |
| `topicAudit.js` | Shared topic-reference parsing, grouped-task audit, proposal matching, and lesson-stage publication rules |
| `TopicLibraryView.jsx` | Topic hover-card and searchable dialog presentation used by Markdown explanations |
| `checkHelpers.js` | Generic check primitives: `wildcardContains`, `wildcardEquals`, `normalizeOutput`, `normalizeCode`, `parseMultipleContainOptions`, `parseCheckValue`, `valueEquals`, `getVariableEntry`, and related helpers — used by `modules/checks.js` and sub-module evaluators |
| `fileKeys.js` | Pure helpers for Firebase file key encoding: `encodeFileKey(name)` and `decodeFileKey(key)` — dots encoded as `__dot__` |
| `codemirror.js` | CodeMirror config: `headstartTheme`, `headstartHighlight`, `createBaseExtensions(type, readOnly)`, `getTabSize(type)` |
| `firebase.js` | Firebase app init from Vite env vars; exports `db` (Realtime Database), `auth`, `firestore`, `functions`, `storage` |
| `markdown.jsx` | Markdown renderer: tables, callouts, fenced code blocks, Scratch block pills, topic links, `InlineMarkdown` |
| `MarkdownFieldEditor.jsx` | Markdown editor with Edit/Preview tabs, formatting toolbar, topic-library link picker, Scratch block insertion, and asset image picker; exports `MarkdownFieldEditor`, `MarkdownToolbar`, `getInlineCodeOptions` |
| `scratchBlockCatalog.js` | Shared Scratch block metadata for markdown rendering, markdown toolbar insertion, and the Scratch toolbox picker |
| `lessonBlocksCodec.js` | Encodes/decodes Scratch block trees as JSON strings for Firestore storage, working around Firestore's nested map/array depth cap |
| `lessonReport.js` | `buildSessionReport()` — builds a session report from an in-memory session + lesson (roster, per-task attempt history, overrides, carry fallbacks, support reveals, task summary); `reportToYamlText()` for YAML export |
| `lessonLinks.js` | `getLessonLinks(lessonId)` — shared lesson URL builder (live + solo links); used by TeacherView and LessonPanel |
| `lessonLevels.js` | Reusable level reference helpers: level Firestore collection name, scope derivation, legacy migration, display title resolution, and sorting |
| `lessonForks.js` | Deterministic class-fork helpers: class record normalization, fork ID/title creation, stock lesson copy, and task lineage construction |
| `taskUtils.js` | Task flattening/group helpers plus estimated-duration and priority totals/formatting |
| `lessonService.js` | Shared lesson loading and publishing helpers: `fetchLessonById()`, `fetchLessonList()`, `publishLesson()`, `publishLessonTasks()`, `deletePublishedLesson()`, `publishLessonFork()`, `applyLessonOverride()`; class helpers; publishing migrates legacy scalar levels; session report helpers: `saveSessionReport()`, `fetchSessionReports()` |
| `workspaceData.js` | Pure scratch state clone/parse and decoded session file-list helpers |
| `useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` — media query hook for responsive layout |
| `Banner.jsx` | Tinted notification banner: `accent` hex colour drives rgba background/border; accepts `color`, `style`, `children` |

### Markdown Helpers (`src/shared/markdown/`)

| File | Role |
|---|---|
| `editorOptions.js` | Markdown editor option data and helpers: image extensions, code block options, inline code options, Scratch insertion categories, and Scratch fence detection |
| `ScratchBlocks.jsx` | SVG/path Scratch block renderer and fenced-stack parser used by MarkdownRenderer |
| `tableParser.js` | Pure Markdown table parser used before handing content to ReactMarkdown |

---

## Cloud Functions (`functions/`)

| File | Role |
|---|---|
| `functions/index.js` | HTTPS callable functions: `createAccount`, `setUserRole`, `disableAccount`, `enableAccount`, `deleteAccount`, `updateAccountPassword` |
| `functions/package.json` | Cloud Functions Node.js package (firebase-admin, firebase-functions) |

---

## Scripts (`scripts/`)

| File | Role |
|---|---|
| `scripts/yaml-to-json.mjs` | CLI tool: converts a YAML lesson file to lesson JSON — `node scripts/yaml-to-json.mjs input.yaml [output.json]` |
| `scripts/download-scratch-sprites.mjs` | One-off tool: downloads Scratch's official sprite/costume assets from the Scratch CDN into `public/scratch-assets/sprites/` |
| `scripts/check-docs.mjs` | Dependency-free documentation hygiene check: validates local Markdown links, `docs/README.md` inventory, and source-file coverage in this map |

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
| `cli/cli.mjs` | Entry point: yargs CLI with lesson topic audit/preflight plus `lessons`, `tasks`, `topics`, `feedback`, and `assets` subcommand groups |
| `cli/firebase.mjs` | Firebase Admin SDK init via `GOOGLE_APPLICATION_CREDENTIALS`; exports `db` (Firestore) and `storage`; exits on missing credentials |
| `cli/validate.mjs` | `validateLessonForMcp(lesson)` — standalone lesson validation (no Firebase dependency) |
| `cli/topic-utils.mjs` | Standalone topic-library normalization and validation helpers used by CLI conversion/publish commands |
| `cli/yaml-converter.mjs` | YAML conversion helpers for lessons and topic libraries, including lesson/topic JSON-to-YAML serialization |
| `cli/structured-input.mjs` | JSON/YAML input detection for CLI files and stdin; lesson YAML is passed through the lesson shorthand converter |
| `cli/lessons.mjs` | Exports async functions: `listLessons`, `getLesson`, `getLessonSkeleton`, `getTask`, `upsertTask`, `appendTask`, `upsertLesson`, `deleteLesson`, `yamlToLesson`, `publishYamlLesson` |
| `cli/topics.mjs` | Exports topic Firestore functions plus bulk topic-library YAML/JSON publish helpers |
| `cli/feedback.mjs` | Exports Firestore feedback helpers: list (platform/lesson/all), add (lesson/platform), archive by ID (soft-delete via `archived: true`), and bulk-clear (archive) with optional filters |
| `cli/assets.mjs` | Exports async functions: `listLessonAssets`, `uploadLessonAsset`, `deleteLessonAsset` |
| `cli/levels.mjs` | Exports Firestore reusable-level helpers: `listLevels`, `upsertLevel`, `deleteLevel` |
| `cli/classes.mjs` | Exports Firestore class helpers for lesson forks: `listClasses`, `getClass`, `upsertClass`, `archiveClass` |

---

## Config & Build

| File | Role |
|---|---|
| `vite.config.js` | Vite build config for both classroom and builder apps |
| `src/test/setup.js` | Vitest/jsdom shared test setup: jest-dom matchers and browser API mocks used across component and hook tests |
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
