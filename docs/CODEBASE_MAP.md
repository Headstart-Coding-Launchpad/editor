# CODEBASE_MAP.md

One-line role for every source file. When a pull request adds, moves, or removes a source component or test target, update this map and consider the corresponding inventory in `TESTING.md`.

Referenced from `AGENTS.md`. Use this as a navigation index: search headings or open only the section relevant to the current task instead of loading the whole file by default.

---

## Entry Points

| File | Role |
|---|---|
| `src/main.jsx` | App DOM entry — renders App into #root |
| `src/App.jsx` | Root router (HashRouter): `/login`, `/lesson/:lessonId`, `/code`, `/playground/:type`, `/admin`, `/builder`, and fallback to LandingPage |
| `src/index.css` | Global styles: brand CSS custom properties, button variants, status dots, animations, syntax highlight overrides |
| `src/builder/App.jsx` | Builder route component: lesson lifecycle, localStorage auto-save, composed-lesson creation, restore/save dialogs |

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
| `SharedAssetsPanel.jsx` | `lessonTypeAssets` Firestore CRUD: per-type Firebase Storage file upload/delete and Scratch default sprite/backdrop library editors (`DefaultSpritesEditor`, `DefaultBackdropsEditor`) |

---

## Classroom Views (`src/app/views/`)

| File | Role |
|---|---|
| `LandingPage.jsx` | Entry screen: student enters a lesson ID, opens `.launchpad` code, or chooses a standalone playground |
| `CodeFileWorkspace.jsx` | Lightweight standalone Python editor/runner for one or many imported `.launchpad` code tasks |
| `PlaygroundView.jsx` | Local-only Python, Arcade Kit, Electronics, and Scratch playground route built from the existing student workspaces |
| `LoginPage.jsx` | Email/password sign-in form; reads `?redirect` param and navigates after success |
| `LessonRoute.jsx` | URL dispatcher: reads `:lessonId` + query params; auth-guards teacher paths, routes to TeacherView or StudentView. `?live=true` is a deprecated no-op (bare URL now smart-joins); `?solo=true` forces solo unconditionally; `?preview=true` (auth-gated like `?teacher=true`) renders an ephemeral, unrestricted-navigation solo StudentView, used by the Admin Portal's Preview link |
| `StudentView.jsx` | Main student experience: all phases (loading → choice → waiting → name-entry → lesson/sandbox/solo → ended); `forceSolo` prop (from `?solo=true`) is combined with the lesson's `soloOnly` flag into the internal `soloMode` |
| `TeacherView.jsx` | Teacher dashboard: collapsible 3-panel layout, session lifecycle controls, student grid |

---

## Classroom Modules (`src/app/`)

