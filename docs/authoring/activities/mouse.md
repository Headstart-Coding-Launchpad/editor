# Mouse Activity

A Mouse task is an **activity** (see [binary.md](binary.md) for what that means: no Run, no
sandbox, no sharing or carry-through; saved on the device and marked for the teacher). Students
practise clicking, double-clicking, right-clicking, dragging, scrolling and hovering on a stage of
large, friendly targets. Touch screens use the touch equivalents.

Write `type: mouse` on the task (the YAML shorthand for `taskType: activity` +
`activityType: mouse`, which also works). In the Builder, choose the **Activity** format and pick
**Mouse skills**.

## Complete example

```yaml
id: mouse-skills
type: python
title: Mouse Skills
description: Click, double-click, right-click, drag and scroll, then run a program.
tasks:
  - title: Mouse practice
    type: mouse
    description: Follow each instruction. The target you need has a coloured border.
    touch: equivalent
    targets:
      - id: star
        label: star
        emoji: "⭐"
        x: 0.2
        y: 0.3
      - id: folder
        label: folder
        emoji: "📁"
        x: 0.5
        y: 0.3
        size: medium
      - id: bin
        label: bin
        emoji: "🗑️"
        x: 0.8
        y: 0.7
      - id: list
        label: list
        emoji: "📜"
        x: 0.3
        y: 0.75
    items:
      - id: a
        action: click
        target: star
      - id: b
        action: double_click
        target: folder
        prompt: Double-click the folder to open it
      - id: c
        action: right_click
        target: star
      - id: d
        action: drag
        target: star
        to: bin
      - id: e
        action: scroll
        target: list
  - title: Now run some code
    starterCode: |
      print("I can use a mouse!")
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `mouse` in YAML (JSON: `taskType: activity` + `activityType: mouse`) |
| `targets` | Yes | Things on the stage (see below). |
| `items` | Yes | Instructions, done one at a time in order. |
| `touch` | No | What happens on a touch screen: `equivalent` (default: touch gestures count, hover items are skipped), `skip` (the same, without the hover warning), or `block` (a "needs a mouse" notice instead of the stage). |

### Targets

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Unique; items refer to it. |
| `label` | No | Name used in instructions ("Click the star") and read by screen readers. Defaults to the id. |
| `emoji` | No | Picture shown on the target. |
| `x`, `y` | Yes | Centre of the target as fractions of the stage: `0` left/top, `1` right/bottom. |
| `size` | No | `large` (default), `medium` or `small`. Every size stays at least 44px so it can be hit by small hands. |

### Items

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Unique. |
| `action` | Yes | `click`, `double_click`, `right_click`, `drag`, `scroll` or `hover`. |
| `target` | Yes | Target id to act on. A `scroll` target becomes a scrollable box. |
| `to` | `drag` only | Target id to drop onto. |
| `prompt` | No | Replaces the generated instruction. |

## Touch screens

| Mouse action | Counts on touch |
|---|---|
| click | tap |
| double-click | double-tap |
| right-click | press and hold |
| drag | touch drag |
| scroll | swipe inside the box |
| hover | no equivalent: skipped (a validation warning reminds you) |

Instructions switch to touch words ("Tap the star") on a touch-only device, and the teacher sees
a "Touch screen" badge on the card and in the modal.

## Mac and Chromebook

Right-click counts however the student's computer does it, because each one opens the browser's
context menu: **Ctrl + click** or a **two-finger click** on a Mac trackpad, **Alt + click** or a
**two-finger tap** on a Chromebook. This holds with `touch: block` too. The teacher's card shows
a **Mac** or **Chromebook** badge for work done on one. (Not yet checked on real devices.)

## Marking and hints

- Each instruction completes when the right gesture happens on the right target; the next one is
  then highlighted. When all are done the task is marked automatically.
- Doing the wrong gesture gives a hint ("That was a right click. Double-click the folder.");
  clicking the wrong target says which target to find.
- Pressing Enter on a focused target does not count as a click — this activity practises the
  mouse. The browser's own right-click menu is turned off on the stage.
- Each completed instruction is a *discrete* change and updates the teacher's card within a
  moment. Pointer movement is never streamed.

## Teacher tools

- The student card shows `n/m done` (with "(touch)" for a touch attempt); the modal shows the
  student's progress read-only.
- **Stage → Start again** clears the progress; **Complete (show answers)** marks every item done.
- Go Live is teacher-only on Mouse tasks; a student's work is never broadcast.

## Validation

See the Mouse table in [validation-errors.md](../validation-errors.md).
