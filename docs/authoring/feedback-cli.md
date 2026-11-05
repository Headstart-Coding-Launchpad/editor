# Feedback from the CLI

Teachers leave feedback while running lessons. Read it before revising a lesson, and archive it
once it's dealt with. All commands need CLI credentials (see "CLI credentials" in
`docs/agents/project-rules.md`) and print JSON.

## Where feedback lives

| Kind | Firestore location | Written from | Seen in |
|---|---|---|---|
| Lesson feedback | `lessons/{lessonId}/feedback` | The tutor's per-task notes in the after-class feedback step (from 2026-10-17, tagged with `reportId`); before that, the Feedback button during a lesson (whole lesson or one task) | Builder task feedback panel, Admin > Lessons |
| Platform feedback | `platformFeedback` | Bug reports and feature ideas | Admin > Feedback |
| Preview review notes | `lessons/{lessonId}/reviewNotes` | An admin's **Feedback** button on the blue strip in the lesson preview (`?preview=true`) | The preview strip, Builder task feedback panel ("Preview notes"); see [below](#preview-review-notes) |

This is not the feedback inside a session report. A report carries its own rated
`teacherFeedback` (per session run, given in the same after-class step) and per-task
`teacherRating`, which the CLI can't read; see
[session-reports.md](session-reports.md#teacher-feedback).

Each item has `id`, `lessonId`, `lessonTitle`, `taskId` (null for whole-lesson feedback),
`taskTitle`, `teacherEmail`, `text`, `reportId` (the session run's report id for notes from the
after-class step, otherwise null), `submittedAt` (Unix ms) and `archived`. List results also
include `source: "lesson" | "platform"`, sorted newest first.

## Read

```bash
node cli/cli.mjs feedback lesson python-3-2          # one lesson's feedback
node cli/cli.mjs feedback platform                   # platform feedback
node cli/cli.mjs feedback all                        # both kinds, every lesson
node cli/cli.mjs feedback all python-3-2             # both kinds, one lesson
```

| Flag | Effect |
|---|---|
| `--task-id <id>` | Only feedback about this task (an all-digit id is matched as a number) |
| `--scope lesson` | Only whole-lesson feedback (no task) |
| `--scope task` | Only task-specific feedback |
| `--lesson-id <id>` | `platform` only: platform feedback that mentions this lesson |
| `--include-archived` | Include archived items (hidden by default) |

## Add

```bash
node cli/cli.mjs feedback add-lesson python-3-2 --text "Task 4 hint gives the answer away" --task-id 4
node cli/cli.mjs feedback add-platform --text "Stage reveal button is hard to find" --lesson-id python-3-2
```

`--email`, `--lesson-title` and `--task-title` are optional and only for display. `--task-id` is
stored as a number when it is all digits (task ids are numbers), so the item shows in that task's
Builder feedback panel.

## Archive

Archiving never deletes: archived items drop out of list results and the Admin and Builder
views, but stay in Firestore. The one exception: **deleting a lesson** (Admin or
`lessons delete`) deletes its lesson feedback too, and re-creating a class fork with
`lessons fork` clears that fork's feedback. Read the feedback before you delete a lesson.

```bash
node cli/cli.mjs feedback archive-lesson python-3-2 <feedbackId>
node cli/cli.mjs feedback archive-platform <feedbackId>

# archive many at once; the same filters as reading apply
node cli/cli.mjs feedback clear-lesson python-3-2 --task-id 4
node cli/cli.mjs feedback clear-platform --lesson-id python-3-2
```

`clear-*` returns the number of items archived. Run the matching list command first so you know
what you're about to archive.

## Suggested loop when revising a lesson

1. `feedback all <lessonId>` to read everything about the lesson.
2. Group items by task, and decide which change the lesson.
3. Edit and republish the lesson (`lessons get <id> --format yaml`, edit, `lessons publish-yaml`).
4. Archive the items you addressed, one by one with `archive-lesson`, or with `clear-lesson --task-id`.
5. Leave anything you didn't act on unarchived, so a person still sees it.

## Preview review notes

An admin previewing a lesson (`/lesson/<id>?preview=true`) taps **Feedback** on the blue strip
above a task, types one line, optionally tags it, and saves. The note is pinned to that task and
the lesson version, so nobody has to map "task 4" from a chat message by hand. The strip shows
the task's note count and the newest note's status (New grey, Picked up blue, Done green). Only
admins see the button (not tutors, never students), and not in the Builder's preview pane. The
Builder's task feedback panel lists the selected task's notes read-only, newest first.

Each note: `noteId`, `lessonId`, `taskId` (the task's id, a number for normal tasks),
`lessonVersion` (the lesson's `version` when the note was made), `text` (1-500 characters),
`tag` (`null`, `wrong`, `confusing`, `too_long` or `love_it`), `status` (`new`, `picked_up`,
`done`), `createdAt` and `statusChangedAt` (ISO times), `createdBy` (the admin's uid).

```bash
node cli/cli.mjs lessons notes python-3-2                          # every note, oldest first
node cli/cli.mjs lessons notes python-3-2 --status new             # only notes nobody has taken
node cli/cli.mjs lessons notes python-3-2 --since 2026-11-05       # made on or after this ISO date
node cli/cli.mjs lessons notes python-3-2 --set <noteId> --status picked_up
node cli/cli.mjs lessons notes python-3-2 --set <noteId> --status done
```

- `--set` prints the updated note and stamps `statusChangedAt`. Status only moves forward
  (`new` to `picked_up` to `done`, or `new` straight to `done`); going back is an error, and so
  is an unknown note id. Setting the status a note already has changes nothing.
- Only the CLI moves a status on. In the preview the writer may edit or delete their own note
  while it is New; once it is picked up it is read-only there, so mark it `picked_up` as soon as
  it is in your revision basket.
- Deleting a lesson (Admin or `lessons delete`) deletes its notes, and re-creating a class fork
  with `lessons fork` clears that fork's notes, the same as feedback.

Suggested loop: `lessons notes <id> --status new`, put each note in the revision basket and
`--set` it `picked_up`; once the revised lesson is published, `--set` each one `done`. Compare
`lessonVersion` with the lesson's current `version`: an older version means the task may already
have changed.
