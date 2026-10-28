# Learning Tree Activity

A Learning Tree task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. The student gives a tree **labelled examples** (a name, a tick for
each yes/no feature, a label such as pet or wild). The tree **builds itself**: it picks the best
yes/no questions from the examples and redraws every time an example is added or removed. Then
the student presses **Try it on new things** and the tree sorts the lesson's unseen test items.
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
| `passAt` | No | How many test items the tree must sort right: a share above 0 and below 1 (`0.8`) or a whole number of items (`4`). Default `0.8`, rounded up (4 of 5). |

## Test item fields

| Field | Required | Notes |
|---|:---:|---|
| `name` | Yes | What the item is called (1 to 16 characters), shown in the results. |
| `yes` | Yes | The features that are true for it (each listed once, from `features`). Any feature not listed is "no". `[]` is fine. |
| `label` | Yes | The right label; it must be one of `labels`. |

`testItems` is **sealed** in the public lesson document (its labels are the answers).

## How it works for the student

1. **Add an example.** Type a name (optional, up to 16 characters), tap the features that are true
   for it (they turn green), tap a label, press **Add example**. Up to `maxExamples`; a ✕ on each
   example removes it.
2. **Watch the tree grow.** After every change the tree is rebuilt and redrawn: a question box
   ("has fur?") with **yes** and **no** branches, ending in coloured answer boxes holding the
   label and how many examples landed there. It scrolls sideways if it is wide.
3. **Try it on new things.** Runs the tree on the `testItems` and shows each as right or wrong
   with what the tree said, and "Your tree got 4 of 5 right". Adding or removing an example
   clears the result (the tree changed), so the student presses Try it again.

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
- Hints never give the answer: "Add some examples first", "Press Try it", then "Your tree got 3 of
  5. It got "Goldfish" wrong. Add an example like it." (naming the first item it got wrong).
- Validation warns when the first label is the right answer for enough test items that an
  **empty tree could pass**. Balance the labels in `testItems`.

## Teacher tools

- The student card shows `6 examples · depth 2 · test 4/5`. The student modal shows the
  student's examples, their tree and the test results, read-only, live (every example is a
  discrete change, so it syncs as soon as it is added). `itemProgress` marks each test item
  right or wrong after Try it.
- **Edit answers** lets the tutor add or remove examples for the student; the tree redraws.
- **Stage → Start again** clears the examples. **Complete (show answers)** fills in the lesson's test items as examples, so the tree works; the
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
