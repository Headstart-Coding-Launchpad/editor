# One-tap badge awarding, and fewer controls on the one-student view

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 3. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md, theme 3 "Tired-tutor friction": "Badges are loved but hard to award in a rough class; the one-student view has too many controls. Make the common action one tap." HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md: group 16, "'Suggested by rules' lists 17 badges, unranked and with no reason given, so it's slow mid-lesson", and the buttons show only an emoji and a name, with no description; group 19, "The header has 9 controls; 👍 and the marking icons (✓ ✕ ? 💡 ⭐) have no labels" and "The More menu has 12 items ... which sound alike". Badges feed Pencilcase and parents, so a missed award is lost recognition.

Closest existing capability (from `lessons capabilities`): The live badges award picker and the student modal (one student's full view). They lack a ranked one-tap award and a slimmed control set.

Current workaround and why it falls short: Ryan awards fewer badges than are earned, or catches up after class from memory. It fails the badges' purpose of recognising the moment.

## Checks wanted

- From a student's card or view, the tutor awards the top suggested badge in one tap, with undo.
- Suggestions are ranked, say why each is suggested, and show a one-line description.
- The one-student view shows only the common actions by default (award badge, thumbs-up, show to class, help); the rest sit behind one menu with no near-duplicate items.
- Every icon-only control has a label or tooltip that works on touch.

## Devices

Tablet: only about 3 badge rows show today. Touch targets at least 44px.

## Notes

Ryan rates the student cards themselves 5/5 ('much improved'); don't redesign the grid as part of this.

## Resolution

Built on branch `feature/one-tap-badge-award` (not merged). One-tap "Award <top badge>" with 6 s Undo on the student card and in the one-student header (ranking in `src/badges/suggestionRanking.js`); the header now shows Award badge, Thumbs up, Show to class and Help, with everything else in one More menu; icon-only buttons have aria-labels and a touch long-press label (`TipButton`), 44px on touch. Docs: `docs/authoring/badges.md` (One-tap award), `docs/FEATURES.md`. Needs a real-browser check on a tablet.
