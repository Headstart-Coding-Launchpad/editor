# Show the Stage drawing while input() is waiting

- **Status:** planned
- **Built:** 2026-10-20 on branch `feature/stage-draws-at-input`, not merged yet. Ryan was right: the Stage only drew when the run ended. It now shows the drawing so far at each `input()`. The Turtle drawing is unchanged (it plays as an animation after the run).
- **Kind:** module
- **Requested by:** Lesson Gen agent, from Ryan's look at the LG-P6 pilot Python Level 1 Lesson 10, 2026-10-20 (Ryan approved, filed direct)
- **Lessons blocked:** none, but it matters to Python Level 1 Lesson 10 (`ufj6g0z9d3`, nested if, taught Tue 20 Oct 13:00 and again with later classes), whose whole Project is a two-question story.

## Need

Ryan (2026-10-20): "can we ask the dev to make stages produce even if there is another input? It would be good for this lesson".

In L1 L10's mission control, typing "begin" draws the begin scene (navy, 🚀, "Mission started"), and then the program asks a second question, `input("Turn or stop? ")`. The student should see the begin scene appear while that question waits, then watch it change to the turn or stop scene once they answer. That's the lesson's point: the follow-up is only asked inside the begin branch, and the screen shows each step. Today the Stage doesn't show what was drawn before a later `input()` until the program moves on (Ryan's observation), so the first scene never shows on its own and the story loses its "one question, then the next" shape.

`docs/authoring/python.md` doesn't say what the Stage shows while `input()` waits. It says "Every call draws straight away" and describes slow-mo as record-then-replay because "a browser can't pause Python mid-run here".

**Closest existing capability:** slow-mo builds the Stage up step by step, but only on replay, after every `input()` has been answered, and it's off in Project tasks. Today's lesson fallback: the begin scene is only seen when the student types an unknown follow-up (it stays under the "Unknown command" text), or by tutor explanation.

## What's wanted

- When a Python program calls `input()`, the Stage (and the Turtle drawing, if it's cheap) shows everything drawn so far while the prompt waits for an answer.
- After the answer, drawing carries on on top as it does now.
- The same applies to every `input()` in the run, not just the first.
- If live drawing during the run is costly, drawing at each `input()` (a flush when the prompt appears) is enough.

## Example

```python
from stage import *
command = input("Begin or deactivate? ")
if command.lower() == "begin":
    background("navy")
    stamp("🚀", size=80)
    text("Mission started", "white", y=320, size=24)
    command = input("Turn or stop? ")   # the navy scene should be visible while this waits
    if command.lower() == "turn":
        background("purple")
        ...
```

## Checks wanted

- None new. Stage checks keep reading the final picture.

## Devices and accessibility

- All. No change to how the prompt is answered.

## Notes

- **Timing:** best before L1 L10 is next taught. If it can't land before 13:00 today, the next class to take the lesson benefits.
- If the Stage already flushes at `input()` and Ryan saw something else (e.g. the prompt covering the Stage on a small screen), say so in the resolution and Lesson Gen will re-check the lesson.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 10 mission scenes.md`.
