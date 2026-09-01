# Lesson JSON Schema

Full JSON field reference for cross-cutting fields. For YAML authoring see `docs/authoring/AUTHORING_GUIDE.md` or the basic-field reference at `docs/authoring/lesson-schema-yaml.md`. For type-specific code task fields, checks, and minimal examples see the relevant `docs/authoring/<type>.md` guide.

**Quiz sub-types:** `docs/authoring/quiz-tasks.md`
**Drag-and-drop runnable code:** see "Code Arrange Task Fields" below

Lessons live in the Firestore `lessons/` collection. Each document ID is the lesson `id`. Use `node cli/cli.mjs lessons upsert <file>` to save a JSON or YAML lesson.

---

## Lesson Envelope

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and export filename. |
| `type` | Yes | string | `composed` for new lessons; legacy lessons may use `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |
| `title` | Yes | string | Display title. |
| `description` | Yes | string | Short entry screen summary. |
| `level` | No | string/number | Legacy display fallback for the difficulty badge. New lessons should link a reusable level with `levelId`/`levelRef`; legacy scalar values are migrated automatically when published through the app or CLI. |
| `levelId` | No | string | ID of a reusable record in `lessonLevels/`. |
| `levelRef` | No | object | `{ id, scopeType, scopeId }` reference for the reusable level. `scopeType` is `type`, `module`, `course`, or `collection`. |
| `topicProposals` | No | proposal array | Missing Topic Library entries proposed by the lesson. Each item has `id`, `title`, `description`, and `status` (`proposed` or `deferred`). Task `topicLinks` remain the source of truth for usage. |
| `modules` | No | `{id, type, title?, sandbox?}[]` | Named workspace instances for a composed lesson. Use `moduleId` on code tasks to select one. |
| `sandboxStarter` | No | string | Python, Arcade Kit, or Scratch sandbox starter code or state. |
| `sandboxStarterFiles` | No | file array | HTML sandbox pre-loaded files. |
| `sandboxToolbox` | No | string | Scratch XML toolbox for sandbox mode. |
| `sandboxSprites` | No | sprite array | Scratch sandbox sprites. |
| `sandboxBackdrops` | No | backdrop array | Scratch sandbox backdrops. |
| `sandboxStarterFs` | No | path map | Filesystem sandbox initial state. |
| `sandboxStarterCircuit` | No | circuit object | Electronics sandbox initial breadboard. |
| `assetsPath` | No | string | Base URL path for asset resolution. |
| `assets` | No | string array | Files shown in the AssetBrowser. |
| `storageAssets` | No | `{name, url, showInEditor?}[]` | Optional metadata for files in Firebase Storage at `lessons/{lessonId}/assets/`. The Storage folder is the asset inventory; this field only preserves per-file settings such as `showInEditor`. Folder-discovered files default to `showInEditor: true`; explicit `false` keeps them out of the web editor rewrite set. |
| `fork` | No | object | Metadata for admin-created class forks. Forked lesson IDs must be `{sourceLessonId}-{classId}` and the fork is still a normal public lesson with its own URL. |
| `soloOnly` | No | boolean | Default `false`/absent. When `true`, the lesson is hard-forced to solo mode always — the live/wait choice screen is never offered to students, regardless of which URL they open (even `?solo=true` is redundant, and even if a live session exists for the lesson, students stay in solo mode). Authored via the Builder's "Solo-only lesson" checkbox in `LessonMetaPanel.jsx`, alongside `draft`. See `docs/agents/runtime-model.md` for how this interacts with the URL/session join flow. |
| `tasks` | Yes | array | Ordered task list. IDs are sequential integers starting at `1`. May contain group objects. |

### Fork Metadata

```json
{
  "fork": {
    "sourceLessonId": "python-l3-09",
    "sourceLessonTitle": "Dictionaries",
    "classId": "maple",
    "className": "Maple",
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "taskLinks": [
      { "taskId": 1, "sourceTaskId": 1, "relation": "copied" }
    ]
  }
}
```

Class forks are created by admins through Admin or the CLI. Creating the same fork again overwrites the lesson document, resets the title to `{source title} - {class name}`, keeps `stage: "published"`, and rebuilds 1:1 `taskLinks`. Reports and feedback start empty for the overwritten fork.

---

## Common Task Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | integer | Sequential task number. |
| `title` | Yes | string | Short task title. |
| `explainer` | Yes | string | Markdown shown to students. |
| `estimatedMinutes` | No | positive number | Approximate duration in minutes (decimals allowed, e.g. `7.5`); totalled in the builder. |
| `priority` | No | string | `core` (default) or `optional`. Teacher-facing only; students do not see task priority. |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `taskType` | No | string | Omit for code tasks. Use `information` or `quiz` for non-code task types, or `code_arrange` for a drag-and-drop runnable-code task (see "Code Arrange Task Fields" below). |
| `moduleType` | Required for composed code | string | Workspace for this code task: `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |
| `moduleId` | No | string | ID of a named entry in the lesson `modules` array. It distinguishes separate instances of the same workspace type. |
| `copyCode` | No | string | Python, Arcade Kit, or HTML code task snippet shown in a read-only reference panel above the student editor. Students cannot select or copy directly from this panel. Missing or blank values hide it. |
| `arcadeTools` | No | string | Arcade Kit only: `none` (default), `sprites`, `tilemaps`, or `both`; controls which visual editors students receive. |
| `arcadeDesign` / `completeArcadeDesign` | No | object | Arcade Kit only: portable authored pixel-sprite and tilemap data for Starter / Complete. A code stage may instead carry `arcadeDesign`. See `arcade.md`. |
| `taskActivity` | No | string | Author-only plain-text note on the intended in-class activity for this task (e.g. "Pair-share discussion"). Never shown to students. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. A code task with **no** `check` never auto-completes and never completes on Run — its check-passed state stays permanently false and it's never logged as passed in teacher reports. This does **not** block the student from advancing to the next task; forward navigation isn't gated by check state. Arcade is a special case: its Run button doesn't yet evaluate checks against game state at all (tracked in `docs/ARCADE_KIT_STATUS.md`), so a checkless Arcade task currently behaves no differently from a checked one — don't rely on an Arcade check to gate progression yet. |
| `feedbackChecks` | No | object or array | Detect nudges or wrong patterns using the same shape as completion checks. Requires a completion `check`. Supported by Python, HTML, Filesystem, Electronics, and Scratch. `mode: blocking` fails the task when matched; `mode: nudge` shows guidance without failing. `show: after_attempt` is the default; `show: on_idle` runs after the learner pauses editing (HTML idle feedback is code-check only). A feedback check may also set a positive `priority` (lower is shown first) and a `stageOffer` to give targeted help. |
| `incorrectChecks` | No | object or array | Legacy alias for blocking `feedbackChecks`. Use `feedbackChecks` in new lessons. |
| `_checkTested` | No | boolean | Builder-only validation flag set when an author has run/tested the completion checks in the builder. It is not read by the student experience. |

