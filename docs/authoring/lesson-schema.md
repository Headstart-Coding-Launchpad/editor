# Lesson JSON Schema

Full JSON field reference for cross-cutting fields. For YAML authoring see `docs/authoring/AUTHORING_GUIDE.md` or the basic-field reference at `docs/authoring/lesson-schema-yaml.md`. For type-specific code task fields, checks, and minimal examples see the relevant `docs/authoring/<type>.md` guide.

**Quiz sub-types:** `docs/authoring/quiz-tasks.md`

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
| `estimatedMinutes` | No | positive integer | Approximate duration; totalled in the builder. |
| `priority` | No | string | `core` (default) or `optional`. Teacher-facing only; students do not see task priority. |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `taskType` | No | string | Omit for code tasks. Use `information` or `quiz` for non-code task types. |
| `moduleType` | Required for composed code | string | Workspace for this code task: `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |
| `moduleId` | No | string | ID of a named entry in the lesson `modules` array. It distinguishes separate instances of the same workspace type. |
| `copyCode` | No | string | Python, Arcade Kit, or HTML code task snippet shown in a read-only reference panel above the student editor. Students cannot select or copy directly from this panel. Missing or blank values hide it. |
| `arcadeTools` | No | string | Arcade Kit only: `none` (default), `sprites`, `tilemaps`, or `both`; controls which visual editors students receive. |
| `arcadeDesign` / `completeArcadeDesign` | No | object | Arcade Kit only: portable authored pixel-sprite and tilemap data for Starter / Complete. A code stage may instead carry `arcadeDesign`. See `arcade.md`. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. |
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

Python, HTML, Arcade Kit, Electronics, and Scratch code stages use `role: starter | support | complete`. The first Starter is the default; teachers may apply any Starter to a class or individual learner. Arcade Kit Starter stages carry `code` plus `arcadeDesign` (sprites and tilemaps); Electronics Starter stages carry `circuit`; Scratch Starter stages carry `blocks`, `predefinedBlocks`, and `prebuiltStacks`. Support stages are read-only references with `revealable: true`: Arcade Kit and Electronics currently show code only, while Scratch uses `markdown` and renders fenced or inline Scratch blocks. A Support stage needs `revealable: true` to be offerable; a Complete stage is revealable without that flag. Complete stages are revealed read-only before the student or teacher explicitly takes them over, using the same preview-then-replace flow as Support stages. Legacy `core`, `extension`, and `solution` roles remain readable for existing lessons.

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

When a feedback check matches in the Builder, its result area includes a **Student feedback preview**. Use it to exercise the same preview or replacement prompt a learner will receive; replacement previews never alter the lesson's authoring code.

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

**Builder-only (not checked by the CLI):**

- `carryCodeFrom` / `carryBlocksFrom` must reference an existing task ID.
- Submit mode cannot use run-required checks.
- DOM checks (`html_element_*`, legacy `element_*`) need a CSS `selector`; attribute checks need an `attribute` name; style-property checks need a `property` name.
- Variable checks (`variable_*`) need a `name`; `variable_dict_key_value` needs a `key`; `variable_array_nth_item` needs a valid `index`.
- Checks requiring a value must provide one (exceptions: `code_no_error`, `output_not_empty`, `output_empty`, `element_exists`, `element_attribute`, `element_style_property`, `variable_exists`).
- Feedback checks are validated against the same field rules as completion checks; blocking feedback without a `hint` is a builder warning.
- Scratch toolbox XML must parse if provided.
- Scratch checks have their own required fields — see `docs/authoring/scratch.md`.
