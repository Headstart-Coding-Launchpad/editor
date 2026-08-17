# Electronics Module Code-Task Authoring

Electronics code tasks use an editable breadboard workspace. Students drag parts from the palette onto the board, drag placed components to reposition them, and drag from one visible pin to another to create wires. Components render as circuit parts: buttons can be pressed, switches can be toggled, powered motors spin, powered buzzers sound, and energized wires show animated current. Wires can be selected and deleted, and selected components can be removed with the Delete key or inspector button.

## Composed Lesson and Electronics Module

```yaml
id: electronics-led-switch
type: composed
title: LED Switch Circuit
description: Build a simple switched LED circuit.
modules:
  - id: electronics-practice
    type: electronics
    sandbox:
      sandboxStarterCircuit:
        version: 1
        board: { type: half-breadboard, rows: 18, cols: 30 }
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
| `codeStages` | No | Array of hints/stages; each stage can contain `{ label, circuit, role? }`. See **Stage object** for role and reveal behaviour. |
| `availableComponents` | No | Array of component types students can add from the palette. Omitted = all components, including `battery`. New starter boards begin empty, so add a battery to the starter circuit or keep it available in the palette when students need one. |
| `carryCircuitFrom` | No | Task ID to carry a previous saved board into this task. |
| `microcontroller` | No | Legacy compatibility for older drafts. New lessons should add a `microcontroller` component; the MicroPython tab appears automatically when one is present. |

Circuit objects contain `board`, `components`, `wires`, and `controls`. Component IDs are internal save-file references for wires and controls. Checks should usually target parts by type and optional label, so students can solve the circuit flexibly.

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Starter stages carry `circuit`. Every Support stage is an offerable read-only reference; electronics references currently show code only. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

The default board is `18 x 30`. The builder can switch between compact `14 x 20`, standard `18 x 30`, and large `22 x 36` boards by updating `board.rows` and `board.cols`.

Components support `label`, `position`, `rotation`, `pins`, `props`, and optional `locked: true`. Locked starter components are fixed for students: they can attach wires to the pins, but cannot move, delete, or edit the component. The builder can still label and configure them.

Wires support `id`, `from`, `to`, `color`, and optional `locked: true`, mirroring the component convention. A locked wire cannot be deleted or recolored by students; the builder can still toggle its "Fixed for students" checkbox, change its color, or delete it. Students can still attach new wires to the same pins.

A populated wire connects two placed components by id and pin, using the same `{ component, pin }` shape as a Checks endpoint selector below, but naming one specific placed component rather than matching flexibly by type:

```yaml
wires:
  - id: w1
    from: { component: battery1, pin: positive }
    to: { component: led1, pin: anode }
    color: red
```

Available component types are `battery`, `resistor`, `led`, `push_button`, `slide_switch`, `potentiometer`, `motor`, `servo_motor`, `buzzer`, `rgb_led`, `lcd1602`, `microcontroller`, `transistor`, `diode`, `sensor`, and `terminal`.

In the builder, available components can be toggled one at a time or by group: Power, Basics, Outputs, and Control. Lessons still save `availableComponents` as the individual component type array shown above.

`terminal` is shown to students as a junction. It is a single shared connection point, useful when a circuit needs several wires to meet neatly.

Batteries support `props.voltage`; the workspace inspector offers 1.5V, 3V, 5V, 9V, and 12V presets. Powered components and selected wires show estimated voltage and current. Parallel branches receive the same supply voltage and add to total battery current; series devices share the supply voltage and draw less current. This is a classroom DC estimate for simple breadboard circuits, not a SPICE-grade solver.

New part defaults:

| Type | Pins | Notes |
|---|---|---|
| `transistor` | `collector`, `base`, `emitter` | An electronic switch. The simulation connects collector to emitter when the base has a high signal, either from a wire connected to battery positive or the inspector's Base signal toggle. |
| `diode` | `anode`, `cathode` | A one-way protection part. The classroom simulation treats anode-to-cathode as a valid path and shows when it is conducting. |
| `sensor` | `positive`, `signal`, `negative` | A readable input part. `props.kind` defaults to `light`; supported inspector choices are `light`, `temperature`, and `distance`. |
| `servo_motor` | `positive`, `signal`, `negative` | A precise-angle motor. `props.angle` defaults to `90`, and the inspector can simulate angles from 0 to 180 degrees. |
| `rgb_led` | `red`, `green`, `blue`, `cathode` | A multi-colour LED. Connect one or more colour pins to positive and the cathode to negative to mix channels. |
| `lcd1602` | `VCC`, `GND`, `SDA`, `SCL` | A 16×2 I²C character display. Connect VCC/GND for power and wire SDA/SCL directly (or through junctions) to the Micro Controller GPIO pins named in code. |
| `microcontroller` | `3V3`, `GND`, `GP0`, `GP1`, `GP2`, `GP3` | Runs MicroPython in the Code tab. `3V3` and `GND` act as a simulated 3.3V supply. GPIO pins can drive connected breadboard parts when MicroPython sets them high or low. The builder inspector can add, rename, or remove GPIO pins; wire references are updated when pins are renamed and removed when pins are deleted. `props.code` stores the component's MicroPython code. |

Resistors support selectable values of 100 ohm, 220 ohm, 330 ohm, 1k ohm, 4.7k ohm, and 10k ohm through `props.resistanceOhms`. LEDs support `props.color` of `red`, `green`, or `blue`. Potentiometers act as a variable 10k ohm resistance for the voltage/current estimate.

## MicroPython

Add a `microcontroller` component to the starter board to enable the MicroPython tab. The tab uses the same Python code editor as Python lessons, including syntax highlighting and editor behavior. Student code is saved inside the serialized circuit as `props.code` on the Micro Controller component, so reset, carry-through, stages, teacher live view, and local saving continue to work through the normal electronics circuit state.

The runner executes MicroPython-style code through the existing Python runtime with a small `machine.Pin` and `utime.sleep_ms` shim. This supports common introductory snippets such as:

```python
from machine import Pin

