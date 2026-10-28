# Mind Reader Activity

A Mind Reader task is an **activity**: a bounded exercise that can sit anywhere in a lesson, between
code tasks of any module. The student plays rock-paper-scissors against a tiny neural network. Each
round the network **locks in its pick** (a face-down card, "It has chosen") from the student's last
few moves, the student taps ✊, ✋ or ✌, the card flips, and the network learns from that one move.
After a few rounds it starts to read the student's pattern, and its read-rate climbs. It is built for
the lesson on neural networks (neurons that learn): the diagram on the left shows the last moves going
in, the neurons glowing and the three outputs, so students see what neurons do.

There is no Run button, no personal sandbox, no sharing and no carry-through. Progress is saved on
the device and mirrored to the teacher's student card. Data stays on the device; there is no camera,
microphone or live AI model, and the network is a few hand-written lines of maths.

Write `type: rps_mind_reader` on the task (the YAML shorthand for `taskType: activity` +
`activityType: rps_mind_reader`, which also works). In the Builder, choose the **Activity** format
and pick **Mind Reader**. The task's `title` and `description` / `explainer` show above the activity.

## Complete example

```yaml
id: rps-mind-reader-example
type: python
title: "Mind Reader example"
description: A short lesson using the Mind Reader activity.
tasks:
  - title: Can you beat the Mind Reader?
    type: rps_mind_reader
    description: Play rock-paper-scissors against a small neural network. Try to be unpredictable.
    rounds: 30
    lookBack: 3
    panels: [network, history, lookback]
    passAt: 20
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `rps_mind_reader` in YAML (JSON: `taskType: activity` + `activityType: rps_mind_reader`) |
| `rounds` | No | Rounds in the game, 5 to 100. Default 30. After the last round a finish card shows the score and how often it read the student, with **Play again**. |
| `lookBack` | No | How many of the student's past moves it sees, 1 to 5. Default 3. With the `lookback` panel this is where the **Remembers** dial starts. |
| `panels` | No | What to show, from `network`, `history`, `lookback`. Default `[network, history]`. `network` draws the brain; `history` the small chart of how often it read the student over the last 10 rounds, round by round; `lookback` the **Remembers 1 … 5** dial. Leave the dial out unless the lesson is about how far back the network looks. |
| `passAt` | No | Rounds played to pass, win or lose, 1 up to `rounds`. Default `rounds`. Play carries on to `rounds` after passing. |

## The screen

- **Left:** the network. Rows of three small circles are the student's last moves (✊ ✋ ✌, the
  circle lit for the move played), six neurons glow by how active they are, and three outputs show
  what it thinks they will play next. The outputs stay blank until the student has tapped (they would
  give the pick away); then the chosen output lights. Under it: "It guessed ✋ → played ✌ · you played
  ✊ · You win!". The face-down card sits beside it.
- **Right:** three big buttons (✊ ✋ ✌, at least 72px tall), the score ("You 7 – 12 It", "It read you
  8 of last 10"), one tip line, the optional Remembers dial, and the read-rate chart (a dashed line
  marks 33%, which is just guessing).
- **Tip:** after the student loses two rounds in a row: "Try playing randomly." It is honest: a
  random player has no pattern, so the network cannot do better than guessing.

## How it plays

- Each round the network predicts the student's next move from their last `lookBack` moves, then
  plays the move that beats it. The pick is saved with the round before the student taps.
- After the tap it trains on that one example (a few steps of plain gradient descent, a tiny
  network with 6 hidden neurons). The starting numbers use a fixed seed, so the same moves always
  give the same network.
- "Read" means the network's guess was the student's move. The chart and "It read you N of last 10"
  use the last 10 rounds.
- A student who repeats a pattern (✊ ✊ ✋ ✊ ✊ ✋ …) is read in about 9 or 10 of the last 10 by
  round 30; a random player is read about a third of the time.
- Changing **Remembers** rebuilds the network from the moves so far; the score and the picks already
  made stay.

## Marking and hints

- The task passes after `passAt` rounds are played, win or lose. There is no Check button and no
  wrong answer.
- Each tap is one change that is saved straight away (a *discrete* change), so the tutor sees every
  round live.

## Teacher tools

- The student card shows `round 18 · You 7–11 It · read 70%` (the last 10 rounds).
- The student modal shows the student's screen live, read-only, and **the card face up with a note
  that it is hidden from the student**, so the tutor can see what the network has locked in. There
  is no **Edit answers** (there is nothing to type).
- **Stage → Start again** clears the game; **Complete (show answers)** fills in a game of a student
  repeating a pattern.
- The session report adds `mindReaderResults`: students, average rounds, wins each side and the
  average share it read.
- Go Live on an activity task is teacher-only: a student's moves are never broadcast.

## Devices

Mouse, keyboard, trackpad or touch: the three moves are real buttons (Tab, then Enter or Space). The
network is a few hundred multiplications a round, so a low-end Chromebook is fine. The card flip
turns off with reduced motion.

## Validation

Every Mind Reader validation message is listed under "Mind Reader" in
[validation-errors.md](../validation-errors.md).