---

### Composed module instances

New lessons use `type: "composed"`. Every code task then supplies `moduleType`; information and quiz tasks are lesson-wide. When no `modules` array is authored, LaunchPad derives one module instance per `moduleType`.

Use `modules` with task `moduleId` when a lesson needs named or repeated workspace instances. A module object is `{ id, type, title?, sandbox? }`, where `type` is one of `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. The module's optional `sandbox` object uses the ordinary type-specific sandbox fields: `sandboxStarter` (Python/Arcade), `sandboxStarterFiles` (HTML), `sandboxStarter`/`sandboxToolbox`/`sandboxSprites`/`sandboxBackdrops` (Scratch), `sandboxStarterFs` (Filesystem), or `sandboxStarterCircuit` (Electronics). Each sandbox is isolated from the others. Without an authored module sandbox, the first code task in that module supplies the starting sandbox state.

When both `moduleId` and `moduleType` are supplied, they must identify the same workspace type. Carry-through can only reference earlier code tasks in the same named module, including when two modules share a type.

Legacy lessons may retain a single `type` of `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`.

---

## Task Format Matrix

| Workspace module type | Code task | Information | Quiz |
|---|---|---|---|---|
| `python` | Python editor + output | Supported | Supported |
| `arcade` | Python game editor + canvas | Supported | Supported |
| `html` | Multi-file editor + iframe | Supported | Supported |
| `scratch` | Scratch blocks + stage | Supported | Supported |
| `filesystem` | Virtual file manager | Supported | Supported |
| `electronics` | Editable breadboard | Supported | Supported |

In a composed lesson, every code task chooses one row with `moduleType`; `moduleId` optionally selects a named instance of that row's workspace.

`information` and `quiz` tasks ignore code fields such as `starterCode`, `starterFiles`, `starterBlocks`, `starterCircuit`, and carry-through fields.

Python, HTML, Arcade Kit, Electronics, and Scratch code stages use `role: starter | support | complete`. The first Starter is the default; teachers may apply any Starter to a class or individual learner. Arcade Kit Starter stages carry `code` plus `arcadeDesign` (sprites and tilemaps); Electronics Starter stages carry `circuit`; Scratch Starter stages carry `blocks`, `predefinedBlocks`, and `prebuiltStacks`. Every Support stage is an offerable read-only reference: Arcade Kit and Electronics currently show code only, while Scratch uses `markdown` and renders fenced or inline Scratch blocks. Complete stages are revealed read-only before the student or teacher explicitly takes them over, using the same preview-then-replace flow as Support stages. Legacy `core`, `extension`, and `solution` roles remain readable for existing lessons.

### Code stage runtime behaviour

- **Labels are shown to students**, not just teachers — a revealed stage's `label` is the panel header the student sees, and it's interpolated into the confirmation text when a stage push would replace their work (e.g. "This will replace your current work with '{label}'").
- **The `check` lives on the task, never on a stage.** Every stage — Starter, Support, or Complete — is graded against the one `check` defined on the task; there is no way to author a stage with its own, differently-graded check. Loading a Complete stage doesn't evaluate the check against it — it force-sets the task to passed directly.
- **Support-stage reveal is offer-based, one at a time, and happens in both live and solo sessions**: after each failed run or check (including runtime/syntax errors), the student is offered the next not-yet-revealed Support stage. They must click to open it. Revealing is non-destructive — it opens a side reference panel and never touches the editor. A teacher can also reveal a Support or Complete stage reference for one student instantly from the student roster, with the same non-destructive effect.
- **Starter/Complete stage pushes from a teacher are destructive but consent-based**: the teacher's push is a request the student must accept or decline before their editor/files are overwritten. This is different from a Support-stage reveal, which needs no confirmation because it doesn't touch the student's own work.
- **Targeted feedback offers** (`stageOffer`, below) can point at either a Support stage or a Complete stage. A `preview` action is always non-destructive; a `replace` action always asks the student to confirm before overwriting their work.

### Solo-mode complete-code self-reveal

A student working in **Solo mode** (no teacher/live session) can destructively overwrite their own code with the task's Complete stage, without any teacher involved. This is distinct from the teacher-driven push covered above and from the read-only `copyCode` panel: it actually replaces the student's saved work and immediately marks the task's `check` as passed, the same as a genuine solve.

- Offered only once the student has exhausted any authored Support stages and failed the check (or a run) at least twice (`checkFailCount >= 2`). It is **not available in a live session** — teachers still use the destructive stage push described above for that.
- Available for every module type that has a Complete stage: Python, HTML, Arcade Kit, Scratch, Filesystem, and Electronics.
- **Python and HTML** show a read-only "See complete code?" preview first; only after that preview has been opened does a second offer appear to load it into the editor.
- **Arcade Kit, Scratch, Filesystem, and Electronics** have no preview step — the single offer to load the complete solution is destructive immediately.
- There is **no confirmation dialog** before the destructive load (unlike moving to a stage, which does ask the student to confirm) — the button's label ("Load complete code into my editor") is the only warning.

### Targeted feedback-stage offers

Link a feedback check to a current code stage when that check identifies a specific misconception. `stageIndex` is zero-based and refers to the task's existing `codeStages` order; it can target a `role: complete` stage for a guided solution reveal as well as a Support stage. The matching feedback check with the lowest `priority` is the only one surfaced for that attempt; checks without a priority keep their array order for compatibility. `afterMatches` is the number of matching attempts before the offer appears and defaults to `2`.

```yaml
feedbackChecks:
  - type: code
    operator: not_contains
    value: "for "
    hint: "Use a loop to repeat the greeting."
    priority: 1
    stageOffer:
      stageIndex: 0
      action: preview # preview | replace
      afterMatches: 2
