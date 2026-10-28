# Neural network playground activity (AI Level 1)

- **Status:** planned
- **Branch:** feature/network-playground (built, not merged)
- **Kind:** activity
- **Requested by:** Ryan (approved by Ryan), 2026-10-23
- **Lessons blocked:** none yet

## Need

AI Level 1 teaches what a neural network is: a tiny network (2 inputs, 1-2 hidden layers of a few neurons) learns live to sort coloured dots on a 2D grid, with neurons and weights drawn, and an 'add a layer' step that suddenly cracks a harder pattern. TensorFlow Playground (Apache 2.0) is the model, much simpler.

Closest existing capability (from `lessons capabilities`): Classifier activity: learns live, but it's nearest-match, not a network, and shows no neurons or layers.

Current workaround and why it falls short: A video of TensorFlow Playground. Fails the concept: students don't train it or add a layer themselves.

## Fun moment

Wow: watch neurons learn to sort coloured dots, live. Dial: how many neurons and layers (add a layer and it suddenly gets the circle). Theirs: their own network. First used: AI Level 1, about Lessons 9-10 (concepts 12-13). Play: try the spiral with one layer, fail, then add one and watch it get it.

## Example task

    - type: activity
      activityType: network_playground
      dataset: circle          # two_blobs | circle | spiral (lesson-set)
      layers: [3]              # start: one hidden layer of 3
      allowAddLayer: true
      maxNeurons: 6
      target: 0.9              # accuracy to pass

## Checks wanted

Outcome: the network reaches the target accuracy on the dataset. Report itemProgress, final accuracy, and the layers used.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too. No camera or microphone. Must stay smooth on a low-end Chromebook (cap the work per frame).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (Plans/LG-P8 Concept map - AI Level 1.md, concepts 12-13 (a neural network; layers); about Lessons 9-10): Approved concept map (Ryan, 2026-10-23: 'These both sound excellent!')

Design brief (Ryan, 2026-10-22): the simplest version that works; simple and a bit silly beats clever; cut features before polish. Dev sizing was asked on handoff #100 and hasn't come back: please size it (rough size, Chromebook risks, what you'd cut first) before building. Data stays on the device; no live AI model.

## Resolution

Built as the activity `network_playground` on branch `feature/network-playground` (not merged, no PR yet). Docs: [activities/network_playground.md](../activities/network_playground.md). `dataset` two_blobs | circle | spiral, `layers`, `maxNeurons` (default 6), `allowAddLayer`, `target` (default 0.9); pure hand-written network in `src/activities/network_playground/network.js`. Reports itemProgress (0-10), final and best accuracy, and most layers used. Browser check on a real Chromebook still to do.
