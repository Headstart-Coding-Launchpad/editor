# Classifier: 'only one thing' mode and an 'I'm not sure' answer

- **Status:** planned
- **Branch:** feature/classifier-ai-l1 (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 1's first rung, 'square or not a square', makes students draw examples of 'not a square', and there are endless non-squares (Ryan, 28 Oct 09:58: 'you have to define what a square isn't, that seems wonky'). A real one-thing detector learns only the thing and says 'not a square' when a drawing isn't close to anything it was taught. Later lessons (3-4, testing) also need the model to be able to say 'I'm not sure' when a drawing is unlike anything it knows.

Closest existing capability (from `lessons capabilities`): classifier (platform-docs/activities/classifier.md): nearest-match over 2 to 6 classes; it always answers one of the classes, and fewer than 2 classes fails validation.

Current workaround and why it falls short: Lesson 1 uses two drawn things (square or circle), or pre-loads a 'not a square' class through `examples`. Both avoid the wonky rung, but neither teaches a one-thing detector or an AI that can admit it doesn't know.

## Fun moment

Wow: draw a triangle and the pad says 'not a square' without ever being shown a triangle; later, it says 'I'm not sure' instead of a confident wrong guess. Dial: the drawings they teach it (more varied squares widen what counts). Theirs: their detector. First used: AI Level 1 Lesson 1 (one thing) and Lesson 3 (not sure). Play: find the wobbliest square it still accepts.

## Example task

    # Only one thing (Lesson 1 style)
    - type: classifier
      mode: drawing
      classes: ["⬜ square"]      # one class allowed: answers 'square' or 'not a square'
      panels: [close]            # 'how close' meter against the cut-off
    
    # I'm not sure (Lessons 3-4)
    - type: classifier
      mode: drawing
      classes: [star, house, fish]
      panels: [fool, unsure]     # answers 'not sure' when nothing taught is close enough

## Checks wanted

Cut-off set automatically from the spread of the student's own drawings (e.g. a multiple of the typical nearest-neighbour distance among them), recomputed as they add drawings; no slider in v1. One-class mode labels the other answer 'not a <thing>'. With `unsure`, a try marked 'not sure' counts as a try in the round (as now, right or wrong both count). Report per student how many tries came back 'not sure' / 'not a <thing>'. The `unsure` panel stays off by default, so Lesson 1's bonus ('draw something you never taught it') still shows it always picks one of the things it knows.

## Devices

Same as the Classifier today: mouse, trackpad or touch; no camera or microphone; the cut-off is one number recomputed when a drawing is added.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:59 ('file as a request for dev'), after the AI L1 design-choices deep dive (#311, Plans/AI L1 student choices deep dive.md). Simplest working version first.

## Resolution

Built on `feature/classifier-ai-l1`: one class allowed in the live round (answers "<thing>" or "not a <thing>"), the `close` panel, and the `unsure` panel ("not sure", off by default). Cut-off = 1.5 x the median nearest-neighbour distance among the thing's own drawings (floor 4), recomputed as drawings are added, no slider. Per-student counts of "not sure" / "not a <thing>" are in the shared state (`unsure`, `notThing`), the tutor modal and card, and the report. Docs: [activities/classifier.md](../activities/classifier.md#only-one-thing-and-not-sure).
