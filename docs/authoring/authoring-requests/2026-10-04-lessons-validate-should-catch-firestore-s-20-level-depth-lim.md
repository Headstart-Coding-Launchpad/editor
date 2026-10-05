# lessons validate should catch Firestore's 20-level depth limit

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

lessons validate passes a lesson whose nested fields exceed Firestore's 20-level depth, and lessons upsert then fails with an opaque 'Input object is deeper than 20 levels' naming no task or field. Scratch prebuiltStacks[].stack is not serialised as text the way codeStages[].blocks is, so any stack over about 3 blocks hits it.

Closest existing capability (from `lessons capabilities`): lessons validate / preflight (no depth rule); codeStages[].blocks already serialised as text by the CLI.

Current workaround and why it falls short: Pre-place long Complete Example stacks in the starter workspace instead of prebuiltStacks, which contradicts the task's intent; the failure only appears at upsert and blocks the stage.

## Checks wanted

validate reports the offending path when any field nests deeper than Firestore allows; ideally prebuiltStacks[].stack is serialised like codeStages blocks.

## Notes

Lessons that hit this gap:

- scratch-1-2 (Scratch Level 1, Lesson 2 row): codeStages blocks 24 levels deep passed validate, failed upsert
- scratch-1-5 task 15 (Scratch Level 1, Lesson 5 row): 5-block prebuiltStacks stack failed upsert

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-07, plus the prebuiltStacks note under the Scratch Complete Example entry).

## Resolution

Branch `fix/authoring-docs-cli-batch`: `lessons validate` (and the Builder) measures the nesting depth of the lesson as stored and errors with the task and deepest path when it exceeds Firestore's limit (`src/shared/firestoreDepth.js`). `prebuiltStacks[].stack` (task, code stage, group subtask) is now stored as JSON text like `codeStages[].blocks`; older object stacks still load. Docs: [validation-errors.md](../validation-errors.md), [scratch.md](../scratch.md).
