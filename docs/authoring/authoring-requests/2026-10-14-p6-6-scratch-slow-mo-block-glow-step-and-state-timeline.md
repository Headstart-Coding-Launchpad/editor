# Scratch slow-mo: block glow, step button and a state timeline

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 6 of 6 in Lesson Gen's P6 Visual learning plan.

## Need

Scratch students see only where the stage ends up, never the steps in between. Two misconceptions in Lesson Gen's `Known Misconceptions - Scratch.md` come straight from this:

- **"Two quick switches expected to show both scenes"** (Level 1 Lesson 7). 4 of 5 students got this wrong on the end quiz after fixing it in a task.
- **"Next Costume after Switch Costume read as staying on the named costume"** (L6, L7).

The Scratch Lesson Guide currently works around this by adding wait blocks so each state is held on screen. That shows the state but not the mechanism. Later levels add variables, broadcasts and loops running at the same time, which are even less visible.

**Closest existing capability:** the `scratch` module (`docs/authoring/scratch.md`) has variable monitors and stage-state checks (`sprite_property`, `variable_equals`, `block_run`). There is no step mode, no slow mode, and no history of state changes.

## Example task

```yaml
- id: 18
  moduleType: scratch
  title: Watch the costumes change
  slowMo:
    enabled: true
    speed: 1.0          # blocks per second; student slider
    timeline: [costume, backdrop, x, y, variables]
```

**Controls:** **Slow-mo** (runs at the slider speed), **Pause**, **Step** (one block), and **Restart**.

**While running:**

- The running block glows in the script, and the stage redraws **after every block**, so "two quick switches" visibly shows both.
- Where several scripts run at once, each running script's current block glows.

**State timeline:** a strip under the stage records one snapshot per step:

- the costume (as a thumbnail)
- the backdrop
- x and y
- variable values

Students can click any snapshot to see the stage at that moment.

## Checks wanted

- **No new completion checks.**
- **Session report:** record whether slow-mo was used.

## Devices

- **Tablets** (many Scratch students use them): big buttons, at least 44 px, and a timeline that can be swiped.

## Notes

- **Ages:** 7–11. Keep the controls very simple: three or four buttons, with icons and words.
- **Accessibility:** follow `prefers-reduced-motion` (a static highlight instead of glow animation), and label the timeline snapshots in text.
- **Teacher:** works in Go Live, so Ryan can step the class through a script.
- **Order:** P6 build order is 1 name-tag panel, 2 Stage, 3 Python slow-mo, 4 scrubbing, 5 HTML Inspector, 6 this.

## Resolution

Shipped 2026-10-14 on `feature/scratch-slow-mo`, as specced. See [scratch.md → Slow-mo](../scratch.md#slow-mo).

- **Field:** `slowMo: { enabled, speed, timeline }`, off unless `enabled: true`. The speed slider goes from 0.25 to 4 blocks a second.
- **Controls:** 🐢 Slow-mo, ⏸️ Pause, 👣 Step and ⏮️ Restart, each a big button (at least 44 px) with an icon and a word, plus a speed slider. Restart also puts the stage back and clears the timeline.
- **While running:** the running block glows in each running script, and the stage redraws after every block. Under reduced motion the glow is a still outline.
- **Step:** one block per press. When several scripts run at once, they take turns (round-robin, in the order they started). If every script is busy (inside a wait or glide), the Step is kept for the next script that's ready.
- **Timeline:** one card per step, with the costume picture, backdrop, x, y and variables. It swipes on tablets, and each card has a text label. Tap a card to preview the stage at that step, then "Back to now". It keeps 500 steps.
- **Checks:** none new. A slow-mo run is a green-flag run, so checks and "still building" work as before.
- **Go Live:** the teacher's controls drive the glow, the stage and the step number the class sees. A tutor watching a student sees that student's glow and step. The timeline isn't synced.
- **Session report:** `slowMoUsed`, `slowMoRuns` and `slowMoSteps` per student per task, and `slowMoUsedCount` per task.

