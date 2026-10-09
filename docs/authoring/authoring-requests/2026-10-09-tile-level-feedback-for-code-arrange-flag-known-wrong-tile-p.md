# Tile-level feedback for code_arrange: flag known-wrong tile placements per blank before the run

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

In multi-blank code_arrange tasks students drag a piece meant for one blank into another, or drag a misconception distractor (e.g. {"pet"} inside an f-string), and get the same whole-program hint either way, so they fire rapid guesses instead of reasoning (Known Misconceptions - Python: 'A piece meant for one blank of a multi-blank arrange task lands in a different blank', seen in Python Levels 1, 2B, 3B and 4B; and 'A variable's name printed as text', 27 mentions across 4 levels, many inside arrange tasks). Students need to be told which blank is wrong and why, from the tiles themselves. Completion must stay run-based so tasks with more than one valid arrangement still pass.

Closest existing capability (from `lessons capabilities`): code_arrange (platform-docs/lesson-schema.md, Code Arrange Task Fields): completion runs the assembled program against check and deliberately does not match tile identity or order; feedbackChecks also run only on the assembled text; tile placements are not recorded in attempts. It lacks any per-tile or per-blank feedback and any record of which tile went where.

Current workaround and why it falls short: One code-pattern feedbackCheck per line containing a blank, naming that line. It fails when the wrong piece still produces text a pattern can't tell apart from the right one (Level 2B Lesson 6 task 22: 7 of 8 never passed, the message-order hint never showed in 22 attempts), and it can't attach a hint to a specific distractor. It also leaves review-lesson-reports unable to see tile placements.

## Example task

    type: code_arrange
    moduleType: python
    lines:
      - id: l1
        parts:
          - {type: text, text: "score = "}
          - {type: slot, id: s1, code: "int", wrongTiles: [{tileId: s3, hint: "That one updates a total. Which piece turns typed text into a number?"}]}
          - {type: text, text: "(code_text)"}
      - id: l2
        parts:
          - {type: text, text: "print(f\"Welcome back, "}
          - {type: slot, id: s2, code: "{pet}"}
          - {type: text, text: "!\")"}
      - id: l3
        parts:
          - {type: slot, id: s4, code: "a = 1", alsoAccepts: [s5]}
      - id: l4
        parts:
          - {type: slot, id: s5, code: "b = 2", alsoAccepts: [s4]}
    distractors:
      - {id: d1, code: "{\"pet\"}", hint: "Quote marks mean 'use exactly this text'. Do you want the word pet, or what the name tag pet is stuck to?"}
    check:
      - {type: output, equals: "..."}
    

## Checks wanted

Outcome checks:
- A distractor tile in any blank shows that distractor's hint (or a default "this piece doesn't belong in this program" if it has none) when the student presses Run, and the blank holding it is highlighted.
- A correct tile placed in a blank whose wrongTiles lists it shows that entry's hint and highlights that blank.
- A correct tile in a blank that is neither its own nor listed in that blank's alsoAccepts or wrongTiles is NOT flagged by tile feedback: completion is still decided only by running the program against `check`, so arrangements that give the right result (e.g. independent lines swapped) still pass.
- Tiles listed in alsoAccepts are never flagged in that blank.
- When tile feedback fires, it is shown before (or instead of) the run-based feedbackChecks for that attempt, and the attempt still counts as an attempt in the session report.
- Session reports record each attempt's tile placements (blank id -> tile id), alongside the assembled submission text, so review-lesson-reports can tell a wrong-blank guess from a wrong-content guess.
- All three new fields are optional; existing code_arrange lessons behave exactly as today.
- New fields are sealed with the other code_arrange answer fields.
Method (optional): validation warns if a wrongTiles or alsoAccepts tileId doesn't exist in the task's pool, and if a tile is in both lists for the same blank.


## Devices

Same as existing code_arrange drag-and-drop on touch screens, tablets, Macs and Chromebooks; the highlighted blank must be visible without hover.

## Notes

From the 2026-10-09 misconception review (Plans/P5 Making concepts stick.md, section D). New optional fields: distractors[].hint, slot wrongTiles: [{tileId, hint}], slot alsoAccepts: [tileId]. Tile feedback only flags known-wrong placements, never 'not the authored tile'.

## Resolution

Shipped on branch `feature/code-arrange-tile-feedback` (activity `code_arrange`). Decisions made
with Ryan that differ from the request above: tile hints show **on drop** (the moment a tile lands
in a blank, like fill-in-the-blank), not on Run, and a flagged drop is logged as a tile miss
(`tileMisses`), **not** counted as an attempt. Run stays available and completion stays run-based.
Tile feedback is opt-in per task (a task with none of the three fields flags nothing), so existing
lessons are unchanged. Docs: [lesson-schema.md](../lesson-schema.md) "Tile feedback",
[session-reports.md](../session-reports.md) (`tileMisses`, `distinctAttempts[].placements`),
[CHANGELOG.md](../CHANGELOG.md) 2026-10-09.
