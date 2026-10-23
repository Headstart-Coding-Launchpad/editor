# Space Station Activity

> **Phase 1 only.** The station covers Mouse and Keyboard Lessons 1 to 4 (power and colours,
> double-click, drag and Ctrl+Z, a scrolling catalogue). Right-click menus, hover tags, text on
> parts, copy and paste, and PNG / share link are not built yet; `lesson` must be 1, 2, 3 or 4.
> Design: [station-activity.md](../../architecture/station-activity.md).

A Space station task is an **activity** (see [binary.md](binary.md) for what that means: no Run,
no sandbox, no sharing; marked as you go). Each child has **one space station** that comes back
every week. Each lesson teaches one mouse or keyboard skill, and the child uses it, the way it
really works on a computer, to add something they can see. The station is carried from lesson to
lesson through the tutor's roster match (the host side of this is built separately); if a child
missed a lesson, earlier parts are added in default places so they can carry on.

Write `type: station` on the task (the YAML shorthand for `taskType: activity` +
`activityType: station`, which also works). In the Builder, choose the **Activity** format and
pick **Space station**.

| Lesson | Skill | What happens on the station |
|---|---|---|
| 1 Power Up | click presses / chooses | The station is dark. Click the three power buttons to light each section; click a swatch for the hull and light colours (swatches are in this lesson only). |
| 2 Special Delivery | double-click opens, one click selects | Crates arrive. One click selects a crate; a double-click opens it and the crew inside walk to their posts. Click a crew member to make them captain. |
| 3 Build It | drag moves; Ctrl+Z undoes | Drag modules from a tray onto empty spots; they snap in. Ctrl+Z (Cmd+Z on a Mac) puts the last change back. |
| 4 The Catalogue | scroll moves through a long list | Scroll a long catalogue, click to order parts, then drag each into place. |

## Complete example

Lesson 3, "Build It".

