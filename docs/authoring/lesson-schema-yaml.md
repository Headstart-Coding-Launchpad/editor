# Lesson YAML Schema

Canonical YAML contract for the shape of a lesson file: the lesson envelope, Draft workflow and metadata, fields common to every task, and the non-code task types (information and group). For the underlying JSON shape every YAML file converts to, see `docs/authoring/lesson-schema.md`.

This file does not cover code task fields or quiz task fields:

- **Quiz fields:** `docs/authoring/quiz-tasks.md`
- **Python code task fields:** `docs/authoring/python-tasks.md`
- **Arcade Kit code task fields and API:** `docs/authoring/arcade.md`
- **HTML code task fields:** `docs/authoring/html-tasks.md`
- **Filesystem code task fields:** `docs/authoring/filesystem-tasks.md`
- **Desktop code task fields:** `docs/authoring/desktop.md`
- **Electronics code task fields:** `docs/authoring/electronics.md`
- **Scratch code task fields:** `docs/authoring/scratch.md` (use `scratch-markdown-blocks.md` for block text and `scratch-toolbox-xml.md` for toolbox XML)
- **Check types:** use the lesson-type docs above (`python.md`, `html.md`, `scratch.md`, `filesystem.md`, `desktop.md`, `electronics.md`, or `quiz-tasks.md`).
- **Full authoring walkthrough and CLI workflow:** `docs/authoring/AUTHORING_GUIDE.md`

Lessons live in the Firestore `lessons/` collection. Use `node cli/cli.mjs lessons publish-yaml <file>` to validate and publish a YAML lesson, or `node cli/cli.mjs lessons upsert <file>` to save one.

---

## Lesson Envelope

