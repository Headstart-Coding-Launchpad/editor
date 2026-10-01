# Scratch block checks that accept one of several opcodes

- **Status:** planned
- **Kind:** check type
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

blocks_in_order, block_used and block_count each take one exact opcode, so a check can't accept an equally-correct choice (turn right or turn left) at a sequence position.

Closest existing capability (from `lessons capabilities`): Scratch blocks_in_order / block_used / block_count (platform-docs/scratch.md).

Current workaround and why it falls short: Check an outcome instead (direction changed after Run, Say-block count), which can't confirm the block was placed correctly; or pin one opcode, which the Checks Writing Guide forbids for equally-correct choices.

## Example task

    check:
      type: blocks_in_order
      blocks:
        - opcode: [motion_turnright, motion_turnleft]

## Notes

Lessons that hit this gap:

- scratch-1-5 task 25 (Scratch Level 1, Lesson 5 row): Dancing Robot build (tasks 25-34); Ryan accepted either turn
- scratch-1-4-solo task 10 (Level 1 Lesson 4 — Turn and Move (Solo Challenge)): Tasks 10 and 11 accept turn right or turn left; used sprite_property_changed on direction, safe only because the toolbox is restricted

Migrated from the 2026-09-29 scratch-1-5 write-lesson-checks entry in Lesson Info/Missing Information.md.

## Resolution

Branch `feature/scratch-opcode-alternatives`: `block_used`, `block_run`, `block_count` and each `blocks_in_order` item accept `opcode` as a list of alternatives, in a short form (`[motion_turnright, motion_turnleft]` with shared `fieldValues`) or a long form (`{ opcode, fieldValues }` entries). Within a sequence the list goes under the item's `opcode:`; a bare list item is rejected because Firestore can't store a list inside a list. `block_count` adds up every alternative and ignores `fieldValues`. `block_run` passes when any alternative ran. Validation rejects empty or malformed lists and warns when a shared `fieldValues` key isn't a number/text input of every alternative. The Builder shows "any of: …" read-only. Docs: [scratch.md](../scratch.md#one-of-several-opcodes).