```yaml
id: station-build-it
type: python
title: Build It
description: Drag parts onto the space station.
tasks:
  - title: Build your station
    type: station
    description: Drag a part from the tray onto an empty spot. Made a mistake? Ctrl+Z puts it back.
    lesson: 3
    coreItems: 3
    items:
      - id: solar
        goal: place_part
        target: solar
        prompt: Drag the solar panel onto the station.
      - id: dome
        goal: place_part
        target: dome
        prompt: Drag the dome onto the station.
      - id: undo
        goal: undo
        prompt: Press Ctrl+Z (Cmd+Z on a Mac) to put the last part back.
      - id: any
        goal: place_part
        prompt: Add any other part you like.
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `station` in YAML (JSON: `taskType: activity` + `activityType: station`) |
| `lesson` | Yes | `1` to `4` (Phase 1). Sets the starting station: everything from earlier lessons is already there in default places (catch-up), then this lesson's setup is added (dark station, crates, tray, catalogue). |
| `items` | Yes | This week's goals, done in any order (see below). |
| `catalogue` | No | Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue. Lessons 1 and 2 have none. Default: the lesson's own list (Lesson 3: `solar`, `dome`, `greenhouse`, `docking-arm`; Lesson 4: `telescope`, `dish`, `flag`, `antenna`, `beacon`, `satellite`, `cargo-pod`, `rainbow-ring`, the best one last, at the very bottom). |
| `coreItems` | No | How many goals make the task pass, 1 to the number of `items`. The rest are **bonus**. Default: all goals. |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`power`, `hull`, …). |
| `goal` | Yes | What the child does (table below). |
| `target` | Depends | What the goal is about: a power section (`left`, `core`, `right`), `hull` or `lights`, a part id or a crate id. Leave out for "any" (or all three sections for `power_on`). Required for `pick_colour`. |
| `prompt` | No | The instruction shown. Default: a plain sentence made from the goal and target. |

## Goals and methods

Every goal records **how** it was done, and only the listed method completes it. The tutor sees
the method ("opened by double-click").

| Goal | Lessons | Target | Done when | Method that counts |
|---|---|---|---|---|
| `power_on` | 1 | a section id, or none = all three | that section (or all) is lit | `click`; Enter or Space on the focused button records `keyboard` and also counts |
| `pick_colour` | 1 | `hull` or `lights` (required) | a swatch is chosen | `click` or `keyboard` |
| `select` | 2, 3, 4 | a part or crate id, or none = any | a crate (Lesson 2) or part is selected by one click. The default prompt in Lesson 2 is "Select a crate." | `click` |
| `open_crate` | 2 | `crate-1`, `crate-2`, `crate-3`, or none = any | a crate is opened | **`double_click` only.** Enter opens the crate (keyboard access) but the goal stays open with the hint "Now try a double-click." |
| `choose_captain` | 2 | none | a crew member is made captain | `click` |
| `place_part` | 3, 4 | a part id, or none = any | the part sits on a spot | `drag`, or `pick_drop` (click to pick up, click to drop: the trackpad fallback). Both count. |
| `undo` | 3, 4 | none | a change is undone | `ctrl_z` or `cmd_z` only. The tutor's "Undo last change" never counts. |
| `order_part` | 4 | a part id, or none = any | the part is ordered from the catalogue | `click`; whether the child scrolled the list first is recorded too |

Parts you can name as targets: crates `crate-1`, `crate-2`, `crate-3` (each holds a crew member:
`crew-robot-1`, `crew-robot-2`, `crew-plant`; they stand in the portholes); Lesson 3 modules
`solar`, `dome`, `greenhouse`, `docking-arm`; Lesson 4 catalogue parts `telescope`, `dish`, `flag`,
`antenna`, `beacon`, `satellite`, `cargo-pod` and the module `rainbow-ring` (the prize, last in the
list). `place_part` and `order_part` targets must be in the task's catalogue.

Where parts fit (Lesson Gen's art, 18 spots): a 2x2 module goes on one of the four module spots (two
on top, two hanging under the hull); the docking arm also fits the two end spots; small parts go on
the part spots (two on top, two under, one on the top of the ring). Only parts that can hang
(`solar`, `rainbow-ring`, `dish`, `antenna`, `beacon`, `satellite`, `cargo-pod`) go under the hull,
drawn upside down; the dome, greenhouse, telescope and flag never do. Empty spots a part fits light
up while the child holds it.

Station saved before this art (older spot, post and part ids) is read gracefully: ids the station
no longer has are dropped and the catch-up puts the lesson's parts back in default places.

## Marking and hints

- Goals are marked as you go: a goal ticks the moment it is done with the right method, and the
  task passes when the core goals are done ("Station upgraded!"). The child can keep building
  after.
- A goal not done yet gets a short hint that never gives the answer away, for example "Now try a
  double-click." or "Drag a part onto an empty spot."
- Every station change is a discrete step (a click, a drop). Dragging itself is not saved.
- When the core goals complete, the station shows a short "Station upgraded!" moment: lights sweep
  across the hull and the newest part pops and sparkles (a still glow when the child prefers
  reduced motion). Each goal in the list has a small picture of the part, crate or badge it is
  about.

## Teacher tools

- The student card shows `n/m goals` and a small station; the student modal shows the full
  station read-only, live, with each goal's method.
- **Undo last change** puts the child's last change back (Lessons 1 and 2 have no Ctrl+Z yet).
  It never completes an `undo` goal.
- **Edit answers**, **Start again** and **Complete (show answers)** work as for other
  activities.
- The session report lists, for each goal, how many children did it and by which method.

## Devices

The station needs a mouse or trackpad (`requires: finePointer`). Touch is blocked: "This needs a
mouse or trackpad." The station picture is at least 560 px wide (it scrolls sideways on a narrower area) so every target is at least 44 px.

## Validation

Every Space station validation message is listed under "Space station" in
[validation-errors.md](../validation-errors.md).
