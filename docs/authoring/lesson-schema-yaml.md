# Lesson YAML Schema

Canonical YAML contract for the shape of a lesson file: the lesson envelope, Draft workflow and metadata, fields common to every task, and the non-code task types (information and group). For the underlying JSON shape every YAML file converts to, see `docs/authoring/lesson-schema.md`.

This file does not cover code task fields or quiz task fields:

- **Quiz fields:** `docs/authoring/quiz-tasks.md`
- **Python code task fields:** `docs/authoring/python-tasks.md`
- **Arcade Kit code task fields and API:** `docs/authoring/arcade.md`
- **HTML code task fields:** `docs/authoring/html-tasks.md`
- **Filesystem code task fields:** `docs/authoring/filesystem-tasks.md`
- **Electronics code task fields:** `docs/authoring/electronics.md`
- **Scratch code task fields:** `docs/authoring/scratch.md` (use `scratch-markdown-blocks.md` for block text and `scratch-toolbox-xml.md` for toolbox XML)
- **Check types:** use the lesson-type docs above (`python.md`, `html.md`, `scratch.md`, `filesystem.md`, `electronics.md`, or `quiz-tasks.md`).
- **Full authoring walkthrough and CLI workflow:** `docs/authoring/AUTHORING_GUIDE.md`

Lessons live in the Firestore `lessons/` collection. Use `node cli/cli.mjs lessons publish-yaml <file>` to validate and publish a YAML lesson, or `node cli/cli.mjs lessons upsert <file>` to save one.

---

## Lesson Envelope

```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: composed               # required for new lessons; legacy types still load
title: Python For Loops      # required
draft: false                 # optional; true permits incomplete real tasks during authoring
version: 3                   # current successful-save version (managed by CLI/Builder)
description: Practise loops. # required — shown on the entry screen
level: Level 1               # optional legacy display fallback; prefer levelId/levelRef
levelId: python-level-1      # optional reusable level id from lessonLevels/
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

# Optional named workspace instances. See “Composed modules” below.
modules: []

tasks: []                     # required — ordered task list (see below)
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and export filename. |
| `type` | Yes | string | `composed` for new lessons. Legacy `python`, `arcade`, `html`, `scratch`, `filesystem`, and `electronics` lessons remain supported. |
| `title` | Yes | string | Display title. |
| `description` | Yes | string | Short entry screen summary. |
| `draft` | No | boolean | Enables incomplete real tasks for authoring. Final publishing refuses `true`. |
| `version` | No | positive integer | Current save version, managed by LaunchPad; callers must not set it. |
| `level` | No | string/number | Legacy display fallback for the difficulty badge. Publishing migrates scalar values into reusable level records when no `levelId`/`levelRef` exists. |
| `levelId` | No | string | ID of a reusable record in `lessonLevels/`. |
| `levelRef` | No | object | `{ id, scopeType, scopeId }` reference for the reusable level. |
| `topicProposals` | No | array | Missing Topic Library entries proposed by the lesson. See `docs/authoring/AUTHORING_GUIDE.md`. |
| `assetsPath` | No | string | Base URL path for asset resolution. |
| `assets` | No | string array | Files shown in the AssetBrowser. |
| `storageAssets` | No | array | Optional metadata for files stored at `lessons/{lessonId}/assets/`; the Storage folder is the asset inventory. |
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
    taskMode: both              # optional — both (default) | live | solo
    intent: |                    # required, non-empty Markdown in Draft; author-only
      Describe the learning goal and intended task.
    # taskType is not set directly in YAML — use `type: information` or `type: quiz`;
    # omit it entirely for a code task.
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
| `estimatedMinutes` | No | positive integer | Approximate duration; totalled in the builder. |
| `priority` | No | string | `core` (default) or `optional`. Teacher-facing only; students do not see task priority. |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `moduleType` | Yes for a code task in a new composed lesson | string | Workspace type: `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |
| `moduleId` | No | string | ID of the named workspace instance in `modules`. Use it to give related tasks one workspace identity, or to distinguish two instances of the same `moduleType`. |
| `intent` | Required for drafts; otherwise No | string | Authoring brief. Remains stored after Draft is cleared and is never student-facing. |
| `intentLastChangedAt` | No | timestamp string | LaunchPad-managed; callers must not set it. Changes only when `intent` changes. |
| `taskLastChangedAt` | No | timestamp string | LaunchPad-managed; callers must not set it. Changes only when learner-facing task content/configuration changes. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. |
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
    starterFiles: []
```

Module sandboxes use the existing type-specific sandbox fields: `sandboxStarter` for Python and Arcade Kit; `sandboxStarterFiles` for HTML; `sandboxStarter`, `sandboxToolbox`, `sandboxSprites`, and `sandboxBackdrops` for Scratch; `sandboxStarterFs` for Filesystem; and `sandboxStarterCircuit` for Electronics. If a named module has no authored `sandbox`, its sandbox starts from that module's first code task. A task's `moduleType` and its named module's `type` must agree.

Carry-through stays inside the same named module: use the existing type-specific carry field (`carryCodeFrom`, `carryBlocksFrom`, `carryFsFrom`, or `carryCircuitFrom`) and select an earlier task in that module only.

---

## Draft workflow and managed metadata

`draft` is a lesson-level boolean. It is the only Draft marker: a Draft task remains a normal code, information, quiz, or group task. In YAML, omit task `type` for a code task; use `type: information` or `type: quiz` for those task types. Do not use lesson stages, `taskType: draft` / `type: draft`, intended-type fields, or review-note metadata.

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
| _(n/a — use `group:` instead)_ | Task group | See below |

---

## Information Task Fields

```yaml
  - type: information         # required — sets taskType: "information" in JSON
    informationType: standard  # optional — standard (default) | recap | introduction
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
    # leftContent is used only with informationType: recap (left pane content)
```

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | Must be `information`. |
| `informationType` | No | `standard` (default), `recap`, or `introduction`. |
| `title` | Yes | Shown in progress UI. |
| `explainer` | Yes* | Markdown content. Required for `standard` and `recap`. Optional for `introduction` (renders lesson metadata). |
| `leftContent` | No | Left-pane Markdown for `recap` only. |

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

Set `_customTitle: true` on every subtask inside a group that has its own `title`. Without it a grouped subtask does not keep the authored name.

```yaml
tasks:
  - group: Loop Basics
    tasks:
      - _customTitle: true       # required for the title below to stick
        title: Counted loops
```

It is only needed on grouped subtasks. Top-level tasks keep their `title` without it.

---

## Validation Rules

Two separate validators exist and they do not enforce the same rules. `cli lessons validate|upsert|publish-yaml` runs `cli/validate.mjs`; the Lesson Builder runs its browser-side final validation when Draft is cleared or a final lesson is saved. A lesson can pass CLI validation and still trip builder-only rules.

See `docs/authoring/lesson-schema.md` (**Validation Rules**) for the full list of rules enforced by each validator.

---

## Minimal Examples

A minimal composed-lesson YAML example for each workspace module lives alongside its field reference:

- **Python:** `docs/authoring/python-tasks.md`
- **HTML:** `docs/authoring/html-tasks.md`
- **Scratch:** `docs/authoring/scratch.md`
- **Filesystem:** `docs/authoring/filesystem-tasks.md`
- **Electronics:** `docs/authoring/electronics.md`

For a complete lesson mixing information, quiz, code, and group tasks, see the **Full YAML Example** in `docs/authoring/AUTHORING_GUIDE.md`.
