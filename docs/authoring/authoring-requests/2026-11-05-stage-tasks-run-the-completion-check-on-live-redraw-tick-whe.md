# Stage tasks: run the completion check on live redraw, tick when correct, never show wrong while typing

- **Status:** planned
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-11-05
- **Lessons blocked:** none yet

## Need

On Stage tasks the editor redraws the Stage live as the student types, but completion checks only run when the student presses Run or lets go of a dragged number (python.md, Typing redraws too). A student who types the right code sees the picture appear and the task does not tick until they press Run. Ryan wants the check to also run on the live redraw, and to only tell the student when it is CORRECT (tick/celebrate), never to show 'wrong' or a failed-check message while they are mid-typing.

Closest existing capability (from `lessons capabilities`): Stage live redraw (python.md, Typing redraws too) and the Run-time completion checks. Lacks: running checks on redraw, and a silent-until-correct mode.

Current workaround and why it falls short: Tell students to press Run, or keep Run in the task; typed Stage tasks do not tick until Run (Level A Lesson 1 reports).

## Devices

All devices; matters most for the typed Stage tasks in Python v13 Level A (iPad students type slowly and see partial code).

## Notes

Ryan 5 Nov 13:48-13:49. Behaviour wanted: while the student is typing, no failing/wrong feedback at all; as soon as the code satisfies the check the task shows correct. Failing feedback only after Run.

## Resolution

Built on branch `feature/stage-live-tick` (not merged yet; Status becomes shipped once it is on
main). Design: HSC Hub Research "LaunchPad request 131 tick without Run design 2026-11-05", on
the Run split already on main (runJudge.js judgeRun, runRecord.js recordRun). A finished typed
redraw (useScrubPreview `onPreviewResult`) is judged by the Run's own `judgeRun`; a pass ticks the
task and is recorded by the Run's own `recordRun` with the attempt marked `source: 'live'`
(useStudentCodeState `commitLivePass`); a miss does nothing. Nothing else is ever run (round 5
dropped the baseline and starter probes): a typed redraw ticks only when the preview judged before
it in this task opening did not pass (the transition rule), so carried, tutor-supplied or pasted
passing code ticks on Run, not by typing a space. `stage_pixel` and `stage_matches_target` tick on
Run only, and a text check with a trivially true value (empty, `*`, `.*`, a regex with no
required literal) never ticks. Round 6: unchanged code is never rerun, a slow redraw of code the
student has since changed keeps the verdict before it, a task that can never tick is never judged
(`liveTickTaskEligible`), and a scrub ticks only through its release checks. A Run
called since the edit always wins, a tutor's Mark Fail blocks it until the next Run, and only
Python Stage tasks whose checks are all allow-listed (`liveTickEligible`) take part. Docs:
python.md (Typing redraws too), CHANGELOG 2026-11-05, runtime-model.md (attemptLog `source`).
Typed Stage tasks need `scrub`, `runOnOpen` or a `#@lock-values` line to redraw (and so tick).
