# Python slow-mo: run slowly, step through, and watch the variables change

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 3 of 6 in Lesson Gen's P6 Visual learning plan. It depends on build 1 (name-tag panel) and works with build 2 (Stage).

## Need

Ryan wants to "slow Python down" so students see what each line does to the variables. This matters most for:

- loops: what the loop variable holds on each pass
- reassignment: what a value was before it changed
- branches: which branch actually ran

It also serves GCSE-style trace tables for our 11–16s.

**Closest existing capability:** the `python` module runs the whole program at once (Pyodide). `turtle` draws instantly, with "no live redraw" (`turtle.md`, Runtime notes). Nothing in `lessons capabilities` steps through code.

**Research constraint:** step-through alone doesn't teach. Lessons will always pair it with a prediction or a single question. So it is **off unless a task turns it on**, and it must work well in a **teacher-led Go Live** demo. Ryan teaches every class in lockstep, so the main use is Ryan running slow-mo on the broadcast while the class has predicted first.

## Example task

```yaml
- id: 31
  moduleType: python        # also: turtle (and Stage when it ships)
  title: Watch the loop
  slowMo:
    enabled: true
    speed: 1.0              # default steps per second; student slider 0.25–4
    showVariables: true     # uses the name-tag panel (build 1)
    question: After pass 3, what is total?   # optional prompt shown when paused
  codeStages:
    - role: starter
      code: |
        total = 0
        for n in [4, 7, 2, 5]:
            total = total + n
        print(total)
```

**Controls:** Run normally (as now), **Slow-mo** (plays at the slider speed), **Pause**, **Step** (one line), **Step back**, and **Restart**.

**While running:**

- The current line is highlighted.
- Name tags update as values change. A changed tag pulses once, and its previous value is shown struck through. Keep a short history.
- A **loop pass counter** sits on the loop's header line ("pass 3 of 4" where knowable, "pass 3" otherwise).
- Output appears line by line as it prints.
- Stage and Turtle draw step by step instead of instantly.
- `input()` pauses for the answer as normal.

**Under the hood:**

- **Step back:** probably easiest as record-then-replay (e.g. `sys.settrace` in Pyodide), with the UI scrubbing through the recorded steps.
- **Runaway programs:** cap the recorded steps (e.g. 2,000) and say so in plain words: "Slow-mo stops after 2,000 steps. Is there a loop that never ends?"

**Later, not needed now:**

- A **trace-table view** built from the recording: one column per variable, one row per loop pass.
- Expression rewriting: `2 * x + 1` shown as `2 * 5 + 1`, then `11`.

## Checks wanted

- **No new completion checks.** Tasks complete on their existing checks.
- **Session report:** record whether slow-mo was used and how many steps were viewed, so Lesson Gen can see whether it was used.

## Devices

- **Tablets:** the controls are large buttons (at least 44 px) and the slider is touch-friendly.
- **Chromebooks:** keep stepping smooth. Recording up front means playback is cheap.

## Notes

- **Accessibility:**
  - Respect `prefers-reduced-motion`: no pulsing, a static marker instead.
  - Keep any flashing under 3 per second.
  - The current line and the changed tags have text equivalents for screen readers.
- **Teacher:**
  - Go Live is the main use. The broadcast should carry the slow-mo state (current step, panel) so students watch the same step.
  - The teacher's step controls drive the broadcast.
- **Order:** P6 build order is 1 name-tag panel, 2 Stage, 3 this, 4 scrubbing, 5 HTML Inspector, 6 Scratch slow-mo.

## Resolution

