# Scratch check verification: per-check results from validate (or a Scratch test-checks)

- **Status:** resolved
- **Kind:** tooling
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

For Scratch, lessons validate returns valid: true with no per-check detail, and test-checks doesn't apply. Authors can't confirm each completion check passes the Complete stage, that feedbackChecks stay silent on it, or that a Debug task's blocking checks fire on its starter.

Closest existing capability (from `lessons capabilities`): lessons validate (covers Scratch completeBlocks/solution stages, output gives no per-check detail); lessons test-checks (Python code checks only).

Current workaround and why it falls short: Hand-read the Blockly JSON against each check. Checks ship verified by reasoning only, which is how over-strict blocks_in_order checks reached students.

## Notes

Lessons that hit this gap:

- scratch-1-5-solo task 7 (Level 1 Lesson 5 — Costume Change (Solo Challenge)): Tasks 7, 10, 11: blocks_in_order checks with fieldValues verified by hand
- scratch-1-5 (Level 1 Lesson 5 — Costume Change): All feedback and Debug blocking patterns checked against stages by reasoning only

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-29, and the scratch-1-5 write-lesson-checks entry's 'verified only by lessons validate' bullet).

## Resolution

Branch `feature/scratch-cli-check-verification`. Scope (Ryan): static checks only; run-time checks are reported as skipped.

- `lessons test-checks lesson.yaml` with no `--cases` verifies every Scratch task (by each task's own module): each completion check (`pass`/`fail`/`skipped`, with `sprite`, `reason` and the `actual` blocks on a fail) and each feedback check (`fires`/`silent`/`skipped`) against the `complete` blocks, the `starter` and each `complete:<label>` code stage. Warnings: a Complete stage fails a check; a feedback check fires on a Complete stage; the starter already passes; a Debug Code Task's blocking feedback checks all stay silent on the starter. `--task <id>` limits it to one task.
- `lessons validate` (and the Builder) warn `Task … complete solution fails a block check — review the complete blocks` and `Task … starter already passes every completion check — …`.
- The workspace's per-sprite dispatch moved to `src/modules/scratch/checkDispatch.js`, shared by the classroom and the CLI; `jsonWorkspace.js` wraps saved block JSON for Node.

Docs: [scratch.md](../scratch.md#verifying-scratch-checks), [validation-errors.md](../validation-errors.md#warnings-about-the-solution).
