# Typing history: speed and accuracy across lessons on the student card

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Typing for Coders is sold on visible progress: each lesson ends with a timed challenge against the student's own last score, and Lesson 12 compares with Lesson 1. Students and parents need to see the improvement. Imports backlog item P09 (its typing-history part; the home-row finger guide stays in the backlog).

Closest existing capability (from `lessons capabilities`): Keyboard type_text with targetWpm (keyboard.md): shows speed for one attempt; 'No history is kept between lessons'. Session reports use per-session Student N labels, so nothing links a student across lessons.

Current workaround and why it falls short: The tutor notes each student's score by hand each week. Fails Typing for Coders' per-lesson 'beat your last score' challenge and Lesson 12's comparison with Lesson 1 (§6), and gives parents no progress record.

## Example task

    # No new lesson fields: history is collected from every Keyboard type_text / type_code item
    # (and the falling-words game) and shown on the student card and to the student.
    - type: activity
      activity: keyboard
      title: Timed challenge
      mode: type_code
      showHistory: true           # optional: show "last time: 62 cpm, 91%" beside the item
      items:
        - code: print("Ready")
    

## Checks wanted

- Per student, stored across lessons: date, lesson, mode, characters a minute (and words a minute), accuracy, corrections.
- Student sees their last score and best score on typing items (showHistory), plus a simple trend ("you went from 40 to 75 characters a minute").
- Teacher sees the same on the student card, and the session report carries each student's score next to their previous one.
- Needs a stable per-student identity across lessons (today reports use per-session Student N labels), so history lives on the student record, not in the anonymous report.


## Devices

Physical keyboard required; omit or block on touch devices (on-screen keyboards hide symbols). Mac: Cmd for Ctrl as elsewhere; note keyboard.md's known UK Mac symbol layout gap.

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- Typing for Coders (Typing for Coders.md §6 every lesson's timed challenge; Lesson 12 comparison with Lesson 1): Shows each student their last and best score in every lesson.

## Resolution

Shipped 2026-10-14 on `feature/typing-history` (package W3-b of the 2026-10-14 build plan). Activity: `keyboard`.

- Tutor-mediated, on the class roster: the tutor's browser saves each matched student's finished `type_text`, `type_code` and `falling_words` results to `classes/{classId}/roster/{rosterId}/typing` (one entry per finished attempt; results from before the match are saved once matched). Unmatched students or "No class" save nothing.
- New `showHistory` field (task, and per item on `type_text` / `type_code`): "Last time: 62 cpm, 91% · Best: 75 cpm" beside the item, and "You went from 40 to 75 characters a minute." after finishing. History is pushed to the student by the tutor (`sessions/{lessonId}/typingHistory/{anonymousId}`).
- Tutor: card line and StudentModal "Typing history" list. Report: `tasks[].typingHistory` with the previous and best scores, anonymised. Admin → Classes → Students → Typing lists a student's scores.
- Docs: [keyboard.md](../activities/keyboard.md#typing-history-showhistory), [session-reports.md](../session-reports.md#typing-history), CHANGELOG 2026-10-14.
