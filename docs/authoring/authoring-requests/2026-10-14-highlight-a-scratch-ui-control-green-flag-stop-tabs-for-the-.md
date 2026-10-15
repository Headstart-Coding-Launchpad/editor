# Highlight a Scratch UI control (green flag, stop, tabs) for the class

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Tutors want to point students at a specific Scratch control, such as the green flag, stop sign, Costumes tab or a block category, while teaching. Tutor feedback 2026-10-13: 'Would be good to be able to highlight different buttons like the green flag etc'.

Closest existing capability (from `lessons capabilities`): Scratch module (scratch.md): explainers can show scratch-markdown blocks and images, and toolbox XML can restrict categories, but nothing can spotlight or pulse a UI control on the student's screen, from the lesson or from the tutor live.

Current workaround and why it falls short: A screenshot in the explainer, or the tutor pointing at the projector. Younger Scratch students (Level 1) still miss the control on their own screen, so they can't run or check the task.

## Example task

    highlight: { target: green_flag }   # task-level: pulse the control when the task opens; plus a live tutor button 'Highlight ▸ green flag / stop / costumes tab / sounds tab / <category>' that pulses it on every student's screen

## Notes

From tutor feedback relayed by Ryan, 2026-10-13. Could apply to other modules' Run buttons too.

## Resolution

Shipped on branch `feature/highlight-ui-controls` (2026-10-14).

- **Task field `highlight`** (string or `{ target }`), on code tasks: pulses the control once per
  task per student when the task opens, until it's used or for 20 s (still outline with reduced
  motion). Validation rejects unknown targets for the task's effective module.
- **Targets** (each module's `capabilities.highlightTargets`): `run`, `stop` on python, turtle,
  arcade, electronics; `run` on html; scratch `green_flag` (alias `run`), `stop`,
  `costumes_tab`, `sounds_tab`, `category:<Motion|Looks|Sound|Events|Control|Sensing|Operators|Variables|My Blocks>`.
- **Live tutor menu:** "Highlight Class" in TeacherView's top bar (whole class) and More →
  Highlight in StudentModal (one student). RTDB `teacherClassControlHighlight` /
  `students/{id}/teacherControlHighlight`, under the existing rules.
- A control on a hidden compact tab, collapsed stage or hidden palette points at the way to it.
- Docs: [scratch.md](../scratch.md#highlighting-a-control), [lesson-schema.md](../lesson-schema.md),
  [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md), [CHANGELOG](../CHANGELOG.md).
