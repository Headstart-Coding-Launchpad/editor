# Rock-paper-scissors mind reader (a neural network that learns your moves)

- **Status:** planned
- **Branch:** feature/rps-mind-reader (built, not merged)
- **Kind:** activity
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 10 (a neural network: neurons that learn). Ryan liked the network idea but found the dots 'super boring', and called this 'a great idea'. The student plays rock-paper-scissors against a small neural network that learns their last few moves and starts beating them. Inputs (their last 3 moves, one-hot) and the 3 outputs are drawn and light up, so they see what neurons do.

Closest existing capability (from `lessons capabilities`): network_playground (platform-docs/activities/network_playground.md): trains a small network on fixed dots; no game, no live learning from the student.

Current workaround and why it falls short: The dots playground. Fails Ryan's fun bar ('I don't know how that is fun or teaches').

## Fun moment

Wow: 'it read my mind!' after about 20 rounds. Dial: how far back it looks. Theirs: their pattern, which it found. First used: AI Level 1 Lesson 10. Play: try to be unpredictable and fail; then beat it.

## Example task

    - type: rps_mind_reader
      rounds: 30          # rounds in the core
      lookBack: 3         # how many of your past moves it sees (student dial 1-5 with the panel)
      panels: [network, history]
      passAt: 20          # rounds played

## Checks wanted

Each round: the network predicts the student's move, plays the counter, then the student taps theirs; the network trains on that one example (online). Show the score (you vs it) and its prediction accuracy over the last 10 rounds. The network diagram lights inputs, hidden neurons and the chosen output each round. A 'Play random' tip after they lose: true randomness beats it (honest). Passes after `rounds` played (win or lose). Report score and its accuracy. Deterministic seed.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built as the `rps_mind_reader` activity on `feature/rps-mind-reader` (not merged, no PR yet). Fields: `rounds` (default 30), `lookBack` (default 3), `panels` (`network`, `history`, `lookback`), `passAt` (default `rounds`). It locks in a face-down pick before the student taps and flips it after; the read-rate chart shows it climbing; "Try playing randomly" tip after two lost rounds. Docs: [activities/rps_mind_reader.md](../activities/rps_mind_reader.md).
