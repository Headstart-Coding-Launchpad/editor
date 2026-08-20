# Composed Lessons Technical Specification

**Status:** Implemented — composed lessons and the standalone playgrounds described here are shipped and are the default multi-workspace lesson mechanism.  
**Scope:** `composed` lessons and standalone Python, Arcade Kit, and Electronics playgrounds.  
**Out of scope:** Virtual OS/VFS work, automatic code translation between modules, and pedagogical sequencing rules.

## 1. Purpose

A composed lesson teaches one sequence through multiple existing coding environments. A learner can, for example, practise a concept in Python, apply it in Arcade Kit, then apply it with Electronics/MicroPython. The feature must reuse the existing lesson modules rather than merge their editors, state formats, runtimes, or check systems.

Existing `python`, `arcade`, `html`, `scratch`, `filesystem`, and `electronics` lessons remain unchanged and fully compatible.

## 2. Goals and invariants

- A composed lesson can contain any ordered combination of existing module types.
- Every code task selects one existing workspace type directly.
- The active workspace set is derived from the code tasks in the lesson.
- Lesson-wide information and quiz tasks are allowed before, after, or between lesson modules.
- Carry-through is permitted only from an earlier task in the same lesson module, using that module's existing carry field and state model.
- Each lesson module has an independent sandbox and independent sandbox persistence.
- A composed lesson does not translate or automatically transfer code between module types.
- Existing single-type lesson documents, localStorage keys, session data, reports, CLI files, and URLs must continue to work without migration.

## 3. Data model

`composed` is a lesson envelope type, not a replacement code-workspace module. Each code task declares its workspace with `moduleType`; the lesson derives its active workspace set from those selections. Groups remain ordinary optional task organisation.

```yaml
id: loops-in-context
type: composed
title: Loops in context
description: Practise a loop in several programming environments.
tasks:
  - type: information
    id: 1
    title: The shared idea
    explainer: A loop repeats an instruction.

  - id: 2
    moduleType: python
    title: Repeat a message
    starterCode: |
      for _ in range(3):
        print('Hello')
    check:
      type: output
      operator: contains
      value: Hello

  - id: 3
    moduleType: arcade
    title: Repeat an animation
    starterCode: |
      from headstart_arcade import game
      game.run()
    check:
      type: code
      operator: contains
      value: game.run

  - type: quiz
    id: 4
    title: Reflect
    quizType: multiple_choice
    # normal quiz fields
```

### 3.1 Code-task workspace field

