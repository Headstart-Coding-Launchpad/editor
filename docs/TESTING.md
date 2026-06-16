# TESTING.md — Headstart Coding Classroom REPL Platform

Testing strategy, tool choices, and conventions. Read this before writing or modifying any tests.

---

## Tool Choices

| Concern | Tool | Reason |
|---|---|---|
| Test runner | **Vitest** | Native Vite integration — zero config overhead, same transform pipeline as dev/build |
| DOM environment | **jsdom** | `checks.js` exercises `querySelectorAll` / CSS style reads; jsdom is more complete than happy-dom for this |
| Component/hook testing | **@testing-library/react** | Tests behaviour not implementation; natural event simulation |
| E2E | **Playwright** | Solo-student and builder flows are fully self-contained (no Firebase) — high-value without infrastructure cost |
| Coverage | **Vitest built-in (v8)** | No separate Istanbul setup needed |

---

## Three Test Layers

### Layer 1 — Unit Tests

**What:** Pure functions and utilities with no React or external dependencies.

**Files to cover:**

| File | Key targets |
|---|---|
| `src/shared/checks.js` | `evaluateSingleCheck` (all 37+ check types), `evaluateCheckResults`, `wildcardContains`, `wildcardEquals`, `normalizeOutput`, `normalizeExactOutput`, `countOutputLines`, `parseCheckValue`, `deepEqual`, `normalizeChecks`, `checkRequiresRun`, `checkAllowedForSubmit` |
| `src/shared/taskUtils.js` | `flattenTasks`, `findTaskById`, `findGroupForTask`, `getProgressItems`, `updateTaskInTasks`, `updateSubtaskTitles` |
| `src/shared/codemirror.js` | `getTabSize`, `getLanguageExtension`, `createBaseExtensions` |
| `src/shared/iframe.js` | `getMime` (pure lookup), `buildIframeSrc` string-rewriting logic (mock Blob + URL.createObjectURL) |
| `src/shared/assetPaths.js` | Absolute asset URL encoding and base-path handling |
| `src/shared/workspaceData.js` | Scratch state parsing/cloning and decoded HTML file conversion |
| `src/shared/topicLibrary.js` | Topic normalization/search, wiki-link expansion and builder link suggestion detection |
| `src/shared/lessonService.js` | Firestore lesson fetch/list helpers, including static JSON fallback for unavailable lesson reads |
| `src/builder/lessonUtils.js` | Lesson validation messages and exported task JSON normalisation |
| `src/app/studentStorage.js` | Exact localStorage key formats plus saved task/file snapshot reads and writes |
| `src/app/studentTaskContent.js` | Student Python/HTML/Scratch saved-work and carry-through selection precedence |
| `src/app/studentLiveDisplay.js` | Teacher-live viewing eligibility, displayed workspace selection, and live HTML file conversion |
| `src/app/teacherSandboxContent.js` | Teacher sandbox draft/live/configured/task fallback selection and defensive cloning |
| `src/app/teacherLivePayload.js` | Decoded teacher-live payload construction from a student snapshot |

**Placement:** `src/shared/__tests__/checks.test.js`, `src/shared/__tests__/taskUtils.test.js`, etc.

**Coverage target:** 90%+ line coverage on `checks.js` and `taskUtils.js`; 80%+ on `iframe.js`.

---

### Layer 2 — Component / Integration Tests

**What:** React hooks and UI components tested with @testing-library/react. Mock all external dependencies (Firebase, localStorage, Web Workers, matchMedia) at the module boundary.

**Files to cover:**

| File | Key scenarios |
|---|---|
| `src/shared/useIsMobile.js` | Renders correctly at mobile/desktop breakpoints; responds to matchMedia change |
| `src/app/hooks/useIdentity.js` | Creates identity on first use; restores from localStorage; `createIdentity`, `updateTimestamp`, `updateDisplayName` methods; handles corrupted JSON gracefully |
| `src/app/hooks/useSession.js` | `encodeFileKey`/`decodeFileKey` helpers (pure — unit test these directly); Firebase methods mocked — test that correct Firebase calls are made for each teacher/student action |
| `src/app/views/LandingPage.jsx` | Renders; navigates to `/lesson/:id` on submit |
| `src/app/components/WaitingRoom.jsx` | Title and description rendering; animated dot progression |
| `src/app/components/JoinChoiceScreen.jsx` | Session-state message variants; Wait/Solo callbacks |
| `src/app/components/JoinSessionPrompt.jsx` | Title rendering; Join/Decline callbacks |
| `src/app/components/NameEntry.jsx` | Submit with unique name; duplicate-suffix confirmation step; solo link; waiting-room mode |
| `src/app/components/ExplainerPanel.jsx` | Collapsible toggle; aria-expanded; non-collapsible mode; content passes to MarkdownRenderer |
| `src/app/components/TopBar.jsx` | Solo/Live/Sandbox badge logic; displayName visibility; right slot; desktop mode |
| `src/app/components/TaskProgressDots.jsx` | Renders past/current/locked dots; click on past dot fires callback; locked dot is not clickable |
| `src/app/components/CheckFeedbackBanner.jsx` | Renders pass state; renders fail + hint; renders "see complete code" when unlocked |
| `src/app/components/QuizTask.jsx` | Multiple-choice renders all options; selecting an answer fires callback; match/fill-blank drag interactions |
| `src/app/components/InformationTask.jsx` | Information/introduction content and duration rendering |
| `src/app/components/LiveActivityToast.jsx` | Activity notification rendering and expiry behaviour |
| `src/app/components/TeacherTimers.jsx` | Elapsed/countdown rendering and expired task state |
| `src/app/components/TeacherSessionControls.jsx` | Navigation, share-link callbacks, and state-specific teacher session actions |
| `src/app/components/EditLessonModal.jsx` | Role-based footer actions (teacher: session-only; admin: session-only + permanent), save validation gate, active-task delete confirmation; builder's `TaskList`/`TaskEditor`/`GroupEditor` are stubbed at the module boundary |
| `src/app/components/FilesystemTask.jsx` | Folder navigation, image preview rendering, and browse interaction callbacks |
| `src/shared/markdown.jsx` | `MarkdownRenderer` renders headings, tables, code fences, callouts and topic-library interaction; `InlineMarkdown` renders inline-only |
| `src/builder/components/ExplainerEditor.jsx` | Markdown topic picker and recognised-term link prompt |
| `src/builder/App.jsx` | Shows restore prompt when localStorage has saved lesson; auto-saves on lesson change; `beforeunload` fires when dirty |

