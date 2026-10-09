# Session report: per-student typing rate, corrections and copy accuracy on code tasks

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Ryan sees the same one or two students fall 3+ minutes behind on code tasks in lockstep lessons, through slow typing and miscopying. The report's timeOnTaskMs runs from when the class moves onto the task to the student's pass, so it mixes typing, reading, thinking, errors and idle time. It can't tell a slow typist from a slow reader or a stuck student, which need different fixes (Typing for Coders proposal vs explainer/scaffold changes). A 2026-10-08 analysis of 39 Python reports found Copy the Code has the biggest gap between the median and slowest student (median gap 1.7 min, 15% of tasks 3+ min) and the typing estimate (1 + chars/120 min) under-estimates the slowest student about 2x, but couldn't check the 120 chars/min rate because nothing records typing speed or copyCode length.

Closest existing capability (from `lessons capabilities`): session-reports.md per-student task fields: timeOnTaskMs, timeToFirstEditMs, pastes {count, chars}; task summary avgTimeOnTaskMs and timeToFirstEdit {median,min,max}. No keystroke/typing measures, no correction count, no comparison against copyCode, and no spread (median/p90/max) of timeOnTaskMs.

Current workaround and why it falls short: Work the spread out by hand from raw reports' timeOnTaskMs (done once, 2026-10-08) and estimate typing from copyCode length. Fails the Lesson Writing Guide's typing-volume calibration (it can only be fitted to the class mean, not the slowest typist who sets lockstep pace) and leaves the tutor guessing whether to recommend typing practice or fix the lesson.

## Example task

    # Session report, graded code task, per student (new fields):
    students:
      - studentLabel: Student 2
        timeOnTaskMs: 342000
        typing:                       # omitted when the student typed nothing
          charsTyped: 148             # characters inserted by keystrokes (not pastes, not autocomplete)
          activeTypingMs: 151000      # time in typing bursts; a gap > 5 s ends a burst
          charsPerMin: 59             # charsTyped / activeTypingMs
          corrections: 23             # Backspace/Delete presses
          longestPauseMs: 48000
          autocompleteAccepts: 2
          copyDistance: 4             # copyCode tasks only: edit distance between copyCode and the
                                      # student's code at their first Run, ignoring trailing whitespace
    # Task summary (new fields):
    typingSummary:
      charsPerMin: { medianPerMin: 104, minPerMin: 59, maxPerMin: 141, studentCount: 4 }
      correctionsMedian: 9
    timeOnTaskSpread: { medianMs: 140000, maxMs: 342000, p90Ms: 300000, studentCount: 4 }
    

## Checks wanted

Not a check type: report fields only. Wanted on every graded code task (Python, Turtle, HTML; Scratch has no typing, except text fields, and can omit `typing`):
- Per student `typing` block as in the example. Timed on the student's device, like timeToFirstEditMs.
- Task summary `typingSummary` and `timeOnTaskSpread` (median, p90, max of timeOnTaskMs), so the gap between the median and the slowest student is in the report rather than worked out by hand.
- Optional: the teacher's live card shows a small typing-rate figure, so the tutor can see who is slow-typing vs stuck while it happens.
Privacy: stays anonymous like the rest of the report (studentLabel only).


## Devices

Keyboard devices only; omit typing on touch devices (on-screen keyboard speeds aren't comparable). Mac and Chromebook as for any keyboard.

## Notes

Uses: recalibrate the typing-volume estimate; choose tasks for side-quests (Request #49); spot students to recommend for the proposed Typing for Coders course (Proposed Courses/Typing for Coders.md). Typing history across lessons is a separate backlog item (P09) and not part of this.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
