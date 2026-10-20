# Predict mode: show the predict tags above the code until predictions are in

- **Status:** planned
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-20
- **Lessons blocked:** none yet

## Need

Ryan (2026-10-20, after the Python L1 Lesson 8 pilot): the prediction panels need a way to focus students on them, maybe put the variables above the code. In caakmdqj5j's first session, task 7 (the first predict task) got no prediction or Run from any of 8 students, and tasks 15 and 17 were right first time for only 2/8 and 1/8. The tutor: 'The predict tasks could have used something to highlight the new area'. Extends #80 (highlight the empty tag), which this replaces.

Closest existing capability (from `lessons capabilities`): showVariables mode: predict with lockRun (python.md, name-tag panel). The empty tags sit in the side panel, nothing draws the eye to them, and a locked Run looks broken.

Current workaround and why it falls short: Explainer bold line saying where the tag is plus the Meet the Name Tags task. It failed task 7's objective in the pilot: 0 of 8 predicted.

## Example task

    - title: Did LEEDS Change?
      moduleType: python
      showVariables:
        mode: predict
        predict: [small]
        placement: above      # predict tags sit above the editor until every prediction is in
    

## Checks wanted

Outcome: in predict mode the empty tags show above the code (not in the side panel) and are the first thing the eye lands on: highlighted/pulsing until filled, with the locked Run pointing at them ("Fill in your predictions first" links to the first empty tag, which takes focus). After the first Run the panel returns to its normal place with the ticks and crosses. Method: session report shows a prediction entered on the first predict task of a lesson by most students.


## Devices

On a narrow screen or tablet the tags above the code must stay visible without scrolling and open the right keypad (number/text answer boxes).

## Notes

Replaces #80; decline #80 as a duplicate when approving this.

## Resolution

Built 2026-10-20 on `feature/predict-tags-above` (LaunchPad Dev), not merged yet. `showVariables.placement: above` (Python): the tags sit above the code until the first Run, then go back with their ticks and crosses. Every predict task (Python and Turtle): empty tags glow until filled, and "Fill in your predictions first" is a button that puts the cursor in the first empty tag. Builder toggle added. Docs: python.md (name-tag panel, `placement` row), CHANGELOG 2026-10-20. Placement is opt-in: add `placement: above` to a lesson's first predict tasks. #80 can be declined as a duplicate.
