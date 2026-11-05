# Picture answer options in multiple-choice quizzes

- **Status:** planned
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-11-05
- **Lessons blocked:** none yet

## Need

Ryan (5 Nov 13:13): v13 quizzes should be visual first, so students pick a picture as the answer (which picture will this code draw?). Lesson 1 tasks 17 and 47 want four Stage pictures as the four options.

Closest existing capability (from `lessons capabilities`): Multiple choice (quiz-tasks.md): options[].text is Markdown, so an image link may render, but picture options are not documented (layout, size, alt text, a 2x2 grid, tap target on iPad).

Current workaround and why it falls short: One labelled image in the explainer holding all four pictures, with short word options matching the labels. Works, but the student reads a label rather than picking the picture itself.

## Fun moment

The student looks at four pictures and taps the one their prediction says the code will draw, then sees it confirmed on the Stage; first used in Level A Lesson 1 (Which Corner?).

## Notes

Lessons that hit this gap:

- hlrv9r2gtg task 17 (Level A Lesson 1 - Commands, Name in Lights): Which Corner? and Which Is on Top? use a combined labelled image for now.

## Resolution

Built on branch `feature/picture-quiz-options` (not merged; waiting on Ryan). Activity:
`quiz_multiple_choice`. Options take `image` (an https lesson-asset URL) or `emoji`, with
required `alt` and an optional `text` caption; 2 to 4 equal picture cards, one tap chooses and
submits, the stored answer is still the option id. Tutor card thumbnail, modal reveal, report
and print labels (caption, else alt, else id). No picture polls, no per-option mini Stage and
no shuffle in v1; the Builder per-option picture picker is a later phase. Docs:
[quiz-tasks.md](../quiz-tasks.md#picture-options).
