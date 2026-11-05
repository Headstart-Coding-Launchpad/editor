# Preview review: leave a note on any task while previewing a lesson, readable by agents

- **Status:** planned
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-11-05
- **Lessons blocked:** none yet

## Need

Ryan reviews lessons in preview (?preview=true) and today has to describe what he sees to an agent by hand, naming task numbers from memory. He wants to leave feedback directly on the task he is looking at, so Lesson Gen can pick it up exactly (lesson id, task id, version) and fold it into the revision basket.

Closest existing capability (from `lessons capabilities`): Preview mode (?preview=true) shows the lesson but has no way to record a note. Session reports carry teacherFeedback (request 8 and 74) but only after a taught class, and only a task rating. Lacks: free-text notes on a task made while previewing.

Current workaround and why it falls short: Ryan types feedback in Discord naming the task by number; an agent maps it to the task by hand. Error-prone, and the lesson version can have changed.

## Devices

Laptop and iPad (preview is used by Ryan on both). A small Feedback button on each task in preview mode, only for the owner/tutor account, never shown to students.

## Notes

Ryan 5 Nov 12:34 (#lesson-gen). Proposed shape (Dev to reshape as needed): each note stores lesson id, task id, lesson version, text, optional quick tag (wrong / confusing / too long / love it), timestamp, who. Agents read them with a CLI call such as 'hsc lessons notes <id> [--since]' returning JSON, and mark a note as picked up or resolved. Lesson Gen then puts them in the revision basket (revise-lesson).

## Resolution

Built on branch `feature/preview-review-notes` (not merged; needs the `firestore.rules` deploy).
Admin-only **Feedback** button on the preview strip (any admin, per Ryan 5 Nov), notes at
`lessons/{lessonId}/reviewNotes`, shown read-only in the Builder task feedback panel, deleted with
the lesson. CLI: `lessons notes <id> [--since] [--status]` and `--set <noteId> --status
picked_up|done`. Docs: [feedback-cli.md](../feedback-cli.md#preview-review-notes).
