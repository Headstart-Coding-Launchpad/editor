# Scratch Support stage: docs say markdown, every live lesson uses blocks

- **Status:** shipped
- **Kind:** docs
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

platform-docs/lesson-schema.md (Task Format Matrix) and scratch.md's stage-object paragraph say a Scratch Support stage uses markdown, but scratch.md's own JSON example and every live Scratch lesson use blocks. Code-writing agents can't tell which is real.

Closest existing capability (from `lessons capabilities`): platform-docs/lesson-schema.md Task Format Matrix; platform-docs/scratch.md.

Current workaround and why it falls short: Follow the live lessons (blocks) against the written docs; each run re-derives it.

## Checks wanted

Docs state the one real Support stage encoding for Scratch (and whether markdown renders at all).

## Notes

Lessons that hit this gap:

- scratch-1-3 (Scratch Level 1, Lesson 3 row)
- scratch-1-4 (Scratch Level 1, Lesson 4 row)

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-07).

### Decisions (Ryan, 2026-09-29)

- Docs-only fix. Both fields exist with different jobs: `markdown` is the student's read-only reference panel (`SupportStagePanel.jsx`); `blocks` is what applying or taking over the stage loads, and what the teacher's stage tab shows (`src/modules/scratch/definition.js`).
- Consequence: a Support stage with only `blocks` shows students an empty reference panel. The docs will say so, and live lessons like scratch-1-3 / scratch-1-4 need `markdown` added.

## Resolution

Branch `fix/scratch-support-stage-docs`: scratch.md Sprite Object now has a Support stage field table (`markdown` = student reference, `blocks` = replace + teacher tab); lesson-schema.md, classroom-behaviours.md and CHANGELOG updated. Checked 2026-09-29 with `lessons get`: scratch-1-3 has 8 and scratch-1-4 has 9 Support stages, none with `markdown`, so students currently get an empty reference panel from all 17. Those lessons need `markdown` added.

Merged to main in `fc94c03` (2026-09-29).
