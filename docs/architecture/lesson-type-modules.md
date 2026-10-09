# Lesson Type Modules

A lesson type (python, arcade, turtle, scratch, html, filesystem, desktop, electronics) is a
**workspace module**: one folder, `src/modules/<type>/`, whose definition tells the classroom,
teacher view, Builder, CLI and validators everything they need. This page is the reference for
the module contract (v2). Why it is shaped this way: [ADR 0004](../adr/0004-lesson-type-module-registry.md)
and [ADR 0010](../adr/0010-module-contract-v2-and-work-slot.md). Bounded exercises are
**activities** instead ([activities.md](activities.md), [ADR 0009](../adr/0009-activity-registry.md));
the decision test is in [modular-activities-plan.md](modular-activities-plan.md).

**The rule:** core code never compares against a module or task type name. It reads the
definition (`getModuleDefinition(type)` from `src/modules/definitions.js`, or the UI module from
`registry.js`) looked up by the task's **effective** module (`getEffectiveLessonForTask` /
`deriveTaskContext().moduleType`) — never a composed lesson's raw `type`. Outside
`src/modules/**` and `src/activities/**` (Builder included) the type-branch ratchet is at zero and ESLint rejects a
new comparison (see [Guard rails](#guard-rails)). A behaviour that differs between modules
becomes a definition field with a default in `defineModule.js`.

## Contract

Each module is split in two:

| File | Holds | Imported by |
|---|---|---|
| `definition.js` | `defineModule({...})`: pure data and hooks. No JSX, React, DOM or runtimes; explicit `.js` extensions on relative imports. | `src/modules/definitions.js` → CLI, validation, shared type lists, the app |
| `index.js` | `defineUiModule(definition, { StudentWorkspace, BuilderWorkspace, CheckEditor, FeedbackCheckEditor?, TeacherLiveView, getLayoutStyles, runtime })` | `src/modules/registry.js` → the app |
| `checks.js` | `CHECKS`: module-owned check types | `src/modules/checks.js` (the check registry) |

`defineModule` (`src/modules/defineModule.js`) validates every field below, fills the optional
ones with defaults and freezes the result; a missing or ill-typed field throws with its name.
`definitions.js` exposes `MODULE_TYPES` (ordered by `meta.order`), `getModuleDefinition`,
`getModuleTypesWhere`, `getModuleTypesWithCapability`, `CARRY_THROUGH_FIELDS`,
`getModuleLabel(type, surface)`, `getModuleAuthoring(type)` and `SPRITE_LIBRARY_MODULE_TYPE`;
`src/modules/moduleContract.js` and `moduleAuthoring.js` hold the shared builders the
definitions use. `moduleDefinitionsNode.test.js` loads every definition in a real Node process.

## Contract v2 reference

### `meta`

| Field | Meaning |
|---|---|
| `label`, `order` | Canonical name; registry order (admin lists, `MODULE_TYPES`). |
| `shortLabel`, `icon`, `pickerHint` | Builder composed-lesson module picker. |
| `pickerOrder` (optional) | Position in that picker and the CLI's type list (`LESSON_MODULE_TYPES`); defaults to `order`. |
| `language` | `'python'` \| `'html'` \| null: explainer code blocks and editors. |
| `playground` | Has a `/playground/:type` route; needs `lifecycle.playgroundTask`. |
| `surfaceLabels` (optional) | Wording per surface: `lessonIntro`, `builderMeta`, `print`, `stageReference`. |
| `teacherEditCopy` | `{ action, consent }` for the teacher's live edit; required with `capabilities.teacherEditor`. |

### `capabilities`

Required booleans: `sideExplainer` (explainer as a side rail, else an accordion), `modulePanes`
(the workspace reports `visiblePanes`), `teacherLiveReference` (teacher live code can be a
student's stage reference), `unifiedStages` (Starter/Complete live in `codeStages` roles; the
unified remote-reset selector and read-only support references), `teacherStageReveal`
(StudentModal's Reveal menu), `highlights` (teacher code highlights; needs a `'code'`/`'files'`
mirror), `downloadCode` (`.launchpad` download), `fixedExplainer` (Scratch's fixed column; needs
`sideExplainer`, no `modulePanes`), `topicLibrary`.

Optional booleans (default false): `teacherFillHeight` (TeacherView's centre column fills and
clips), `teacherSandboxRow` (the teacher sandbox workspace fills a plain flex row),
`teacherUnifiedStageTabs` (teacher code tabs show stage roles with no Starter/Complete tabs),
`explainerBlockMenu` (explainer editor's Scratch block-reference menu), `sideQuests` (a passed
code task's `sideQuests` run in a throwaway workspace of this module; `src/shared/sideQuests.js`;
python, turtle, html).

| Field | Values |
|---|---|
| `stageReveal` | `'progressive'` (support stages as read-only references, complete previewed first; python, html) \| `'offer'` (offer the next stage after two failed checks) |
| `studentMirror` | How StudentModal mirrors a watched student: `'code'`, `'files'` (= the files wire channel), `'blocks'`, `'view'` (the module's `TeacherLiveView`) |
| `cardSummary` (optional) | StudentCard line: `'output'`, `'blocks'`, `'fs'`, null |
| `lineHints` (optional) | Author line-hint marker syntax in starter code and stages (`src/shared/lineHints.js`): `'python'` (`#> …`; python, turtle), `'html'` (`<!--> … -->`; html), null (none). The classroom strips markers per task by this (`prepareClassroomLesson`); a trailing marker hints a new empty last line. The module's student editor still has to pass `getTaskLineHintSets(task)` to its `CodeEditor` |
| `peerHelp` (optional) | `{ anchors: 'lines' \| 'scripts', hints: 'python' \| 'html' \| 'blocks' }` or null (default): a classmate can help with this module's work (`src/shared/peerHelp.js`). `anchors` is what feedback attaches to (`'lines'` also allows suggested edits); `hints` picks the platform's preset hint list. Read through `peerHelpCapability` (`src/app/peerHelpAnchors.js`). Python, Turtle, HTML: lines; Scratch: scripts |
| `focusPanes` (optional) | Extra `{ id, label }` panes the teacher can highlight/force |
| `teacherEditor` (optional) | `{ surface: 'code'\|'files'\|'blocks'\|'view', workspace?, design? }`, declared exactly when `workSlot.teacherEdit` is |
| `sandboxState` | Teacher sandbox work kind: `'code'` (one code string), `'blocks'`, `'fs'`, `'desktop'`, `'files'` |
| `run` | What Run does (`handleRun` dispatches on it): `'runtime'` (needs `runResult` and a UI `runtime`), `'preview'` (html iframe), `'workspace'` (the workspace runs/checks and reports), `'none'` (default). Remote "Run on student" is offered when not `'none'`. |

`runResult` (exactly for `'runtime'`): `errorLine`, `turtle`, `liveCode` booleans.
`moduleDefinitions.test.js` / `moduleRunCapability.test.js` pin the built-in values.

### Authoring, state and validation hooks

- Builder: `makeCodeTaskFields`, `makeNewStage`, `initCompleteTab`/`initStageTab` (optional),
  `defaultCheck`, `carryThroughField` / `carryThroughLabel` / `getCarryThroughUpdates` /
  `getNewStarterUpdates`, `completeField`, `stageLabels`, `explainerInlineCodeLanguages`,
  `explainerCodeBlockLanguages`, `supportsInteractionMode` / `supportsIncorrectChecks` /
  `supportsTests` / `supportsVariableChecks` / `supportsDomChecks` (and optional
  `supportsCopyCode`, `supportsOutputChecks`), `inheritsCheckTypes` (check types owned elsewhere
  the module can evaluate).
- State: `defaultState`, `initialState(task)`, `serializeState` / `deserializeState`,
  `getDisplayState(task, stage, liveState, tab)` (what the teacher tabs show).
- Validation, shared by the Builder and the CLI (`src/shared/lessonValidation.js`):
  `validateTask(task, { n, lesson, errors, warnings })`, `hasStarterContent`, `hasCheckValue`,
  `validateTaskInBrowser` (Builder only). Every message is documented in
  `docs/authoring/validation-errors.md` (`validationErrorsDoc.test.js`). Optional
  `verifyTaskChecks(task, label)` evaluates the task's checks per check against its own authored
  stages for `lessons test-checks` without `--cases` (Scratch).

### `authoring` (the Builder)

Everything the Builder used to decide by comparing lesson types, so `src/builder/` never branches
on a module type (`getModuleAuthoring(type)` in `definitions.js`; null for an unregistered type,
so each call site keeps its old fallback). Shared builders: `src/modules/moduleAuthoring.js`,
`src/modules/printHelpers.js`, each module's `print.js`.

| Field | Meaning |
|---|---|
| `defaultTypeFields(prevTask, { defaultSprites })` | Module fields of a new task, seeded from the task it follows (`codeDefaultTypeFields` for code strings) |
| `missingStarter(task)`, `missingStarterLabel` | A draft task with no starter work yet shows TaskEditor's "This draft task has no {label} yet" notice |
| `copyStarterToComplete(task)` | "Reset to starter code" updates (`{}` = nothing) |
| `printTask(task, { esc })` | The module's section of the printable lesson (`''` = none) |
| `sandboxStarterEditor` | Sandbox starter modal editor: `'code'`, `'blocks'`, `'fs'`, `'circuit'`, `'files'` |
| `builderRun` | TaskEditor's Run: `'pyodide'`, `'preview'`, `'none'` |
| `codeFormat` (optional) | The Code task-format button `{ label, icon }` |
| `copyCodePlaceholder` | Copy code panel placeholder (required with `supportsCopyCode`) |
| Flags (default false) | `fileTabs`, `sharedTypeAssets`, `previewTypeAssets` (the preview always includes the type's shared assets, so Shared Assets offers no per-asset "Web editor" toggle), `spriteLibrary` (the type's assets hold the default sprites/backdrops: Builder, Shared Assets, EditLessonModal, the `type-assets` CLI) |

`moduleAuthoring.test.js` and `builderAuthoringParity.test.jsx` compare the built-in hooks with
verbatim copies of the Builder branches they replaced.

### `lifecycle`

`resetTarget(task, action, ctx)` (the state a teacher remote reset — `starter`, `complete`,
`stage_<n>` — puts in front of the student, in the module's shape), `hasComplete(task)`,
`teacherCompleteTab(task)`, `sandboxStarter(lesson, task)` (`getSandboxState` is its alias),
`composedSandboxFields(firstTask)`, `hasPersonalSandbox(lesson)` (`alwaysPersonalSandbox`, or
`personalSandboxWhenLessonHas(field)`), and optional `playgroundTask()` (the playground's one
task; exactly when `meta.playground`).

### `storage`

Adapters onto the localStorage shapes in `docs/agents/runtime-model.md`, which must not change:
`layout: 'record'` via `recordStorage({ workKey, taskMeta, sandboxMeta })` (one
`headstart_{lessonId}_{taskId}_{anonymousId}` record; meta fields written only when passed, in
declared order) or `layout: 'perFile'` via `perFileStorage()` (html, `{ content }` per file).
Hooks: `toTaskRecord` / `fromTaskRecord`, `toSandboxRecord` / `fromSandboxRecord`.
`createStudentPersistence` routes `saveWork` / `readWork` / `saveSandboxWork` /
`readSandboxWork` through them (personal sandbox, presentation's in-memory store, else
localStorage).

### `wire`

How work travels over Realtime Database: `sandboxChannel` `'code'` (`currentCode` /
`sandboxCode` string) or `'files'` (html; `sandboxFiles`, must match `sandboxState: 'files'`),
`toCode` / `fromCode` (`codeStringWire` identity, `jsonWire` JSON, `filesWire` null plus
`toFilesMap`), `liveExtras` (always both teacherLive extras, explicit `null`s — teacherLive is an
`update()` merge) and `submission(work)` (logged with an attempt).

### Checking and the generic work slot

Every module declares `checking` and `workSlot` together; `useStudentCodeState` keeps one work
slot, `{ moduleType, taskId, value }`, read through `workValueFor(moduleType)` (the module's
stable default when the slot holds another module's work, so a composed lesson never saves,
publishes or checks a leftover value).

`checking.trigger`: `'change'` (every edit writes a run and is checked — only for discrete
edits; filesystem, desktop), `'run'` (checked when the work runs: runtime modules, html's
preview or Submit, a `'workspace'`-run module's report through `handleWorkspaceRun`),
`'workspace'` (the workspace evaluates and reports through `reportRun`; scratch).
`checking.buildContext(work, extras)` builds the evaluator context (`codeCheckContext` gives
`{ ...extras, code }`).

`workSlot`, field form (`starterField`, `sandboxField`, `stageField`; the source hooks are
derived) or hook form (`starter`, `stage`, `complete`, `sandbox`, `fromResetTarget`, `stored`,
`fromStored`; `codeWorkSlot()` and `filesWorkSlot()` build them), plus `empty(task)`,
`normalise(work)` (applied whenever work is restored, never to the student's own edits),
`kind` (`'code'`: own save restored only in solo, carry via `carryCodeFrom`, restoring clears
the run output; `'state'`: own save always restored, carry via `carryThroughField`), the flags
`taskReset`, `teacherSandboxReset`, `remoteResetPersists`, `teacherEdit`, `workspaceOwned`
(scratch; the workspace loads its own work and receives restored work as pushed state), and
optional `teacherStarter(task)` (TeacherView's Starter-tab work; defaults to `starter`,
electronics shows `starterCircuit`). A slot on the `'code'` channel stores one record; on
`'files'` it stores per file.

The one pipeline: `handleWorkChange(next, { moduleType, interaction })` (per trigger: save,
teacherLive, `writeStudentCode` **only while watched**, idle feedback; the preview is never
rebuilt per keystroke), `evaluateAndReport`, `handleRun` → `runWithRuntime` / the preview,
`handleWorkspaceRun(work)`, `reportRun({ passed, suggestion, work })`. Loading (own save, carry,
starter), the personal sandbox, remote reset, show stage/complete, Reset, teacher-edit apply,
sandbox push, watch-start writes, the teacherLive payload and the share snapshot all read the
definition. A module whose sandbox kind is `'code'` or `'files'` is code work: the `code` /
`files` aliases, `handleCodeChange` / `handleFileChange` speak it and an information task clears
it. Runtime state (`output`, `runStatus`, `turtleResult`, `inputPrompt`, `errorLine`, html's
`iframeSrc`) stays outside the slot. `moduleWorkSlot.test.js` and the Phase 0
`useStudentCodeState.*` characterisation suites pin the bytes written.

### Teacher surfaces

- **TeacherView** (`src/app/teacherSandboxWork.js`) keeps one work value per
  `capabilities.sandboxState` kind plus a draft; stage / module switch / reload restore the draft,
  else the session's work (`wire.fromCode(sandboxCode)` or the decoded `sandboxFiles`), else
  `lifecycle.sandboxStarter`; Go Live / Push / Reset write through the wire. The displayed task's
  Starter tab uses `workSlot.teacherStarter`. Layout reads `teacherFillHeight`;
  `TeacherEditorPanel` reads `teacherUnifiedStageTabs`, `teacherSandboxRow` and
  `lifecycle.teacherCompleteTab`.
- **Student sandbox push** (`useSandboxCodePush`), **teacherLive** display and publish
  (`useTeacherLivePublish`, explicit null extras), **workspace sharing** (snapshot, seed, copy)
  and **StudentModal / StudentCard / StudentWorkspaceBody** all go through `wire`, `storage` and
  the capabilities above; StudentModal takes the registry's `TeacherLiveView`.

### UI half

`StudentWorkspace` (props from `LessonTaskContent`: `lesson`, `task`, `cs`, viewing / forced /
teacher-edit flags, `display*` states; edits only through `cs`), `BuilderWorkspace` (TaskEditor's
tab state and handlers), `CheckEditor` (+ optional `FeedbackCheckEditor`), `TeacherLiveView`
(`displayState`, `readOnly`, `onChange` in the sandbox), `getLayoutStyles()` (`sharedStyles.js`),
`runtime` (`{ init, isReady, stop, provideInput, run, buildPreviewSrc, waitForPreviewText }` for
a `'runtime'` module, else null).

## Check-Type Registry

`src/modules/checkRegistry.js` (pure) builds one registry in `src/modules/checks.js` from
`CORE_CHECKS`, every module's `CHECKS` and the shared input checks. A definition is
`{ type, owner, subject?, operators?, fields?, aliases?, timing, requiresRun, submitAllowed,
contextKey?, evaluate(check, output, ctx), validate?(check, ctx) }`; `owner` is `core`,
`module:<type>` or `input`; duplicate ids throw. `evaluateSingleCheck` normalises core aliases,
looks up and calls `evaluate` (unknown types are `false`); `RUN_REQUIRED` / `SUBMIT_ALLOWED` are
derived. Scratch evaluates its own checks in the workspace. `checkRegistryParity.test.js` holds
parity with the frozen pre-registry dispatcher.

## Guard rails

- `src/modules/__tests__/typeBranchRatchet.test.js` counts literal type comparisons (and inline
  type arrays) per file outside the plugin folders; every file is at zero (the baseline is
  empty), and a match that is not type branching goes on its reasoned, self-checking allowlist
  (empty today; prefer a named constant or map). A new module's type joins its name list.
- `eslint.config.js` `no-restricted-syntax` rejects `=== / !== / case` against a type name in
  `src/**` and `cli/**` outside `src/modules/**`, `src/activities/**` and tests (the generator
  adds a new module's type to its pattern).
- Registry-driven tests fail when a module misses a surface: `moduleInterface`,
  `moduleTypeParity` (every parity list or an honest `KNOWN_GAPS` reason),
  `StudentViewModules` (real click-through per module), `moduleDefinitionsNode` (every folder
  registered and Node-safe), `authoringDocExamples`, `validationErrorsDoc`. Value pins describe
  the built-in modules (`__tests__/helpers/builtInModules.js`).

## Adding a module

Use the kit; the `new-module` skill (`.claude/skills/new-module/SKILL.md`) walks the whole loop
from an authoring request to the real-browser checks.

```bash
npm run new:module -- <type> "<Label>" [--dry-run]
```

`scripts/new-module.mjs` copies `src/modules/_template/` (a working "write text, press Check"
module: `run: 'workspace'`, `trigger: 'run'`, `codeWorkSlot`, core code checks, every group
filled with safe defaults and `TODO(new-module)` markers) to `src/modules/<type>/`, registers it
in `definitions.js`, `registry.js` and `checks.js`, adds the type to the ratchet and ESLint rule,
records the scaffold's deliberate parity gaps in `KNOWN_GAPS`, adds its `StudentViewModules`
click-through, writes `docs/authoring/<type>.md` (with a validated example) and indexes it in
`docs/README.md`, `docs/CODEBASE_MAP.md`, `validation-errors.md`, `AGENTS.md`,
`lesson-schema.md`, `task-types.md` and `MODULE_FEATURE_MATRIX.md`. It rejects reserved and
taken types (and names core code already compares against), refuses to overwrite and writes
nothing until every edit is planned. The untouched scaffold passes `npm test`, lint, format,
`docs:check` and `vite build`; `scripts/__tests__/newModule.test.mjs` tests the generator.

Then decide each definition group, build the real workspaces, add module checks, update the
tests (keep the click-through; Run then Stop for a runtime module), resolve the `KNOWN_GAPS`
entries, rewrite the docs, and verify in a real browser.

## Usually Changes With

- `src/modules/defineModule.js`, `src/modules/moduleContract.js` and `src/modules/_template/`
  (a new field needs a default and a template entry)
- `src/modules/__tests__/moduleDefinitions.test.js`, `moduleInterface.test.js`,
  `moduleTypeParity.test.js`, `derivedTypeLists.test.js`
- `src/app/hooks/useStudentCodeState.js`, `src/app/teacherSandboxWork.js`,
  `src/app/components/LessonTaskContent.jsx`, `src/app/views/teacher/TeacherEditorPanel.jsx`
- `docs/architecture/feature-impact-map.md`, `docs/authoring/<type>.md`, `docs/CODEBASE_MAP.md`,
  `docs/TESTING.md`
