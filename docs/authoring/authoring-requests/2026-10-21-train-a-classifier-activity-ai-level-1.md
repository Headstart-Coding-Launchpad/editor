# Train-a-Classifier activity (AI Level 1)

- **Status:** planned
- **Kind:** activity
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

AI Level 1 Lessons 1-3 and 11-12 teach 'a model learns from examples': students collect labelled examples, train, then test on data the model hasn't seen and explain accuracy. Needs an in-browser classifier (TF.js transfer learning or k-NN) in drawing and sound modes; data never leaves the device; no faces. Backlog P42.

Closest existing capability (from `lessons capabilities`): Activity registry (binary, keyboard, mouse): self-marking with itemProgress, but nothing that trains or tests a model.

Current workaround and why it falls short: Quizzes and a rule-based Python chatbot. Fails Lesson 2's objective (classifier reaches a target accuracy on a test set) and Lessons 11-12's own-dataset project: nothing is trained.

## Example task

    - type: activity
      activityType: classifier
      mode: drawing            # drawing | sound (webcam left out for now)
      classes: [cat, fish, rocket]   # lesson-set labels; empty = student names their own
      minExamplesPerClass: 8
      testSet: teacher         # teacher | held_out (student's own examples kept back)
      targetAccuracy: 0.8
    

## Checks wanted

Outcome: the student's model reaches targetAccuracy on the test set (teacher's or held-out). Optional: every class has at least minExamplesPerClass examples (Lesson 11's "at least 3 balanced classes"). Report itemProgress per class and the final accuracy and confusion counts to the teacher card and session report.


## Devices

Must run on ordinary Chromebooks and tablets. Drawing mode works by touch or mouse; sound mode needs a microphone. Webcam mode left out until Ryan decides (AI proposal §10 question 8).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (AI Literacy and AI Builders.md §7 AI Level 1 Lessons 1-3, 11-12): Core activity for AI Level 1, January 2027

Cut to three activities for January (Hub-logged default yes, 2026-10-21). Bias Explorer (P47) later reuses this.

## Resolution

Built on branch `feature/classifier-activity` (not merged; waiting on Ryan's merge OK, 2026-10-22).
Activity id `classifier`, docs: [activities/classifier.md](../activities/classifier.md).

- **Drawing mode is complete.** Pointer-event drawing pad (mouse, touch, pen), drawings shrunk to
  a 16 x 16 greyscale grid, in-house k-nearest-neighbours (k = 3, no new dependency), instant
  Train, accuracy as "7 of 9 right, 78%" plus a confusion table in words.
- **Test sets:** `held_out` (every 4th drawing in a class is kept back), `teacher` (authored
  `testItems`: `label` + `strokes` as flat `x, y` lists in 0 to 1, or a 16 x 16 `grid`), and
  `live` (the student draws new test drawings one at a time, `liveTestSize`).
- **Fields:** `mode`, `testSet`, `classes` (empty = student names 2 to 6), `minExamplesPerClass`,
  `targetAccuracy`, `liveTestSize`, `testItems`. Outcome passes when the model reaches
  `targetAccuracy` on the test and every class has at least `minExamplesPerClass`. Per-class
  `itemProgress`, final accuracy and confusion counts go to the tutor card and the session report.
- **Privacy:** drawings stay in the device's per-task activity-state localStorage file. What goes
  to Firebase (via a new optional `serializeShared` hook in the activity contract, default
  unchanged for every other activity): class names, drawings per class, trained, test result with
  confusion counts, live-test progress. No thumbnails (the live-sync string is a single small
  field, so counts only). Tutors cannot see the drawings, so there is no Edit answers.
- **Left out:** `mode: sound` is NOT built (validation says "not built yet"); no webcam mode
  (Ryan's open question 8).
- The Builder has an editor (classes, test set, numbers, and a pad to draw teacher test drawings).
- Needs no database rules change (same `currentAnswer` field as every activity).

