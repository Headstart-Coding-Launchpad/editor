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
| `inputs` | No | The inputs the network starts with, from `x`, `y`, `x2` (x squared) and `y2` (y squared): 1 to 4 different ones. Default `[x, y]`. Each input is one node on the left of the diagram, labelled x, y, x², y². |
| `allowInputs` | No | The inputs the student may switch on and off (a subset of `x, y, x2, y2`, 1 to 4). Shows an **Inputs** row of toggle buttons (at least 44px, at least one stays on). Changing one rebuilds the network with fresh numbers, like changing a layer. Leave it out for fixed inputs. `inputs` must be inside it. |
| `allowZeroLayers` | No | `true` lets the student remove every hidden layer, so the inputs go straight to the output (**Remove a layer** works down to none; `layers: []` can start there). Default `false`. |
| `testDots` | No | `true` adds **Try new dots**: it scores 80 fresh dots (40 each colour) from the same pattern, made with a different seed from the training dots, and shows **New dots: N% right** beside the training score. It does not change whether the task passes. The score clears when the network trains again or is rebuilt. Default `false`. |
| `target` | No | Accuracy to pass, above 0.5 and up to 1. Default 0.9. |

## Better inputs beat a bigger network

With `inputs: [x, y]` and no hidden layer the network can only draw a straight line, so the
`circle` cannot be cracked. Switch on `x2` and `y2` (x and y squared) and the circle is a straight
cut on those: the unit tests train it with no hidden layer and it reaches the target in a few
passes. A good setup for the lesson is `dataset: circle`, `layers: [1]`,
`allowInputs: [x, y, x2, y2]`, `allowZeroLayers: true`, `testDots: true`.

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
- With `allowInputs` the card adds `· inputs x², y²`; with `testDots` and a score, `· new dots 90%`.
  A network with no hidden layers shows as `0 layers (none)`. The modal's diagram shows the same
  input nodes and the New dots score, read-only, and they are part of the shared state.
- Session reports also keep `inputs` and the new-dots score; the class summary adds `inputCounts`
  (how many students used each input, when `allowInputs` is set) and `avgNewDots` (when `testDots`
  is on).
- Session reports show each student's final accuracy, best accuracy and most layers used, and the
  class summary adds how many reached the target and the average layers used.
- Go Live on an activity task is teacher-only: a student's network is never broadcast.

## The screen

Built on `ActivityLayout`. The dots are on the left with the score above them: a big "92% right ✓" with
a goal mark on a bar, and (with `testDots`, after Try new dots) "On new dots: 88%" beside it. On the
right, "Your network" is the diagram: with `allowInputs` the other inputs (x², y²...) are dashed,
faded circles on the diagram that you tap to switch on (they replace the old input buttons). Under it
are a Layers stepper (hidden with `allowAddLayer: false` unless `allowZeroLayers`) and a Neurons
stepper per layer. Train (Pause, Train more) is the one filled button, Start again is a link, and
Try new dots becomes the main button once it passes (`testDots`). The tip line says what to do
("Press Train and watch the colours change", "It got stuck..."). Default screen: Train, Start again,
Layers, Neurons (4 controls); 5 with `allowInputs`.

## Devices

Ordinary Chromebooks and laptops with a mouse or trackpad; works by touch too (buttons only). No
camera or microphone. The work is capped: one pass over the 160 dots (well under a millisecond)
every 6th frame, about 10 passes a second, so children can watch it learn (two blobs takes a few
seconds, the spiral with two layers 5-10 seconds). The 30 by 30 heatmap redraws every 2nd pass.

## Validation

Every Network Playground validation message is listed under "Network Playground" in
[validation-errors.md](../validation-errors.md).
