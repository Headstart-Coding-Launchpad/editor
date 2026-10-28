# Network playground: student-picked inputs (x, y, x^2, y^2) and a new-dots test

- **Status:** planned
- **Branch:** feature/network-playground (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 10 (neural networks and layers) should show that better inputs can beat a bigger network: with x^2 and y^2 the circle is solved with no hidden layer. It should also test on dots the network didn't learn from (concept 4 is a Need). Builds on feature/network-playground (#101).

Closest existing capability (from `lessons capabilities`): network_playground (feature/network-playground docs/authoring/activities/network_playground.md): inputs are fixed at x and y; accuracy is on the training dots only.

Current workaround and why it falls short: Teach both in text. This fails the design choice: the student never sees the inputs change what the network can learn.

## Fun moment

Wow: tick x^2 and y^2 and the circle is cracked with no hidden layer at all. Dial: the inputs, layers and neurons. Theirs: their network. First used: AI Level 1 Lesson 10. Play: find the smallest network that solves the spiral.

## Example task

    - type: network_playground
      dataset: circle
      layers: [1]
      inputs: [x, y]            # starting inputs; the student can toggle x2 and y2
      allowInputs: [x, y, x2, y2]
      allowZeroLayers: true
      testDots: true            # 'Try new dots' scores 80 fresh dots from the same pattern

## Checks wanted

Passing unchanged (accuracy reaches target). Before the first Train, show 'not trained yet' instead of '0% right' (#308 review). Report inputs used, layers and new-dots score.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on branch `feature/network-playground` (not merged, no PR yet), in the existing `network_playground` activity ([docs](../activities/network_playground.md)). "Not trained yet" was already there. New task fields: `inputs`, `allowInputs` (subset of x, y, x2, y2, student toggles rebuild the network), `allowZeroLayers`, `testDots` ("Try new dots" scores 80 fresh dots with a different seed; "New dots: N% right"; passing unchanged). Inputs, layers and the new-dots score are in the shared state, tutor card and report. A unit test trains the circle from x2 and y2 with no hidden layer and reaches the target.
