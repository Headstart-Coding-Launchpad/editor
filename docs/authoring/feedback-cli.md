# Feedback from the CLI

Teachers leave feedback while running lessons. Read it before revising a lesson, and archive it
once it's dealt with. All commands need CLI credentials (see "CLI credentials" in
`docs/agents/project-rules.md`) and print JSON.

## Where feedback lives

| Kind | Firestore location | Written from | Seen in |
|---|---|---|---|
| Lesson feedback | `lessons/{lessonId}/feedback` | Teacher's Feedback button during a lesson, for the whole lesson or one task | Builder task feedback panel, Admin > Lessons |
| Platform feedback | `platformFeedback` | Bug reports and feature ideas | Admin > Feedback |

Each item has `id`, `lessonId`, `lessonTitle`, `taskId` (null for whole-lesson feedback),
`taskTitle`, `teacherEmail`, `text`, `submittedAt` (Unix ms) and `archived`. List results also
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
| `--task-id <id>` | Only feedback about this task |
| `--scope lesson` | Only whole-lesson feedback (no task) |
| `--scope task` | Only task-specific feedback |
| `--lesson-id <id>` | `platform` only: platform feedback that mentions this lesson |
| `--include-archived` | Include archived items (hidden by default) |

## Add

```bash
node cli/cli.mjs feedback add-lesson python-3-2 --text "Task 4 hint gives the answer away" --task-id 4
node cli/cli.mjs feedback add-platform --text "Stage reveal button is hard to find" --lesson-id python-3-2
```

`--email`, `--lesson-title` and `--task-title` are optional and only for display.

## Archive

Feedback is **archived, never deleted**. Archived items drop out of list results and the Admin
and Builder views, but stay in Firestore.

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
