# Game agent Activity

A Game agent task is an **activity**: a bounded exercise that can sit anywhere in a lesson. The
student sees a small grid world with a robot (`R`) and a treasure (`T`). They set the **rewards**
(how much the treasure, each step and bumping a wall are worth), press **Train**, and the robot
practises over many tries, learning by itself which move is worth most from each square
(reinforcement learning, Q-learning). **Go!** then runs what it learned once and shows the route
and the score. Set silly rewards and it does something daft; fix them and it finds the way.

There is no Run button, no code, no sharing and no carry-through. Progress is saved on the device,
mirrored to the teacher's student card, and marked as you go: the task passes when a Go! reaches
the treasure. Data stays on the device; there is no AI model, only a small table the robot fills in.

Write `type: game_agent` on the task (the YAML shorthand for `taskType: activity` +
`activityType: game_agent`, which also works). In the Builder, choose the **Activity** format and
pick **Game agent**. The task's `title` and `description` / `explainer` show above the activity.

## Complete example

```yaml
id: game-agent-example
type: python
title: "Game agent example"
description: A short lesson using the Game agent activity.
tasks:
  - title: Teach the robot
    type: game_agent
    description: Set the rewards, press Train, then press Go! to see if your robot finds the treasure.
    map:
      - "#####"
      - "#R..#"
      - "#.#T#"
      - "#####"
    rewards:
      treasure: 10
      step: -1
      wall: -5
    episodes: 50
    showLearning: true
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `game_agent` in YAML (JSON: `taskType: activity` + `activityType: game_agent`) |
| `map` | Yes | Rows of text, at most 10 x 10, all the same length. `#` wall, `.` floor, `R` robot start (exactly one), `T` treasure (exactly one), `X` pit (optional: falling in ends the try), `C` coin (optional: picked up once per try, the robot walks through it). The treasure must be reachable from `R` (a pit is not a way through). The edge of the grid counts as a wall. |
| `rewards` | No | The starting rewards the student can change: `{ treasure, step, wall, pit, coin }`, whole numbers from -20 to 20. Default `{ treasure: 10, step: -1, wall: -5, pit: -10 }` (plus `coin: 3` when the map has a `C`). The pit and coin rewards only show when the map has an `X` / `C`. |
| `senses` | No | What the robot senses to tell situations apart (and the starting choice): `position` (its square), `walls` (the four sides), `treasure_direction` (8-way compass), `treasure_direction_4` (4-way compass), `pit_near`, `coin_direction` (compass to the nearest coin not yet picked up). Setting `senses` or `maxSenses` shows the sense buttons so the student can switch senses on and off. Default `[position]`: the old behaviour, the robot only knows its square. |
| `maxSenses` | No | The most senses on at once (1 to 6). Default 6. |
| `testMaps` | No | A sealed list (at most 5) of maps, same characters as `map`, that nobody trains on. See "The mystery map". |
| `episodes` | No | How many practice tries one press of **Train** runs (1 to 500). Default 50. The student can press Train again to practise more. |
| `showLearning` | No | Show the learning curve (one small bar per try, the last 40). Default true. |
| `race` | No | Race v1: the tutor card shows each student's best mystery-map score (`mystery map: 8 pts`) so the tutor can rank the class. Needs `testMaps` (a warning if missing). There is no class ranking screen yet; see "Teacher tools". |

## How the robot learns

- Four moves (up, right, down, left). Bumping a wall (or the edge) keeps the robot where it is and
  costs the **wall** reward. Any other move costs the **step** reward; reaching `T` pays the
  **treasure** reward and ends the try; falling into an `X` pays the **pit** reward and ends it.
- A try also ends after a step limit (4 x the number of open squares, at least 8).
- Tabular Q-learning with a fixed learning rate (0.5) and discount (0.9). It explores at random a
  lot at first, then less and less over the tries (epsilon-greedy, decaying per try). A seeded
  random number generator makes it deterministic: the same rewards and the same number of tries
  always give the same robot, so a saved state only needs the rewards and the try count.
