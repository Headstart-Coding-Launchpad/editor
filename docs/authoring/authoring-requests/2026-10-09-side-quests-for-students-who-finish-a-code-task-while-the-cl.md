# Side-quests for students who finish a code task while the class waits

- **Status:** open
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Lessons run in lockstep: the class doesn't advance until every student finishes the current task. Ryan reports the same one or two students regularly fall 3+ minutes behind on code tasks (Copy the Code, Challenges, Project/Milestone) through slow typing and miscopying, while everyone else sits idle. Copy the Code can't be skipped or shortened (Standard Lesson Format.md) and handing the slow student the support stage doesn't help slow typing, so the fix is giving finished students something worthwhile to do: optional, unchecked side-quests (mini challenge, debug it, predict and run, earlier-concept retrieval) attached to the tasks known to cause waits, that never change the code carried into the next task.

Closest existing capability (from `lessons capabilities`): Personal sandbox (lesson-schema.md modules[].sandbox.sandboxStarter; badges.md Sandboxes): isolated from task code and carry-through, but one starter per module per lesson, no per-task instruction, nothing surfaces it when a student passes and is waiting, and no done signal in the report. peerHints (CHANGELOG 2026-10-02) gives a finished student a way to help a stuck one, but it's not something to do for a student nobody needs help from. A later optional task can't help either: in lockstep the slow student meets it too.

Current workaround and why it falls short: Tutor asks waiting students verbal prediction questions, or tells them to tinker in their own code and 'put it back' (which then carries into the next task via carryCodeFrom if they don't). Fails the Interactive pillar (Teaching Ethos.md: maximise time writing code) for most of the class for 3+ minutes per affected task, and tinkering in task code risks breaking the next task's carried starting point.

## Example task

    # On a code task the class often waits on (e.g. Copy the Code), up to 3 side-quests.
    - type: code
      moduleType: python
      title: "Copy the Code: for loops"
      copyCode: |
        for i in range(3):
            print("Hello")
      # ...codeStages, checks as normal...
      sideQuests:                      # optional, up to 3, shown in order
        - title: "Break it, then fix it"
          kind: debug                  # challenge | debug | predict (label/icon only)
          explainer: |
            This loop has a bug. Run it, read the error message, then fix it.
          starter: |
            for i in range(3)
                print("Hello")
        - title: "Predict, then run"
          kind: predict
          explainer: |
            How many times will this print? Decide first, then press Run.
          starter: |
            for i in range(2):
                for j in range(3):
                    print("*")
        - title: "Mini challenge"
          kind: challenge
          explainer: |
            Make a loop that counts down from 5 to 1. (Earlier skill: range has a step.)
          starter: ""
    

## Checks wanted

No completion checks: side-quests are deliberately unchecked (Ryan, 2026-10-08), so a student can never "fail" one or be held by one.

Behaviour wanted:
- A task's side-quests unlock for a student only after that task's own completion check passes, and only while the live class is still on that task. In solo mode they can show after a pass too.
- Each opens in an isolated scratch editor of the task's module (like the personal sandbox): it never writes to the task's saved code and never feeds carryCodeFrom. Starter is the side-quest's own `starter`.
- The student gets a "Done" button per side-quest. Done is self-reported and is recorded, not verified.
- When the teacher advances the class, the side-quest closes and the student goes to the next task as normal; side-quest code is kept for the session.
- Teacher card shows "on side-quest n/m" so the tutor can see who is busy rather than idle.

Session report wanted: per student, per task: sideQuest opened (time), runs, error runs, done (true/false, time). This also lets review-lesson-reports see which tasks the class waited on and for how long.

Badges/points: Ryan wants finishing early to feel rewarding. Either a new suggested badge (e.g. "Side Quester" after N side-quests marked done in a session, suggested not auto-awarded since Done is self-reported) or a points tally on the student's screen. Dev agent's call which fits badges.md better.


## Devices

Same as the task's module (Python, Turtle, HTML, Scratch first; Python and HTML matter most, since Copy the Code is Python/HTML only). No touch-specific behaviour beyond what the module's sandbox already has.


## Notes

Ryan's choices (interview 2026-10-08): side-quest panel plus a prompt inside the task; not on every task, only those known to cause waits (always Copy the Code) plus a few later once the main concept is taught; unchecked; a badge or points for doing them. Guide changes to Standard Lesson Format.md and Lesson Writing Guide.md will follow once this ships, so lessons don't ask for a feature that doesn't exist.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
