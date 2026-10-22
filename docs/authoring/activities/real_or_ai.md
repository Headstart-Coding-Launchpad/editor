# Real or AI Activity

A Real or AI task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. There is no Run button, no personal sandbox, no sharing and no
carry-through.

Each item shows a **pair**: two pictures or two texts side by side (stacked on phones and
narrow tablets). The student:

1. picks which one is the AI one,
2. picks the **clue** (the "tell") that gave it away, from the task's `tells` list,
3. presses **Reveal**.

The pair then locks and the student sees whether the pick was right, whether their clue matches
yours, whether that clue is **reliable** on its own, and your `reveal` text. A running score
("Score: 2 right out of 3 done") stays at the top. The activity marks itself: revealing the last
pair finishes the task, right or wrong, because the point is learning the clues. The score is
reported separately.

Write `type: real_or_ai` on the task (the YAML shorthand for `taskType: activity` +
`activityType: real_or_ai`, which also works). The task's `title` and `description` /
`explainer` show above the activity.

## Complete example

```yaml
id: real-or-ai-example
type: python
title: "Real or AI example"
description: A short lesson using the Real or AI activity.
tasks:
  - title: Spot the AI
    type: real_or_ai
    description: Pick the one the AI made, then say what gave it away.
    tells: [hands, text_in_image, too_smooth, lighting, odd_detail, none_reliable]
    items:
      - id: p1
        kind: image
        a: images/real-1.jpg
        b: images/ai-1.jpg
        altA: A girl holding a mug in a kitchen
        altB: A girl holding a mug in a kitchen
        answer: b
        tell: hands
        reliable: false
        reveal: "Hands used to give AI away, but newer models get them right, so don't rely on it."
      - id: p2
        kind: text
        a: "I tried the soup and it was too salty, so Gran added a potato."
        b: "Soup is a delightful culinary creation enjoyed by many people around the world."
        answer: b
        tell: too_smooth
        reliable: true
        reveal: "AI text often sounds smooth and general, with no small real details."
```

## Builder

In the Builder, choose the **Activity** format and pick **Real or AI**. The editor has a
**Clues** list (add, rename, remove; renaming a clue updates the pairs that use it) and a
**Pairs** list (add, remove, move up / down). Each pair has Pictures / Texts, side A and B (image
URL or path, or text), alt text for pictures, which side is AI, the clue (chosen from the Clues
list), whether the clue is reliable, and the reveal text. Problems show under the pair they are
about.

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `real_or_ai` in YAML (JSON: `taskType: activity` + `activityType: real_or_ai`) |
| `tells` | Yes | The clues the student chooses from; at least two, no repeats. Write ids like `too_smooth` (shown as "Too smooth") or plain text like `Odd lighting` (shown as written). Include a catch-all such as `none_reliable` if you want one. |
| `items` | Yes | One or more pairs. Each needs a unique `id` (keeps saved progress attached to the right pair). |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`p1`, `p2`, ...). |
| `kind` | No | `image` (default) or `text`. |
| `a`, `b` | Yes | The two sides. For `image`: an image path or URL. For `text`: the text to show (line breaks are kept; Markdown is not rendered). |
| `altA`, `altB` | No | Alt text for the pictures, read by screen readers. Describe what is in the picture, never which one is AI. Defaults to "Picture A" / "Picture B". |
| `answer` | Yes | `a` or `b`: which side is the AI one. |
| `tell` | Yes | The clue to look for. Must be one of the task's `tells`. |
| `reliable` | Yes | `true` if that clue can be trusted on its own, `false` if not (for example because newer AI gets it right). Shown in the reveal. |
| `reveal` | Yes | The explanation shown after the student reveals the pair. |

### Pictures

`a` / `b` are resolved like Scratch costume images: a full `https://` URL (for example from
`assets upload`, see [lesson-assets-cli.md](../lesson-assets-cli.md)), a `data:` URL, a path
starting with `/` (under the site), or a path relative to the lesson's `assetsPath`. Keep both
pictures the same size and shape, so the pair is not given away by the crop.

## Marking

- A pair is **right** when the student picked the AI side (`answer`). Whether their clue matches
  `tell` is recorded separately: a student can be right with a different clue.
- Picks and clues can be changed until **Reveal**. After Reveal the pair is locked (so the
  reveal can't be gamed by trying again); the teacher's **Stage → Start again** resets it.
- The task is complete when every pair has been revealed. Task score = pairs picked right.

## Teacher tools

- **Live, before Reveal.** Each pick and clue is mirrored to the teacher as it is chosen. The
  student card shows e.g. `1/1 right so far, item 2: picked B, Too smooth` and, once finished,
  `3/5 right`. The student modal opens on the pair the student is on, shows their pick and clue
  with a note "Student has picked B and the clue ... Not revealed yet" and the answer key (which
  side is AI, the clue, whether it is reliable), so you can step in before they reveal.
- **Edit answers** in the modal lets the teacher change the student's picks (and reveal for
  them); the edit is marked as teacher assisted.
- **Stage → Start again** clears the student's pairs; **Complete (show answers)** fills in the
  key.
- Go Live on an activity task is teacher-only: a student's answers are never broadcast.

## Session report

`itemProgress` is `{ correct, total }` = pairs picked right out of all pairs. The task summary
adds `avgItemProgress` and `itemResults[]`: per pair, `itemId`, `tell`, `reliable`, `revealed`
(students who revealed it), `rightPick` and `tellMatch` (counts). See
[session-reports.md](../session-reports.md#activity-summary-fields).

## Devices and accessibility

- Works with mouse, touch and keyboard (all controls are real buttons, at least 44 px).
- Picks and results are never shown by colour alone: a picked side says "Your pick", the reveal
  uses words and the symbols ✓ / ✗ / ⚠.
- After Reveal, focus moves to the reveal so a screen reader or keyboard user lands on it.

## Validation

Every Real or AI validation message is listed under "Real or AI" in
[validation-errors.md](../validation-errors.md).