led = Pin("GP0", Pin.OUT)
led.on()
print("Micro Controller running")
```

When a student runs MicroPython, `Pin` output values are sent to the circuit through a private GPIO protocol rather than through visible console output. A high GPIO pin acts like a 3.3V signal source referenced to the Micro Controller's `GND`; a low GPIO pin is tied to `GND`. The visual circuit updates while the program runs and stays in the final state after the run so students can see the result on the breadboard.

### 16×2 I²C LCD

Add the **16×2 LCD (I²C)** from Outputs, then wire `VCC` to `3V3`, `GND` to `GND`, and `SDA`/`SCL` to two GPIO pins. The built-in `lcd1602` helper follows the familiar Arduino-style display calls while staying small enough for beginners:

```python
from lcd1602 import LCD1602

lcd = LCD1602(sda="GP0", scl="GP1")
lcd.init()
lcd.backlight()
lcd.print("Hello!")
lcd.setCursor(0, 1)
lcd.print("Headstart")
```

`clear()` empties both rows, `noBacklight()` turns off the simulated backlight, and each row holds up to 16 characters. Display commands affect only a powered LCD whose SDA and SCL wires reach the GPIO names passed to `LCD1602`.

`Pin.IN` reads are derived from the connected breadboard state. A signal pin wired to `3V3`, battery positive, or another high source reads `1`; a pin wired to `GND` or a low source reads `0`; a floating pin follows `Pin.PULL_UP` or `Pin.PULL_DOWN`. MicroPython `sleep` and `sleep_ms` calls poll the latest circuit controls, so button presses and switch changes can be observed inside common `while True` loops.

## Checks

Electronics checks evaluate from the current board state after circuit edits, simulation updates, or the Check Circuit action. The builder groups them as Safety, Part, Control, Connection, and Code checks, then stores the circuit-specific selector fields such as `component`, `control`, `from`, `to`, and `includes`. `feedbackChecks` use the same circuit check shapes and require a completion `check`. Use `show: on_idle` for guidance after a student pauses editing the circuit, or `show: after_attempt` for feedback after Check Circuit. `mode: nudge` shows guidance without failing; `incorrectChecks` is a legacy alias for blocking feedback.

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

Electronics tasks with a `microcontroller` component can also use the shared generic code checks — `code`, `code_contains`, `code_equals`, `code_matches_regex`, and their negated variants (`code_not_contains`, `code_not_equals`, `code_not_matches_regex`) — the same check types Python, HTML, and Arcade Kit lessons use. These evaluate against the Micro Controller's MicroPython source (`props.code`), not the serialized circuit, so authors can check for specific code patterns alongside circuit-shape checks. The Builder's check editor exposes this as a **Code** subject (alongside Safety, Part, Control, and Connection) with the same contains/equals/matches regex operators and wording used for Python and HTML code checks, so authors do not need to hand-edit lesson JSON/YAML to add one:

```yaml
checks:
  - type: circuit_has_component
    component: { type: microcontroller }
  - type: code_contains
    value: Pin("GP0", Pin.OUT)
```

If a board has more than one `microcontroller` component, code checks evaluate against the first one found.

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
type: composed
title: LED Switch Circuit
description: Wire an LED through a switch.
tasks:
  - title: Build the LED path
    moduleType: electronics
    moduleId: electronics-practice
    explainer: Connect the LED so it can be powered by the battery.
    availableComponents: [battery, led, resistor, slide_switch, terminal]
    starterCircuit:
      version: 1
      board: { type: half-breadboard, rows: 18, cols: 30 }
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
