# Electronics Lessons

Electronics lessons use an editable breadboard workspace. Students add parts from a palette, select components on the board, and connect pins from the inspector. The first implementation is click-to-add and click-to-wire rather than freeform drag-and-drop, but the saved circuit model is independent of that UI and can support drag gestures later.

## Lesson Envelope

```yaml
id: electronics-led-switch
type: electronics
title: LED Switch Circuit
description: Build a simple switched LED circuit.
sandboxStarterCircuit:
  version: 1
  board: { type: half-breadboard, rows: 14, cols: 20 }
  components:
    - id: battery1
      type: battery
      label: Battery
      position: { row: 1, col: 1 }
      pins: [positive, negative]
      props: { voltage: 5 }
  wires: []
  controls: {}
tasks: []
```

## Code Task Fields

| Field | Required | Notes |
|---|:---:|---|
| `starterCircuit` | Yes | Circuit object loaded when the task starts. |
| `completeCircuit` | No | Completed board shown by teacher tools and solo help. |
| `codeStages` | No | Array of hints/stages; each stage can contain `{ label, circuit }`. |
| `carryCircuitFrom` | No | Task ID to carry a previous saved board into this task. |
| `microcontroller` | No | Reserved for future virtual microcontroller support. `{ enabled: true }` shows a Code tab alongside Breadboard. |

Circuit objects contain `components`, `wires`, and `controls`. Component IDs and pin names are used in checks, for example `battery1.positive` or `led1.anode`.

## Checks

```yaml
check:
  type: circuit_connected
  from: battery1.positive
  to: led1.anode
  hint: Connect the battery positive rail to the LED anode.
```

| Check type | Required fields | Meaning |
|---|---|---|
| `circuit_no_short` | none | Battery positive and negative are not directly connected. |
| `circuit_component_exists` | `id`, `componentType`, or `label` | A matching part exists on the board. |
| `circuit_connected` | `from`, `to` | Two pin refs are connected through wires. |
| `circuit_not_connected` | `from`, `to` | Two pin refs are not connected. |
| `circuit_component_state` | `componentId`, `property`, `value` | A simulated state matches, such as `led1` `on` = `true`. |
| `circuit_pin_value` | `componentId`, `pin`, `value` | A control value matches, such as a potentiometer value. |

## Minimal Example

```yaml
id: electronics-led-switch
type: electronics
title: LED Switch Circuit
description: Wire an LED through a switch.
tasks:
  - title: Build the LED path
    explainer: Connect the LED so it can be powered by the battery.
    starterCircuit:
      version: 1
      board: { type: half-breadboard, rows: 14, cols: 20 }
      components:
        - id: battery1
          type: battery
          label: Battery
          position: { row: 1, col: 1 }
          pins: [positive, negative]
          props: { voltage: 5 }
        - id: led1
          type: led
          label: LED
          position: { row: 4, col: 8 }
          pins: [anode, cathode]
          props: {}
      wires: []
      controls: {}
    checks:
      - type: circuit_no_short
      - type: circuit_component_state
        componentId: led1
        property: on
        value: "true"
```
