# Open short answer: teacher shows chosen answers on the presentation window

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-02
- **Lessons blocked:** none yet

## Need

Every lesson is gaining two optional live discussion tasks (opening 'Show and tell', closing 'Where could you use this?'), written as open short_answer quizzes with no check. Their purpose is social: the tutor reads answers and the class talks about them. Today answers appear only in the teacher's student grid, and 'Go Live for All' is hidden on quiz tasks, so the class can't see any answer. Wanted, for open (no-check) short_answer only: the teacher picks one or more answers to show on the presentation window, anonymised by default, like poll results. Graded quizzes keep the current rule (no broadcasting a student's answer).

Closest existing capability (from `lessons capabilities`): quizType: poll shows a live class split on the presentation window; open short_answer (quiz-tasks.md 'Open-ended (teacher review only)') shows answers only in the student grid; Go Live for All is hidden on quiz tasks (CHANGELOG, Binary/Keyboard/Mouse entry).

Current workaround and why it falls short: The tutor reads answers aloud from the grid. It works, but quieter students never see their own idea up on screen and the class can't respond to it, which is the whole point of the slot.

## Example task

    - type: quiz
      quizType: short_answer
      taskMode: live
      priority: optional
      title: Show and tell
      explainer: What have you made, tried or played with since last lesson?
      showResponses: teacher_picks   # new — teacher picks answers to show on the presentation window
      anonymiseResponses: true       # new — shown without names (teacher can turn names on per answer)
    

## Checks wanted

No check: these tasks are never marked. Session report should record which answers the teacher showed (optional).

## Devices

Presentation window only; nothing changes on student devices beyond what they see today.

## Notes

Lesson side: guides/Standard Lesson Format.md is gaining Discussion tasks (priority optional, ~1 min each, live only, not in Solo Challenges/Projects).

## Resolution

Branch `feature/short-answer-show-responses`: `quiz_short_answer` gains `showResponses: teacher_picks` and `anonymiseResponses` (default `true`), exactly as in the example task. In a live lesson each student card has **📺 Show** (and, once shown, a **👤** name toggle); the presentation window swaps the answer box for the picked answers. Graded short answers can't use it (validation error). The session report's task summary records `shownResponses[]`. New teacher-only RTDB node `sessions/{lessonId}/shownResponses` (needs `firebase deploy --only database`). Docs: [quiz-tasks.md](../quiz-tasks.md#showing-answers-on-the-presentation-window), [session-reports.md](../session-reports.md#ungraded-tasks).
