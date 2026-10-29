# Game agent Activity

A Game agent task is an **activity**: a bounded exercise that can sit anywhere in a lesson. The
student sees a small grid world with a robot (`R`) and a treasure (`T`). They set the **rewards**
(how much the treasure, each step and bumping a wall are worth), press **Train**, and the robot
practises over many tries, learning by itself which move is worth most from each square
(reinforcement learning, Q-learning). **Watch it try** then runs what it learned once and shows the route
and the score. Set silly rewards and it does something daft; fix them and it finds the way.

There is no Run button, no code, no sharing and no carry-through. Progress is saved on the device,
mirrored to the teacher's student card, and marked as you go: the task passes when a Watch it try reaches
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
    description: Set the rewards, press Train, then press Watch it try to see if your robot finds the treasure.
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
| `episodes` | No | How many practice tries one press of **Train** runs (1 to 500). Default 50. With `randomCourses` a press runs 5 times as many (each try on a new training course). Not used with `brain: copy`. The student can press Train again to practise more. |
| `showLearning` | No | Show the learning curve (one small bar per try, the last 40). Default true. |
| `randomCourses` | No | Random solvable courses for **Try a new course**: `{ size, walls, pits, coins, seed }`, every part optional. `size` 5 to 9 (default 7), `walls` 0 to 0.4 (the share of squares that are walls, default 0.25), `pits` 0 to 3 (default 1), `coins` 0 to 3 (default 0), `seed` `class` (default) or a whole number. Replaces `testMaps` (setting both warns). See "Random courses". |
| `brain` | No | How the robot learns: `reward` (default; Q-learning from points) or `copy` (a small neural network that learns from the student's driving). See "Copy-bot". |
| `panels` | No | Extra pictures on the stage. `network` draws the copy-bot network (needs `brain: copy`). |
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
  made with other rewards cannot be compared). There is no Start again on the child's screen; the
  tutor clears a robot with **Stage -> Start again** (see Teacher tools).
- Training is paced so it can be watched: a few moves per animation frame, with the robot drawn on
  the map. The **Fast** side of the Slow / Fast switch does a big batch of moves per frame and skips
  the drawing. The work per frame is capped, so it stays smooth on a low-end Chromebook.
- **Watch it try** runs the learned moves greedily (no exploring) once from `R`, walks the route on
  the map and shows the result on the map's bottom edge. If the robot ends on the treasure, a small
  💎 stays in the cell corner.
- **What it learned** (a view on the map, after the first Train) draws a small arrow in each open
  square for the move the robot currently rates best there (no arrow where it has no opinion yet, or
  on walls and the treasure). It updates live while training. Student-side only.

## The screen

Built on the shared `ActivityLayout` (see the Layout briefs): the map on the left, one column on
the right, 5 controls on the default screen and at most 7 after the first Train.

