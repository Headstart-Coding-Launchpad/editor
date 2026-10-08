# Show indentation depth in the Python editor (indent guides or block shading)

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-08
- **Lessons blocked:** none yet

## Need

Students can't see which block a line belongs to once nesting goes two levels deep. Python Level 1 Lesson 10 (all 3 students, tasks 19 and 31) and Lesson 12 (both students, tasks 16, 17, 23, 24 and 28) miscounted indentation depth; the same Known Misconception is recorded at Level 4B. Ryan wants 'Something that would make it clearer what indentation level is' in the editor itself.

Closest existing capability (from `lessons capabilities`): Python code editor (lessons capabilities: Python module, teacherEditor). Request #26 (shipped) lets a check see nesting depth, but nothing shows the student the depth while typing.

Current workaround and why it falls short: Explainers and diagrams stating each depth, arrange tasks with wrong-depth distractors and depth hints. Fails Python Level 1 Lesson 10's New Concept (nested if) and Lesson 12's project steps: the explainer already states both depths (Lesson 12 task 23) and students still failed production after passing the recognition rungs.

## Notes

Lessons that hit this gap:

- python-1-10 task 31 (Level 1 Lesson 10 — Nested If (If checks inside ifs)): All 3 students miscounted the inner print's depth on task 31 (one needed 8 attempts); Lesson 12 showed the same in a 30-line carried program.
- python-1-12 task 23 (Level 1 Lesson 12 — Choose Your Own Adventure - Part 2): Both students miscounted depth inside the inner if in a 30-line carried program (task 23 at 2.1x estimate) although the explainer states both depths.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->

Shipped 2026-10-08 (merge of `feature/indent-brackets` to main). Built as a feature of the existing
Python editor, not a new module: coloured block brackets beside the lines each `:` line controls,
coloured by depth (elif/else share their if's colour), with the colon tinted to match. On by
default in Python, Turtle, Arcade Kit and Electronics (MicroPython) editors; the editor's
**Blocks** button hides them per device; new task field `showBlocks: false` (Builder: **Block
brackets** checkbox) hides the brackets and the button. Docs: python.md "Block brackets",
lesson-schema.md `showBlocks`, CHANGELOG 2026-10-08. The code_arrange indent mode request will
reuse the same bracket colours.
