# Network Playground Activity

A Network Playground task is an **activity**: a bounded exercise that can sit anywhere in a
lesson, between code tasks of any module. The student sees orange and blue dots on a grid and a
tiny **neural network** (2 inputs, 1 or 2 hidden layers of neurons, 1 output) drawn beside it.
They press **Train** and watch it learn: the coloured background shows what the network guesses,
the lines between the neurons show its weights, and the percentage shows how many dots it gets
right. They can change the neurons in a layer, **add a layer**, and start again, so they can try
the circle with one layer, fail, add a layer and watch it crack the pattern. It teaches "a
neural network learns by adjusting numbers, and more layers can learn harder patterns".

The task is **marked as you go**: it passes the moment the network's accuracy reaches `target`.
There is no Check my work button, no Run button, no personal sandbox, no sharing and no
carry-through. Everything runs on the student's device: no live AI model, no data leaves it.

Write `type: network_playground` on the task (the YAML shorthand for `taskType: activity` +
`activityType: network_playground`, which also works). In the Builder, choose the **Activity**
format and pick **Network Playground**: the editor sets the dots, the starting layers, the limits
and the target. The task's `title` and `description` / `explainer` show above the activity.

## Complete example

```yaml
id: network-playground-example
type: python
title: "Network Playground example"
description: A short lesson using the Network Playground activity.
tasks:
  - title: Sort the dots
    type: network_playground
    description: Train the network until it sorts the orange and blue dots.
    dataset: two_blobs
    layers: [3]
    target: 0.9
  - title: Crack the circle
    type: network_playground
    description: One layer is not enough here. Add a layer, or more neurons.
    dataset: circle
    layers: [1]
    allowAddLayer: true
    maxNeurons: 6
    target: 0.9
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `network_playground` in YAML (JSON: `taskType: activity` + `activityType: network_playground`) |
| `dataset` | Yes | The dots: `two_blobs` (easy, one line sorts it), `circle` (needs a hidden layer; one neuron cannot do it) or `spiral` (hard, wants two layers). Always the same 160 dots for a name. |
| `layers` | No | The hidden layers the network starts with, as neurons per layer: `[3]` (default) or `[4, 3]`. 1 or 2 layers, each from 1 to `maxNeurons`. |
| `maxNeurons` | No | Most neurons the student can put in one layer, 1 to 8. Default 6. |
| `allowAddLayer` | No | Show **Add a layer** and **Remove a layer** (2 hidden layers at most). Default `true`. `false` leaves only the neuron buttons. |
| `target` | No | Accuracy to pass, above 0.5 and up to 1. Default 0.9. |

## Marking and hints

- The task passes when the network's accuracy on the dots is at least `target`. It is judged on
  the dots on screen (this is a playground, there is no held-back test set).
- Training runs one pass over the dots per animation frame and stops by itself when the accuracy
  has held at the target for a moment, or after 2000 passes (it then says it got stuck and
  suggests more neurons or another layer). **Pause** stops it any time; **Train more** carries on.
- Changing the neurons, adding or removing a layer, or **Start again** gives the network fresh
  random numbers.
- Before it passes, the hint under the activity says to press Train, to train for longer, or to
  try more neurons or another layer. It never says how many.
- How hard each pattern is (fixed seeds, plain training): `two_blobs` is solved with 1 hidden
  layer of 3; `circle` is not solvable with 1 neuron but is with 3 or 4; `spiral` is not solved by
  one layer but usually is by two layers of 6 (sometimes the random start is unlucky: Start
  again).

## Teacher tools

- The student card shows the live line, for example `Training · 72% · 1 layer (3)` or
  `93% · 2 layers (4+3) · best 95%`.
- The student modal shows the student's own network, background and accuracy live, read-only (the
  network's numbers are shared while it trains, at most every 2 seconds, and on every start,
  stop and layer change). The tutor can watch a student get stuck, then nudge them to add a
  layer. There is no **Edit answers** (there is nothing to type).
- **Stage → Start again** resets the student's network; **Complete (show answers)** marks it
  passed with 100% (no network drawn).
- Session reports show each student's final accuracy, best accuracy and most layers used, and the
  class summary adds how many reached the target and the average layers used.
- Go Live on an activity task is teacher-only: a student's network is never broadcast.

## Devices

Ordinary Chromebooks and laptops with a mouse or trackpad; works by touch too (buttons only). No
camera or microphone. The work per frame is capped (one pass over 160 dots, well under a
millisecond; the heatmap is 30 by 30 cells and is redrawn every 4th frame).

## Validation

Every Network Playground validation message is listed under "Network Playground" in
[validation-errors.md](../validation-errors.md).