```

`preview` opens the named stage read-only from the feedback banner and keeps the student's work. `replace` offers the named stage from the same banner, but the student must confirm before their work is replaced. A later matching attempt offers the stage again if the student previously declined or did not use it. Removing a stage in the builder removes links to it and keeps later stage links aligned.

When a feedback check matches in the Builder **on a Python code task**, its result area includes a **Student feedback preview**. Use it to exercise the same preview or replacement prompt a learner will receive; replacement previews never alter the lesson's authoring code. This preview is currently Python-only (`TargetedStageOfferPreview`, rendered from `PythonTaskWorkspace.jsx`) — HTML, Scratch, Filesystem, and Electronics tasks support `stageOffer` the same way at runtime, but the Builder has no equivalent preview tool for them yet, so double-check those with the module's real student view instead.

## Draft lessons

Draft is a lesson-level `draft: true` mode, not a task type. Draft tasks remain normal information, quiz, code, or group tasks. Every Draft task needs a title and non-empty author-only Markdown `intent`; Draft allows incomplete learner-facing and task-specific fields but still validates task shapes and type values. Final lessons restore all ordinary validation requirements.

`intent` remains stored after Draft is cleared and is never shown to learners. Do not use lesson stages, `taskType: draft`, intended-type fields, or review-note metadata. The canonical YAML contract and command behaviour are in `docs/authoring/lesson-schema-yaml.md`.

Topic references are collected from task `topicLinks` and from `[[topic-id]]`, `[[topic-id|Custom label]]`, and `#topic/topic-id` links throughout task content, including nested hints and grouped tasks. Final lessons must reference entries in the Topic Library before saving.

