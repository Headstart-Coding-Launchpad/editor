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
| `map` | Yes | Rows of text, at most 10 x 10, all the same length. `#` wall, `.` floor, `R` robot start (exactly one), `T` treasure (exactly one), `X` pit (optional: falling in ends the try). The treasure must be reachable from `R` (a pit is not a way through). The edge of the grid counts as a wall. |
| `rewards` | No | The starting rewards the student can change: `{ treasure, step, wall, pit }`, whole numbers from -20 to 20. Default `{ treasure: 10, step: -1, wall: -5, pit: -10 }`. The pit reward only shows when the map has an `X`. |
| `episodes` | No | How many practice tries one press of **Train** runs (1 to 500). Default 50. The student can press Train again to practise more. |
| `showLearning` | No | Show the learning curve (one small bar per try, the last 40). Default true. |
| `race` | No | **Not built yet.** Accepted with a warning. Racing classmates needs a design decision; for now the tutor card shows each student's best score so the tutor can run a race on the big screen. |

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
  and shows its score.

## Marking and hints

- The task passes (no Check button) when a Go! reaches the treasure within the step limit.
- A missed Go! shows a plain-words hint that points at the mistake: treasure worth nothing, steps
  that earn a bonus (so it wanders), or "train it some more".

## Teacher tools

- The student card shows the tries and the best score, e.g. `50 episodes · best 8 (3 steps)`, or
  `training` while a Train is running. Compare cards to run a race on the big screen.
- The student modal shows the grid with the last Go! route, the rewards, the tries, the best score
  and the learning curve, live while the student trains (the count updates about every 2 seconds
  while watched).
- Teachers can award badges, use **Stage -> Start again** to clear the robot, and **Complete (show
  answers)** to fill in a trained robot. There is no Edit answers.
- Reports show `itemProgress` (trained, then found the treasure), the tries trained, the best score
  and whether the last Go! reached the treasure; the class summary adds how many trained, how many
  reached the treasure, the average tries and the best score.

## Devices

Ordinary Chromebooks and laptops with a mouse or trackpad; it works by touch too (big buttons, no
dragging). No camera or microphone.

## Validation

Every Game agent validation message is listed under "Game agent" in
[validation-errors.md](../validation-errors.md).
