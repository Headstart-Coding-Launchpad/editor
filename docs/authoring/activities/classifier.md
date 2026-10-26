# Classifier Activity

A Classifier task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. The student **teaches the pad a few things** by drawing them
(for example 3 cats, 3 fish, 3 rockets), then watches it **guess live** as they draw, with a bar
per thing. Then comes **the round**: the pad suggests a thing ("Draw a 🐟, will it get it?"), the
student draws (anything they like: fooling it is allowed) and presses **Done**, then says **what
they drew** with one tap on the things' emoji. The pad is right when its guess is what they said
they drew, and wrong when it is not. A wrong one can be taught in one tap ("Teach it this one"). It teaches "a model learns from examples, so it only knows what it was
shown". There is no Train button, no Run button, no personal sandbox, no sharing and no
carry-through. The task is **marked as you go**: it passes the moment the round's goal is met
(`liveTestSize` tries, whether the pad got them right or wrong; there is no Check my work
button).

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
| `liveTestSize` | No | The round's goal: how many **tries** make the round and pass the task, 3 to 20. Default `5`. A try is a drawing the student finished and named, counted whether the pad got it right or wrong (the student's job is to test it, not to make it win). The name is kept from the older version. |
| `panels` | No | Extra parts to show: any of `grid`, `sure`, `fool` (see [Panels](#panels-what-each-lesson-switches-on)). Default `[fool]`. `[]` shows none. Anything else is an error. |
| `targetAccuracy` | No | `held_out` / `teacher` only: the share of the test it must get right, above 0 and up to 1 (`0.8` is 80%). Default `0.8`. Ignored by the round. |
| `examples` | No | Pre-loaded drawings the pad has already learned (see [Pre-loaded examples](#pre-loaded-examples)). Needs `classes`. Up to 40 in total. |
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
3. **The round.** The pad suggests a thing in turn: "Draw a 🐟, will it get it?". The student
   draws and presses **Done**, then the pad asks **"What did you draw?"** with one big button per
   thing (the suggested thing is picked out, so one tap confirms; **Back to the pad** goes back).
   The guess is **right** when it equals what they said they drew, so a deliberate fool that the
   pad still gets right is a right answer, and a drawing it gets wrong is a miss whatever was
   suggested. A right answer ticks and the round moves on by itself. A miss shows what it said
   and what they drew. With the `fool` panel, **Teach it this one** adds that drawing to the
   thing they said they drew (and the pad keeps the miss as a mix-up picture); **Try another**
   moves on. A strip shows "3 of 5 done".
4. **Core, then bonus.** The core is `liveTestSize` **tries**, right or wrong. Getting there
   **passes the task** (once, marked as you go) and says "Round done! It got 4 of 5 right" (never
   a plain "You did it!"). Then the round carries on as a **bonus**: keep fooling it and fixing
   it ("5 of 5 done · +2 bonus").
5. **Results in pictures.** "It got 4 of 5 right" as a meter, and (with `fool`) the misses as
   thumbnails: "It thought your 🐱 was a 🐟". There is no confusion table in words.

On a screen 800 px wide or more the pad (up to about 460 px) is on the left with the prompt, the
buttons and the answer under it, and the guess bars, how-sure and what-it-sees panels sit on the
right. Narrower screens stack them, pad first.

### How the model works

Each drawing is shrunk to a **16 x 16 greyscale grid** (256 numbers, 0 = empty to 1 = ink),
after being moved and scaled to fill the grid, so where or how big it was drawn does not matter.
The classifier is **k-nearest-neighbours**: to label a new drawing it finds the **7** drawings
whose grids are closest (straight-line distance; fewer when it has fewer), weights each by
`1 / (distance + 1)` so closer drawings count for more, and adds the weights up per thing. The
top thing is its answer (a tie goes to the thing with the closest drawing). The bars show each
thing's share of the total weight, so they move smoothly (not in thirds) and the "how sure" meter
climbs as better drawings are taught. Nothing is downloaded and there is no machine-learning library: it runs in the
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

## Pre-loaded examples

`examples` gives the pad drawings to learn **before the student draws anything**, so it guesses
from the start (for example a first lesson where the pad is already shown to be wrong about
something). Each item is `{ label, grid }` or `{ label, strokes }`, in the same format as
`testItems` (below), and `label` must be one of `classes`. Up to 40 in total; prefer `grid`
(about 260 bytes each; the Builder saves grids).

```yaml
- type: classifier
  mode: drawing
  classes: ["⭕ circle", "➖ line"]
  minExamplesPerClass: 4
  examples:
    - label: "⭕ circle"
      grid:
        - "................"
        # ... 16 rows of 16 characters in all
    - label: "➖ line"
      strokes: [[0.1, 0.5, 0.9, 0.5]]
```

How they behave:

- **Given examples count** towards `minExamplesPerClass`. If every thing has enough given
  examples the pad is ready (and guesses) at once, with no teaching step.
- In the gallery they show a small **Given** tag. The student cannot remove them. They can add
  their own on top (while a thing still needs drawings, and with **Teach it this one** in the
  round); their own drawings are removable as usual. The cap of 40 drawings per thing
  applies to the student's own drawings, with the given ones on top.
- With `testSet: held_out` only the student's **own** drawings are ever kept back; given ones
  always train. If a thing has `minExamplesPerClass` or more given examples the student never has
  to draw it and nothing is kept back, so validation warns: raise `minExamplesPerClass`.
- They are **not sealed**: they are public lesson content.
- They are not saved in the student's state. They are read from the task on every load, so
  editing `examples` in a lesson takes effect when students reload.
- **Tutor:** the card and modal say how many are given and how many are the student's own
  ("Teaching: 🐱 cat 3 given + 2 own"; the modal "🐱 cat: 5 of 3 drawings (3 given + 2 own)").
  Shared counts (`counts`, Firebase) are given plus own.
- **Builder:** the Classifier editor has a **Pre-loaded examples** section (always shown): pick a
  class, draw on the pad and press **Add as example**; the drawing is saved as a grid. Each
  example has a remove button.

## Testing

| `testSet` | The model is tested on | Notes |
|---|---|---|
| `live` (default) | The round: drawings the student makes and names | Passes at `liveTestSize` tries (right or wrong); `targetAccuracy` is ignored. |
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
  has made `liveTestSize` tries (Done, then said what they drew), whether the pad got them right
  or wrong. It is marked the moment that happens. `held_out` / `teacher`
  pass when the Test result reaches `targetAccuracy`.
- Hints name the first thing missing, in plain words: "Draw more cat: you have 2 and need 3.",
  "Draw something, press Done and tell it what you drew. It needs 5 tries: you have 2 so far. Try
  to fool it, and teach it the ones it gets wrong."
- Progress (`itemProgress`) counts the things that have enough drawings, then the tries towards
  the goal.

## Privacy: what is kept where

- The taught drawings, the raw **strokes**, and the full list of drawings it got wrong are saved
  **only on the student's device**, in the activity's usual per-task localStorage file
  (`headstart_{lessonId}_{taskId}___activity_state___{id}`). They are never written to Firebase,
  the attempt log, the session report or a Go Live broadcast.
- What is sent (the activity's `serializeShared`, kept under 1,800 characters): the thing names,
  the **number of drawings per thing**, whether it is **ready** (`trained`), the **tries**
  (`liveCount`), **rights** (the pad was right) and **misses** (the pad was wrong), and the result
  (right, total and the mix-up counts: how many of each thing drawn were guessed as which). So
  that the tutor can see the work live, it also sends **the pad as it is now** (`pad`, at each
  stroke end, with its `target`, the thing suggested or being taught) and **the last 3 misses**
  (`recent`: what it said and what they drew), each only as the small **16 x 16 grid** the model
  looks at (a packed text of 256 digits). These are low-resolution pictures, not the strokes.
  When the message would be too big the oldest misses go first, then the pad.
- Two small numbers are sent for the live badges (🎭 AI Fooler, 🏋️ AI Trainer, 💯 Perfect Round):
  `taught` (how many misses the student then taught it with "Teach it this one") and `readyAt`
  (the student's device clock, in milliseconds, when the pad first became ready; kept for good,
  and for given examples that make it ready from the start it is the student's first change).
  Old saves have neither. The badges see the round as it was at the pass.
- If the student's device storage is cleared, their drawings are gone and they start again.

## Teacher tools

- **Student card** (live, updated as drawings are added and after each try): while teaching,
  `Teaching: 🐱 cat 2/3 · 🐟 fish 0/3`; in the round, `5/5 tried · 4 right` (then `+2 bonus`
  after the core); `No drawings yet` before anything.
- **Student modal:** drawings per thing against the minimum (with a tick), then the round: tries,
  rights, the "It got 4 of 5 right" meter and the mix-ups as text ("Called 🐱 a 🐟: 2"). It also
  shows **what is on the student's pad now** (a small grid picture, with the thing they were
  asked for, updated at each stroke end, before they press Done) and **their last 3 misses** as
  small grid pictures ("It said 🐟, they drew 🐱"). This is the live view of how each student is
  doing before they pass; the existing hint and nudge tools work on it as on any other task. The
  taught drawings and the strokes are not visible, because they never leave the device.
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