## Information Task Fields

| Field | Required | Notes |
|---|:---:|---|
| `taskType` | Yes | Must be `"information"`. |
| `informationType` | No | `standard` (default), `recap`, or `introduction`. |
| `title` | Yes | Shown in progress UI. |
| `explainer` | Yes* | Markdown content. Required for `standard` and `recap`. Optional for `introduction` (renders lesson metadata). |
| `leftContent` | No | Left-pane Markdown for `recap` only. |

---

## Code Arrange Task Fields

**Authoring YAML note:** the field names below (`taskType`, etc.) are the internal/JSON form this page documents, per the header above. In authoring YAML, use `type: code_arrange` — matching how `docs/authoring/AUTHORING_GUIDE.md` already phrases `type: information`/`type: quiz` for the other two special task types — and `cli/yaml-converter.mjs` converts it to `taskType: code_arrange` on ingest. Authoring with a literal `taskType: code_arrange` key in the YAML is silently carried through as an unrecognised extra field rather than validated or converted, so the task will not actually be treated as an arrange task.

`taskType: "code_arrange"` is a drag-and-drop runnable-code task, alongside
`information` and `quiz` — not a `quiz` sub-type, since `quiz` tasks must
never carry code/output check fields (see `docs/authoring/quiz-tasks.md`)
and this task type needs exactly those fields. Students assemble a program
line by line and run it for real through the Python or HTML pipeline — the
same Pyodide/HTML run function and the same check evaluator
(`src/modules/checks.js`) an ordinary code task uses, unmodified. Completion
is decided by running the assembled code against the task's ordinary
`check`, not by matching tile identity or order.

