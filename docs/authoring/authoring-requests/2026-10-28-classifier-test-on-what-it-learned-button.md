# Classifier: 'Test on what it learned' button

- **Status:** planned
- **Branch:** feature/classifier-ai-l1 (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lessons 3-4 (testing on unseen data) need the student to see that testing a model on its own training drawings always scores 100%, 'marking its own homework', before testing on new drawings shows the truth.

Closest existing capability (from `lessons capabilities`): classifier `testSet: live | held_out` (classifier.md Testing): tests on new or kept-back drawings. It lacks a test on the training drawings themselves.

Current workaround and why it falls short: The tutor explains it. This fails the contrast: students never see the fake 100% beside the real score.

## Fun moment

Wow: a perfect 100%, then a new drawing fools it straight away. Dial: what it's tested on. Theirs: their model's two scores. First used: AI Level 1 Lesson 3. Play: try to get the two scores closer by teaching it better.

## Example task

    - type: classifier
      mode: drawing
      panels: [fool, selftest]   # selftest adds 'Test on what it learned', scoring every training drawing
    

## Checks wanted

Shows 'Tested on its own drawings: 24 of 24 right' beside the round's real score. Doesn't count towards passing. Report both scores per student.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on `feature/classifier-ai-l1`: the `selftest` panel adds **Test on what it learned**, which scores every training drawing and shows "Tested on its own drawings: N of N right" beside the round score; not counted for passing. Both scores are in the shared state (`selftest`), the tutor modal and card, and the report. Docs: [activities/classifier.md](../activities/classifier.md#test-on-what-it-learned).