- **Map** (left): the grid, with the result banner on its bottom edge (green "Found it in 5 steps!
  Score 10", red "Lost! ..."). On the map's top edge: the **Slow / Fast** switch (always) and, after
  the first Train, the view switch **Map | What it learned | What it senses** ("What it senses" only
  when the task sets `senses` or `maxSenses`).
- **Right column**, top to bottom: the one **main button** (Train, then Pause while training, then
  Watch it try, then Try a new map when `testMaps` is set; if the robot got lost, **Train more**
  becomes the main button and Watch it try the outline one); **Train more** as the outline button
  after training; one yellow tip line; the **What does it get points for?** card (Find the
  treasure, Each step, Bump a wall, plus Fall in a pit / Pick up a coin only when the map has `X` /
  `C`, with the caption "Changing anything makes it forget"); the **What can it sense?** fold
  (closed by default; only when the task sets `senses` or `maxSenses`; its header shows the senses
  that are on); and the **Score each try** chart (only when `showLearning` is on, display only).
- Words kept off the child's screen: "50 tries", "situations to learn", "8 ways" / "4 ways", "Go!",
  "Fast: on" and "Robot's-eye view". The tutor card keeps the tries count.
- Below 900px of panel width the layout stacks: map, main button, tip, rewards, fold, chart.

## Senses

The robot's table is keyed by what its senses report, not by the square. With only `position` it
memorises one map. With `walls` + `treasure_direction` it learns rules ("wall up and treasure to the
right, go right") that still work on a map it has never seen. More senses means more situations to
learn, so slower learning ("too many senses make slow learners"). The tutor's card and the Builder keep the number of situations; the child's screen does not show it.

- The senses are picture chips in the **What can it sense?** fold: Where I am, Walls next to me and
  one **Treasure compass** per lesson (8-way, or 4-way when the task's `senses` lists
  `treasure_direction_4` and not `treasure_direction`), plus Pit next to me / Coin compass when the
  map has `X` / `C`. They toggle on and off (at least one stays on, at most `maxSenses`) and are at
  least 44px high. **Changing a sense makes the robot forget everything**, the same as changing a
  reward.
- **What it senses** (a view on the map) dims the map and draws the robot's own square bright with
  what it senses: red edges where it feels a wall, an arrow towards the treasure (or the nearest
  coin), and a pit warning. A line under the map says it in words ("walls: up, left; treasure is
  down and right").
- **What it learned**: arrows per square when `position` is a sense, otherwise a short list
  "When it sees ..., it goes ..." of the situations it meets most.

## The mystery map

When `testMaps` is set, **Try a new map** joins the main-button chain (after a Watch it try that
found the treasure). The map swaps in place with a "Mystery map" ribbon and a **Back to my map**
link. Under the hood it It runs the trained robot once on one of the
sealed maps (they take turns), with no exploring and no training. In a situation the robot never met, it
does what it learned for the closest situation it knows (a compass point next door counts as half
alike), and it won't walk into the same wall twice from one square. Knowing nothing like it, it
guesses. A square number (`position`) means nothing on another map, so a robot that only knows its
square gets lost, while `walls` plus `treasure_direction` usually finds the way first time. The run
stops after 120 moves. The task passes (no Check button) when
that run reaches the treasure; **Watch it try** on the training map no longer decides the pass. Without
`testMaps` the old rule applies (a Watch it try reaches the treasure).

## Random courses

`randomCourses: { size: 7, walls: 0.25, pits: 1, seed: class }` makes **Try a new course** (the same
place in the main-button chain, the same rule as `testMaps`): it runs the trained robot once on the
next generated course, with no exploring and no training, and the task passes when that run reaches
the treasure. The map stays on screen with a "Mystery map" ribbon and a **Back to my map** link, and
the result line says which course it was ("Found it on the new course (course 3) ...").

- **A generated course** is a `size` x `size` square with `R` and `T` placed far apart, then walls (each
  square with chance `walls`), `pits` pits and `coins` coins on open squares. Coins pay the task's
  `rewards.coin` (3 when the task sets it or its map has a `C`; otherwise they pay nothing).
- **Always solvable.** Each course is checked with a breadth-first search from `R` to `T`, with pits
  counted as blocked. If it fails, it is thrown away and another is drawn.
- **No dead-end trap.** A trap is a pocket at least 2 deep: an open square with walls (or the edge)
  on 3 sides whose one way out is itself between walls. A robot that senses walls and the treasure
  compass steers toward the treasure, walks in, turns back and is pulled in again. A course is thrown
  away when the far end of such a pocket is within 3 squares (king moves) of the straight line from
  `R` to `T`. Single notches (the exit opens onto open ground) and pockets further away are allowed.
  After 200 failed draws the course falls back to an open board, so a very crowded setting never
  fails; in practice this is rare.
- **The same for the class.** The courses come from a seeded generator (mulberry32): the same seed
  always gives the same course 1, 2, 3 ... With `seed: class` the seed is made from the lesson id
  (a live session runs on the lesson id, so every student in it gets identical courses) and the task
  id (two course tasks in one lesson differ). A number seed gives the same courses in every lesson
  that uses it. In the Builder preview there is no lesson id, so the courses come from the task id.
  Each student walks through the sequence in order, one course per press. New rewards or senses make
  the robot forget everything and the sequence starts again at course 1.
- **Train practises on courses too.** With `randomCourses` (and the usual `brain`), each practice try
  runs on the next course of a separate **training stream** (a different seed from the courses
  **Try a new course** uses, so those stay unseen) instead of only the task's `map`; the `map` is
  just the first thing on screen. One press of Train runs `episodes` x 5 tries (default 250), the
  robot learns with a smaller step and explores for longer, and the grid shows the course it is
  practising on. The same training courses come back after a reload (the robot is rebuilt from the
  try count). Without `randomCourses` nothing changes.
- **How well the robot does.** A robot that only senses can still get lost on a fair course; with
  3 presses of Train on the 5 x 5 setting (`walls: 0.15`, no pits) `walls` plus `treasure_direction`
  clears about 70% of new courses, `treasure_direction` alone about 55%, and `position` about 15%.
  Bigger, wall-heavy courses are harder for every sense.

## Copy-bot

`brain: copy` swaps reward learning for imitation: the student **drives** the robot, and a small
neural network learns to copy them. It is how early self-driving cars learned.

    - type: game_agent
      brain: copy
      senses: [walls, treasure_direction]   # the default for a copy-bot; position is left out
      panels: [network]
      randomCourses: { size: 5, walls: 0.15, pits: 0, seed: class }   # optional; defaults apply

- **Drive.** The arrow keys, or the four on-screen arrow buttons (48px, no drag), move the robot on a
  practice course. Each move is an example: what the robot senses there (the sense vector) and the
  way the student went. A move into a wall is an example too. A course ends at the treasure or a pit;
  **Next course** moves to the next practice course (up to 6 courses and 200 moves in all). The
  screen says "You've shown it 34 moves on 2 courses". The practice courses come from the training
  stream described above, the same for the class with `seed: class`.
- **Train** fits the network on all the examples: 8 hidden neurons, 4 outputs (up, right, down,
  left), stochastic gradient descent, 600 steps, 60 per animation frame so the page stays smooth.
  It is seeded, so a reload rebuilds the same network from the drives. The button reads **Train
  again** once the student has driven more.
- **Watch it drive** runs the network on the next unseen class course (the courses **Try a new
  course** uses), one move per step, taking the most lit output. It does not walk into the same
  wall twice from one square and slightly prefers squares it has not stood on (so it does not circle
  for ever); everything else is what it copied. It stops after 120 moves.
- **Passes** when the copy-bot reaches the treasure on a new course (no Check button). A lost run
  says to drive more courses and train again.
- **Drive badly and it copies the mistakes.** It learns only from the examples: always driving right
  gives a bot that mostly drives right. This is the fun moment, and the unit tests hold both ways: a
  good driver (shortest way) on 3 courses gives a bot that clears about 78% of the first 5 unseen
  class courses (5 x 5 setting), and an always-right driver about 39%.
- **`panels: [network]`** draws the network under the grid: input neurons (one per sense light, named
  such as "wall up"), the hidden neurons, and four outputs (the arrows). Each dot is as dark as the
  number it holds and the output it picks has a ring; it lights as the bot decides on each step of a
  Watch it drive, and shows what it would do on the practice square once trained.
- **Defaults.** `senses` defaults to `[walls, treasure_direction]` (a square number means nothing on
  a new course); `randomCourses` defaults apply when it is left out; the rewards are not shown (the
  score on a course uses the default rewards); `testMaps` are ignored.
- **Race v1 (two tasks).** Put a `brain: copy` task and a `brain: reward` task (with `randomCourses`)
  in one lesson with `seed: class`. Both run on the class courses, and the tutor card of each shows
  its score by course number (`copy-bot · 34 moves · course 3: 8 pts` and `course 3: 5 pts · 250
  tries`), so the two can be compared on the same course numbers. There is no ranking screen.
- **Tutor visibility.** The shared state carries the drives (course and moves), so the tutor sees
  the driving live, the number of moves, whether it is trained and each new-course result, and can
  use **Stage -> Start again**, hints and badges as for the other Game agent tasks.

## Marking and hints

- The task passes (no Check button) when a Watch it try (Go! in the saved data) reaches the treasure within the step limit.
- A lost run shows a plain-words tip that points at the mistake: treasure worth nothing, steps
  that earn a bonus (so it wanders), or "train it some more".

## Teacher tools

- The student card shows the tries and the best score, e.g. `50 episodes · best 8 (3 steps)`, or
  `training` while a Train is running. With `race: true` and a mystery-map run it reads
  `mystery map: 8 pts · 50 tries` (or `lost`), so cards can be compared for a race.
- With `brain: copy` the card reads `copy-bot · 34 moves · course 3: 8 pts` (`not trained yet` before Train, `Not driven yet` before any move).
- With `randomCourses` the card lists the last four courses by number, e.g.
  `course 1: 8 pts · course 2: lost · course 3: 5 pts · 50 tries`, so the tutor can compare students
  on the same course. There is no ranking screen.
- Shared state (tutor visibility): the senses, rewards, tries, the last test-map result (reached,
  score, steps), the best test-map score and the number of test-map runs.
- No class ranking screen exists. Activities have no class-wide tutor view hook, only per-student
  cards, so the race is ranked by reading the card text. A proper ranking screen needs a class-level
  activity summary hook (a ranked list across `perStudent` states, live, on the tutor's view).
- The student modal shows the grid with the last route, the rewards (read-only), the tries, the best
  score and the learning curve (no switches or fold), live while the student trains (the count updates about every 2 seconds
  while watched).
- Teachers can award badges, use **Stage -> Start again** to clear the robot (the child cannot do this any more), and **Complete (show
  answers)** to fill in a trained robot. There is no Edit answers.
- Reports show `itemProgress` (trained, then found the treasure), the tries trained, the best score
  and whether the last Go! reached the treasure; the class summary adds how many trained, how many
  reached the treasure, the average tries and the best score, plus how many ran a test map, how many
  reached the treasure on one and the best test-map score. With `randomCourses` it also has
  `courseStudents` (students who tried a course), `avgCoursesTried` and `avgCoursesCleared`.

## Devices

Ordinary Chromebooks and laptops with a mouse or trackpad; it works by touch too (big buttons, no
dragging). No camera or microphone.

## Validation

Every Game agent validation message is listed under "Game agent" in
[validation-errors.md](../validation-errors.md).
