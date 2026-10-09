# New live badges: vocab tasks and emoji use

- **Status:** open
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Ryan wants two new live badges:

1. **Vocab badge:** awarded for doing well on vocab tasks. There is no vocab quiz type. "Vocabulary Check" and "Vocabulary Match" exist only as `taskActivity` tags (`src/shared/taskActivity.js`), for example a `quizType: match` tagged `Quiz: Vocabulary Match`. A rule could key off that tag. `word_wizard` is a related badge, but tutors award it by hand.
2. **Emoji badge:** awarded for using emoji in code. The emoji picker on the Python and HTML editors (`EmojiPickerButton`) sends no signal. Nothing in `src/badges/signals.js` or `liveTimeline.js` tracks emoji, so this needs a new signal, either from the picker or from emoji found in the code that is run.

## Checks wanted

- Vocab: suggested when a student completes N vocab-tagged tasks, or gets them all right first time (exact rule to agree with Ryan). Works with every quiz type that can carry a vocab tag.
- Emoji: suggested the first time a student runs code containing an emoji (in a string or HTML text), whether it was typed, pasted or picked.
- Both appear in the Admin catalogue and can be awarded by hand, like every badge. Each suggestion names its task (see `2026-10-09-badge-suggestions-always-show-the-task.md`).
- Built with the `new-badge` skill (`npm run new:badge`) and the new signal documented in `docs/authoring/badges.md`.

## Devices

No device-specific behaviour beyond what the emoji picker already supports.

## Notes

Open questions for Ryan: the badge names and emoji, the vocab threshold, and whether the emoji badge should only count emoji inside output text and ignore comments.

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