- **Changing a reward makes the robot forget everything** (and clears the best score, since scores
  made with other rewards cannot be compared). **Start again** forgets without changing rewards.
- Training is paced so it can be watched: a few moves per animation frame, with the robot drawn on
  the grid. **Fast** does a big batch of moves per frame and skips the drawing. The work per frame
  is capped, so it stays smooth on a low-end Chromebook.
- **Go!** runs the learned moves greedily (no exploring) once from `R`, walks the route on the grid
  and shows its score. If the robot ends on the treasure, a small 💎 stays in the cell corner.
- **Show what it learned** (off by default) draws a small arrow in each open square for the move
  the robot currently rates best there (no arrow where it has no opinion yet, or on walls and the
  treasure). It updates live while training. Student-side only; the tutor view is unchanged.

## Senses

The robot's table is keyed by what its senses report, not by the square. With only `position` it
memorises one map. With `walls` + `treasure_direction` it learns rules ("wall up and treasure to the
right, go right") that still work on a map it has never seen. More senses means more situations to
learn, so slower learning ("too many senses make slow learners"). The student sees **Your robot has N
situations to learn** (the number of different situations the chosen senses can report on this map).

- Sense buttons are at least 44px high and toggle on and off (at least one stays on, at most
  `maxSenses`). **Changing a sense makes the robot forget everything**, the same as changing a reward.
- **Robot's-eye view** greys the grid and writes what the robot's senses report from where it
  stands ("walls: up, left; treasure is down and right").
- **Show what it learned**: arrows per square when `position` is a sense, otherwise a short list
  "When it sees ..., it goes ..." of the situations it meets most.

## The mystery map

When `testMaps` is set, **Go on a new map** appears. It runs the trained robot once on one of the
sealed maps (they take turns), with no exploring and no training. A situation the robot never met
gets a fixed made-up move, and the run stops after 120 moves. The task passes (no Check button) when
that run reaches the treasure; **Go!** on the training map no longer decides the pass. Without
`testMaps` the old rule applies (a Go! reaches the treasure).

## Marking and hints

- The task passes (no Check button) when a Go! reaches the treasure within the step limit.
- A missed Go! shows a plain-words hint that points at the mistake: treasure worth nothing, steps
  that earn a bonus (so it wanders), or "train it some more".

## Teacher tools

- The student card shows the tries and the best score, e.g. `50 episodes · best 8 (3 steps)`, or
  `training` while a Train is running. With `race: true` and a mystery-map run it reads
  `mystery map: 8 pts · 50 tries` (or `lost`), so cards can be compared for a race.
- Shared state (tutor visibility): the senses, rewards, tries, the last test-map result (reached,
  score, steps), the best test-map score and the number of test-map runs.
- No class ranking screen exists. Activities have no class-wide tutor view hook, only per-student
  cards, so the race is ranked by reading the card text. A proper ranking screen needs a class-level
  activity summary hook (a ranked list across `perStudent` states, live, on the tutor's view).
- The student modal shows the grid with the last Go! route, the rewards, the tries, the best score
  and the learning curve, live while the student trains (the count updates about every 2 seconds
  while watched).
- Teachers can award badges, use **Stage -> Start again** to clear the robot, and **Complete (show
  answers)** to fill in a trained robot. There is no Edit answers.
- Reports show `itemProgress` (trained, then found the treasure), the tries trained, the best score
  and whether the last Go! reached the treasure; the class summary adds how many trained, how many
  reached the treasure, the average tries and the best score, plus how many ran a test map, how many
  reached the treasure on one and the best test-map score.

## Devices

Ordinary Chromebooks and laptops with a mouse or trackpad; it works by touch too (big buttons, no
dragging). No camera or microphone.

## Validation

Every Game agent validation message is listed under "Game agent" in
[validation-errors.md](../validation-errors.md).