| Field | Required | Meaning |
|---|:---:|---|
| `moduleType` | Yes, on code tasks | One registered workspace type: `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |

The Builder displays all workspace types in each code task's selector. Changing it clears workspace-specific code, checks, stages, and carry-through configuration rather than attempting an unsafe conversion.

### 3.2 Task placement rules

Information and quiz tasks are lesson-wide. Every code task must have a valid `moduleType`. Existing ordinary groups remain supported for visual task organisation only.

Subtask IDs remain globally unique sequential integers across the whole lesson. Existing task IDs must not be renumbered after publication, because session state, reports, carry references, and learner persistence are keyed by task ID.

### 3.3 Sandbox shape

Each derived workspace sandbox starts from the first code task using that `moduleType`:

| Module type | Sandbox field |
|---|---|
| Python / Arcade Kit | `starterCode` |
| HTML | `starterFiles`, optional `entryFile` |
| Scratch | `starterBlocks`, optional `sprites`, `backdrops`, `toolbox` |
| Filesystem | `starterFs` |
| Electronics | `starterCircuit` |

The existing single-type lesson envelope fields remain supported only for single-type lessons. The composed runtime adapts a lesson-module sandbox into the selected module's existing `getSandboxState` contract.

## 4. Module resolution architecture

`composed` must not be registered as an ordinary lesson module because it has no editor, runner, check editor, or state format of its own. Instead, add a pure task-context resolver:

```js
getTaskContext(lesson, taskId) // { task, lessonModule, moduleType, module }
getTaskModule(lesson, taskId)  // registered module or null for global information/quiz
```

For a single-type lesson, `getTaskModule` returns the lesson's existing module. For a composed lesson, it resolves `task.moduleType`. All runtime, builder, teacher, and validation paths that currently select behaviour from `lesson.type` must use this resolver for a task.

The module interface remains unchanged. Modules continue to own their code-state shape, checks, stage creation, display selection, editor, live view, runtime, and carry update logic. The composed layer owns only task placement, module selection, sandbox scoping, and boundary validation.

## 5. Student experience and persistence

### 5.1 Navigation and workspace selection

Selecting a code task resolves its module and mounts the existing `StudentWorkspace` for that module. Lesson-wide information and quizzes render as they do today and do not create a code-state context.

Progress remains task-based, preserving the current sequential lesson flow. The platform does not require, generate, or display a concept-transition card; authors and pedagogical tooling decide whether to place information or quiz tasks between lesson modules.

### 5.2 Carry-through

The Builder only offers carry sources that:

1. precede the selected task;
2. are code tasks in the same `moduleId`; and
3. use the same lesson module `type`.

The existing module-owned carry field stays in use: `carryCodeFrom` for Python, Arcade Kit, and HTML; `carryBlocksFrom` for Scratch; `carryFsFrom` for Filesystem; and `carryCircuitFrom` for Electronics. The existing module-owned copy semantics determine what is carried.

The CLI and Builder must reject a carry reference that crosses a lesson-module boundary, including two lesson modules of the same type.

### 5.3 Lesson-module sandboxes

Entering a sandbox from a composed lesson opens the active lesson module's sandbox. Returning restores the active task. One lesson module's sandbox cannot overwrite, reset, or expose another lesson module's sandbox state.

New composed sandbox localStorage keys use the stable `moduleId` and do not change existing keys:

| State | Key pattern |
|---|---|
| Non-file sandbox state | `headstart_{lessonId}_module_{moduleId}_sandbox_{anonymousId}` |
| HTML sandbox file | `headstart_{lessonId}_module_{moduleId}_sandbox_{filename}_{anonymousId}` |

Task-work keys continue to use the existing task-ID-based patterns. In teacher presentation and Builder preview, sandbox state uses the existing ephemeral persistence adapter rather than browser localStorage.

### 5.4 Live sessions and reports

Teacher live view, remote reset, stage delivery, watched-student data, and output/check state resolve the module from the active task. A live payload records the resolved `moduleType` with its existing type-specific state so a stale payload cannot be rendered by the wrong workspace.

Session reports retain their existing task records. Adding denormalised module metadata to historic reporting is deliberately deferred; it does not affect lesson execution or single-type reports.

## 6. Builder and CLI requirements

### 6.1 Lesson Builder

Every new lesson is a `composed` lesson; the Builder does not offer a global lesson-type choice. A one-workspace lesson is simply a composed lesson with one lesson module. Existing single-type lessons remain editable in legacy compatibility mode and may only be converted through an explicit future conversion action. Its task list offers:

- add lesson-wide information task;
- add lesson-wide quiz task; and
- add lesson module, selecting a registered module type and title.

Within a selected lesson module, the existing `BuilderWorkspace`, check editor, stages, carry picker, assets, and sandbox editor render for that lesson module's module. The Builder may not move a code task outside a lesson module or between module types without an explicit conversion flow; version one should require creating a new task instead.

### 6.2 YAML and CLI

The YAML converter preserves each code task's `moduleType` selector:

```yaml
tasks:
  - moduleType: python
    title: Print a message
    starterCode: "print('Hello')"
