# Tutor sees short-answer text as the student types

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

On open-ended (short-answer) questions the draft is kept only in the student's browser (`localAnswer` in `ShortAnswerQuiz.jsx`). It reaches Firebase only when they press submit. The tutor sees a blank until then, so they can't spot a student who is stuck, typing something off-track, or has written a good answer they're too nervous to submit.

## Checks wanted

- While a short-answer task is live, the tutor sees the student's current draft. It appears on the student card (for example "typing: …", clearly marked as not submitted) and in full in StudentModal.
- Writes follow the platform's live-view rule. Drafts are debounced and sent at full rate only while that student is open in StudentModal (`activeStudentView`), matching how code is synced. No write on every keystroke otherwise.
- The tutor can act on a draft: send the student a nudge or hint, and (later) choose a draft for `showResponses: teacher_picks` with the student's agreement.
- Submitted answers, checks and `showResponses` behave exactly as now. Drafts never count as attempts.
- Session reports may record the last draft for students who never submitted.

## Devices

No change for students. The draft must be readable on a tutor tablet without hovering.

## Notes

Any other "submit to reveal" text inputs (e.g. open `fill_blanks` text entry) should be checked for the same gap.

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