Every line in `lines` is authored the same way: as an ordered `parts`
sequence alternating fixed text and blanks — never parsed out of a `___`
marker in a text blob. A blank (`{type: "slot", id, code}`) owns its correct
value; a text segment (`{type: "text", text}`) is fixed, non-draggable
content. A line that's just a single blank with no surrounding text (e.g.
`parts: [{type: "slot", id: "L1", code: "for i in range(5):"}]`) behaves
like a traditional whole draggable line; a line mixing text and blanks
reads like `for i in range(___):`. There is no separate schema branch for
either case — it's purely how many/which parts a line has. A line may also
have no blanks at all (every part `type: "text"`) — it renders as fixed,
non-interactive context, e.g. a variable declaration the student doesn't
need to arrange. At least one blank is still required somewhere in the
task as a whole (across all of its lines combined).

There is exactly one shared tile pool for the whole task: every blank's own
correct code, plus the task-level `distractors` list (`{id, code}[]`). Any
tile in that pool can be dropped into any blank — whatever tile currently
sits in a blank, correct or distractor, is exactly what gets spliced into
the final program and run: a distractor produces a real error or wrong
output, never a silent exclusion.

Currently supported for `moduleType: python` and `moduleType: html` only.
`interactionMode`, `tests`, and code carry-through (`carryCodeFrom`) are not
supported for `code_arrange` in this version — omit them. In the Lesson
Builder, choose **Arrange** in the task format picker (composed lessons
only); every line uses the same part-by-part composer (a new line defaults
to a single blank, the whole-line shape, as a starting point).

| Field | Required | Notes |
|---|:---:|---|
| `taskType` | Yes | Must be `"code_arrange"`. |
| `moduleType` | Yes | `python` or `html` only. Selects which run pipeline executes the assembled code. |
| `lines` | Yes | Ordered program lines: `{id, parts}[]`. At least one required. One assembled program line (`parts` joined together) is produced per entry, in order, joined by newlines. |
| `lines[].id` | Yes | Stable string id for the line (Builder list identity/reordering only — not itself a pool tile id). |
| `lines[].parts` | Yes | Ordered sequence alternating fixed text and blanks: `{type: "text", text}` or `{type: "slot", id, code}`. A line may have zero `slot` parts (fixed context); the task as a whole needs at least one `slot` part somewhere across all lines. |
| `lines[].parts[].id` | Slot parts | Stable string id; doubles as the id of that blank's own "correct" tile in the task's shared pool. |
| `lines[].parts[].code` | Slot parts | The exact correct value for this blank. |
| `distractors` | No | Task-level list of extra wrong tiles, shared by every blank in the task: `{id, code}[]`. |
| `entryFile` / `starterFiles` | HTML only | Same shape as ordinary HTML tasks (see `docs/authoring/html.md`); the assembled lines become `entryFile`'s content, so include an entry for it with any placeholder `content` (an empty string is fine). Other files (e.g. `style.css`) are not assembled from tiles. |
| `check` | Yes | Same `output`/`code`/`output_line_count`/`code_no_error` checks as an ordinary Python task, or the same `html_element_*`/`output`/`code` checks as an ordinary HTML task — see `docs/authoring/python.md` / `docs/authoring/html.md`. |
| `feedbackChecks` | No | Same shape as other code tasks. |

### Python Example (a whole-line blank + a line with an inline blank, sharing one pool)

```yaml
- title: Print the first five even numbers
  type: code_arrange
  moduleType: python
  explainer: Drag the line into place and fill in the blank to print 0 2 4 6 8, one per line.
  lines:
    - id: L1
      parts:
        - type: text
          text: "for i in range("
        - type: slot
          id: S1
          code: "5"
        - type: text
          text: "):"
    - id: L2
      parts:
        - type: slot
          id: L2
          code: "    print(i * 2)"
  distractors:
    - id: S1d1
      code: "10"
    - id: D1
      code: "    print(i + 2)"
  check:
    type: output
    operator: equals
    value: |
      0
      2
      4
      6
      8
```