<!-- example:template -->
```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: composed               # required for new lessons; legacy types still load
title: Python For Loops      # required
draft: false                 # optional; true permits incomplete real tasks during authoring
soloOnly: false               # optional; true hard-forces solo mode, hiding the live/wait choice
version: 3                   # current successful-save version (managed by CLI/Builder)
description: Practise loops. # required — shown on the entry screen
level: Level 1               # optional legacy display fallback; prefer levelId/levelRef
levelId: python-level-1      # optional reusable level id from lessonLevels/
lessonNumber: 9              # optional — position within the level (positive whole number)
levelRef:                    # optional reusable level reference
  id: python-level-1
  scopeType: type            # type | module | course | collection
  scopeId: python
assetsPath: scratch-assets    # optional — base URL path for asset resolution
assets:                       # optional — files shown in the AssetBrowser
  - sprites/rocket.png
storageAssets:                 # optional — metadata for Firebase Storage files
  - name: logo.png
    url: https://firebasestorage.googleapis.com/...
    showInEditor: true        # optional — show in web editor asset panel

badgeOptions:                 # optional — tune the live badge rules (docs/authoring/badges.md)
  quizMasterThreshold: 0.8    # default 0.8
  readyToCodeSeconds: 10      # default 10
  earlyBirdMinutes: 5         # default 5

# Optional named workspace instances. See “Composed modules” below.
modules: []

tasks: []                     # required — ordered task list (see below)
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and export filename. |
| `type` | Yes | string | `composed` for new lessons. Legacy `python`, `arcade`, `turtle`, `html`, `scratch`, `filesystem`, `desktop`, and `electronics` lessons remain supported. |
| `title` | Yes | string | Display title. |
| `description` | Yes | string | Short entry screen summary. |
| `draft` | No | boolean | Enables incomplete real tasks for authoring. Final publishing refuses `true`. |
| `soloOnly` | No | boolean | Default `false`. When `true`, hard-forces solo mode always — the live/wait choice screen is never offered, regardless of URL or an existing live session. See `docs/authoring/lesson-schema.md` and `docs/agents/runtime-model.md`. |
| `companionOf` | No | string | Set only on a `soloOnly` "solo challenge" lesson, to the `id` of the parent lesson it extends. Links the two in the Admin list and offers this lesson as a "Try the Solo Challenge" continuation when students finish the parent. See "Solo Companion Metadata" in `docs/authoring/lesson-schema.md`. |
| `version` | No | positive integer | Current save version, managed by LaunchPad; callers must not set it. |
| `level` | No | string/number | Legacy display fallback for the difficulty badge. Publishing migrates scalar values into reusable level records when no `levelId`/`levelRef` exists. |
| `levelId` | No | string | ID of a reusable record in `lessonLevels/`. |
| `levelRef` | No | object | `{ id, scopeType, scopeId }` reference for the reusable level. |
| `lessonNumber` | No | positive integer | Position within its level (`1`, `2`, `3` …). Shown next to the title ("9 · Boolean Flags") in the Admin lesson list, the Builder's lesson picker and `lessons list`, and as "Lesson 9" in the classroom header. Lists sort within a level by `lessonNumber`, unnumbered lessons after numbered ones by title. A Solo Challenge (`companionOf`) needs none: it sorts straight after its parent. Give a Solo Project the number of the lesson it follows; on a shared number the lesson without `soloOnly` comes first, then its companion, then the `soloOnly` lesson. `0`, negatives, decimals and strings fail validation. A save or upsert that leaves the field out keeps the stored number; `lessonNumber: null` clears it. See "Lesson Numbers" in `docs/authoring/lesson-schema.md`. |
| `topicProposals` | No | array | Missing Topic Library entries proposed by the lesson. See `docs/authoring/AUTHORING_GUIDE.md`. |
| `assetsPath` | No | string | Base URL path for asset resolution. |
| `assets` | No | string array | Files shown in the AssetBrowser. |
| `storageAssets` | No | array | Optional metadata for files stored at `lessons/{lessonId}/assets/`; the Storage folder is the asset inventory. |
| `badgeOptions` | No | object | Tunes the built-in live badge rules: `quizMasterThreshold` (0–1), `quizMasterMinQuizzes`, `persistenceMinFails`, `readyToCodeSeconds`, `earlyBirdMinutes`, `sideQuesterMinDone`, `wordSmithMinTasks`. See [badges.md](badges.md#badgeoptions). |
| `modules` | No | array | Named workspace instances for a composed lesson. Use when tasks need a shared named workspace, especially when two instances use the same `moduleType`. See **Composed modules**. |
| `tasks` | Yes | array | Ordered task list. May contain group objects. |

In a new composed lesson, put sandbox configuration on the relevant `modules[].sandbox`; it is isolated per named workspace. The legacy lesson-envelope sandbox fields remain supported for legacy single-type lessons.

---

## Common Task Fields

Every task, regardless of type, supports these fields:

```yaml
tasks:
  - id: 1                    # optional — auto-assigned sequential integer if omitted
    title: Task title         # required
    explainer: |               # required — Markdown shown to students
      Instructions here.
    estimatedMinutes: 5        # optional — approximate duration, totalled in the builder
    priority: core              # optional — core (default) | optional; teacher-facing only
    allowSharing: true          # optional — let students share this workspace with the class (teacher approves)
    peerHints:                  # optional — extra hints a classmate can send when helping (peer help)
      - Did you use a loop?
    sideQuests:                 # optional — up to 3 unchecked extras once the task is passed (python, turtle, html)
      - title: Break it, then fix it
        kind: debug             # challenge | debug | predict (label and icon only)
        explainer: Run it, read the error, then fix it.
        starter: |
          for i in range(3)
              print("Hello")
    taskMode: both              # optional — both (default) | live | solo
    intent: >-                   # required, non-empty Markdown in Draft; author-only
      Describe the learning goal and intended task.
    taskActivity: Code Task, Complete Example  # optional; author-only Glossary format + pattern
    badgeHints:                 # optional — add or suppress a live badge on this task
      suppress: [ready_to_code]
    # taskType is not set directly in YAML — use `type: information`, `type: quiz`,
    # `type: code_arrange` (drag-and-drop runnable code — see lesson-schema.md's
    # "Code Arrange Task Fields") or an activity (`type: binary`, `type: keyboard`,
    # `type: mouse`); omit it entirely for a normal code task.
    moduleType: python          # required for every code task in a new composed lesson
    moduleId: python-practice   # optional — named workspace instance from `modules`
    check: {}                   # optional — completion check, see the lesson-type docs
    feedbackChecks: []          # optional — nudges or blocking wrong-pattern checks
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | No | integer | Auto-assigned sequential integer if omitted. |
| `title` | Yes | string | Short task title. |
| `explainer` | Yes in final mode | string | Markdown shown to students. Draft permits it to be omitted. |
| `estimatedMinutes` | No | positive number | Approximate duration in minutes (decimals allowed, e.g. `7.5`); totalled in the builder. |
| `priority` | No | string | `core` (default) or `optional`. Teacher-facing only; students do not see task priority. |
| `peerHints` | No | list of strings | Up to 6 short hints (≤ 60 characters; helpers see at most 6 hint cards) a classmate can send when helping on this task (peer help). Keep them general and kind, never the answer. Not valid on `quiz` or `information` tasks. |
| `allowSharing` | No | boolean | Lets students offer this workspace to the whole class, subject to teacher approval. Off unless set to `true`. Not valid on `quiz` or `information` tasks. |
| `sideQuests` | No | list | Up to 3 optional, unchecked side-quests (`title`, `kind`, `explainer`, `starter`) a student can open once they pass this code task. Python, Turtle and HTML only. See [Side-quests](AUTHORING_GUIDE.md#side-quests). |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `moduleType` | Yes for a code task in a new composed lesson | string | Workspace type: `python`, `arcade`, `turtle`, `html`, `scratch`, `filesystem`, `desktop`, or `electronics`. |
| `moduleId` | No | string | ID of the named workspace instance in `modules`. Use it to give related tasks one workspace identity, or to distinguish two instances of the same `moduleType`. |
| `intent` | Required for drafts; otherwise No | string | Authoring brief. Remains stored after Draft is cleared and is never student-facing. |
| `taskActivity` | No | string | Author-only tag for the task's canonical type (e.g. `Code Task, Complete Example`, `Quiz, Multiple Choice`), per the content workspace's `guides/Task Intent Format.md`. The platform's copy of the vocabulary is `src/shared/taskActivity.js` (`lessons capabilities` → `taskActivity`); badges read the pattern, and validation warns (never errors) about one it doesn't recognise. Always optional, even in Draft. Never student-facing. |
| `badgeHints` | No | object | `suggest:` / `suppress:` lists of badge ids for this task. See [badges.md](badges.md#badgehints). |
| `intentLastChangedAt` | No | timestamp string | LaunchPad-managed; callers must not set it. Changes only when `intent` changes. |
| `taskLastChangedAt` | No | timestamp string | LaunchPad-managed; callers must not set it. Changes only when learner-facing task content/configuration changes. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. A code task with **no** `check` never auto-completes and never completes on Run, but it also doesn't block advancing to the next task — it just never shows as passed in reports. See `docs/authoring/lesson-schema.md` for the full behaviour, including the Arcade-specific caveat. |
| `feedbackChecks` | No | object or array | Supported by Python, HTML, Filesystem, Electronics, and Scratch. Requires a completion `check`. `mode: blocking` fails when matched; `mode: nudge` guides without blocking. `show: after_attempt` is the default; `show: on_idle` runs after the learner pauses editing (HTML idle feedback is code-check only). |
| `incorrectChecks` | No | object or array | Legacy alias for blocking `feedbackChecks`. |

---

## Composed modules

`composed` is the standard envelope for new lessons. Each code task selects its workspace with `moduleType`; information and quiz tasks remain lesson-wide and need neither module field.

For a lesson with one workspace of each type, `moduleType` is enough: LaunchPad derives one module instance for that type. Add `modules` and `moduleId` when you need named workspace instances — for example, two independent Python workspaces in one lesson. Every named module has an `id`, a workspace `type`, an optional display `title`, and an optional isolated `sandbox` configuration.

```yaml
type: composed
modules:
  - id: model-python
    type: python
    title: Model in Python
    sandbox:
      sandboxStarter: "print('Try a model here')"
  - id: challenge-python
    type: python
    title: Independent Python challenge
    sandbox:
      sandboxStarter: "print('This sandbox is separate')"
  - id: web-showcase
    type: html
    title: Web showcase
    sandbox:
      sandboxStarterFiles:
        - name: index.html
          type: html
          content: "<!doctype html><title>Sandbox</title>"
tasks:
  - title: Write the model
    moduleType: python
    moduleId: model-python
    starterCode: "print('Model')"
  - title: Build independently
    moduleType: python
    moduleId: challenge-python
    starterCode: "print('Challenge')"
  - title: Add a web heading
    moduleType: html
    moduleId: web-showcase
    starterFiles:
      - name: index.html
        type: html
        content: "<!doctype html><title>Showcase</title><h1></h1>"
```

Module sandboxes use the existing type-specific sandbox fields: `sandboxStarter` for Python, Arcade Kit and Turtle; `sandboxStarterFiles` for HTML; `sandboxStarter`, `sandboxToolbox`, `sandboxSprites`, and `sandboxBackdrops` for Scratch; `sandboxStarterFs` for Filesystem; and `sandboxStarterCircuit` for Electronics. If a named module has no authored `sandbox`, its sandbox starts from that module's first code task. A task's `moduleType` and its named module's `type` must agree.

Carry-through stays inside the same named module: use the existing type-specific carry field (`carryCodeFrom`, `carryBlocksFrom`, `carryFsFrom`, `carryDesktopFrom`, or `carryCircuitFrom`) and select an earlier task in that module only.

---

## Draft workflow and managed metadata

`draft` is a lesson-level boolean. It is the only Draft marker: a Draft task remains a normal code, information, quiz, activity, or group task. In YAML, omit task `type` for a code task; use `type: information`, `type: quiz` or `type: <activity>` (e.g. `type: binary`) for those task types. Do not use lesson stages, `taskType: draft` / `type: draft`, intended-type fields, or review-note metadata.

When `draft: true`, every task must have a title, its normal real task type, and a non-empty Markdown `intent`. Draft deliberately permits omitted learner-facing and task-specific fields, but it still rejects malformed field shapes and invalid task/type values. When Draft is false or omitted, all ordinary validation rules apply again. `intent` remains stored after Draft is cleared and is never rendered to students.

Builder preserves task IDs, task order, `intent`, and recognised task fields when it saves. It permits incomplete tasks only while Draft is true. Clearing Draft runs full final validation and is refused if that validation fails.

`version`, `intentLastChangedAt`, and `taskLastChangedAt` are managed by LaunchPad; callers must not set them. CLI and Builder saves are last-writer-wins. A material save increments `version`; a no-op leaves `version` and timestamps unchanged. `intentLastChangedAt` changes only when the author-only `intent` changes. `taskLastChangedAt` changes only when learner-facing task content or configuration changes.

| Command | Draft lesson (`draft: true`) | Final lesson (`draft: false` or omitted) |
|---|---|---|
| `lessons validate <file>` | Validates Draft structure, including title, intent, real task type, valid types, and field shapes. | Runs all ordinary validation requirements. |
| `lessons upsert <file>` | Creates or replaces the Draft lesson after Draft validation. | Creates or replaces the final lesson after full validation. |
| `lessons preflight <file>` | Validates Draft structure and checks Topic Library references. | Validates and checks Topic Library references. |
| `lessons publish-yaml <file>` | Refuses while Draft remains true. | Validates, checks references, and publishes. |
| `lessons get <id> --format yaml` | Retrieves the current authoritative Draft YAML. | Retrieves the current authoritative final YAML. |

---

## Task Types

A task is a code task by default. Set `type:` on the task to switch to a different task type:

| YAML `type:` on a task | Resulting task | Field reference |
|---|---|---|
| _(omitted)_ | Code task — its `moduleType` selects Python, Arcade Kit, HTML, Scratch, Filesystem, or Electronics | See the matching module code-task guide linked above |
| `information` | Explainer-only slide | See below |
| `quiz` | Knowledge check | `docs/authoring/quiz-tasks.md` |
| `binary`, `keyboard`, `mouse` | Activity (`taskType: activity` + `activityType` in JSON) | See [Activity Tasks](#activity-tasks) |
| _(n/a — use `group:` instead)_ | Task group | See below |

## Activity Tasks

An activity is a bounded exercise that can sit anywhere in a lesson (no Run, sandbox, sharing or
carry-through). Write `type: <activity>` on the task; the converter turns it into
`taskType: activity` + `activityType: <activity>`, and exporting to YAML writes the shorthand back.
The explicit `taskType: activity` + `activityType:` form still works. `node cli/cli.mjs lessons
capabilities` lists every activity; each has an authoring page in
[activities/](activities/) ([binary](activities/binary.md), [keyboard](activities/keyboard.md),
[mouse](activities/mouse.md)). Quizzes keep `type: quiz` + `quizType`.

```yaml
id: activity-shorthand
type: composed
title: Activity shorthand
description: One Binary activity between two code tasks.
tasks:
  - title: Print a number
    moduleType: python
    starterCode: |
      print(5)
  - title: Make the numbers
    type: binary                # → taskType: activity, activityType: binary
    description: Click the bits to turn them on. Make each number.
    mode: make_number
    bits: 4
    items:
      - id: a
        target: 5
  - title: Print it in binary
    moduleType: python
    starterCode: |
      print(bin(5))
```

---

## Information Task Fields

```yaml
  - type: information         # required — sets taskType: "information" in JSON
    informationType: standard  # optional — standard (default) | recap | introduction | badges
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
    # leftContent is used only with informationType: recap (left pane content)
```

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | Must be `information`. |
| `informationType` | No | `standard` (default), `recap`, `introduction`, or `badges` (the Badge Summary, "Today's Coding Moments": the live session's badges grouped by badge; skipped in solo — see [badges.md](badges.md#badge-summary-task)). |
| `title` | Yes | Shown in progress UI. |
| `explainer` | Yes* | Markdown content. Required for `standard` and `recap` (the recap's right pane). Optional for `badges` (shown above the class wall). `introduction` ignores it: it renders only the lesson's `title`, `level` and `description`. |
| `leftContent` | No | `recap` only: the purple left pane. Canonical style is a single `## ` heading and nothing else (`leftContent: "## What we covered"`); put the recap body in `explainer`. Ignored by every other `informationType`, including `introduction`. |

---

## Task Groups

```yaml
tasks:
  - group: Loop Basics         # required — generates a group object in JSON
    tasks:                      # required — ordered task objects, same format as top-level tasks
      - title: Counted loops
        explainer: Use `range()` to repeat exactly N times.
        check:
          type: output_line_count
          operator: equals
          value: 5
```

Groups cannot be nested. Group IDs are auto-generated (e.g. `g-1234567890`). `carryCodeFrom` / `carryBlocksFrom` references from within a subtask use the subtask's own integer `id`.

### Subtask titles

Subtask titles are independent from the group title. Set `title` on each subtask exactly as you would for a top-level task.

```yaml
tasks:
  - group: Loop Basics
    tasks:
      - title: Counted loops
      - title: Loop over a list
```

The legacy `_customTitle` field is no longer needed. Builder saves and exports strip it from grouped subtasks.

---

## Validation Rules

`cli lessons validate|upsert|publish-yaml` and the Lesson Builder (when Draft is cleared or a final lesson is saved) run the same rules with the same messages. Only a few extras differ: the CLI requires a `description`; the Builder also parses Scratch toolbox XML and warns about duplicate task ids and untested checks.

See `docs/authoring/lesson-schema.md` (**Validation Rules**) for the rules and `docs/authoring/validation-errors.md` for every message.

---

## Minimal Examples

A minimal composed-lesson YAML example for each workspace module lives alongside its field reference:

- **Python:** `docs/authoring/python-tasks.md`
- **HTML:** `docs/authoring/html-tasks.md`
- **Scratch:** `docs/authoring/scratch.md`
- **Filesystem:** `docs/authoring/filesystem-tasks.md`
- **Desktop:** `docs/authoring/desktop.md`
- **Electronics:** `docs/authoring/electronics.md`

For a complete lesson mixing information, quiz, code, and group tasks, see the **Full YAML Example** in `docs/authoring/AUTHORING_GUIDE.md`.
