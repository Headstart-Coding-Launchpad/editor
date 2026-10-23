# Classifier Activity

A Classifier task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. The student **teaches the pad a few things** by drawing them
(for example 3 cats, 3 fish, 3 rockets), then watches it **guess live** as they draw, with a bar
per thing. Then comes **the round**: the pad asks for a thing ("Draw a 🐟, will it get it?"), the
student draws it and presses **Done**, and it is a tick or a miss. A miss can be taught in one tap
("Teach it this one"). It teaches "a model learns from examples, so it only knows what it was
shown". There is no Train button, no Run button, no personal sandbox, no sharing and no
carry-through. The task is **marked as you go**: it passes the moment the round's goal is met
(there is no Check my work button).

Write `type: classifier` on the task (the YAML shorthand for `taskType: activity` +
`activityType: classifier`, which also works). In the Builder, choose the **Activity** format and
pick **Classifier**: the editor sets the things, the test, the numbers and the extra panels. The
task's `title` and `description` / `explainer` show above the activity.

Only **drawing** mode is built. `mode: sound` is rejected by validation ("not built yet") and
webcam mode does not exist.

## Complete example

```yaml
id: classifier-first
type: python
title: Teach a Computer Doodles
description: Teach the pad three doodles, then try to fool it.
tasks:
  - title: Teach it three doodles
    type: classifier
    description: Draw 3 of each thing. Then see if it can guess your doodles.
    mode: drawing
    classes: ["🐱 cat", "🐟 fish", "🚀 rocket"]
    minExamplesPerClass: 3
    liveTestSize: 5
    panels: [fool]
  - title: What does it see?
    type: classifier
    description: The same pad, now showing the grid it looks at and how sure it is.
    mode: drawing
    classes: ["😀 smile", "☹️ frown"]
    panels: [grid, sure, fool]
  - title: Name your own
    type: classifier
    description: Pick two to four things of your own to teach it.
    mode: drawing
    liveTestSize: 4
  - title: Print a result
    starterCode: |
      print("My pad learned 3 things")
    check:
      type: output
      operator: contains
      value: "3 things"
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `classifier` in YAML (JSON: `taskType: activity` + `activityType: classifier`) |
| `mode` | Yes | `drawing`. (`sound` is not built yet and fails validation; webcam is not planned.) |
| `classes` | No | The things to teach: 2 to 6 different names, each 1 to 16 characters; **3 is a good number**. A name may start with an emoji (`"🐱 cat"`), which is then shown big. Leave it out (or `[]`) and the student names **2 to 4** of their own. |
| `minExamplesPerClass` | No | Drawings every thing needs before the pad is ready: a whole number from 2 to 40. Default `3`. With `testSet: held_out` it must be at least `4`. |
| `testSet` | No | How it is tested. Default `live` (the round). Or `held_out` / `teacher`, the older Test button versions (see [Testing](#testing)). |
| `liveTestSize` | No | The round's goal: how many **right answers** make the round and pass the task, 3 to 20. Default `5`. (The name is kept from the older version.) |
| `panels` | No | Extra parts to show: any of `grid`, `sure`, `fool` (see [Panels](#panels-what-each-lesson-switches-on)). Default `[fool]`. `[]` shows none. Anything else is an error. |
| `targetAccuracy` | No | `held_out` / `teacher` only: the share of the test it must get right, above 0 and up to 1 (`0.8` is 80%). Default `0.8`. Ignored by the round. |
| `testItems` | `teacher` | `testSet: teacher` only: 2 to 24 test drawings (see below). |

## How it works for the student

1. **Teach it.** The prompt names one thing at a time: "Draw 3 🐱". The student draws on a big
   square pad with a mouse, finger or pen and presses **Add this drawing**. Tapping a drawing in
   the gallery removes it. When a thing has its drawings the prompt moves on to the next. With no
   `classes`, the student names 2 to 4 things first (a name is fixed once it has a drawing; they
   can start a name with an emoji).
2. **Ready, and it guesses live.** When every thing has `minExamplesPerClass` drawings the pad is
   ready (no Train button: it just uses every drawing). From then on, each time a stroke ends the
   pad shows a bar per thing (emoji and %) for what it thinks the drawing is.
3. **The round.** The pad asks for a thing in turn: "Draw a 🐟, will it get it?". The student
   draws it and presses **Done**. A right answer ticks and the round moves on by itself. A miss
   shows what it said instead. With the `fool` panel, **Teach it this one** adds that drawing to
   the thing it really was (and the pad keeps the miss as a mix-up picture); **Try another**
   moves on. A strip shows "3 of 5 done".
4. **Core, then bonus.** The core is `liveTestSize` right answers. Getting there **passes the
   task** (once, marked as you go). Then the round carries on as a **bonus**: keep fooling it and
   fixing it ("5 of 5 done · +2 bonus").
5. **Results in pictures.** "It gets 4 of 5 right" as a meter, and (with `fool`) the misses as
   thumbnails: "It thought your 🐱 was a 🐟". There is no confusion table in words.

### How the model works

Each drawing is shrunk to a **16 x 16 greyscale grid** (256 numbers, 0 = empty to 1 = ink),
after being moved and scaled to fill the grid, so where or how big it was drawn does not matter.
The classifier is **k-nearest-neighbours with k = 3**: to label a new drawing it finds the 3
drawings whose grids are closest (straight-line distance), and takes a vote; a tie goes to the
label whose drawings are closer. The bars show each thing's share of those 3 votes (so 0%, 33%,
67% or 100%). Nothing is downloaded and there is no machine-learning library: it runs in the
browser in a few milliseconds, which is why teaching it more drawings changes the next guess at
once.

## Panels: what each lesson switches on

The pad, the teach step and the guess bars **always** show. `panels` adds more, so each lesson
adds one new thing and the screen stays simple:

| Panel | What it adds |
|---|---|
| `grid` | **What it sees**: the current drawing as the small grid the model looks at. |
| `sure` | **How sure is it?**: a meter for its top guess. |
| `fool` | **Fool it and fix it**: the **Teach it this one** button after a miss and the mix-up thumbnails ("It thought your 🐱 was a 🐟"). Without it a miss just clears itself after a moment. |

A bias view (teach one kind only, then test the others) is not built.

## Testing

| `testSet` | The model is tested on | Notes |
|---|---|---|
| `live` (default) | The round: drawings the student makes when the pad asks for a thing | Passes at `liveTestSize` right answers; `targetAccuracy` is ignored. |
| `held_out` | The student's own drawings that were kept back | No round. **Every 4th drawing in a thing (the 4th, 8th, …) is kept back** and never used for the guesses; they are marked "Test" in the gallery. Once ready, a **Test it** button scores them. Passes at `targetAccuracy`. Needs `minExamplesPerClass` of at least 4. |
| `teacher` | Test drawings you write in `testItems` | No round. The same test for every student. **Test it** scores them. Needs `classes`. Every drawing is used for the guesses. Passes at `targetAccuracy`. |

`held_out` and `teacher` keep the plain behaviour (a free-play pad with the guess bars, then one
Test button). The round is the main experience.

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

- The round passes when every thing has at least `minExamplesPerClass` drawings and the student
  has `liveTestSize` right answers. It is marked the moment that happens. `held_out` / `teacher`
  pass when the Test result reaches `targetAccuracy`.
- Hints name the first thing missing, in plain words: "Draw more cat: you have 2 and need 3.",
  "Draw what it asks for and press Done. It needs 5 right: you have 2 so far. If it gets one
  wrong, teach it that one."
- Progress (`itemProgress`) counts the things that have enough drawings, then the right answers
  towards the goal.

## Privacy: what is kept where

- The drawings (and their grids), and the drawings it got wrong, are saved **only on the
  student's device**, in the activity's usual per-task localStorage file
  (`headstart_{lessonId}_{taskId}___activity_state___{id}`). They are never written to Firebase,
  the attempt log, the session report or a Go Live broadcast.
- What is sent (the activity's `serializeShared`, about 200 to 1,500 bytes): the thing names, the
  **number of drawings per thing**, whether it is **ready** (`trained`), the **tries**, **rights**
  and **misses**, and the result (right, total and the mix-up counts: how many of each true thing
  were guessed as which). No images, no strokes, no thumbnails.
- If the student's device storage is cleared, their drawings are gone and they start again.

## Teacher tools

- **Student card** (live, updated as drawings are added and after each try, not while drawing):
  while teaching, `Teaching: 🐱 cat 2/3 · 🐟 fish 0/3`; in the round, `3/5 right · +1 bonus · 2
  missed`; `No drawings yet` before anything.
- **Student modal:** drawings per thing against the minimum (with a tick), then the round: rights,
  misses, the "It gets 4 of 5 right" meter and the mix-ups as text ("Called 🐱 a 🐟: 2"). This is
  the live view of how each student is doing before they pass; the existing hint and nudge tools
  work on it as on any other task. The drawings themselves are not visible, because they never
  leave the device.
- **Session report:** per student the latest attempt (counts, rights, misses, result), the usual
  per-thing item progress, and for the task a `classifierResults` summary: how many students
  tried, how many reached the goal, the average accuracy and the mix-up counts added up across the
  class (true thing → guessed thing → count). Read it to see which things the class's pads mix up.
- **Stage → Start again** clears the student's drawings and results. **Complete (show answers)**
  fills in a finished summary (no drawings). There is no **Edit answers**: the drawings are on
  the student's device.
- Go Live on an activity task is teacher-only: a student's work is never broadcast.

## Devices

Drawing works with a mouse, a finger or a pen (Pointer Events), so Chromebooks and tablets are
fine. Drawing itself needs a pointer; everything else (adding, removing, Done, Teach it this one)
is a normal button, at least 44 px, and works from the keyboard. Results are always written out,
never shown by colour alone, and the bars do not animate with reduced motion on.

## Validation

Every Classifier validation message is listed under "Activity tasks" in
[validation-errors.md](../validation-errors.md).
