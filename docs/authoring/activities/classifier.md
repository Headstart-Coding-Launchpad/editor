# Classifier Activity

A Classifier task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. Students **draw examples** of each class, **train** a model
(instant), then **test** it on drawings it has not seen and read its accuracy ("7 of 9 right,
78%"). It teaches "a model learns from examples": more and better examples give a better model,
and testing on new data is how you know. There is no Run button, no personal sandbox, no sharing
and no carry-through. The task is marked when the student presses **Check my work**.

Write `type: classifier` on the task (the YAML shorthand for `taskType: activity` +
`activityType: classifier`, which also works). In the Builder, choose the **Activity** format and
pick **Classifier**: the editor sets the classes, the test set and the numbers, and you can draw
your own test drawings on a pad. The task's `title` and `description` / `explainer` show
above the activity.

Only **drawing** mode is built. `mode: sound` is rejected by validation ("not built yet") and
webcam mode does not exist.

## Complete example

```yaml
id: classifier-shapes
type: python
title: Teach a Computer Shapes
description: Train a classifier on your own drawings, then print a result in Python.
tasks:
  - title: Circles and lines
    type: classifier
    description: Draw lots of circles and lines, train the model, then test it.
    mode: drawing
    classes: [circle, line]
    minExamplesPerClass: 8
    testSet: teacher
    targetAccuracy: 0.8
    testItems:
      - label: circle
        strokes:
          - [0.5, 0.2, 0.7, 0.3, 0.8, 0.5, 0.7, 0.7, 0.5, 0.8, 0.3, 0.7, 0.2, 0.5, 0.3, 0.3, 0.5, 0.2]
      - label: circle
        strokes:
          - [0.5, 0.1, 0.8, 0.3, 0.9, 0.5, 0.8, 0.8, 0.5, 0.9, 0.2, 0.8, 0.1, 0.5, 0.2, 0.3, 0.5, 0.1]
      - label: line
        strokes:
          - [0.1, 0.5, 0.9, 0.5]
      - label: line
        strokes:
          - [0.2, 0.9, 0.8, 0.1]
  - title: Name your own classes
    type: classifier
    description: Pick two things to tell apart, draw examples and test the model.
    mode: drawing
    minExamplesPerClass: 8
    testSet: held_out
    targetAccuracy: 0.75
  - title: Test it live
    type: classifier
    mode: drawing
    classes: [smile, frown]
    minExamplesPerClass: 6
    testSet: live
    liveTestSize: 6
    targetAccuracy: 0.8
  - title: Print a result
    starterCode: |
      print("My model scored 80%")
    check:
      type: output
      operator: contains
      value: "80%"
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `classifier` in YAML (JSON: `taskType: activity` + `activityType: classifier`) |
| `mode` | Yes | `drawing`. (`sound` is not built yet and fails validation; webcam is not planned.) |
| `testSet` | Yes | What the model is tested on: `held_out`, `teacher` or `live` (see [Testing](#testing)). |
| `classes` | No | The class names: 2 to 6 different names, each 1 to 16 characters. Leave it out (or `[]`) and the student names their own, 2 to 6. |
| `minExamplesPerClass` | No | Drawings every class needs before the task can pass: a whole number from 2 to 40. Default `6`. With `held_out` it must be at least `4`. |
| `targetAccuracy` | No | The share of the test the model must get right, above 0 and up to 1 (`0.8` is 80%). Default `0.8`. |
| `liveTestSize` | No | `testSet: live` only: how many new drawings the student tests, 3 to 20. Default `5`. |
| `testItems` | `teacher` | `testSet: teacher` only: 2 to 24 test drawings (see below). |

## How it works for the student

1. **Collect drawings.** The student picks a class and draws on a square pad with a mouse,
   finger or pen, then presses **Add this drawing**. Drawings can be removed again from the
   gallery. With no `classes`, the student names 2 to 6 classes first (a name is fixed once the
   class has a drawing).
2. **Train the model.** Instant. Needs at least 2 drawings in every class. Any change to the
   drawings afterwards means training and testing again.
3. **Test the model.** The model labels drawings it was not trained on, and the student sees
   "7 of 9 right, 78%", the target, and a sentence per class ("cat: 3 of 4 right. 1 was called
   fish."), which is the confusion table in words.
4. **Check my work** hands it in. It passes when the model reached `targetAccuracy` on the test
   and every class has at least `minExamplesPerClass` drawings.

### How the model works

Each drawing is shrunk to a **16 x 16 greyscale grid** (256 numbers, 0 = empty to 1 = ink),
after being moved and scaled to fill the grid, so where or how big it was drawn does not matter.
The classifier is **k-nearest-neighbours with k = 3**: to label a new drawing it finds the 3
training drawings whose grids are closest (straight-line distance), and takes a vote; a tie goes
to the label whose drawings are closer. Nothing is downloaded and there is no machine-learning
library: it runs in the browser in a few milliseconds.

## Testing

| `testSet` | The model is tested on | Notes |
|---|---|---|
| `held_out` | The student's own drawings that were kept back | **Every 4th drawing in a class (the 4th, 8th, 12th, …) is kept back** and never used for training. They are marked "Test" in the gallery, and the pad says when the next one will be kept back. Needs `minExamplesPerClass` of at least 4. |
| `teacher` | Test drawings you write in `testItems` | The same test for every student, so results compare. Needs `classes`. Every drawing is used for training. |
| `live` | New drawings the student makes during the test | The student draws something new and says what it really is; the model's guess is recorded. The result appears after `liveTestSize` drawings (more can be added). |

### Writing `testItems`

Each test drawing has a `label` (one of the `classes`) and **either** `strokes` **or** `grid`:

| Field | Notes |
|---|---|
| `label` | Required. The true class; it must be one of `classes`. |
| `strokes` | A list of strokes. Each stroke is a flat list of numbers `x1, y1, x2, y2, …` between 0 and 1, from the top-left of the pad (`0.5, 0.5` is the middle). At least one point per stroke. The drawing is scaled to fit the grid, so size and position do not matter. |
| `grid` | Exactly 16 strings of exactly 16 characters: `.` empty, `#` full ink, digits `0`–`9` for shades. Quote each row. |

The test drawings give the answers away (the labels), so `testItems` is **sealed** in the public
lesson document like other answer fields. Validation warns when a class has no test drawing.

## Marking and hints

- The task passes when the model is **trained**, the latest test reached `targetAccuracy`, and
  every class has at least `minExamplesPerClass` drawings. Check results appear in the usual
  feedback banner and next to the button.
- Hints name the first thing missing, in plain words and without giving anything away: "Draw
  more cat: you have 3 and need 8.", "Press Train so the model can learn from your drawings.",
  "Press Test to see how the model does on drawings it has not seen.", "The model got 60% and
  needs 80%. Try more drawings in different sizes and shapes, then train and test again."
- Progress per class (`itemProgress`) counts the classes that have enough drawings.

## Privacy: what is kept where

- The drawings (and their grids) are saved **only on the student's device**, in the activity's
  usual per-task localStorage file (`headstart_{lessonId}_{taskId}___activity_state___{id}`). They
  are never written to Firebase, the attempt log, the session report or a Go Live broadcast.
- What is sent (the activity's `serializeShared`, about 200 to 1,500 bytes): the class names, the
  **number of drawings per class**, whether the model is **trained**, the latest **test result**
  (right, total and the confusion counts: how many of each true class were labelled as which),
  how many live test drawings are done, and how many times the student has tested. No images,
  no thumbnails.
- If the student's device storage is cleared, their drawings are gone and they start again.

## Teacher tools

- **Student card:** `12 drawings, 78% on test` (or `not trained` / `trained` / `No drawings
  yet`). Updates as drawings are added, and when the student trains or tests (not while drawing,
  and not per stroke).
- **Student modal:** per-class counts against the minimum (with a tick), whether the model is
  trained, and the test result with a line per class. This is the live view of how each student
  is doing before they hand anything in; the existing hint and nudge tools work on it as on any
  other task. The drawings themselves are not visible, because they never leave the device.
- **Session report:** per student the latest attempt (counts, trained, result), the usual
  per-class item progress, and for the task a `classifierResults` summary: how many students
  tested, how many reached the target, the average accuracy and the confusion counts added up
  across the class (true class → labelled class → count). Read it to see which classes the
  class's models mix up.
- **Stage → Start again** clears the student's drawings and results. **Complete (show answers)**
  fills in a finished summary (no drawings). There is no **Edit answers**: the drawings are on
  the student's device.
- Go Live on an activity task is teacher-only: a student's work is never broadcast.

## Devices

Drawing works with a mouse, a finger or a pen (Pointer Events), so Chromebooks and tablets are
fine. Drawing itself needs a pointer; everything else (choosing a class, adding, removing,
training, testing, checking) is a normal button, at least 44 px, and works from the keyboard.
Results are always written out, never shown by colour alone.

## Validation

Every Classifier validation message is listed under "Activity tasks" in
[validation-errors.md](../validation-errors.md).
