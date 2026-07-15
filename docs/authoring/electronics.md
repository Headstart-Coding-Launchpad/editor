# Electronics Lessons

Electronics lessons use an editable breadboard workspace. Students drag parts from the palette onto the board, drag placed components to reposition them, and drag from one visible pin to another to create wires. Components render as circuit parts: buttons can be pressed, switches can be toggled, powered motors spin, powered buzzers sound, and energized wires show animated current. Wires can be selected and deleted, and selected components can be removed with the Delete key or inspector button.

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
| `availableComponents` | No | Array of component types students can add from the palette. Omitted = all components, including `battery`. New starter boards begin empty, so add a battery to the starter circuit or keep it available in the palette when students need one. |
| `carryCircuitFrom` | No | Task ID to carry a previous saved board into this task. |
| `microcontroller` | No | Reserved for future virtual microcontroller support. `{ enabled: true }` shows a Code tab alongside Breadboard. |

Circuit objects contain `components`, `wires`, and `controls`. Component IDs are internal save-file references for wires and controls. Checks should usually target parts by type and optional label, so students can solve the circuit flexibly.

Components support `label`, `position`, `rotation`, `pins`, `props`, and optional `locked: true`. Locked starter components are fixed for students: they can attach wires to the pins, but cannot move, delete, or edit the component. The builder can still label and configure them.

Available component types are `battery`, `resistor`, `led`, `push_button`, `slide_switch`, `potentiometer`, `motor`, `buzzer`, and `terminal`.

`terminal` is shown to students as a junction. It is a single shared connection point, useful when a circuit needs several wires to meet neatly.

Resistors support selectable values of 100 ohm, 220 ohm, 330 ohm, 1k ohm, 4.7k ohm, and 10k ohm through `props.resistanceOhms`. LEDs support `props.color` of `red`, `green`, or `blue`. The simulation uses a simple classroom model: series resistors reduce the estimated voltage reaching LEDs, motors, and buzzers, so LEDs dim and motors spin more slowly. Potentiometers act as a variable 10k ohm resistance for this estimate. It is not a full circuit solver.

## Checks

```yaml
checks:
  - type: circuit_no_short
  - type: circuit_control_affects_power
    control: { type: slide_switch }
    component: { type: motor }
    hint: Put the switch in series so it controls the motor.
```

| Check type | Required fields | Meaning |
|---|---|---|
| `circuit_no_short` | none | Battery positive and negative are not directly connected. |
| `circuit_has_component` | `component` selector, optional `minCount` | At least one matching part exists on the board. |
| `circuit_component_powered` | `component` selector | A matching output part is powered/on. |
| `circuit_component_unpowered` | `component` selector | All matching parts are unpowered/off. |
| `circuit_control_affects_power` | `control` selector, `component` selector | Opening/closing a switch or button changes whether the target part is powered. |
| `circuit_path_exists` | `from`, `to` endpoints | A closed connection path exists between matching part pins. |
| `circuit_path_includes` | `from`, `to` endpoints, `includes` selector | A closed connection path exists and passes through a matching part. |

Selectors use component type and an optional label:

```yaml
component: { type: motor }
control: { type: slide_switch, label: Main switch }
includes: { type: resistor }
```

Endpoints use component type, pin, and an optional label:

```yaml
from: { type: battery, pin: positive }
to: { type: led, pin: anode }
```

## Minimal Example

```yaml
id: electronics-led-switch
type: electronics
title: LED Switch Circuit
description: Wire an LED through a switch.
tasks:
  - title: Build the LED path
    explainer: Connect the LED so it can be powered by the battery.
    availableComponents: [battery, led, resistor, slide_switch, terminal]
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
      - type: circuit_component_powered
        component: { type: led }
```
