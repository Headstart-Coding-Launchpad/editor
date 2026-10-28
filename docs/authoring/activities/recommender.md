# Recommender Activity

A Recommender task is an **activity**: the student rates things 👍 / 👎 and gets their own
"feed" of recommendations from a made-up class of raters. It teaches why a feed shows what it
does, and (with `bubble: true`) how rating only one kind of thing closes a **filter bubble**.
It also fits "a tool, not a friend": feeds are built to keep you watching.

There is no Run button, no personal sandbox, no sharing and no carry-through. Progress is saved on
the device, mirrored to the teacher's student card, and marked as you go. Data stays on the
device; there is no live AI model.

Write `type: recommender` on the task (the YAML shorthand for `taskType: activity` +
`activityType: recommender`, which also works). In the Builder, choose the **Activity** format and
pick **Recommender**.

## Complete example

```yaml
id: recommender-example
type: python
title: "Recommender example"
description: A short lesson using the Recommender activity.
tasks:
  - title: Build your feed
    type: recommender
    description: Rate things with a thumbs up or down, then see what your feed shows you.
    showWhy: true
    bubble: true
    minRated: 6
    items:
      - { id: football, emoji: "\u26bd", label: Football, group: sport }
      - { id: swimming, emoji: "\U0001F3CA", label: Swimming, group: sport }
      - { id: tennis, emoji: "\U0001F3BE", label: Tennis, group: sport }
      - { id: cat, emoji: "\U0001F431", label: Cats, group: animals }
      - { id: dog, emoji: "\U0001F436", label: Dogs, group: animals }
      - { id: frog, emoji: "\U0001F438", label: Frogs, group: animals }
      - { id: guitar, emoji: "\U0001F3B8", label: Guitar, group: music }
      - { id: drums, emoji: "\U0001F941", label: Drums, group: music }
      - { id: piano, emoji: "\U0001F3B9", label: Piano, group: music }
      - { id: pizza, emoji: "\U0001F355", label: Pizza, group: food }
      - { id: icecream, emoji: "\U0001F366", label: Ice cream, group: food }
      - { id: pancakes, emoji: "\U0001F95E", label: Pancakes, group: food }
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `recommender` in YAML (JSON: `taskType: activity` + `activityType: recommender`) |
| `items` | Yes | 12 to 20 things to rate, in 3 to 5 groups. Fewer than 12 items or fewer than 3 groups only warns. More than 20 is an error. |
| `raters` | No | Only `preset` (the default): a made-up class generated from the items. |
| `showWhy` | No | Default `true`. Each recommendation gets a **Why?** button, and opening one is part of passing. `false` hides the buttons and drops that part of the goal. |
| `bubble` | No | Default `false`. Shows the bubble meter under the feed. |
| `goals` | No | A switch for what the feed aims for: 1 to 3 different goals from `like`, `watching` and `new`. With two or more the student gets buttons (at least 44px) above the feed: **What I'll like**, **Keep me watching**, **Something new**. Leave it out and the feed is the usual one, exactly as before. |
| `minRated` | No | How many items the student must rate. Default 6; 1 to the number of items. |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`football`). Also seeds the made-up class: change the ids and the raters change. |
| `emoji` | Yes | The picture, one emoji. |
| `label` | Yes | The name shown under it. |
| `group` | Yes | The kind of thing it is (`sport`, `animals`, `music`). The bubble meter counts these. |

## How it works

- **The made-up class.** About 8 silly-named raters (Robo Rita, Sporty Sam, ...) are generated from
  the items. Each loves one or two groups (likes nearly all of them), dislikes most other things,
  and skips a few. The same lesson always gives the same raters.
- **Recommendations.** A rater is *similar* when they agree with the student on the items both
  rated. Each item the student has not rated is scored by what the similar raters thought of it,
  with a small boost for kinds the student likes. The top 4 are **Your feed**. With nothing rated
  yet, the feed is what the class liked most, one of each kind first.
- **Why?** Opens "Because Robo Rita and Sporty Sam, who liked what you liked, liked this". Where no
  rater is behind a pick it says "People like you liked this" or "You liked other sport things".
- **Feed goals** (`goals: [like, watching, new]`). The student switches what the feed aims for and
  the feed and the bubble meter recompute at once (only on a tap, no timers). `like` is the usual
  feed. `watching` ("Keep me watching") shows only the kind they liked most, so the feed narrows
  to one kind (it gets shorter rather than mixing in other kinds once that kind runs out; use 4 or
  more items per kind so it still fills). `new` ("Something new") puts kinds they have not rated yet first, so it opens
  up. The feed starts on `like` (or the first goal listed if `like` is not there). **Why?** names
  the goal: "Because you liked lots of sport, and this feed wants you to keep watching." With no
  ratings yet every goal shows the same starting feed.
- **Bubble meter** (`bubble: true`). Under the feed: "Your feed has 1 of 4 kinds: bubble!" with a
  dot per kind, and the nudge "Like something different to break out." Rate only one kind and the
  feed shrinks to it; like something else and it opens again.

## Marking

- The task passes once the student has rated at least `minRated` items **and** opened a Why? on one
  recommendation (unless `showWhy: false`). Tapping a rating again takes it back.
- There is no right or wrong rating, so no wrong marks and no hints beyond "Rate 3 more" and "Tap
  Why? on one of your recommendations".

## Teacher tools

- **Live.** Every tap is mirrored at once. The student card shows e.g. `4/6 rated · feed 2 of 4
  kinds`, and `· opened Why?` once they have; with a goal switch it adds `· aim: Keep me watching`
  (the goal the feed is on; the shared state carries `goal` and `tried`). The student modal shows the student's ratings, their
  feed and the bubble meter, read-only.
- **Edit answers** lets the teacher change the student's ratings (marked teacher assisted); the
  feed follows.
- **Stage → Start again** clears the ratings; **Complete (show answers)** rates the first items
  and opens Why?.
- Go Live on an activity task is teacher-only: a student's answers are never broadcast.

## Session report

`itemProgress` is `{ correct, total }` = items rated out of `minRated`. The task summary adds
`recommenderResults`: `students`, `avgRated`, `avgFeedKinds` (how many groups the feed shows),
`openedWhyCount` and `bubbleCount` (students whose feed is a single kind). With `goals`, `goalCounts`
says how many students had the feed on each goal at some point (`{ like, watching, new }`), and
`avgFeedKinds` is measured on the goal each student left it on. See
[session-reports.md](../session-reports.md#activity-summary-fields).

## Devices and accessibility

- Mouse, touch and keyboard: every rating and Why? is a real button, at least 44px.
- A rating is shown by a pressed state and the thumb, not by colour alone; the bubble meter has
  words as well as dots.
- The feed is recomputed only when a rating changes: no timers or animation loop, so it stays smooth
  on a low-end Chromebook.

## Validation

Every Recommender validation message is listed under "Recommender" in
[validation-errors.md](../validation-errors.md).
