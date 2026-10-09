# New live badges: vocab tasks and emoji use

- **Status:** shipped
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

Shipped on branch `feature/badge-task-names-vocab-emoji`, with Ryan's answers: two suggested (not auto-awarded) registry badges, in the tutor's picker and manually awardable like every badge.

- 📖 Word Smith (`word_smith`, `src/badges/definitions/word_smith.js`, rule `firstTryOnEveryPatternTask` in `src/badges/rules.js`): right first time on every **graded** vocab-tagged quiz (`Quiz: Vocabulary Check` / `Quiz: Vocabulary Match`, any quiz type) the student has tried, at least `wordSmithMinTasks` (new `badgeOptions` key, default 2). One vocab task wrong first time rules them out; untried ones don't count.
- 🤩 Emoji Artist (`emoji_artist`, `src/badges/definitions/emoji_artist.js`; 🎨 was taken by Design Master): the first Run of Python or HTML code with an emoji in a string literal, or in HTML text or an attribute. Comments never count. New student signal `studentSignals/{id}/emojiRun` `{ firstRunAt, context, taskId }`, written once from the student's device on Run (`reportRunCode` → `codeHasEmoji` in `src/shared/emojiInCode.js`), timeline event `emoji_run`; new `database.rules.json` rule (needs a rules deploy).

Docs: [badges.md](../badges.md), [CHANGELOG.md](../CHANGELOG.md), `docs/agents/runtime-model.md` ("Badge data").
