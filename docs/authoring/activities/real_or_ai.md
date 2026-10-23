# Real or AI Activity

A Real or AI task is an **activity**: a bounded exercise that can sit anywhere in a lesson,
between code tasks of any module. There is no Run button, no personal sandbox, no sharing and no
carry-through.

Each item is a **pair**: two pictures or two texts side by side (stacked on phones and narrow
tablets). Each side is one big button. The student **taps the one they think the AI made**, and
the answer shows at once:

- a tick or cross plus a word ("Right!" / "Not this time") and "B is the AI one",
- a one-line note on the **tell**, written as a short sentence ("The tell: Hands. Don't rely on it
  by itself."), from the pair's `tell` and `reliable` fields,
- your optional extra `reveal` sentence.

That is the whole pair: there is no second "which tell?" question and no Reveal button. A
`⭐ 3 right` count at the top only ever goes up (no streaks to lose; Play again starts it over).

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
    description: Tap the one the AI made.
    coreItems: 2
    items:
      - id: p1
        kind: image
        a: images/real-1.jpg
        b: images/ai-1.jpg
        altA: A girl holding a mug in a kitchen
        altB: A girl holding a mug in a kitchen
        answer: b
        tell: odd hands
        reliable: false
        reveal: "Newer models get hands right, so don't rely on it."
      - id: p2
        kind: text
        a: "I tried the soup and it was too salty, so Gran added a potato."
        b: "Soup is a delightful culinary creation enjoyed by many people around the world."
        answer: b
        tell: too_smooth
        reliable: true
      - id: p3
        kind: text
        a: "The bus was late again, so I read the whole of my comic."
        b: "Public transportation can sometimes be delayed, which allows time for leisure reading."
        answer: b
        tell: too_smooth
        reliable: true
```

## Builder

In the Builder, choose the **Activity** format and pick **Real or AI**. The editor has a **Core
pairs** field and a **Pairs** list (add, remove, move up / down). Each pair has Pictures / Texts,
side A and B (image URL or path, or text), alt text for pictures, which side is AI, the tell,
whether it is reliable (or "Not said"), and an optional extra note. Problems show under the pair
they are about.

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `real_or_ai` in YAML (JSON: `taskType: activity` + `activityType: real_or_ai`) |
| `items` | Yes | One or more pairs, played in order. Each needs a unique `id` (keeps saved progress attached to the right pair). Aim for 3-8. |
| `coreItems` | No | How many pairs make the round (1 to the number of pairs). The task passes at that many; the rest are bonus pairs. Defaults to all pairs. |

`tells` (the old task-level list of clues) is no longer used. Old lessons that still have it, and
pairs whose `tell` was one of its entries, keep validating and playing: the list is ignored and
the pair's `tell` is shown as the note.

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`p1`, `p2`, ...). |
| `kind` | No | `image` (default) or `text`. |
| `a`, `b` | Yes | The two sides. For `image`: an image path or URL. For `text`: the text to show (line breaks are kept; Markdown is not rendered). |
| `altA`, `altB` | No | Alt text for the pictures, read by screen readers. Describe what is in the picture, never which one is AI. Defaults to "Picture A" / "Picture B". |
| `answer` | Yes | `a` or `b`: which side is the AI one. |
| `tell` | No | The clue to look for, shown after the tap: an id like `too_smooth` (shown as "Too smooth") or plain text like `Odd lighting`. Leave out for no note. |
| `reliable` | No | `true` if the tell can be trusted on its own, `false` if not (for example because newer AI gets it right). Leave out to say nothing about it. |
| `reveal` | No | One extra sentence shown under the tell note. |

### Pictures

`a` / `b` are resolved like Scratch costume images: a full `https://` URL (for example from
`assets upload`, see [lesson-assets-cli.md](../lesson-assets-cli.md)), a `data:` URL, a path
starting with `/` (under the site), or a path relative to the lesson's `assetsPath`. Keep both
pictures the same size and shape, so the pair is not given away by the crop.

## Marking

- A pair is **right** when the student tapped the AI side (`answer`). A tap marks it at once, right
  or wrong, and locks the pair (so the answer can't be gamed by trying again); the teacher's
  **Stage → Start again** resets it.
- **One round, no in-task navigation.** The student sees a progress strip (`3 of 5 done`). After a
  tap the answer and note stay up until the student taps **Next →** (or **Finish →** on the last
  pair); nothing moves on by itself, so slow readers are never rushed. There
  are no Previous or numbered buttons; tutors can open any pair from a tutor-only picker. An
  activity task is one round: a single goal of 3-8 reps that moves on by itself, with no in-task
  navigation; if you want the class to look at one answer together, make it its own task.
- The task is complete when the **core** pairs are done (all of them unless `coreItems` says
  fewer), right or wrong, because the point is learning the tells. Pairs after the core are
  **bonus**. When every pair is done there is a finish card with **Play again**, which clears the
  pairs and the `⭐` count on that device; the task stays passed. The finish card reads
  `Round done! You spotted 2 of 3` (never "You did it!" at a low score), and the pass banner says
  `Round done!` rather than `Correct!`.
- The `⭐ N right` count only goes up within a round. There are no streaks, and replays start from 0.

## Teacher tools

- **Live picks.** Each tap is mirrored to the teacher at once. The student card shows e.g.
  `3/5 done · 2 right` (plus `· +1 bonus` after the core). The student modal opens on the pair the
  student is on, shows their pick and the answer key (which side is AI, the tell, whether it is
  reliable) before they tap, and any earlier pair from the tutor-only picker.
- **Edit answers** in the modal lets the teacher change a student's picks; the edit is marked as
  teacher assisted.
- **Stage → Start again** clears the student's pairs; **Complete (show answers)** fills in the
  key.
- Go Live on an activity task is teacher-only: a student's answers are never broadcast.

## Session report

`itemProgress` is `{ correct, total }` = pairs picked right out of the core pairs. The task
summary adds `avgItemProgress` and `itemResults[]`: per pair, `itemId`, `tell`, `reliable`,
`revealed` (students who played it) and `rightPick` (counts). See
[session-reports.md](../session-reports.md#activity-summary-fields).

## Devices and accessibility

- Works with mouse, touch and keyboard (each side is a real button, a large tap target).
- Picks and results are never shown by colour alone: a picked side says "Your pick", the reveal
  uses words and the symbols ✓ / ✗.
- After a tap, focus moves to **Next**; on the next pair it moves to the question, so a keyboard
  or screen-reader user keeps their place.
- Reduced motion is respected: the small press and reveal animations only run when the device
  has not asked for less motion. The timing is the same either way.

## Validation

Every Real or AI validation message is listed under "Real or AI" in
[validation-errors.md](../validation-errors.md).
