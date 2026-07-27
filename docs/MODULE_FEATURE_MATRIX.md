# Lesson Module Feature Matrix

This is a product-facing overview of the six lesson modules registered in `src/modules/`. It records features that differ by module and clarifies the distinction between a **landing-page playground**, a **lesson sandbox**, and a teacher editing a student's current work.

## At a glance

| Module | Student experience | Landing-page playground | Lesson sandbox | View student work live | Directly edit one student's current work | Teacher-editable shared sandbox | Code stages | Student self-serve stage reference | Automatic completion checks | Carry work to a later task |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Python | Code editor, Run/Stop, console output | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Arcade Kit | Python game editor, pixel-game canvas, Run/Stop | Yes | Yes | Yes | No | Yes | Yes | No | Yes | Yes |
| HTML/CSS/JS | Multi-file editor and sandboxed webpage preview | No | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes |
| Scratch | Block editor, sprites, and stage canvas | No | Yes | Yes | Yes | Yes | Yes | No | Yes | Yes |
| Filesystem | Virtual file-manager workspace | No | Yes | Yes | No | Yes | Yes | No | Yes | Yes |
| Electronics | Breadboard, wiring, components, and optional MicroPython | Yes | Yes | Yes | No | Yes | Yes | No | Yes | Yes |

**Yes** means the feature is implemented. **No** means it is not currently available for that module.

## What the columns mean

| Feature | Meaning |
|---|---|
| Landing-page playground | A standalone, local-only workspace opened from the landing page. The currently available playgrounds are Python, Arcade Kit, and Electronics. |
| Lesson sandbox | A separate freeform workspace inside a lesson. Students can enter a personal sandbox; teachers can also switch a live class to sandbox mode. It is separate from the task workspace and task checks. |
| View student work live | A teacher can open a student's workspace from the student grid and inspect their current state. Python and HTML additionally support teacher code highlights with an optional note. |
| Directly edit one student's current work | Python and Scratch support a consent-based teacher edit: the teacher requests access, the student accepts, and the teacher can live-edit then commit that student's code or blocks. Other module views are read-only; teachers can still request a starter/stage/complete state, remotely reset a student, send a message or code highlight, or work in the shared sandbox. |
| Teacher-editable shared sandbox | In teacher-forced sandbox mode, the teacher can edit module state and push it to the whole class. This edits shared sandbox content, not an individual student's task work. |
| Code stages | Authors can define starter, support-stage, and complete states. Teachers can inspect stages and send an authored stage to the class. The state format is module-specific: code, files, blocks, filesystem, or circuit. |
| Student self-serve stage reference | After unsuccessful work, Python and HTML can offer an authored revealable stage as a read-only reference. For other modules, stages remain author/teacher tools rather than an automatic student reference panel. |
| Automatic completion checks | Each module supplies its own check editor and evaluator: Python/code checks, HTML element checks, Scratch block/state checks, filesystem checks, circuit checks, or Arcade code checks. |
| Carry work to a later task | A later task can use a previous task's completed state as its starter: source code for Python/Arcade, files for HTML, blocks for Scratch, filesystem state for Filesystem, and circuit state for Electronics. |

## Module-specific notes

| Module | Notable capabilities |
|---|---|
| Python | Runs Python through Pyodide; supports `input()`, output, tests, variable checks, downloadable `.launchpad` code files, revealable reference stages, and complete-code reference/solution flows. |
| Arcade Kit | Runs a Python pixel game in an isolated canvas; includes sprite, tilemap, tile-property, and object-spawn editing alongside source code. |
| HTML/CSS/JS | Supports multiple files and a Blob-backed, sandboxed iframe preview; completion checks can inspect page elements. |
| Scratch | Supports multi-sprite Blockly workspaces, costumes/backdrops, custom toolbox choices, and an in-browser Scratch-style runtime. |
| Filesystem | Simulates a Windows Explorer-style workspace with folders, files, rename, move, drag-and-drop, and text-file editing. |
| Electronics | Supports a visual breadboard, wiring, circuit simulation/checks, configurable components, and optional MicroPython GPIO control. |

## Shared lesson and classroom features

All six modules participate in the same lesson builder, teacher dashboard, student progress flow, session controls, session-only task editing, check feedback, personal sandbox flow, and teacher live broadcast infrastructure. The module determines the workspace and state type; the classroom features are shared.

## Sources of truth

- `src/modules/registry.js` lists the currently registered modules.
- Each module's `src/modules/<module>/index.js` declares its workspace, checks, sandbox state, stages, and carry-through behavior.
- `src/app/views/LandingPage.jsx` and `src/app/views/PlaygroundView.jsx` define the standalone playground choices.
- `src/app/views/teacher/TeacherEditorPanel.jsx` and `src/app/components/StudentModal.jsx` define the teacher sandbox and student-work views.
- `docs/agents/classroom-behaviours.md` explains sandbox, live viewing, and stage-reveal behavior.