| File | Role |
|---|---|
| `studentStorage.js` | Student task/file localStorage key construction and saved-work persistence helpers; personal sandbox load/save helpers; raw per-file record helpers (`loadSavedFileRecord`, `saveFileRecord`, `loadPersonalSandboxFileRecord`, `savePersonalSandboxFileRecord`, ephemeral equivalents) for the storage adapters |
| `codeCheckContext.js` | `buildCodeCheckContext()` — the check-evaluation context for code tasks (Check/Submit); defers to a run-checked module's `checking.buildContext` (Electronics adds `circuit` so code checks read the MicroPython source), else `{ ...extras, code }` |
| `studentTaskContent.js` | `prepareClassroomLesson(lesson)` — the classroom copy of a lesson with line-hint markers stripped (StudentView/TeacherView apply it after any session override; TeacherView keeps the authored lesson for Edit Lesson). Pure student task-content selection and authored carry-chain precedence helpers, plus `resolveRemoteResetTarget()` — what a teacher's remote reset/complete action should put in front of the student, dispatched to each module's `lifecycle.resetTarget` |
| `studentLiveDisplay.js` | Pure student teacher-live/view display selection and live HTML file conversion helpers; `displayOutputCollapsed` mirrors the broadcast source's output/preview panel collapse state to a forced-live viewer (`null` when not forced-live) |
| `studentQuizContent.js` | Adapter re-exporting the quiz activities' `buildQuizSubmission` / `getQuizSuggestion` (`src/activities/quiz/quizActivity.js`) |
| `studentCodeExports.js` | Pure selection of browser-saved Python code tasks for `.launchpad` backup exports |
| `teacherSandboxWork.js` | Pure teacher-sandbox work helpers for TeacherView (plan step 4.6): the per-`capabilities.sandboxState` work slots, restore order (draft, then the live session via `wire.fromCode` / decoded `sandboxFiles`, then `lifecycle.sandboxStarter`), draft copies, and the `enterSandbox` / `pushSandboxCode` / `pushSandboxFiles` fields via `wire.toCode` on the module's `wire.sandboxChannel`; `taskStarterWork` is the displayed task's Starter-tab work (`workSlot.teacherStarter`, step 4.8) |
| `teacherLivePayload.js` | Pure student-to-teacherLive broadcast payload construction |
| `nudgeAlert.js` | Best-effort browser attention effects for teacher nudges: `startTitleFlash` (tab title + favicon), `playNudgeChime` (Web Audio), `showNudgeNotification` (only with granted permission) |
| `throttledMirrorWriter.js` | Leading + trailing throttle for mirrored "latest value" writes (watched student output); re-checks nothing itself — callers gate on watch state per write |
| `taskItemProgress.js` | Pure teacher-only filled/correct item counts for Match and Fill in the Gaps quizzes (via the quiz activity's `getProgress`) and filled-slot counts for Code Arrange (StudentCard + StudentModal header) |
| `sharedWorkspacePayload.js` | Pure workspace-share snapshot construction, size limit, index entry building, and newest-first share sorting |

---

## Classroom Components (`src/app/components/`)

| File | Role |
|---|---|
| `TopBar.jsx` | Header: lesson title, level badge, SOLO/LIVE/SANDBOX badge, student name, progress dots slot |
| `TaskNavigator.jsx` | Left sidebar: task list with group collapse, run/check stats, sandbox and pause controls |
| `TaskProgressDots.jsx` | Top bar progress indicator: clickable past dots, locked future dots, current highlighted |
| `ExplainerPanel.jsx` | Collapsible Markdown explainer panel above the editor; `disableCopy` prop blocks selection/copy (used for student-facing renders only) |
| `CopyCodePanel.jsx` | Student-facing read-only reference code block with selection/copy blocked, shown for Python/HTML tasks with `copyCode` |
| `SupportStagePanel.jsx` | Student-facing read-only code-stage reference panel with reveal control and copy/selection blocking; shows the stage's line hints as faded text after their lines (`lineHintsFor`, `stageHintsByLine`) |
| `OutputPanel.jsx` | Python output with retro typing animation (via `useTypewriterOutput`) and inline `input()` prompt; `onInputChange` fires per keystroke (for live-mirroring to a watching teacher); `inputReadOnly`+`mirroredInputValue` swap the prompt row to a plain-text, externally-driven mirror instead of an editable input, used by `StudentWorkspaceBody.jsx`. `splitEmojiRuns()` (exported for testing) grapheme-splits the output so emoji render a bit larger than the surrounding monospace text, via `Intl.Segmenter` |
| `IframePreview.jsx` | Sandboxed iframe output with console log capture tab (receives postMessage from iframe) |
| `CollapsibleIframePreview.jsx` | Slide-in toggle wrapper around IframePreview |
| `QuizTask.jsx` | Polymorphic quiz: multiple-choice (grid), match (drag-drop), fill-blank (drag/type), short-answer, confidence (1–5 rating) |
| `CodeArrangeTask.jsx`, `CodeArrangeTaskContainer.jsx` | Thin re-exports of the code_arrange activity's tile board and module workspace (moved to `src/activities/code_arrange/`) |
| `CheckFeedbackBanner.jsx` | Pass/fail popup (floating, top-center, auto-dismisses after 45s or via its own close button — not inline in the layout) with optional hint and "see complete code" action; no longer hosts its own Need Help button (see StudentView's top bar) |
| `WaitingRoom.jsx` | Full-screen modal: lesson title + animated "your teacher is getting ready" message; shows a "📹 Join Video Call" link when the session's `videoCallLink` is set |
| `ChoiceScreen.jsx` | `choice`-phase screen: Join a Live Lesson or Go Solo (shown when no active session exists and the student hasn't committed to solo) |
| `EntryScreenCard.jsx` | Shared chrome for the pre-lesson screens (`ChoiceScreen`, `NameEntry`, `WaitingRoom`, `JoinSessionPrompt`): centred card, purple header, wordmark, lesson title and optional description, above a white body. Exports `centredBody` and `ghostLink` for the body layouts and quiet secondary links those screens share |
| `JoinSessionPrompt.jsx` | Modal: option to join a live session that started during solo work |
| `VideoCallPrompt.jsx` | Modal shown to one student when a teacher targets them with "📹 Send Video Call Link" from the Student Grid, stamping `students/{id}/videoCallLinkPushedAt` |
| `RecordingWidget.jsx` | Solo-mode-only fixed-corner pop-out player for a lesson's `recordingUrl` (YouTube recording, authorable on any lesson). Hide pauses via the YouTube IFrame API; the player stays mounted so reopening resumes in place |
| `NameEntry.jsx` | Student name input with duplicate-suffix handling and solo fallback |
| `StudentGrid.jsx` | Grid of StudentCards with collapse toggle and check conditions display |
| `PresenceBadge.jsx` | Shared online/away/offline/waiting badge used by StudentCard and StudentModal (Away = connected but window unfocused) |
| `NudgeBanner.jsx` | Student-side half of a teacher nudge: `NudgeBanner` (in-page "your teacher is asking for your attention" banner) and `NudgePermissionPrompt` (one-time opt-in for OS notifications, "Not now" remembered in localStorage) |
| `StudentCard.jsx` | Compact card: name, online/run/check/support/sharing badges, teacher-only item progress badge (`taskItemProgress.js`), code/output snippet (per the module's `capabilities.cardSummary`) or the activity/quiz answer summary (the activity UI's `CardSummary`), expand button |
| `SharedWorkspacePreview.jsx` | Read-only render of a frozen share snapshot; maps a snapshot to each module's TeacherLiveView props |
| `SharedWorkspacePanel.jsx` | Student-facing "Shared work" gallery button, new-share toast, and share list |
| `SharedWorkspaceViewer.jsx` | Non-destructive editable copy of a classmate's shared workspace; renders the student's own `LessonTaskContent` surface via a throwaway `useStudentCodeState` (previewMode, namespaced lessonId, no-op session writers), seeded from the snapshot; optional "Copy to my editor" |
| `StudentModal.jsx` | Full-width modal: student workspace view + teacher actions (Go Live, Remote Reset, Check Override, Rename, Remove, Send Video Call Link); remote run, live edit (`capabilities.teacherEditor`, rendered through the module's `TeacherLiveView`), code highlights and the stage Reveal menu are gated by the task module's capabilities |
| `TeacherMessageToast.jsx` | Friendly dismissible toast shown to a student when a teacher sends them a personal message |
| `TeacherTimers.jsx` | Timer strip for elapsed lesson time, planned duration, and active-task countdown |
| `TeacherSessionControls.jsx` | Teacher top-bar task navigation, presentation/share links, session action controls, and a "📹 Video Call" popover to set/edit the session's `videoCallLink` |
| `TeacherCodeTabs.jsx` | Starter/stage/complete tab strip shown above teacher code editors; includes "Send to all" action |
| `TeacherPreviewBanner.jsx` | Status banner shown when the teacher previews a task without moving students |
| `TeacherSandboxBanner.jsx` | Status banner shown in sandbox staging/live mode with action buttons |
| `TeacherEndSessionModal.jsx` | Confirmation modal for ending a live session, with End and End+Home actions |
| `TeacherFeedbackModal.jsx` | Two-tab modal for submitting lesson feedback (per-task, stored in Firestore subcollection) or platform feedback (stored in `platformFeedback` collection) |
| `TeacherReportModal.jsx` | Post-session report modal shown right after ending a session: per-student per-task results (including any live `teacherRating` on a task), distinct attempts, activity item progress, YAML export via `reportToYamlText`; when `onSaveFeedback` is supplied and no feedback is saved yet, shows an editable star-rating/notes form that calls it (used only for the just-ended session's report, not historical ones) |
| `StarRatingFeedbackFields.jsx` | Shared 1-5 star rating input/display + "what worked well"/"what didn't work" textareas, used by both `TeacherReportModal`'s end-of-session lesson rating and `TaskRatingPanel`'s live per-task rating |
| `TeacherReportsPanel.jsx` | Persistent list of past session reports for a lesson, reachable any time from the Reports button; queries `sessionReports` ordered by `startedAt` desc and opens `TeacherReportModal` per report |
| `EditLessonModal.jsx` | Reuses the builder's `TaskList`/`TaskEditor`/`GroupEditor`/`useBuilderState` to edit a lesson's tasks from TeacherView; "Apply for This Session" broadcasts via the session's `lessonOverrideTasks` (teacher and admin), "Save Permanently" (admin only) also writes Firestore |
| `InformationTask.jsx` | Read-only information/introduction task rendering for lesson flow |
| `LessonCompleteScreen.jsx` | "Lesson complete!" screen shown after Next off the last task in solo mode, with an Open Playground button for playground-supported lesson types — see `docs/agents/classroom-behaviours.md` |
| `CollapsiblePanelControls.jsx` | Shared collapse/expand tab controls for classroom and builder panels |
| `PanelTabs.jsx` | Generic `role="tablist"` tab switcher (`PanelTabs`, `PanelTabPanel`); inactive panels are hidden via `display:none`, never unmounted; styled by `.ui-tabs`/`.ui-tab` in index.css |
| `TaskSlideTransition.jsx` | Animated slide transition wrapper used when switching between tasks; optional `panelStyle` prop overrides the entering panel's own `.task-slide-panel` CSS (`min-height: 0`) — used by Scratch's layout, see `docs/agents/classroom-behaviours.md` |
| `StudentEditorHeader.jsx` | Shared editor header bar (Code label + Run/Submit/Reset buttons) for HTML task editors |
| `LoadingScreen.jsx` | Branded reusable spinner/loading/error message screen for route, auth, and StudentView phases |
| `SessionEndedScreen.jsx` | "Session ended" screen with Continue Solo action — rendered when phase === 'ended' |
| `StudentStatusBanners.jsx` | Teacher-live, viewing-previous, and personal-sandbox notification banners shown above the task body |
| `LessonTaskContent.jsx` | Task content area: TaskSlideTransition wrapper, ExplainerPanel, CheckFeedbackBanner, and task-type dispatch via `getLessonModule()` registry (Quiz, Information, and Code Arrange rendered inline; other code types delegated to their module's `StudentWorkspace`) |
| `SoloNav.jsx` | Bottom prev/next navigation bar for solo mode; includes Open Sandbox shortcut |

### Quiz Components (`src/app/components/quiz/`)

| File | Role |
|---|---|
| `MultipleChoiceQuiz.jsx` | Multiple-choice quiz renderer with stable per-task option shuffle and answer reveal states |
| `MatchQuiz.jsx` | Drag/tap match quiz renderer using `useTileDragAndDrop` |
| `FillBlankQuiz.jsx` | Fill-in-the-blank quiz renderer for drag and typed modes, including inline/code-block blank parsing |
| `ShortAnswerQuiz.jsx` | Short-answer quiz renderer with submit and result feedback |
| `ConfidenceQuiz.jsx` | Confidence-scale quiz renderer |
| `quizUtils.js` | Shared quiz logic: answer parsing, option lookup, fill-blank segment parsing, option fit/shrink helpers, and the question panel |
| `quizStyles.js` | Quiz presentation: answer-option state colours, base/interaction/confidence style objects |

### Student Modal Sub-components (`src/app/components/student-modal/`)

| File | Role |
|---|---|
| `DropdownMenu.jsx` | Reusable popover/dropdown primitive used by StudentModal actions |
| `OverrideDropdown.jsx` | Teacher check-override menu and fail-hint modal |
| `MessageCompose.jsx` | Personal teacher message composer for one student |
| `StageDropdown.jsx` | Teacher request menu for sending starter/stage/complete code to a student |
| `PaneFocusDropdown.jsx` | Checkbox picker + Highlight/Force actions for `teacherPaneCommand` — reused per-student (StudentModal, "Focus") and whole-class (TeacherView, "Focus Class"); options are Instructions plus the module's `capabilities.focusPanes` |
| `StudentWorkspaceBody.jsx` | Student workspace display inside the teacher modal, chosen by the module's `capabilities.studentMirror` (`code` / `files` inline editors, `blocks` / `view` through the module's `TeacherLiveView` passed in by StudentModal); the `code` mirror's `OutputPanel` mirrors `currentInputPrompt`/`currentInput` read-only while a watched student has a pending `input()` prompt |
| `ShareRequestPanel.jsx` | Teacher review of a pending workspace share: fetches the frozen snapshot, previews it read-only, approves or declines |
| `constants.js` | StudentModal highlight emoji options and shared modal constants |

### Teacher View Sub-modules (`src/app/views/teacher/`)

| File | Role |
|---|---|
| `TeacherEditorPanel.jsx` | Module-generic teacher editor/live-view panel, including starter/stage/complete tabs |
| `CheckConditionsPanel.jsx` | Collapsible teacher-facing display of current task check conditions |
| `TaskRatingPanel.jsx` | Collapsible panel, rendered above `CheckConditionsPanel`, letting the teacher rate the current task live (1-5 stars + notes) via `setTaskRating`; follows the teacher as they move between tasks |
| `checkFormatting.js` | Human-readable check formatting helper used by `CheckConditionsPanel` |

---

## Classroom Hooks (`src/app/hooks/`)

| File | Role |
|---|---|
| `useIdentity.js` | Anonymous ID and display name management; localStorage persistence; session timestamp comparison |
| `useCrossTabPresence.js` | BroadcastChannel-based ping/pong presence check for the same student+lesson open in another tab; returns a boolean, informational only |
| `useSession.js` | Firebase session listener and full command layer: session lifecycle, student sync, sandbox, teacherLive, remote reset, carry fallback/support reveal/task rating logging (`setTaskRating`), session-only lesson task override (`pushLessonOverride`/`clearLessonOverride`), workspace share request/approve/remove |
| `useLessonLoader.js` | Firestore lesson fetch (or lessonProp pass-through); returns `{ lesson, lessonLoading, firstTaskId }` |
| `useStudentPhase.js` | Student phase state machine (loading → choice → waiting → name-entry → lesson → sandbox → solo → ended); owns `phase`, `currentTaskId`, `viewingTaskId` |
| `useStudentCodeState.js` | All student editor/code workspace state: code, files, output, check results, personal sandbox, run/stop handlers, and the Pyodide warm-up effect; composes the sub-hooks below. Every module shares the generic `work` slot and `handleWorkChange` pipeline driven by its definition (html's per-file `{ files, activeFile }`, Scratch's workspace-owned states with `reportRun` for its own checks) — `cs.code` / `cs.arcadeDesign` / `cs.files` / `cs.activeFile` / `handleCodeChange` / `handleFileChange` / `handleScratchChange` / `handleScratchCheck` / `handleArcadeRun` / `scratchExternalState` are aliases over it (`docs/architecture/lesson-type-modules.md`, "checking and the generic work slot"); `handleRun` dispatches on `capabilities.run` |
| `runWithRuntime.js` | `runWithRuntime(ctx)` — the `'runtime'` branch of `handleRun` (Pyodide / MicroPython): output streaming and throttled teacher mirror, `input()` prompts, stop handling, the task check with feedback, the run-record save, `writeStudentRun` and the attempt log. Per-module differences come from the definition's `runResult` flags and `checking.buildContext` |
| `useLatestRef.js` | `useLatestRef(value)` — a ref holding the latest render's value, for stale-closure-safe reads inside async handlers, timers and event listeners |
| `useStudentPresenceReporting.js` | Reports this student's window state to the teacher: connected, focused, fullscreen, recently active. Presentation windows report nothing and remove themselves from the roster |
| `useNudgeAlert.js` | Reacts to a teacher nudge (`students/{id}/nudgePushedAt` always; session `nudgeAwayPushedAt` only when the window is unfocused): banner, chime, and — while unfocused — tab flash until focus plus an OS notification. Timestamps present at load are a baseline and never replay |
| `useSandboxCodePush.js` | Loads content the teacher pushes into the sandbox, keyed off the session's push timestamps: on the module's code channel `wire.fromCode(sandboxCode)` → `onPushedWork(work)`, on the files channel the decoded `sandboxFiles` (else the lesson's `sandboxStarterFiles`) → `onPushedFiles(files)` |
| `useTypewriterOutput.js` | `useTypewriterOutput(output)` — reveals program output with the retro typing animation, chunking faster as the remaining text grows; shared by `OutputPanel` and `BuilderOutputPanel` |
| `useCheckFeedback.js` | Check result state (`checkPassed`, `checkAttempted`, `checkSuggestion`, `repeatedSuggestionCount`, `testResults`); `resetCheckFeedback` / `applyCheckFeedback`; teacher check-override effect |
| `studentOutputBuffer.js` | Buffered output helper used by student run state to batch streaming output updates |
| `createStudentPersistence.js` | Conditional localStorage save helpers: routes each write (one shared `routeSave`) to the sandbox or normal task key based on `inPersonalSandboxRef`, or the in-memory store in presentation/preview. Adapter-driven `saveWork` / `readWork` / `saveSandboxWork` / `readSandboxWork` map a module's work through its definition's `storage` adapter; `saveRunRecord` writes the code editor / run record (`{ code, ...fields }`, sandbox keeps only the code); the per-type named savers/readers remain for existing callers |
| `useTeacherLivePublish.js` | Teacher-live broadcast helpers (`canPublishTeacherLive`, `currentTeacherLivePayload`, `publishTeacherLive`), `teacherLiveIframeSrc` and `htmlPreviewCollapsed` state, and the two teacher-live sync effects; `publishOutputCollapsed(collapsed)` merge-updates just `teacherLive.outputCollapsed`, standalone from the main payload, so a source's output/preview panel collapse state mirrors continuously to forced-live viewers |
| `useActivityState.js` | State, persistence and live sync for hosted activity and quiz tasks (owned by `useStudentCodeState`): loads/saves the `__activity_state__` aux file, discrete changes mirror `currentAnswer` debounced, continuous changes only while `activeStudentView` is this student (throttled, flushed when the teacher starts watching), submit/auto grading → `applyCheckFeedback` + `writeStudentRun` + `logAttempt`, `remoteResetAction` starter/complete, `teacherAnswerEdit`, teacher-live `answer` payload |
| `useTileDragAndDrop.js` | Shared drag-and-drop + tap-to-place hook for tile-based quizzes (MatchQuiz, FillBlankQuiz); also exports `setLiftedDragImage` and `removeTileFromState` |

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
| `lessonUtils.js` | Builder lesson validation — the shared core (`src/shared/lessonValidation.js`) plus the Builder-only extras (duplicate task-id warnings, browser-only module rules such as Scratch toolbox XML, the untested-check reminder) — and export normalisation rules |
| `printLesson.js` | `buildPrintHtml(lesson)` — generates printable HTML string from lesson JSON (no DOM); quizzes and activities print their own fields (`printHtml`), activities also their name and description; a code task's module section comes from its module's `authoring.printTask` |
| `taskFormat.js` | Builder format switching: `COMMON_TASK_FIELDS` / `commonTaskFields` (kept across formats) and `convertTaskToActivity` (UI `builderConvert` or `defaultTask`) |

---

## Builder Hooks (`src/builder/hooks/`)

| File | Role |
|---|---|
| `useBuilderState.js` | Task CRUD state and handlers (add, duplicate, delete, reorder, subtasks) plus derived state (errors, warnings, flatTasks, selectedTask/Group) — no DOM, independently unit-testable |
| `useTaskEditorState.js` | Run/check/output state and handlers for the task editor: `handleRun`, `handleRunTests`, `handleStop`, `handleTestChecks`, `handleQuizPreviewSelect`, `handleInputSubmit`, `resetRunState`; what Run does comes from the module's `authoring.builderRun` (`runsPyodide` / `runsNothing`, else the HTML preview) |

---

## Builder Components (`src/builder/components/`)

| File | Role |
|---|---|
| `LessonMetaPanel.jsx` | Lesson-level metadata: id, type, title, description, level, topic summary/proposals, assets (shared type assets for `authoring.sharedTypeAssets` modules), sandbox config modals |
| `LessonTopicSummary.jsx` | Derived existing/missing/unused topic report and editor for lesson-level topic proposals |
| `TaskList.jsx` | Left sidebar: task/group tree with drag-reorder, selection, creation, validation summary; task icons/tooltips for quizzes and activities come from the activity registry |
| `TaskEditor.jsx` | Task editor composition root: orchestrates sub-components and workspace panels; task format grid Code / Information / Quiz / Activity (+ Arrange in composed lessons) via `getTaskFormat`, with the quiz picker, activity gallery and quiz `BuilderEditor`s from the activity registry; dispatches to lesson-type `BuilderWorkspace` via registry; module gates (stage tabs, draft notice, Code button, copy-code placeholder, preview assets, reset-to-starter) come from the definition's `capabilities.unifiedStages` and `authoring` group; delegates run/check state to `useTaskEditorState`; re-exports `ScratchToolboxPicker`, `SpriteManager`, `BackdropManager` |
| `ExplainerEditor.jsx` | Markdown editor with Edit/Preview tabs; live rendering via MarkdownRenderer |
| `FileManager.jsx` | HTML file list: add/delete/type-change, entry file picker, HTML+CSS+JS template generator (templates from `modules/html/fileTemplates.js`; re-exports `HTML_ONLY`) |
| `BuilderOutputPanel.jsx` | Output panel with check results, retro typing animation (via `useTypewriterOutput`), and `input()` prompt for builder |
| `GroupEditor.jsx` | Inline editor for a task group's title and subtask count summary |
| `ValidationPanel.jsx` | Collapsible errors/warnings panel with tabbed view and per-warning ignore action |
| `TaskFeedbackPanel.jsx` | Collapsible panel showing teacher-submitted lesson feedback items for the selected task |
| `BuilderToolbar.jsx` | Top toolbar: branding, dirty indicator, and all action buttons (new/upload/preview/print/download/publish) |

### Lesson Meta Sub-components (`src/builder/components/lesson-meta/`)

| File | Role |
|---|---|
| `SandboxStarterModal.jsx` | Lesson sandbox starter editor and summary, chosen by the module's `authoring.sandboxStarterEditor` (`code`, `blocks`, `fs`, `circuit`, `files`); composed lessons get one tab per module |
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
| `QuizEditors.jsx` | Thin re-export for older imports: `QuizTypePicker` (from `ActivityPickers.jsx`) and each quiz sub-type's editor (now in `src/activities/quiz_*/ui.jsx`) |
| `ActivityPickers.jsx` | Registry-driven `QuizTypePicker` (category `quiz` activities) and `ActivityGallery` (every `taskType: 'activity'` activity: icon, label, description; unknown-activity hint) |
| `ActivitySection.jsx` | Builder section for an activity task: gallery, description field, the activity's `BuilderEditor`, and the `ActivityPreview` student preview |
| `CheckEditors.jsx` | Check utilities and editors: `subjectOpFromType`, `typeFromSubjectOp`, `getOperatorOptions`, `makeCheckSkeleton`, `CheckValueEditor`, `CheckListEditor`, feedback priority/stage-offer controls, and `CheckFeedbackControls` (the shared feedback mode/show pair, also used by the electronics, filesystem and scratch check editors) |
| `TestsEditor.jsx` | Builder sub-module: `TestsEditor` — CRUD UI for Python task test cases (inputs + check per test) |
| `TaskPreviewPanel.jsx` | Titled wrapper panel used to render the student-facing quiz/information preview in the builder |
| `TaskCheckResults.jsx` | Pass/fail check result banner plus a non-mutating student-feedback preview for linked stage offers |
| `TaskRunControls.jsx` | Run/Stop/Run Tests button row for the Python task builder |
| `TaskTestResults.jsx` | Output + test-suite results panel for the Python task builder; wraps `BuilderOutputPanel` |
| `TaskOptionsSection.jsx` | Collapsible "Task options" section: carry-through, interaction mode, completion check (via module `CheckEditor` + `defaultCheck`), feedback checks with targeted stage offers, and tests; all type-specific behaviour driven by module properties (`supportsInteractionMode`, `supportsIncorrectChecks`, `supportsTests`) |
| `PythonTaskWorkspace.jsx` | Python code editor + run controls panel for the builder (starter/complete/stage tabs) |
| `FilesystemTaskWorkspace.jsx` | Filesystem tree editor panel for the builder (starter/complete/stage tabs) |
| `DesktopTaskWorkspace.jsx` | Desktop starter/complete filesystem tree editor panel for the builder (reuses `FsTreeEditor` against `starterDesktop.fs`/`completeDesktop.fs`), plus `startsInDir` and an `availableApps` checkbox picker |
| `HtmlTaskWorkspace.jsx` | HTML editor with file manager + live preview split pane for the builder |
| `ScratchTaskSetup.jsx` | Scratch block editor modal and setup summary; owns all scratch-specific state and handlers |

### Check Editor Helpers (`src/builder/components/task-editor/check-editors/`)

| File | Role |
|---|---|
| `checkEditorUtils.js` | Pure check editor mapping helpers: subject/operator/type conversion, option lists, check skeletons, regex detection, and failure formatting |

---

## Lesson Type Modules (`src/modules/`)

Each lesson type is a self-contained module folder. Adding a new type requires only a new folder plus one line each in `definitions.js` and `registry.js`.

| File | Role |
|---|---|
| `registry.js` | Maps `lesson.type` strings → module objects; exports `getLessonModule`, `getStudentWorkspace`, `getBuilderWorkspace`, `getCheckEditor` |
| `checks.js` | Check evaluation dispatcher: canonical `type` + `operator` aliases, feedback-check precedence, `evaluateSingleCheck`, `evaluateCheck`, `evaluateCheckResults`, `evaluateCheckWithFeedback`, `normalizeChecks`. Builds `checkRegistry` from `CORE_CHECKS` + every module's `CHECKS`; `evaluateSingleCheck` normalises core aliases then does a registry lookup + call, and `CHECK_TYPES.RUN_REQUIRED` / `SUBMIT_ALLOWED` are derived from the definitions. The core `code` definition routes to the electronics evaluator when `context.circuit` is present, so it runs against Micro Controller MicroPython source instead of raw circuit JSON |
| `checkRegistry.js` | Pure, Node-safe check-type registry: `createCheckRegistry(defs)` validates definitions (`type`, `owner`, `timing`, `requiresRun`, `submitAllowed`, `evaluate`, optional `aliases`/`subject`/`operators`/`fields`/`contextKey`/`validate`), throws on duplicate type ids or aliases, and provides alias-aware `get`/`has`/`canonicalType`/`typeIds`/`evaluate` |
| `sharedStyles.js` | Shared lesson-module layout style factories used by scroll-style modules |
| `defineModule.js` | Pure: `defineModule(def)` validates a module definition (type, `meta` — `label`, `order`, `shortLabel`, `icon`, `pickerHint`, `language`, `playground`, optional `surfaceLabels` / `pickerOrder` (defaults to `order`) — `capabilities` (including `run`: `runtime` / `preview` / `workspace` / `none`, defaulting to `none`, with `runResult` flags for runtime modules, and the step 4.7 UI gates `stageReveal`, `teacherStageReveal`, `highlights`, `downloadCode`, `fixedExplainer`, `topicLibrary`, `studentMirror`, optional `cardSummary` / `focusPanes` / `teacherEditor` — the last paired with `workSlot.teacherEdit` and `meta.teacherEditCopy` — and the step 4.8 optional booleans `teacherFillHeight`, `teacherSandboxRow`, `teacherUnifiedStageTabs`, `explainerBlockMenu`, defaulting to false), required hooks and flags, the contract v2 `lifecycle` (plus optional `playgroundTask`, required exactly for `meta.playground` modules) / `storage` / `wire` groups, the Builder `authoring` group (`defaultTypeFields`, `missingStarter`, `copyStarterToComplete`, `printTask`, `sandboxStarterEditor`, `builderRun`, optional `codeFormat` / `copyCodePlaceholder` / flags), and the optional paired `checking` / `workSlot` groups that put a module on the generic work slot (hook form, or field form whose source hooks it derives; a record slot on the code channel or a per-file slot on the files channel; `workspaceOwned` needs the `workspace` trigger; optional `teacherStarter` defaults to `starter`) — `getSandboxState` is set as an alias of `lifecycle.sandboxStarter`) and freezes it; `defineUiModule(def, ui)` merges the UI half (workspaces, check editors, `getLayoutStyles`, `runtime`) into the object the registry returns |
| `moduleTaskValidation.js` | Pure building blocks for each module definition's `validateTask`: check-field rules (`validateCodeChecks`, `validateScratchChecks`), stage-state and HTML starter-file rules, Python test rules, complete-solution warnings, starter/check-value helpers, and `validateRegisteredChecks` (calls a check-registry definition's optional `validate`) |
| `moduleContract.js` | Pure builders for the contract v2 hook groups: lifecycle helpers (`stageForAction`, `codeResetTarget`, `codeHasComplete`, `alwaysPersonalSandbox`, `personalSandboxWhenLessonHas(field)`), `TEACHER_EDIT_CODE_COPY`, storage adapters (`recordStorage({ workKey, taskMeta, sandboxMeta })`, `perFileStorage()`) mapping work onto the runtime-model localStorage shapes, wire codecs (`codeStringWire`, `jsonWire`, `filesWire`, `noLiveExtras`), and work-slot builders (`codeWorkSlot`, `codeCheckContext`, `starterCodeOf` / `completeCodeOf`, `identityStored` / `identityFromStored`, `fieldWorkSlotHooks`) |
| `moduleAuthoring.js` | Pure builders for the `authoring` group: `codeDefaultTypeFields`, `codeCopyStarterToComplete`, `never`, `noUpdates`, the copy-code placeholders |
| `printHelpers.js` | Pure helpers for `authoring.printTask`: `printCodeStringTask` (python, turtle, arcade), `printCarryFrom`, `printCopyCode`, `printNothing`, and the shared `parseObjectLike` / `sortByPath` / `snippet` / `formatSummary` |
| `definitions.js` | Pure, Node-safe registry of every `<type>/definition.js`: `MODULE_TYPES` (registry order), `getModuleDefinitions()`, `getModuleDefinition(type)`, plus the derivation helpers core code uses instead of hand-maintained type lists — `getModuleTypesWhere(predicate)`, `getModuleTypesWithCapability(name)`, `CARRY_THROUGH_FIELDS`, `getModuleLabel(type, surface)`, `getModuleAuthoring(type)`, `SPRITE_LIBRARY_MODULE_TYPE`; used by `registry.js`, `src/shared/composedLesson.js`, `taskUtils.js` and the CLI |
| `<type>/definition.js` | Pure, Node-safe half of each module (python, html, scratch, filesystem, electronics, arcade, turtle, desktop): `meta`, authoring/carry-through/state/sandbox/display hooks, the contract v2 `lifecycle` (`resetTarget`, `hasComplete`, `teacherCompleteTab`, `sandboxStarter`, `composedSandboxFields`, `hasPersonalSandbox`), `storage` and `wire` groups, the Builder `authoring` group, the `checking` / `workSlot` groups (every module), and capability flags; no JSX, React, DOM or runtimes, and explicit `.js` import extensions. `<type>/index.js` wraps it with `defineUiModule` |
| `python/index.js` | Python module: layout styles, `makeCodeTaskFields`, `makeNewStage`, `initCompleteTab`, `defaultCheck`, capability flags |
| `python/checks.js` | Python-exclusive check evaluation: `PYTHON_CHECK_TYPES`, `evaluatePythonCheck`, registry `CHECKS` — all `variable_*` types |
| `python/PythonEditor.jsx` | Python CodeEditor wrapper with Pyodide loading/error status; shows a tap-to-insert row of common Python symbols above the editor on touch devices (`useIsTouchDevice`) plus an always-visible `EmojiPickerButton`, both while interactive, inserting via `CodeEditor`'s `insertAtCursor` ref API. Shared by Turtle, Arcade, and Electronics student/live views since they reuse this component for their Python/MicroPython code |
| `python/StudentWorkspace.jsx` | Student Python editor + Run/Stop/Output panel (extracted from `LessonTaskContent`) |
| `python/BuilderWorkspace.jsx` | Re-export of `PythonTaskWorkspace` |
| `python/CheckEditor.jsx` | `CheckListEditor` wrapper with Python-appropriate flags |
| `python/pyodide.js` | Pyodide Web Worker manager: `initPyodide()`, `runPython()`, `stopPython()`, `provideInput()`, `isPyodideReady()` |
| `python/pyodide.worker.js` | Web Worker: Pyodide loader, AST-based async `input()` transform, stdout/stderr event streaming (via `createUtf8ByteDecoder()`, a streaming UTF-8 decoder — Pyodide's raw callbacks deliver one byte at a time, so multi-byte characters like emoji or `£` must be reassembled rather than decoded byte-by-byte); `formatPythonError()` parses the failing `<student>` line for the error-line highlight |
| `html/index.js` | HTML module definition |
| `html/checks.js` | HTML-exclusive check evaluation: `HTML_CHECK_TYPES`, `evaluateHtmlCheck`, registry `CHECKS` (canonical `html_*` types own the legacy `element_*` ids as aliases) |
| `html/iframe.js` | `buildIframeSrc()`: Blob URL filesystem, cross-reference rewriting, CSP + console interceptor injection; `resolveIframeErrorLocation()` maps a reported runtime error back to `{ file, line }` for the error-line highlight |
| `html/HtmlEditor.jsx` | Tabbed HTML/CSS/JS editor with optional asset browser drawer; shows an `EmojiPickerButton` above the editor while interactive |
| `html/StudentWorkspace.jsx` | Student HTML editor + iframe preview; handles mobile/desktop split; owns `useTypeAssets` call |
| `html/BuilderWorkspace.jsx` | Re-export of `HtmlTaskWorkspace` |
| `html/CheckEditor.jsx` | `CheckListEditor` wrapper with HTML flags; includes `allowDomChecks` |
| `html/fileTemplates.js` | Pure: `HTML_FILE_TYPE`, `isHtmlFileType`, `isHtmlEntryCandidate`, and the `HTML_ONLY` / `HTML_WITH_CSS` / `HTML_WITH_CSS_JS` file templates (Builder file manager, sandbox starter editor, `authoring.defaultTypeFields`) |
| `html/print.js` | Pure: `printHtmlTask` — the HTML module's printable-lesson section |
| `scratch/index.js` | Scratch module definition |
| `scratch/checks.js` | Pure Scratch check evaluation: `evaluateScratchCheck`, `compare`, `createSpriteState`, `DEFAULT_SPRITES`, `normalizeSequenceItem` |
| `scratch/print.js` | Pure: `printScratchTask` — the Scratch module's printable-lesson section |
| `scratch/scratch.js` | Custom Scratch interpreter: block definitions, multi-sprite state, broadcast, sounds, `CREATE_VARIABLE_CALLBACK_KEY`/`addCreateVariableButtonToToolbox` flyout button injection; re-exports check/state helpers from `checks.js` and persistence helpers from `scratchPersistence.js` |
| `scratch/scratchEditors.jsx` | Scratch toolbox data, `buildScratchToolboxXml`, `parseScratchToolboxXml`, `ScratchToolboxPicker`, `ScratchCheckListEditor`, `ScratchCheckEditor`, variables, and prebuilt stack editors |
| `scratch/graphicEffects.js` | Draws Scratch graphic effects (`effect_*` sprite state) on the stage: `applyGraphicEffectsToPixels` ports Scratch 3's sprite shader maths for all seven effects; `drawSpriteWithGraphicEffects` renders a sprite through an offscreen canvas, falling back to canvas alpha/CSS filters when a cross-origin costume taints the canvas |
| `scratch/scratchPersistence.js` | Workspace serialization and state migration: `saveWorkspace`, `loadWorkspace`, `migrateBroadcastState`, `migrateVariableFields` |
| `scratch/ScratchWorkspace.jsx` | Full Scratch IDE: multi-sprite Blockly workspaces, stage canvas, sprite drag, check evaluation; author-gated (`task.allowAddSprite`/`allowAddBackdrop`/`allowCreateVariable`) student "Add sprite"/"Add backdrop" pickers and a runtime "Make a Variable" flyout button — all decorative/check-invisible (`isSpriteCheckable`, `filterCheckableSpriteWorkspaces`, `isValidNewVariableName`), persisted under a `__meta__` key alongside the per-sprite Blockly state; below a measured or forced (`forceCompact`) width threshold, switches from side-by-side editor+stage to a Blocks/Stage `PanelTabs` layout; the stage canvas itself scales down on both width and height to fit whatever space it's given (`computeStageScale`) instead of a height threshold triggering that same switch; Blockly zoom is fully automatic (`computeBlockScale`, no manual wheel/on-canvas zoom) (see `docs/agents/classroom-behaviours.md`) |
| `scratch/StudentWorkspace.jsx` | Scratch workspace with Reset Blocks button (extracted from `LessonTaskContent`) |
| `scratch/TeacherLiveView.jsx` | Read-only Scratch view for the teacher dashboard's "watch one student" modal (`StudentWorkspaceBody.jsx`); always renders `ScratchWorkspace` with `forceCompact` so it doesn't depend on the modal's own width |
| `scratch/BuilderWorkspace.jsx` | Re-export of `ScratchTaskSetup` |
| `scratch/CheckEditor.jsx` | `ScratchCheckListEditor` wrapper |
| `filesystem/index.js` | Filesystem module definition |
| `filesystem/checks.js` | Filesystem check evaluation: `FS_CHECK_TYPES`, `FS_CHECK_DEFINITIONS`, `evaluateFsCheck`, registry `CHECKS` — all `fs_*` types |
| `filesystem/filesystem.js` | Virtual filesystem engine: flat path-map state, CRUD helpers, path normalization, and parent/child lookup |
| `filesystem/print.js` | Pure: `printFilesystemTask` — the Filesystem module's printable-lesson section (path/type/snippet tables) |
| `filesystem/filesystemEditors.jsx` | Builder sub-module: `FsTreeEditor` visual starter/complete editor and `FsCheckListEditor` filesystem check builder |
| `filesystem/FilesystemTask.jsx` | Student-facing Windows Explorer-style virtual filesystem UI: folder tree, icon grid, drag-and-drop move, inline rename, CodeMirror file editor |
| `filesystem/StudentWorkspace.jsx` | `FilesystemTask` wrapper with initialDir derivation |
| `filesystem/BuilderWorkspace.jsx` | Re-export of `FilesystemTaskWorkspace` |
| `filesystem/CheckEditor.jsx` | `FsCheckListEditor` wrapper |
| `desktop/index.js` | Desktop module definition |
| `desktop/desktopState.js` | Desktop state shape (`{ fs, recycleBin, windows }`), window CRUD helpers (`openWindow` — dedupes by `(appId, filePath)`, `moveWindow`, `resizeWindow`, `setWindowMinimized`, `setWindowMaximized`, `closeWindow`, `focusWindow`, `arrangeSideBySide`, `isWindowDirty`), serialize/deserialize |
| `desktop/checks.js` | Desktop check evaluation: `DESKTOP_CHECK_TYPES`, `DESKTOP_CHECK_DEFINITIONS`, `evaluateDesktopCheck`, registry `CHECKS` — `fs_recycle_bin`, `window_state`, `windows_arranged_side_by_side` (`fs_*` checks route through the filesystem module's evaluator via `context.fs`) |
| `desktop/desktopEditors.jsx` | Builder check editor: `DesktopCheckListEditor`, unified over filesystem `fs_*`, desktop-specific and `input_*` check definitions (gesture/target/drop-target/combo/via/modifier/min fields) |
| `desktop/Desktop.jsx` | Desktop shell: background, app icon grid, taskbar with clock and open-window buttons |
| `desktop/WindowManager.jsx` | Renders open windows for the current desktop state, wires drag/resize/minimize/maximize/close/focus to `desktopState.js` |
| `desktop/Window.jsx` | Window chrome: draggable title bar, resize handle, minimize/maximize/close controls |
| `desktop/apps/fileManager/FileManagerApp.jsx` | File Manager "app": wraps `FilesystemTask`, adds a Recycle Bin panel, search, and sort; calls `onOpenFile` on file open instead of showing `FilesystemTask`'s inline preview |
| `desktop/apps/fileManager/recycleBin.js` | Soft-delete/restore layered on the filesystem module's pure operations, without modifying them |
| `desktop/apps/textEditor/TextEditorApp.jsx` | Text Editor "app": plain-text editor with local `draftContent`/dirty tracking and explicit Open/Save/Save As (no autosave) |
| `desktop/apps/imageViewer/ImageViewerApp.jsx` | Image Viewer "app": read-only image display, zoom, and Prev/Next across sibling images in a folder |
| `desktop/apps/shared/FileDialog.jsx` | Shared Open/Save As dialog (folder navigation, New Folder, overwrite confirm) used by Text Editor and Image Viewer |
| `desktop/apps/browser/BrowserApp.jsx` | Browser "app": simulated browser chrome (Back/Forward/Refresh/Home, address bar), search engine, and downloads over a lesson-authored `siteGraph` |
| `desktop/apps/browser/siteGraph.js` | Pure helpers for the Browser's lesson-authored site graph: normalise, page lookup, free-text search ranking, URL lookup |
| `desktop/apps/paint/PaintApp.jsx` | Paint "app": freehand canvas (brush/eraser, palette, sizes, undo, clear) with Text Editor's explicit Open/Save/Save As model; saves a PNG `data:` URL onto the file entry's `content` |
| `desktop/StudentWorkspace.jsx` | Mounts `Desktop` for the student, wiring `cs.handleDesktopChange`/`handleDesktopInteraction` and the file-open-to-app-window handler; when the task has `input_*` checks, records input on the surface (`useSurfaceInputRecorder`) and sends the summary as `interaction.input` (in memory only) |
| `desktop/BuilderWorkspace.jsx` | Re-export of `DesktopTaskWorkspace` |
| `desktop/CheckEditor.jsx` | `DesktopCheckListEditor` wrapper |
| `desktop/TeacherLiveView.jsx` | Reuses `Desktop` read-only or sandbox-editable against `displayState` |
| `electronics/index.js` | Electronics module definition: breadboard state helpers, builder/student/teacher workspaces, checks, carry-through, sandbox state, and MicroPython runtime bridge |
| `electronics/checks.js` | Electronics registry `CHECKS` for the `circuit_*` check types (evaluators live in `circuit.js`) |
| `electronics/circuit.js` | Pure electronics circuit model helpers: default board, clone/parse/serialize, component creation, connectivity, short detection, simulated states, `circuit_*` check evaluation, and generic `code`-family check evaluation against the Micro Controller's MicroPython source |
| `electronics/print.js` | Pure: `printElectronicsTask` — the Electronics module's printable-lesson section (parts, components, wires, MicroPython) |
| `electronics/ElectronicsWorkspace.jsx` | Shared breadboard UI shell: board state, selection, drag/drop, wiring interaction, fit-to-pane zoom, tabs, MicroPython Code tab, and output panel - draws on the five modules below |
| `electronics/Inspector.jsx` | Right-hand panel for the selected wire or part: electrical readout, part properties, runtime controls, Micro Controller GPIO editing; handlers arrive bundled as `actions` |
| `electronics/ComponentArt.jsx` | How parts are drawn: palette glyphs, the part on the board with its live state and on-canvas controls, and the inspector's state readout. Keeps literal colours - it draws real components |
| `electronics/wireRouting.js` | Orthogonal wire routing: obstacle-aware pathfinding over a lane graph, scored on overlap, crossings and bends |
| `electronics/boardGeometry.js` | Board grid metrics and part geometry: part sizes, pin offsets, rotation, and the rectangles the wire router avoids |
| `electronics/workspaceStyles.js` | Electronics chrome styles on the `--colour-*`/`--ui-*` tokens, plus the semantic colour constants the tokens do not cover |
| `electronics/format.js` | Display formatting for resistance, voltage and current, shared by the inspector and the part drawings |
| `electronics/StudentWorkspace.jsx` | Student electronics workspace wrapper: serialized circuit state, reset/check actions, teacher-live/read-only handling |
| `electronics/BuilderWorkspace.jsx` | Builder electronics workspace: starter/complete/stage board tabs, board sizing, and available component controls |
| `electronics/TeacherLiveView.jsx` | Read-only or sandbox-editable teacher electronics board view |
| `electronics/CheckEditor.jsx` | Electronics check list editor for `circuit_*` completion and feedback checks, plus a Code subject that reuses `builder/components/task-editor/check-editors/checkEditorUtils.js` and `CheckEditors.jsx`'s `CheckValueEditor` for generic code checks |
| `arcade/index.js` | Arcade Kit module definition: single-file Python pixel-game task schema and classroom capabilities |
| `arcade/StudentWorkspace.jsx` | Student Arcade Kit workspace: Python editor, sandboxed game canvas, lesson/type/local asset browser, and Run/Stop controls |
| `arcade/BuilderWorkspace.jsx` | Builder Arcade Kit code-stage editor and on-demand game preview |
| `arcade/ArcadePreview.jsx` | Isolated iframe host for rendering and restarting an Arcade Kit game safely |
| `arcade/design.js` | Portable pixel-sprite and tilemap model, stage selection, generated image data URLs, and Python tilemap snippet creation |
| `arcade/ArcadeDesignStudio.jsx` | Shared Builder/student sprite editor, tilemap painter, per-tile-property editor, object-spawn list, and generated-asset list |
| `arcade/runtime.js` | Builds the sandboxed Pyodide game document and exposes `headstart_arcade` (`game`, `Sprite`, `TileMap`, `keys`, `pointer`/`mouse`) to student code |
| `arcade/CheckEditor.jsx` | Arcade Kit code-check editor wrapper (Output subject hidden; code checks run on Run game via `handleArcadeRun` in `useStudentCodeState.js`) |
| `arcade/TeacherLiveView.jsx` | Teacher Arcade source view with read-only inspection of a watched student's art and map snapshot |
| `turtle/index.js` | Turtle module definition: single-file Python turtle-graphics task schema and classroom capabilities |
| `turtle/engine.js` | Pure turtle-graphics state machine (forward/turn/goto/home), no DOM/Pyodide — unit tested directly |
| `turtle/shim.js` | Python-side fake `turtle` module (source-line array + `buildTurtleProgram`), same technique as `electronics`'s `MICROPYTHON_SHIM`, backed by `__hsTurtle*` bridge functions on the shared Pyodide worker |
| `turtle/draw.js` | Shared canvas renderer: maps the fixed logical turtle world onto a responsive canvas (`drawTurtleCommands`, `sizeCanvasToDisplay`) and draws the 🐢 position/heading marker (`turtleMarkerTransform`) |
| `turtle/checks.js` | Registry `CHECKS` + `turtle_position`/`turtle_heading`/`turtle_path_closed`/`turtle_segment_count`/`turtle_path_length`/`turtle_command_used`/`turtle_color_used`/`turtle_stamp_count` check evaluators |
| `turtle/sync.js` | `compactTurtleResultForSync` — rounds coordinates and caps the command log before a run result is synced live to a teacher, shared by both `useTeacherLivePublish.js` and `useSession.js`'s `writeStudentTurtleResult` |
| `turtle/StudentWorkspace.jsx` | Student Turtle workspace: Python editor, canvas, Run/Stop controls, collapsible output panel |
| `turtle/BuilderWorkspace.jsx` | Builder Turtle code-stage editor with a self-contained on-demand drawing preview (own Pyodide run, like Arcade Kit's Builder preview) |
| `turtle/CheckEditor.jsx` | Turtle check list editor with a Turtle/Code subject picker; code checks reuse `CheckValueEditor` and `checkEditorUtils.js` |
| `turtle/TeacherLiveView.jsx` | Teacher's read-only code + canvas view of a student's turtle task, driven by the synced `currentTurtleResult`/`turtleResult` |
| `_template/definition.js`, `_template/index.js`, `_template/StudentWorkspace.jsx`, `_template/BuilderWorkspace.jsx`, `_template/CheckEditor.jsx`, `_template/TeacherLiveView.jsx`, `_template/checks.js` | Module scaffold copied by `npm run new:module` (`scripts/new-module.mjs`): a working "write text, press Check" module on the generic work slot (`run: 'workspace'`, `checking.trigger: 'run'`, `codeWorkSlot`, core code checks) with every contract v2 group filled with safe defaults and `TODO(new-module)` markers, its tests (definition, workspace UI, StudentView click-through that skips while unregistered) and `doc.md.tmpl`. Never registered; `moduleDefinitionsNode` / `validationErrorsDoc` skip `_`-prefixed folders (the definition still loads under Node) |

### Module interface

Each `index.js` exports a default object with the following properties. UI surfaces (`StudentWorkspace`, `BuilderWorkspace`, `CheckEditor`, `FeedbackCheckEditor`, `TeacherLiveView`, `getLayoutStyles`, `runtime`) are declared in `index.js`; everything else comes from `definition.js` (plus `meta: { label, order }`).

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
| `validateTask(task, { n, lesson, errors, warnings })` | `fn` | Pure type-specific lesson validation shared by the Builder and the CLI (pushes messages); see `src/shared/lessonValidation.js` |
| `hasStarterContent(task)` | `fn \| null` | Optional: whether the task has starter content (`null` = never warn about an empty editor) |
| `hasCheckValue(task)` | `fn \| null` | Optional: whether the completion check is worth the Builder's untested-check reminder (`null` = the generic code-check rule) |
| `validateTaskInBrowser(task, { n, errors, warnings })` | `fn \| null` | Optional Builder-only rules needing browser APIs (Scratch toolbox XML via `DOMParser`); the CLI never calls it |
| `runtime` | `object \| null` | Optional runtime bridge with `init`, `isReady`, `stop`, and module-specific helpers |

---

## Activities (`src/activities/`)

Self-contained exercises that can sit anywhere in a lesson (see `docs/architecture/modular-activities-plan.md` and `docs/architecture/activities.md`). New activities (`taskType: 'activity'`) and legacy quizzes (`taskType: 'quiz'` + `quizType`, one activity per sub-type) run through `ActivityHost`. code_arrange (`taskType: 'code_arrange'`) is an activity hosted by a workspace module (`hostModules: ['python', 'html']`): its board replaces the module's StudentWorkspace and the assembled program runs through the module's own work slot and Run (plan step 4.9).

| File | Role |
|---|---|
| `defineActivity.js` | Activity contract: validates a pure activity definition and fills defaults (storage in the `__activity_state__` aux file, live state on `currentAnswer`, report type fields) |
| `resolve.js` | `getActivityId(task)`: maps stored tasks to activity ids without changing formats (`quiz` + `quizType` → `quiz_<type>`, `code_arrange`, `activity` + `activityType`); `LEGACY_QUIZ_TASK_TYPE`, `isLegacyQuizRecord(task)` (any stored quiz, known quizType or not) |
| `registry.pure.js` | Node-safe activity registry (`getActivityDefinition(s)`, `getTaskActivity`, `ACTIVITY_IDS`, YAML shorthand lookup both ways (`activityIdForYamlType`, `yamlTypeForActivityTask`), `isHostedActivityTask` (ActivityHost tasks only), module-hosted activities (`getModuleHostedActivity`, `isModuleHostedActivityTask`, `getModuleHostedActivityDefinitions`), `isLegacyQuizTask`, `allowsStudentBroadcast`, Builder helpers `TASK_FORMATS`, `getTaskFormat`, `getQuizActivityDefinitions`, `getGalleryActivityDefinitions`); unknown `activityType` / `quizType` values resolve to the fallback |
| `quiz/quizActivity.js` | Shared pure logic for the five quiz activities: `defineQuizActivity` (legacy shape, shared validation, `currentAnswer` formats, `{ taskType: 'quiz', quizType }` report fields), attempt submissions (`buildQuizSubmission`), feedback (`getQuizSuggestion`), item progress, report normalisers and per-item failure summaries, print tables |
| `quiz/QuizActivityViews.jsx` | Quiz activity UI: `QuizActivityStudentView` hosts `QuizTask` (in-progress change → `onChange`, final answer → `onSubmit(answer, { passedOverride })`; teacher variant shows verdict + correct answers) and the StudentCard summaries (`ChoiceCardSummary`, items progress text, short-answer text, confidence badge) |
| `quiz_multiple_choice/definition.js` | Multiple-choice quiz activity: option-id state, graded by the `answer_equals` check, option feedback, print options table |
| `quiz_match/definition.js` | Match quiz activity: pair map state, auto-marked when every tile is placed, teacher-editable, item progress, `pairFailures` report summary, print pairs table |
| `quiz_fill_blank/definition.js` | Fill-in-the-gaps quiz activity: tile-id (drag) or typed-text map, auto-marked (drag) / Submit (type), teacher-editable, item progress, `blankFailures` report summary, print text/blanks/distractors |
| `quiz_short_answer/definition.js` | Short-answer quiz activity: free text, graded by its `answer_*` check or (ungraded) any non-blank answer |
| `quiz_confidence/definition.js` | Confidence quiz activity: `"1"`..`"5"` rating, never marked (`completion: 'none'`), `ratingDistribution` report summary |
| `quiz_*/ui.jsx` | Per-sub-type UI entries: `QuizActivityStudentView`, the matching `CardSummary`, `ownsLayout` (no activity header/frame), and the Builder parts: `BuilderEditor` (the sub-type's editor, moved from `QuizEditors.jsx`), `BuilderIcon`, `builderHint`, `builderConvert` |
| `quiz/quizBuilder.js` | Builder conversions for quizzes: `toQuizTask` (choosing the Quiz format) and `switchQuizType` (changing quiz sub-type), unchanged from the old TaskEditor handlers |
| `quiz/QuizTypeIcon.jsx` | SVG icons for the Builder's quiz-type picker |
| `binary/definition.js` | Binary activity definition wrapping `binary.js`: default task, validation, state, grading, progress, card summary, print |
| `keyboard/keyboard.js` | Pure Keyboard activity logic (`type_text`, `find_key`, `symbols`, `shortcuts`, `edit_text`; UK layout): validation incl. untypeable characters and browser-reserved shortcuts, grading from stored per-item results (Shift vs Caps Lock, optional accuracy/WPM targets, keys vs menu, hardware-only items) |
| `keyboard/editText.js` | Pure `edit_text` logic: the edit model (`text`, per-character `orig` mask, `caret`, `anchor`) and `applyEditKey` (arrows, Home/End, Shift selection, Ctrl+A, Backspace, Delete, typing), `lcsLength` / `keptShare` (edited-not-retyped, `minKept`), `editSolution`, `gradeEditItem` hints, `validateEditItem`, `EDIT_REQUIRE_KEYS` |
| `keyboard/definition.js` | Keyboard activity definition: needs a physical keyboard with an on-screen fallback; keystrokes classified as continuous, finished items as discrete |
| `mouse/mouse.js` | Pure Mouse activity logic: stage targets (0-1 positions), click/double-click/right-click/drag/scroll/hover items, touch policy (`equivalent`/`skip`/`block`), grading by the gesture that completed each item |
| `mouse/definition.js` | Mouse activity definition: grades with the device recorded in state (touch equivalents accepted, hover skipped on touch) |
| `legacyValidation.js` | Pure quiz (`validateQuizTask`) and code_arrange (`validateCodeArrangeTask`) validation plus starter/check-value helpers, looked up by `getLegacyTaskValidation(task)` from `src/shared/lessonValidation.js`; the quiz and code_arrange activity definitions' `validateTask` wrap the same rules |
| `code_arrange/definition.js` | Code Arrange activity (legacy `taskType: 'code_arrange'`), hosted by the python / html modules (`hostModules`): slot-map state, `__code_arrange_slots__` aux file, `codeArrangeSlots` live channel (`currentCodeArrangeSlots`), slot progress ("X/N slots filled", `progressUnit`), `{ taskType: 'code' }` report fields, prints nothing of its own, offered only in composed lessons (`availableIn`); `hostModuleFor` |
| `code_arrange/ui.jsx` | Code Arrange UI: `ModuleWorkspace` (the container below, rendered by `LessonTaskContent` in place of the module's StudentWorkspace), `StudentView` (controlled tile board; the teacher's task panel shows the solution with it), `TeacherLiveView` (StudentModal board from `currentCodeArrangeSlots`, editable with Edit answers), `BuilderEditor`, `builderConvert` |
| `code_arrange/CodeArrangeTask.jsx` | Presentational tile board: renders each authored line as either a whole-line drop slot or fixed text with small inline blanks in place (via `useTileDragAndDrop`), all fed from the one shared "Code tiles" pool below the program, Run button, Python output panel or HTML iframe preview. Reused by the student container, teacher views and the Builder preview |
| `code_arrange/CodeArrangeTaskContainer.jsx` | Wires `CodeArrangeTask` to `useStudentCodeState` (`cs`): persists the tile arrangement (definition `storage` / `serialize`), pushes assembled code into `cs.handleCodeChange`/`handleFileChange`, and runs via `cs.handleRun` — the real Python/HTML pipeline, unmodified |
| `code_arrange/CodeArrangeBuilderEditor.jsx` | Visual Builder authoring + live preview for Arrange tasks: a reorderable line list where every line uses the same "parts composer" (fixed-text and blank-slot chips; a line with just one blank is the whole-line case), one shared task-level distractor-tile list, entry file for HTML, the module's ordinary `CheckEditor`, and a drag-and-run preview using `getLessonModule(...).runtime` directly |
| `code_arrange/codeArrangeBuilder.js` | `convertToCodeArrange`: the Builder's conversion into the Arrange format (unchanged from the old TaskEditor handler) |
| `unknown/definition.js` | Fallback for an `activityType` this bundle doesn't know: ungraded "not available" notice, validation error pointing at `lessons capabilities` |
| `registry.js` | UI activity registry: merges each pure definition with its `ui.jsx` (`getActivityUi`, `getTaskActivityUi`, `getModuleHostedActivityUi`). Classroom only, never imported by the CLI |
| `ActivityHost.jsx` | Classroom host for a hosted activity task: picks the student's own state, an earlier task's saved state (review) or the teacher's broadcast (`teacherLive.answer`); applies `requires` / `touchFallback` (on-screen keyboard banner, "needs a mouse" block, touch notice, "I have a keyboard" override); unknown-activity notice. Also exports `ActivityView` (header + StudentView/TeacherLiveView) used by StudentModal and TeacherEditorPanel |
| `state.js` | Pure helpers reading an activity's state from its serialised form (`deserializeActivityState`, `solutionOrInitialState`, `readActivityAnswer`, `readStudentActivityState` / `studentStateField` for the student record field of the activity's `liveChannel`, `summarizeActivityAnswer` for the teacher card) |
| `device.js` | Pure device helpers: `describeActivityDevice(state)` (touch / on-screen keyboard badge from the activity's own state) and `effectiveCapabilities` (keyboard override, tablets treated as keyboard-less) |
| `binary/ui.jsx` | Binary StudentView: bit tiles (switches) with place values, decimal answer box, carry row for addition, one item at a time |
| `binary/BinaryBuilderEditor.jsx` | Binary `BuilderEditor`: mode (keeps item ids, drops options the mode doesn't use), bits, display options (place values, running decimal, carries, ASCII code format/table, picture size), per-mode items incl. a pixel-grid editor |
| `keyboard/KeyboardBuilderEditor.jsx` | Keyboard `BuilderEditor`: mode, fixed UK layout note, `type_text` options (Shift capitals, min accuracy, target WPM), per-mode items with `hardwareOnly`; reserved-shortcut errors inline |
| `mouse/MouseBuilderEditor.jsx` | Mouse `BuilderEditor`: touch policy, targets (label/emoji/x/y/size; renaming updates items) with a click-to-place stage preview, items (action/target/to/prompt) |
| `ui/builderKit.jsx` | Building blocks for activity BuilderEditors: `useActivityValidation` / `splitValidation` (validateTask messages next to their item or target), `ValidationMessages`, `RowListEditor`, `InlineField`, `ChoiceCards`, `nextItemId`, `readNumber` |
| `ui/BuilderField.jsx` | The labelled `Field` row shared by the Builder task editor and activity editors |
| `ActivityPreview.jsx` | Builder student preview: plays a task through `ActivityHost` with in-memory state (kept per task while the page is open, restarted on edit), grades on Check, Start again / Show answers; writes nothing |
| `keyboard/ui.jsx` | Keyboard StudentView: `type_text` target overlay with accuracy/WPM (`typingStats`), `find_key` / `symbols` with the keyboard picture and hints, `shortcuts` practice box (keys vs right-click menu detection); on-screen keyboard input when there is no physical keyboard |
| `keyboard/OnScreenKeyboard.jsx` | UK on-screen keyboard: interactive fallback emitting virtual key events (one-shot Shift/Ctrl) or a non-interactive picture highlighting hinted keys |
| `mouse/ui.jsx` | Mouse StudentView: stage of positioned `data-input-id` targets, Pointer Events recording (incl. touch drag via `elementsFromPoint`), `recognizeGestures`, no native context menu on the stage, hover dwell timer (skipped on touch), `state.device.touch` |
| `ui/ItemNav.jsx` | Shared "Question n of m" item navigation with per-item done/wrong markers |
| `ui/ActivityDeviceBadge.jsx` | Teacher badge (card and modal) showing a touch-screen or on-screen-keyboard attempt |
| `binary/binary.js` | Pure Binary activity logic for `make_number`, `to_binary`, `to_decimal`, `add`, `overflow`, `hex`, `ascii`, `pixels`: bit conversion, place values, carries, shared authoring validation, per-item grading with child-friendly hints, whole-task progress |
| `_template/definition.js`, `_template/template_activity.js`, `_template/ui.jsx` | Activity scaffold copied by `npm run new:activity` (`scripts/new-activity.mjs`): a working "type the answer" activity with `TODO(new-activity)` markers, its tests (pure, UI, StudentView click-through that skips while unregistered) and `doc.md.tmpl`. Never registered; the registry, interface and validation-doc tests skip `_`-prefixed folders |

---

## Shared Modules (`src/shared/`)

| File | Role |
|---|---|
| `CodeEditor.jsx` | Shared CodeMirror React wrapper: language/readOnly via compartments, no remount on prop change; `errorLineField`/`setErrorLine` drive the red runtime-error-line highlight, cleared on any document change; `forwardRef` exposes an imperative `insertAtCursor(text)` (no-op while `readOnly`) for external "insert at cursor" UI, e.g. `PythonEditor.jsx`'s touch symbol row and `EmojiPickerButton` |
| `EmojiPickerButton.jsx` | Toolbar button that opens an `emoji-picker-react` popover (native emoji style, no CDN calls) and calls `onInsert(emoji)` on pick; closes on pick or outside click. Used by `PythonEditor.jsx` and `HtmlEditor.jsx` |
| `SplitPane.jsx` | Draggable two-pane splitter: [15%, 85%] clamped, collapsible right pane with fixed width option |
| `AssetBrowser.jsx` | Read-only lesson asset browser: file tree, click-to-copy paths, image hover preview |
| `AssetImagePreview.jsx` | Shared asset image thumbnail and preview presentation |
| `AssetPicker.jsx` | Dropdown asset picker for builder inputs: grouped by lesson/shared/common sources, manual fallback |
| `assetPaths.js` | Encoded absolute asset URL construction for iframe and Scratch consumers |
| `spritePresets.js` | Pure Scratch sprite/backdrop preset validation, unique lesson-sprite/backdrop creation, and admin-library-vs-author-subset resolution (`resolvePresetLibrary`) — shared by the builder's author-side "Add sprite"/"Add backdrop" pickers and the student-facing runtime pickers in `ScratchWorkspace.jsx` |
| `storageAssets.js` | Pure Firebase Storage asset metadata merge helper: folder listing is inventory, schema entries preserve per-file options |
| `useAssets.js` | Hook for fetching `public/assets/manifest.json` (returns empty arrays when absent); exposes `lessonAssets`, `sharedAssets`, `lessonFolderAssets` for static asset paths — currently returns empty everywhere |
| `useLessonStorageAssets.js` | Hook for listing `lessons/{lessonId}/assets/` in Firebase Storage and merging discovered files with optional `lesson.storageAssets` metadata |
| `useTypeAssets.js` | Hook for fetching `lessonTypeAssets/{type}` from Firestore; returns `typeStorageAssets`, `defaultSprites`, and `defaultBackdrops` for type-wide shared files and the Scratch sprite/backdrop libraries |
| `topicLibrary.js` | Topic-library Firestore loader (`topicLibrary` collection) plus type-filtered search, wiki-link expansion, author suggestion helpers, and `clearTopicCache()` |
| `topicAudit.js` | Shared topic-reference parsing, grouped-task audit, proposal matching, and lesson-stage publication rules |
| `TopicLibraryView.jsx` | Topic hover-card and searchable dialog presentation used by Markdown explanations |
| `checkHelpers.js` | Generic check primitives: `wildcardContains`, `wildcardEquals`, `normalizeOutput`, `parseCheckValue`, `valueEquals`, `getVariableEntry`, `evaluateCodeCheck` (shared `code`-family evaluation reused by both `modules/checks.js` and `electronics/circuit.js`, avoiding a circular import), and related helpers — used by `modules/checks.js` and sub-module evaluators |
| `checkAuthoringValidation.js` | `validateFilesystemChecks`/`validateElectronicsChecks`/`validateTurtleChecks` (check-field-completeness validation) plus their shared target-selector helpers — called from the module definitions' `validateTask`, so the Builder and the CLI can't validate these checks differently |
| `lessonValidation.js` | Pure, Node-safe lesson validation core shared by the Builder (`validateLesson`) and the CLI (`validateLessonForMcp`), one wording for both: envelope, groups, task shape, feedback checks, carry-through; delegates type rules by each task's effective module type to the module definition's `validateTask`, `taskType: 'activity'` to the activity registry, and quiz / code_arrange to `activities/legacyValidation.js`. `validateLessonCore(lesson, { envelope, beforeTasks, afterTask })` hooks add each validator's own extras (ADR 0008) |
| `fileKeys.js` | Pure helpers for Firebase file key encoding: `encodeFileKey(name)` and `decodeFileKey(key)` — dots encoded as `__dot__` |
| `codemirror.js` | CodeMirror config: `createBaseExtensions(type, readOnly)`, `getTabSize(type)`, `getLanguageExtension(type)` (editor-language maps; unknown languages get Python and a 2-space tab) — `headstartTheme` and `headstartHighlight` are internal-only, applied inside `createBaseExtensions`. Also the line-hint extension: `lineHintsExtension()` (💡 gutter marker + faded ghost-text widget per hinted line, never part of the document or undo history), driven by `setLineHints`; `lineHintsField` maps hints through edits and drops one when its line is deleted; `getLineHints(state)` reads what shows |
| `fieldSpec.js` | Pure field declarations (a task shape as data): `normaliseFieldSpecs` (validates and freezes `{ name, type, required, authored, values, modes, itemFields }`), `authoredFieldPaths`, `fieldsForMode`, `describeFieldSpecs`. Used by `defineActivity` (`fields`), `defineModule` (`taskFields`) and `taskFields.js` |
| `taskFields.js` | `COMMON_TASK_FIELDS`, `TASK_TYPE_FIELDS` (information, group) and the `codeStagesField(payload)` helper modules use in their `taskFields` |
| `lineHints.js` | Pure, import-free author line hints (`#> …` / `<!--> … -->` marker lines; a module opts in with `capabilities.lineHints`): `parseLineHints(code, syntax)` → `{ code, hints, trailingMarker }`, `stripLineHints`, `anchorLineHints` / `chooseLineHints` (re-anchor hints onto saved code by trimmed line text), `stripTaskLineHints` / `stripLessonLineHints` (strip a task/lesson, recording runtime-only `task.lineHintSets`), `getTaskLineHintSets` / `getStageLineHints` (what editors and stage references show), `findTrailingLineHintMarkers` (validator warning) |
| `firebase.js` | Firebase app init from Vite env vars; exports `db` (Realtime Database), `auth`, `firestore`, `functions`, `storage` |
| `markdown.jsx` | Markdown renderer: tables, callouts, fenced code blocks, Scratch block pills, topic links, `InlineMarkdown` |
| `MarkdownFieldEditor.jsx` | Markdown editor with Edit/Preview tabs, formatting toolbar, topic-library link picker, Scratch block insertion, and asset image picker; exports `MarkdownFieldEditor` and `getInlineCodeOptions` (the toolbar is internal) |
| `scratchBlockCatalog.js` | Shared Scratch block metadata for markdown rendering, markdown toolbar insertion, and the Scratch toolbox picker |
| `lessonBlocksCodec.js` | Encodes/decodes Firestore-incompatible lesson fields as JSON strings: Scratch block trees for nested depth and Arcade Kit designs for nested sprite-frame arrays. `encodeLessonForFirestore` / `decodeLessonFromFirestore` are the full `lessons` collection boundary (blocks + answer sealing) used by every lesson read and write, web and CLI |
| `lessonSeal.js` | Answer obfuscation (not security) for the public lesson document: `sealLesson`/`unsealLesson` (and `sealTask`/`sealTasks`/`unsealTasks`) move each task's answer fields (`TASK_SEALED_FIELDS` plus the activity's `sealedFields`) into `task._sealed = 'v1:<base64>'` (UTF-8 JSON XOR a fixed key); `lessonNeedsSealing` spots lessons stored before sealing. Also seals `lessonOverrideTasks` (useSession `pushLessonOverride`, unsealed in `applyLessonOverride`) |
| `lessonReport.js` | `buildSessionReport()` — builds a session report from an in-memory session + lesson (roster, per-task attempt history, overrides, carry fallbacks, support reveals, live per-task teacher ratings, task summary; quiz and activity type fields, submissions and summaries come from each activity definition, plus `itemProgress` / `avgItemProgress` for activities); `attachTeacherFeedback()` merges the teacher's optional end-of-session star rating and notes onto a built report; `reportToYamlText()` for YAML export |
| `codeSubmission.js` | `normalizeCodeSubmission()`: parses a JSON code submission from the attempt log back to its object shape (HTML file map, Scratch state), leaving plain code strings; shared by the session report and the code_arrange activity's report |
| `lessonLinks.js` | `getLessonLinks(lessonId)` — shared lesson URL builder, returns `{ join, solo, teacher, preview }` (bare smart-join URL, plus `?solo=true`, `?teacher=true` and `?preview=true` links); used by TeacherView, LessonPanel and SessionsPanel |
| `lessonLevels.js` | Reusable level reference helpers: level Firestore collection name, scope derivation, legacy migration, display title resolution, and sorting |
| `lessonForks.js` | Deterministic class-fork helpers: class record normalization, fork ID/title creation, stock lesson copy, and task lineage construction |
| `youtube.js` | Pure YouTube URL parsing for the `recordingUrl` lesson field: `extractYouTubeId()`, `isValidRecordingUrl()`, `buildYouTubeEmbedSrc()`. Dependency-free (only the built-in `URL`) so it's shared between the browser widget/Builder field and the Node CLI validator |
| `pasteDetection.js` | Large-paste thresholds (40 chars / 3 lines) and helpers used by `handleEditorPaste` to flag pastes to the teacher |
| `taskStages.js` | Pure code-stage role helpers (`STAGE_ROLES`, `getStageRole`, `getStarterStage`, `getCompleteStage`, revealable stages, `SUPPORT_REVEAL_SOURCES`, `AUTO_REVEAL_MODES`) with no imports, so module definitions can use them; re-exported by `taskUtils.js` |
| `codeLanguages.js` | `CODE_LANGUAGE_LABELS` / `getCodeLanguageLabel` for code-fence languages (CopyCodePanel, explainer code-block menu) |
| `taskUtils.js` | Task flattening/group helpers plus estimated-duration and priority totals/formatting; `deriveTaskContext` (incl. `moduleType`) and `buildStageOptions` read module definitions. `flattenTaskTree()` expands groups as authored; `flattenTasks()` is that with legacy draft tasks filtered out |
| `textUtils.js` | Small string helpers shared across modules: `escapeRegExp()`, `stableHash()` (deterministic 32-bit hash for stable ids and shuffle seeds), `isPlainObject()`, `fileExtension()` |
| `quizAnswers.js` | Reading a stored quiz answer: `parseQuizAnswerState()` (object, or the JSON string it was persisted as) and `answerTextMatches()` (case- and whitespace-insensitive compare) — shared by the quiz components, submission building and lesson reports |
| `spriteVisuals.js` | `spriteVisualMode(sprite)` — whether a Scratch sprite is drawn from a costume image, an emoji, or a preset; used by the admin shared-asset panel and the Builder sprite editor |
| `composedLesson.js` | Pure composed-lesson module resolution, structural validation, sandbox adaptation, and scoped carry-source helpers |
| `codeArrange.js` | Pure helpers for the `code_arrange` task type: the one shared task-level tile pool, slot-completeness, assembling the final runnable code string from tile placements (`assembleCodeArrangement`), and its inverse (`deriveSlotStateFromCode`, backtracking over the shared pool using each line's fixed text as anchors) — the run pipeline and check evaluator only ever see the final assembled string |
| `draftLesson.js` | Shared structural validation for incomplete lesson-level draft tasks. |
| `lessonAudit.js` | Current-state lesson/task version and change-timestamp helper with no-op detection. |
| `lessonService.js` | Shared lesson loading and publishing helpers: `fetchLessonById()`, `fetchLessonList()`, `publishLesson()`, `publishLessonTasks()`, `deletePublishedLesson()`, `publishLessonFork()`, `applyLessonOverride()`; class helpers; publishing migrates legacy scalar levels; session report helpers: `saveSessionReport()`, `fetchSessionReports()` |
| `timeAgo.js` | Pure short relative-time label (`formatTimeAgo`) shared by the student grid and the shared-work gallery |
| `workspaceData.js` | Pure scratch state clone/parse and decoded session file-list helpers |
| `useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` — media query hook for responsive layout |
| `useRemoteRunTrigger.js` | `useRemoteRunTrigger(token, run, { enabled, onHandled })` — each module workspace runs its own Run action once per pending teacher remote-Run token (`cs.remoteRunToken`), then acknowledges it so a remount never replays it |
| `useIsTouchDevice.js` | `useIsTouchDevice() → boolean` — touch-capability hook (`ontouchstart`/`maxTouchPoints`), not a viewport-width check like `useIsMobile` — catches touch devices with a wide viewport (iPad Pro landscape); drives `PythonEditor.jsx`'s on-screen punctuation symbol row (the emoji button is shown regardless of this hook) |
| `useElementSize.js` | `useElementSize() → [ref, {width, height}]` — `ResizeObserver`-based container-size hook (vs. `useIsMobile`'s viewport-only breakpoint); drives `LessonTaskContent.jsx`'s Scratch compact/tab layout (`ScratchWorkspace.jsx` measures its own container directly, not via this hook). Returns a callback ref, not a plain `useRef` — needed because `TaskSlideTransition.jsx` swaps in a fresh DOM node per task without the owning component remounting; a mount-only effect would silently keep observing the detached old node |
| `Banner.jsx` | Tinted notification banner: `accent` hex colour drives rgba background/border; accepts `color`, `style`, `children` |
| `launchpadCodeFile.js` | Versioned `.launchpad` Python code-file creation, validation, parsing, naming, and browser download helpers |

### Markdown Helpers (`src/shared/markdown/`)

| File | Role |
|---|---|
| `editorOptions.js` | Markdown editor option data and helpers: image extensions, code block options, inline code options, Scratch insertion categories, and Scratch fence detection |
| `ScratchBlocks.jsx` | SVG/path Scratch block renderer and fenced-stack parser used by MarkdownRenderer |
| `tableParser.js` | Pure Markdown table parser used before handing content to ReactMarkdown |

### Input Recorder (`src/shared/input/`)

Pure, Node-safe input library for the Keyboard and Mouse activities and the Desktop's `input_*` checks (plan: `docs/architecture/modular-activities-plan.md`, Phases 3 and 5). Raw events stay on the device; only summaries are checked or synced.

| File | Role |
|---|---|
| `platform.js` | `detectPlatform` (Mac / Chromebook / Windows / other from the user agent; iPad = other), `keyName` (a taught key as labelled on that keyboard: Mac delete, fn + delete, Chromebook Alt + Backspace, Alt + Search…), `modKeyName` (Cmd on a Mac), `PLATFORM_LABELS`; part of `detectInputCapabilities` |
| `index.js` | Re-exports the whole library |
| `layouts.js` | Character → `{ code, shift }` tables (UK only for now), `describeCharKeys` ("Shift + 2"), key labels |
| `events.js` | `normalizeKeyEvent` (modifiers, Caps Lock, hardware vs virtual source), `normalizePointerEvent` (`data-input-id` targets plus their `data-input-kind`, 0-1 positions), canonical combos (`mod+c`, Ctrl and Cmd alike), browser-reserved combos |
| `gestures.js` | `recognizeGestures`: click, double-click, right-click, drag (pointer or HTML5 drag-and-drop, with source/drop target kinds), scroll, hover and the touch forms tap, double-tap, long-press; `TOUCH_EQUIVALENTS`, `gestureSatisfies` |
| `summary.js` | `typedCharacters` (Shift vs Caps Lock per capital), `summarizeInput` (small serialisable counts), `typingStats` (accuracy, WPM) |
| `recorder.js` | `createInputRecorder`: bounded in-memory event ring buffer, never persisted |
| `targetSummary.js` | `summarizeTargetedInput` / `createInputTally`: capped, serialisable per-surface summary for `input_*` checks — gestures per target kind (`file`/`folder`/`window`/`icon`), drags by source>drop kind, shortcuts by keyboard vs menu, Shift/Caps Lock capitals; the tally folds finished segments into running totals so the ring buffer never loses gestures |
| `checks.js` | Owner-`input` check types `input_gesture`, `input_shortcut`, `input_modifier` (registered in `src/modules/checks.js`): evaluate against `ctx.input`; `validate()` rejects modules without them in `inheritsCheckTypes`, browser-reserved combos, unknown gestures/kinds; `inputChecksOf` / `inputSummaryCapFor` |
| `useSurfaceInputRecorder.js` | React hook: capture-phase key/pointer/drag listeners on a surface element feeding a tally; calls `onSummary` only when the capped summary changes; returns `recordCommand(combo, via)` for menu equivalents (used by Desktop `StudentWorkspace`) |
| `useInputCapabilities.js` | React hook over `detectInputCapabilities`, upgraded when a hardware keydown proves a physical keyboard (kept out of `index.js` so the library stays Node-safe) |
| `capabilities.js` | `detectInputCapabilities` (fine pointer, hover, touch), `withKeyEvidence` (physical keyboard learned from a hardware keydown), `unmetRequirements` |

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
| `scripts/download-scratch-sprites.mjs` | One-off tool: downloads Scratch's official sprite/costume assets from the Scratch CDN into `public/scratch-assets/sprites/` |
| `scripts/check-docs.mjs` | Dependency-free documentation hygiene check: validates local Markdown links, `docs/README.md` inventory, and source-file coverage in this map |
| `scripts/new-activity.mjs` | `npm run new:activity -- <id> "<Label>" [--category …] [--dry-run]`: scaffolds an activity from `src/activities/_template/`, registers it in `registry.pure.js` / `registry.js`, writes `docs/authoring/activities/<id>.md` and indexes it in `docs/README.md`, this map and `validation-errors.md`; validates the id, refuses to overwrite, prettier-formats generated code (tested by `scripts/__tests__/newActivity.test.mjs`) |
| `scripts/new-module.mjs` | `npm run new:module -- <type> "<Label>" [--dry-run]`: scaffolds a workspace module from `src/modules/_template/` (registry order after the last module), registers it in `definitions.js`, `registry.js` and `checks.js`, adds the type to the type-branch ratchet and the ESLint rule, records the scaffold's deliberate parity gaps in `moduleTypeParity`'s `KNOWN_GAPS`, adds its `StudentViewModules` click-through, writes `docs/authoring/<type>.md` and indexes it in `docs/README.md`, this map, `validation-errors.md`, `AGENTS.md`, `lesson-schema.md`, `task-types.md` and `MODULE_FEATURE_MATRIX.md`; validates the type (reserved words, activities, names core code already compares against), refuses to overwrite (tested by `scripts/__tests__/newModule.test.mjs`) |
| `scripts/scaffold-utils.mjs` | Shared plan/apply plumbing for both kits: template listing, prettier formatting, anchored inserts, line-ending preservation, `applyPlan` (refuses to overwrite or apply a stale plan) and `describePlan` |

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
| `cli/cli.mjs` | Entry point: yargs CLI with lesson topic audit/preflight/check-case testing plus `lessons`, `tasks`, `topics`, `feedback`, and `assets` subcommand groups |
| `cli/firebase.mjs` | Firebase Admin SDK init via `GOOGLE_APPLICATION_CREDENTIALS`; exports `db` (Firestore) and `storage`; exits on missing credentials |
| `cli/validate.mjs` | `validateLessonForMcp(lesson)` — standalone lesson validation (no Firebase dependency): the shared core (`src/shared/lessonValidation.js`) plus the CLI-only `description is required` rule |
| `cli/capabilities.mjs` | `buildCapabilities()` — JSON catalogue printed by `lessons capabilities` for lesson agents (no Firebase): modules (with their `taskFields`), activities (modes, `fields`, `fieldsByMode`, `authoredFields` from each definition's `fields`), the common / information / group task fields (`src/shared/taskFields.js`), check types, and `requests` |
| `cli/authoring-requests.mjs` | `readAuthoringRequests()` / `parseAuthoringRequest()` — reads `docs/authoring/authoring-requests/*.md` headers into `{ file, title, kind, status, requestedBy, lessonsBlocked }` for `lessons capabilities` |
| `cli/check-tests.mjs` | `testLessonChecks(lesson, casesFile)` — source-code case harness using the shared runtime check evaluator, including feedback-match reporting |
| `cli/topic-utils.mjs` | Standalone topic-library normalization and validation helpers used by CLI conversion/publish commands |
| `cli/yaml-converter.mjs` | YAML conversion helpers for lessons and topic libraries, including lesson/topic JSON-to-YAML serialization and the `type: <activity>` shorthand (both directions, via the activity registry) |
| `cli/structured-input.mjs` | JSON/YAML input detection for CLI files and stdin; lesson YAML is passed through the lesson shorthand converter |
| `cli/lessons.mjs` | Exports async functions: `listLessons`, `getLesson`, `getLessonSkeleton`, `getTask`, `upsertTask`, `appendTask`, `upsertLesson`, `deleteLesson`, `yamlToLesson`, `publishYamlLesson` |
| `cli/topics.mjs` | Exports topic Firestore functions plus bulk topic-library YAML/JSON publish helpers |
| `cli/feedback.mjs` | Exports Firestore feedback helpers: list (platform/lesson/all), add (lesson/platform), archive by ID (soft-delete via `archived: true`), and bulk-clear (archive) with optional filters |
| `cli/assets.mjs` | Exports async functions: `listLessonAssets`, `uploadLessonAsset`, `deleteLessonAsset` |
| `cli/type-assets.mjs` | Exports async functions for lesson-type-wide shared assets (`lessonTypeAssets/{type}`, storage at `shared/{type}/assets/`): `listTypeAssets`, `uploadTypeAsset`, `setDefaultSprites`, `uploadDefaultBackdrop` (scratch-only defaults) |
| `cli/storage-utils.mjs` | Firebase Storage helpers shared by `assets.mjs` and `type-assets.mjs`: download-URL building, filename/slug validation, bucket file listing |
| `cli/levels.mjs` | Exports Firestore reusable-level helpers: `listLevels`, `upsertLevel`, `deleteLevel` |
| `cli/classes.mjs` | Exports Firestore class helpers for lesson forks: `listClasses`, `getClass`, `upsertClass`, `archiveClass` |

---

## Config & Build

| File | Role |
|---|---|
| `vite.config.js` | Vite build config for both classroom and builder apps |
| `src/test/setup.js` | Vitest/jsdom shared test setup: jest-dom matchers and browser API mocks used across component and hook tests |
| `src/test/studentCodeStateHarness.js` | Test harness for `useStudentCodeState`: renders the hook with `vi.fn` session writers, storage-key helpers, and runtime fakes (see `docs/TESTING.md`) |
| `src/test/studentCodeStateMocks.js` | Dependency-free `vi.mock` factories (Pyodide, type/lesson storage assets) used by the `useStudentCodeState` characterization tests |
| `src/test/fixtures/studentCodeStateLessons.js` | Per-module-type (and composed) lesson fixtures for the `useStudentCodeState` characterization tests |
| `src/test/activityBuilderHarness.jsx` | Test harness rendering an activity `BuilderEditor` with the task held in state (`renderBuilderEditor`), so tests edit through the UI and read the resulting task |
| `src/test/activityUiHarness.jsx` | Test harness rendering an activity StudentView with a real state store (`renderActivityUi`), so UI tests exercise updater-style `onChange` like `useActivityState` |
| `src/test/fixtures/legacyActivityTasks.js` | Test-only fixtures: one valid task per quiz sub-type, Python/HTML `code_arrange` tasks, and invalid variants, shared by the Phase 0 characterisation tests that pin quiz/code_arrange behaviour before the Activity migration (`docs/architecture/modular-activities-plan.md`) |
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
