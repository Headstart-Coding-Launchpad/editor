# Learning Tree Activity

A Learning Tree task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. The student gives a tree **labelled examples** (a name, a tick for
each yes/no feature, a label such as pet or wild). The tree **builds itself**: it picks the best
yes/no questions from the examples and redraws every time an example is added or removed. Then
the student presses **Try it on new animals** and the tree sorts the lesson's unseen test items.
It teaches "a tree learns its own questions from examples, and you can read why it decided".
There is no Run button, no personal sandbox, no sharing and no carry-through. Everything runs in
the browser; there is no AI model and nothing is downloaded.

Write `type: learning_tree` on the task (the YAML shorthand for `taskType: activity` +
`activityType: learning_tree`, which also works). In the Builder, choose the **Activity** format and pick **Learning Tree**, or write the
task in YAML. The task's `title` and `description` / `explainer` show above the activity.

## Complete example

```yaml
id: learning-tree-example
type: python
title: Grow a Tree
description: Teach a tree to tell pets from wild animals.
tasks:
  - title: Pet or wild?
    type: learning_tree
    description: Add some animals. Tick what is true, pick pet or wild, and watch the tree grow.
    features: [has_fur, can_fly, lives_in_water]
    labels: [pet, wild]
    maxExamples: 20
    maxDepth: 3
    passAt: 4
    testItems:
      - name: Hamster
        yes: [has_fur]
        label: pet
      - name: Dog
        yes: [has_fur]
        label: pet
      - name: Eagle
        yes: [can_fly]
        label: wild
      - name: Shark
        yes: [lives_in_water]
        label: wild
      - name: Goldfish
        yes: [lives_in_water]
        label: pet
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `learning_tree` in YAML (JSON: `taskType: activity` + `activityType: learning_tree`) |
| `features` | Yes | 1 to 6 different yes/no feature names, each 1 to 24 characters. Underscores show as spaces and the tree asks "has fur?". |
| `labels` | Yes | 2 to 6 different label names, each 1 to 16 characters. The tree's answers; a tie goes to the **first** label. |
| `testItems` | Yes | 2 to 12 unseen items the tree is tested on (see below). |
| `maxExamples` | No | The most examples a student can add: a whole number from 4 to 40. Default `20`. |
| `maxDepth` | No | The most questions in a row the tree may ask: a whole number from 1 to 5. Default `3`. |
| `studentDepth` | No | `true` (default) shows a small − / + dial, "How many questions deep", so the student can grow a shallower tree (1 up to `maxDepth`, which is also where it starts). `false` hides the dial. Must be true or false. |
| `studentPicksFeatures` | No | A whole number from 1 to the number of `features`. The student ticks which features the tree may use (up to this many; the buttons are at least 44px) and the tree regrows from only those. They start with none ticked, so the tree is a single answer box until they pick. The examples still record every feature. Leave it out and the tree uses all of them (as before). |
| `passAt` | No | How many test items the tree must sort right: a share above 0 and below 1 (`0.8`) or a whole number of items (`4`). Default `0.8`, rounded up (4 of 5). |

## Test item fields

| Field | Required | Notes |
|---|:---:|---|
| `name` | Yes | What the item is called (1 to 16 characters), shown in the results. |
| `yes` | Yes | The features that are true for it (each listed once, from `features`). Any feature not listed is "no". `[]` is fine. |
| `label` | Yes | The right label; it must be one of `labels`. |

`testItems` is **sealed** in the public lesson document (its labels are the answers).

## How it works for the student

The screen has the tree on the left (the picture) and the controls on the right. On a narrow
screen (a tablet held upright, the tutor's student view) it stacks: tree, Try it, tip, add form,
animals.

1. **Add an animal.** The add form is open at the start: type a name (optional, up to 16
   characters), tap the features that are true for it (a dashed chip gets a ✓ and a solid outline),
   then tap a label button (**+ pet** / **+ wild**). The label button adds the animal, so there is
   no separate Add button. Up to `maxExamples`. After 4 animals the form folds to one bar
   ("+ Add an animal, 4 of 20"); tap the bar to open it again. **Your animals** shows each one as a
   chip in its label's colour with a × to remove it (hover or long-press shows its ticks).
2. **Watch the tree grow.** After every change the tree is rebuilt and redrawn: a question box
   ("has fur?") with **yes** and **no** branches, ending in coloured answer boxes holding the
   label and how many animals landed there. It scrolls sideways if it is wide. Above the tree,
   **Max questions** (a − 3 + stepper, with "using 2" beside it) sets how deep it may go; it is
   hidden with `studentDepth: false`.
3. **Try it on new animals.** The one main button: outlined until there are 2 animals, then filled.
   It runs the tree on the `testItems` and shows "Your tree got 4 of 5 right" and a chip per
   test item under the tree (✓ Hamster, ✗ Shark said pet). Tapping a chip lights that item's path
   through the tree (no sentence). Adding or removing an animal clears the result (the tree
   changed) and the button says **Try it again**. One yellow tip line under the button says what to
   do next ("It got Shark wrong. Add an animal like it.").

With `studentPicksFeatures`, a **Tree may use** row of chips sits above the tree. Ticking or
unticking one regrows the tree and clears the Try it result (press it again). Picking more than N
gently shakes the row (not with reduced motion) and the tip says "Untick one first"; chips are never
greyed out. This is the "useless feature" moment: tick a feature that does not separate the labels
and the tree gets test items wrong.

The default screen has 5 controls (name, "Which are true?", "Add it as", Max questions, Try it);
with the form folded it has 4, and 5 with `studentPicksFeatures`.

### Deck mode (`deck`)

Instead of typing examples, the student **sorts a ready-made deck**. Add `deck` (4 to 16 cards,
each `{ name, emoji, yes }`) and the add form is replaced by the deck and one bin per label.

```yaml
- type: learning_tree
  title: Would you eat it?
  deck:
    - { name: Doughnut, emoji: "🍩", yes: [is_sweet, is_fried] }
    - { name: Apple, emoji: "🍎", yes: [is_sweet, is_crunchy] }
    - { name: Liver, emoji: "🥩", yes: [] }
    - { name: Sprouts, emoji: "🥦", yes: [is_crunchy] }
  labels: ["I'd eat it", "No thanks"]
  studentLabels: true
  twentyQuestions: true
  testItems:
    - { name: Cookie, emoji: "🍪", yes: [is_sweet, is_crunchy], label: "I'd eat it" }
    - { name: Olive, emoji: "🫒", yes: [], label: "No thanks" }