```

CLI validation must:

- recognise `type: composed`;
- require every code task to select a registered workspace `moduleType`;
- apply each task's existing module-specific checks and field validation according to its effective module type;
- permit top-level information and quiz tasks;
- reject invalid workspace selections and cross-workspace carry-through; and
- preserve `moduleId` and task IDs on YAML round-trip and publish.

Builder validation remains the stricter browser-side validator. Both validation layers must agree on the composed structural rules even where their existing type-specific depth differs.

## 7. HTML and Scratch compatibility

HTML and Scratch are supported first-class lesson-module types. Neither becomes a shared Python workspace, and neither gains cross-module carry-through.

### 7.1 HTML lesson modules

An HTML lesson module uses the existing multi-file `HtmlEditor`, Blob-backed sandboxed iframe preview, asset browser, DOM checks, and teacher live view.

- HTML tasks retain `starterFiles`, `completeFiles`, `entryFile`, stages, HTML checks, and feedback checks.
- `carryCodeFrom` remains HTML's current filename-based file carry behaviour, but its source picker is restricted to earlier tasks in that HTML lesson module.
- Its lesson-module sandbox uses `sandbox.starterFiles` and optional `sandbox.entryFile`; it has its own localStorage namespace and never shares files with another HTML lesson module or a lesson-wide sandbox.
- Shared type assets and lesson assets continue to resolve normally for the active HTML task.
- Existing HTML support-stage behaviour remains available because it is a module capability, not a lesson-envelope capability.

No HTML task may carry files to Python, Arcade Kit, Electronics, Scratch, or another HTML lesson module.

### 7.2 Scratch lesson modules

A Scratch lesson module uses the existing Blockly workspace, sprites, backdrops, toolbox, custom interpreter, Scratch checks, and teacher live workspace.

- Scratch tasks retain `starterBlocks`, sprites, backdrops, variables, toolbox, complete state, and Scratch checks.
- `carryBlocksFrom` retains its existing project-copy behaviour: blocks plus sprites, backdrops, and variables. It is restricted to earlier tasks in the same Scratch lesson module.
- Its lesson-module sandbox uses `sandbox.starterBlocks` and optional sprite, backdrop, and toolbox configuration; it is isolated from every other Scratch lesson module.
- Scratch stage metadata remains preserved. Its current support-stage presentation limits remain unchanged; composed lessons do not add a student self-serve reference panel for Scratch stages.
- Scratch does not share block state with Python, Arcade Kit, Electronics, HTML, or another Scratch lesson module.

### 7.3 Standalone playground scope

The first standalone playground release covers Python, Arcade Kit, and Electronics only. HTML and Scratch remain eligible as composed lesson modules but are explicitly outside this playground release. Adding standalone HTML or Scratch later is a separate decision, because their multi-file/asset and project/toolbox persistence requirements need their own UX and storage design.

## 8. Standalone playgrounds

Add login-less routes:

| Route | Workspace |
|---|---|
| `/playground/python` | Python editor and output |
| `/playground/arcade` | Arcade Kit editor and game preview |
| `/playground/electronics` | Electronics workspace and MicroPython controls |

The landing page exposes a Playgrounds entry point. Playgrounds use the corresponding existing module workspace and local-only saved state, but have no lesson ID, task checks, teacher controls, session reports, teacher-live writes, lesson assets, or Realtime Database session.

Use separate keys such as `headstart_playground_{moduleType}_{anonymousId}`. Playground state must never collide with a lesson task or lesson-module sandbox key. Playground resets affect only their own key.

## 9. Compatibility, safety, and non-goals

- No Firebase backend or new dependency is introduced.
- Students remain login-less; playgrounds do not create lesson or session data.
- Existing localStorage key formats are never changed or migrated.
- Firebase writes remain limited to the active watched learner in a live session; playgrounds perform no session writes.
- Iframe rendering remains Run-triggered only; composed lessons must not re-render HTML previews on each keystroke.
- Firebase filename keys continue to use `encodeFileKey` and `decodeFileKey`.
- No automatic translation, synchronisation, or carry-through exists between Python, Arcade Kit, Electronics, HTML, Scratch, or Filesystem.
- Virtual OS/VFS work is not part of this feature.
- Admin lists lessons as one library rather than filtering by a single lesson type. New composed lessons use collection-scoped (`lessons`) levels; legacy type-scoped levels remain readable.

## 10. Delivery sequence and acceptance criteria

1. **Foundation:** add composed schema, task-context resolver, module-aware validation, and pure unit tests.
2. **Authoring:** add lesson-module creation/editing, scoped carry pickers, YAML conversion, and Builder preview support.
3. **Classroom:** route student, teacher, sandbox, live-view, persistence, stage, and report logic through task context.
4. **Playgrounds:** add the three local-only routes and landing-page entry point.
5. **Pilot:** author and test a Python -> Arcade Kit -> Electronics lesson.

Release is acceptable when:

- all existing single-type lesson tests pass unchanged;
- a composed lesson can contain at least Python, Arcade Kit, HTML, Scratch, Filesystem, and Electronics lesson modules;
- module-specific checks, stages, resets, teacher live view, and sandbox state work for each supported type;
- invalid task placement and cross-lesson-module carry-through fail in both CLI and Builder validation;
- HTML files and Scratch projects remain isolated across lesson-module boundaries; and
- the three playgrounds restore and reset only their own local state.
