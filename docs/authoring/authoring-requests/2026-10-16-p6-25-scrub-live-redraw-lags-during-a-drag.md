# Bug: live scrub redraw seems to wait until the drag stops

- **Status:** open
- **Kind:** bug
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–21), 2026-10-16
- **Lessons blocked:** none. Affects the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), task 21 "Slide the Sentence".

## What the docs say

`docs/authoring/python.md`, Live scrubbing: "While a value moves, the program re-runs about every 200 ms, as a preview … Only programs that draw on the Stage … and don't call `input()` re-run live."

## What Ryan saw

Ryan's click-through, 2026-10-16, on Draft `caakmdqj5j`: "It doesn't feel like 200ms, feels a lot longer. It feels like only if you stop dragging." So the picture seems to update only when the pointer pauses or the drag ends, not continuously while it moves. He asked for it to redraw while dragging, "this might need some limiting", so that students can drag and watch it change.

## Steps to reproduce

1. Open task 21 of `caakmdqj5j` in the Builder preview, or as a student. Its starter has no `input()`:
   ```python
   from stage import *
   snack = "popcorn"
   place = "the cinema"
   sentence = f"I love {snack} at {place}"
   text(sentence, "navy", y=200, size=24)
   ```
2. Press Run so the Stage shows.
3. Drag the `200` left and right without stopping.

**Expected:** the sentence moves while the drag is still going, a few times a second.
**Seen:** it seems to redraw only when the drag pauses or ends.

## What's wanted

- Live redraw during continuous movement, throttled so it stays smooth. Pyodide start-up per preview may be the cost, so re-using a warm interpreter or a draw-only fast path for Stage programs might help. Dev's call.
- If 200 ms isn't reachable, correct the docs to say what students will actually see.

## Notes

- It may be slower on Ryan's machine or in the Builder preview than in the student view, so please check both.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`.