**Placement:** `src/app/hooks/__tests__/`, `src/app/components/__tests__/`, `src/app/views/__tests__/`, `src/shared/__tests__/`, `src/builder/__tests__/`

**Mock strategy:**

```js
// Firebase — vi.mock at top of test file
vi.mock('firebase/database', () => ({ ref: vi.fn(), onValue: vi.fn(), set: vi.fn(), update: vi.fn(), remove: vi.fn(), onDisconnect: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })) }))

// localStorage — use the jsdom built-in; reset between tests:
beforeEach(() => localStorage.clear())

// matchMedia — inject into window before tests
Object.defineProperty(window, 'matchMedia', { value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })

// crypto.randomUUID
vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1234')

// Blob + URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock')
global.URL.revokeObjectURL = vi.fn()
```

**Coverage target:** 70%+ branch coverage on hooks; 80%+ on components.

---

### Layer 3 — E2E Tests (Playwright)

**What:** Critical user journeys tested against the running Vite dev server. These flows are chosen because they are self-contained (no Firebase emulator required).

**Flows to cover:**

| Flow | Why critical |
|---|---|
| **Solo student — Python lesson** | Navigate to a lesson, run Python code with output, verify check pass/fail banner; verifies Pyodide loading, check evaluation, and localStorage persistence end-to-end |
| **Solo student — HTML lesson** | Open HTML lesson, edit files, run preview, verify iframe renders; verifies the virtual filesystem and Blob URL pipeline |
| **Lesson builder — create and export** | Open builder, choose lesson type, add a task, write starter code, add a check, run validation, download JSON; verifies the builder's full create→validate→export lifecycle |
| **Lesson builder — auto-save restore** | Create a lesson, reload page, verify restore prompt appears and restores correctly |

**Firebase-dependent flows (deferred — require Firebase emulator):**
- Live session full cycle (teacher + student)
- Remote reset
- `activeStudentView` streaming
- Session state machine transitions

**Placement:** `e2e/` directory at project root

**Config:** `playwright.config.js` — `baseURL: 'http://localhost:5173/editor/'`, screenshots on failure, 1 retry, Chromium only for CI, all browsers locally.

---

## File & Naming Conventions

- Unit/component test files: `*.test.js` (or `*.test.jsx` for JSX)
- E2E test files: `*.spec.js`
- Test setup file: `src/test/setup.js`
- All `__tests__` directories mirror the source directory they test
- No co-located test files (keep test files in `__tests__/` subdirectories)
- When adding a source component or test target, consider updating `CODEBASE_MAP.md` and this inventory in the same pull request.

---

## What NOT to Test

- Firebase `onDisconnect` behaviour (requires real network disconnection)
- Pyodide WASM execution (Worker, not unit-testable; test the `pyodide.js` manager interface only via mock)
- Scratch VM rendering (canvas-based, not suitable for jsdom)
- CodeMirror editor internals (test the config factories, not EditorView itself)
- Lesson JSON schema validity (covered by the builder's own validation logic tests)

---

## Coverage Thresholds

Set in `vitest.config.js`. Current thresholds reflect the initial test scope (pure functions + selected simple components). `QuizTask`, `InformationTask`, `TeacherTimers`, `TeacherSessionControls`, and pure builder validation/export logic now have focused coverage; large orchestration surfaces including `StudentView`, `TeacherView`, `useSession`, and builder UI views still require incremental coverage before raising thresholds.

| Phase | When to raise to | Prerequisite |
|---|---|---|
| Current | 8% lines / 6% branches | Initial setup complete |
| Phase 2 | 25% | useSession, QuizTask, HtmlEditor covered |
| Phase 3 | 50% | StudentView, TeacherView partially covered |
| Phase 4 | 70% | Builder views + remaining components |

`pyodide.worker.js` and `scratch.js` are permanently excluded from coverage because they require Web Worker and canvas runtime environments that jsdom cannot measure.

---

*Last updated: May 2026 — added characterization coverage for WaitingRoom, JoinChoiceScreen, JoinSessionPrompt, NameEntry, ExplainerPanel, and TopBar.*