### HTML Example

```yaml
- title: Arrange a heading and paragraph
  type: code_arrange
  moduleType: html
  explainer: Build the page by arranging the lines.
  entryFile: index.html
  starterFiles:
    - name: index.html
      type: html
      content: ""
    - name: style.css
      type: css
      content: "h1 { color: navy; }"
  lines:
    - id: L1
      parts:
        - type: slot
          id: L1
          code: "<h1>Hello</h1>"
    - id: L2
      parts:
        - type: slot
          id: L2
          code: "<p>Welcome to my page.</p>"
  distractors:
    - id: D1
      code: "<h2>Hello</h2>"
  check:
    type: html_element
    operator: exists
    selector: h1
```

---

## Task Groups

```json
{
  "id": "g-1234567890",
  "type": "group",
  "title": "Loops",
  "subtasks": [...]
}
```

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | String (e.g. `"g-1234567890"`) — not an integer. |
| `type` | Yes | Must be `"group"`. |
| `title` | Yes | Group display name. Subtask titles are derived from this. |
| `subtasks` | Yes | Ordered task objects using the same format as top-level tasks. |

Groups may not be nested. `carryCodeFrom` / `carryBlocksFrom` references from within a subtask use the subtask's integer `id`.

---

## Validation Rules

Two separate validators exist and they do not enforce the same rules. `cli lessons validate|upsert|publish-yaml` runs `cli/validate.mjs` (`validateLessonForMcp`); the Lesson Builder runs a stricter, browser-only validator in `src/builder/lessonUtils.js`. A lesson can pass CLI validation and still trip builder-only rules — publish through the builder at least once, or check by hand, if you need those covered.

**Enforced by both the CLI and the builder:**

- Lesson `id`, `title`, and at least one task are required.
- Every task needs a `title`.
- Information tasks need an `explainer` unless `informationType` is `introduction`.
- Multiple-choice quiz tasks need at least two non-empty options and an `answer_equals` check; match/fill-blank/short-answer quizzes have their own required-field rules.
- HTML code tasks should have files with unique filenames and an HTML entry file.
- Scratch `sprite_property` and `block_used` checks need their type-specific fields (`property`/`operator`/`value`, `opcode`) filled in.
- Filesystem checks (`fs_*`, including legacy aliases) need their type-specific fields — a `path`, an expected `value`/count where applicable, a parent `dir` for location checks.
- Electronics tasks need a starter breadboard (`starterCircuit` or a Starter-role `codeStages` entry). Electronics checks (`circuit_*`) need a real target — a component/control selector (`type`, `label`, or `id`) and, for connection checks, an endpoint `pin`.

Both validators share the same filesystem/electronics check-field logic (`src/shared/checkAuthoringValidation.js`) so they can't drift apart the way they used to — a lesson published via the CLI alone can no longer ship a filesystem or electronics check the Builder would have flagged as broken.

**Builder-only (not checked by the CLI):**

- `carryCodeFrom` / `carryBlocksFrom` must reference an existing task ID.
- Submit mode cannot use run-required checks.
- DOM checks (`html_element_*`, legacy `element_*`) need a CSS `selector`; attribute checks need an `attribute` name; style-property checks need a `property` name.
- Variable checks (`variable_*`) need a `name`; `variable_dict_key_value` needs a `key`; `variable_array_nth_item` needs a valid `index`.
- Checks requiring a value must provide one (exceptions: `code_no_error`, `output_not_empty`, `output_empty`, `element_exists`, `element_attribute`, `element_style_property`, `variable_exists`).
- Feedback checks are validated against the same field rules as completion checks; blocking feedback without a `hint` is a builder warning.
- Scratch toolbox XML must parse if provided.
- Scratch checks have their own required fields — see `docs/authoring/scratch.md`.