```

| Field | Notes |
|---|---|
| `deck` | 4 to 16 cards. `yes` lists the features true for the card. `features` can be left out: it is then every tag the deck uses (still at most 6). |
| `studentLabels` | `true` lets the student rename the bins (a text box on each bin). Default `false`. |
| `twentyQuestions` | `true` adds the **Play 20 Questions** test (needs 2 sorted cards). Without it the usual **Try it on new cards** button tests the tree on `testItems`. |
| `testItems[].emoji` | Optional emoji shown on the mystery card. |

The student drags a card into a bin, or taps a card and then a bin (Enter on the card, then
Enter on the bin, works too); **Back to the deck** puts a selected card back. The tree regrows
at once and the other settings (`maxDepth`, `studentDepth`, `studentPicksFeatures`, `passAt`) work as above.
If the sorted cards cannot be split by any question it says "It can only use the questions it was
given."

**Play 20 Questions.** A mystery `testItems` card is shown with its facts. The tree asks its
questions one at a time ("is sweet?"), the student answers Yes or No from the card (a wrong answer is
refused with "Look at the card again"), the path lights up, and at an answer box the tree says
"I think: I'd eat it". The student marks it right or wrong, then plays the next card. Moving a
card clears the rounds. The task passes when enough rounds are right (`passAt`):
without `studentLabels` a round is right when the tree's guess equals the test item's `label`;
with `studentLabels` the bins are the student's own, so it counts the rounds the student marked right.

The deck screen has 3 to 5 controls (the sort board counts as one, plus the Max questions
dial, **Tree may use** if set, and the Play button).

Tutor view: the card reads `sorted 8 · 20Q 3 of 4`; the shared state carries the bins (`b`), the
bin names (`ln`), the rounds (`q`) and `sorted`; **Complete (show answers)** sorts the deck on the
best feature and marks every round right.

### How the tree is built

It uses **ID3**. For the examples in a box, it tries each yes/no feature not yet asked on that
path and measures the **information gain** (how much less mixed the labels become). The feature with
the biggest gain becomes the question (a tie goes to the feature listed first); the examples split
into yes and no and each side is built the same way. A box becomes an **answer** when its examples
all share one label, when no question gains anything, or when it is `maxDepth` questions deep.
The answer is the most common label (a tie goes to the first label). A branch with no examples
answers what its parent would. With no examples at all the tree is one answer: the first label.

A single yes/no question cannot spot a pattern that needs two features together (like "furry **and**
flies"), so some data gives a short tree. That is part of what the activity teaches.

## Marking and hints

- Marked as you go: the task passes when the student has pressed **Try it** on the current tree
  and it sorts at least `passAt` test items right (default 4 of 5). There is no Check button.
- After **Try it**, each test result is a button. Pressing it lights the boxes and branches that item
  took in the tree and shows a line such as "Hamster: has fur? yes → pet".
- Hints never give the answer: "Add some examples first", "Press Try it", then "Your tree got 3 of
  5. It got "Goldfish" wrong. Add an example like it." (naming the first item it got wrong).
- Validation warns when the first label is the right answer for enough test items that an
  **empty tree could pass**. Balance the labels in `testItems`.

## Teacher tools

- The student card shows `6 examples · depth 2 · test 4/5` (with `(set to N)` after the depth when the student turned the dial below
  `maxDepth`; the shared state carries `chosenDepth`). The student modal shows the
  student's examples, their tree and the test results, read-only, live (every example is a
  discrete change, so it syncs as soon as it is added). `itemProgress` marks each test item
  right or wrong after Try it.
- With `studentPicksFeatures`, the card adds `· uses has fur, can fly` and the shared state carries
  `chosenFeatures`; the modal shows the same toggles, read-only. The session report adds
  `featureUse` (how many students who tried the test used each feature) to `learningTreeResults`.
- **Edit answers** lets the tutor add or remove examples for the student; the tree redraws.
- **Stage → Start again** clears the examples. **Complete (show answers)** fills in the lesson's test items as examples, so the tree works (with `studentPicksFeatures` it also ticks the most useful features); the
  student's own examples are replaced.
- The session report keeps, per student, the examples, the tree's depth and the test score, and
  shows for the class how many tried the test, how many passed and the average examples, depth
  and score (`learningTreeResults`).
- Go Live on an activity task is teacher-only.

## Devices

Works by mouse, trackpad or touch: toggles and label buttons are at least 44px and reachable by
keyboard. No camera or microphone. The tree is rebuilt only when an example changes (a few dozen
rows), with no animation loop, so it is light on a low-end Chromebook.

## Validation

Every Learning Tree validation message is listed under "Learning Tree" in
[validation-errors.md](../validation-errors.md).
