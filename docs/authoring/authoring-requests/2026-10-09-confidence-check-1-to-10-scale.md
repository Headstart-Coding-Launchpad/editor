# Confidence check on a 1 to 10 scale

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

The confidence check (`quiz` with `quizType: confidence`) only offers five buttons, 1 to 5 (`src/app/components/quiz/ConfidenceQuiz.jsx`). Ryan wants a 1 to 10 scale, so students can show smaller shifts in confidence and tutors can see who has moved.

The tutor currently sees one "N/5" pill per student card and nothing for the whole class.

## Example task

    - type: quiz
      quizType: confidence
      title: How confident are you with loops?
      explainer: Tap a number. 1 means "not yet", 10 means "I could teach it".
      scale: 10          # new, optional; 5 (today's behaviour) or 10

## Checks wanted

- The student sees 10 buttons (red to green, 👎 at 1 and 👍 at 10). One tap submits, as it does now.
- The student card pill reads "N/10". Session reports store the value and the scale, so a 7/10 is never read as a 7/5.
- Existing lessons keep their 5-point scale unless they set `scale`.
- Validation rejects `scale` values other than 5 or 10.

## Devices

Ten buttons must fit on one row on a tablet in portrait with tap targets of at least 44px. Wrap to two rows of five on narrow phones.

## Notes

Open question for Ryan: should 10 become the default for new lessons, or replace the 5-point scale everywhere? This request assumes it's an option, so existing lessons don't change.

Would also suit a class-wide spread (how many students chose each number) in the tutor view, in line with the principle below.

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
