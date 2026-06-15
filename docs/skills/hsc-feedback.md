# HSC: Manage Feedback

Use with a feedback action: list platform/lesson/all, add, delete `<id>`, or clear.

Feedback is collected from teachers during lessons. It lives in two Firestore locations:

- **Lesson feedback** — `lessons/{lessonId}/feedback` subcollection. Submitted from the teacher's Feedback modal. Can be scoped to the whole lesson or to a specific task. Visible in the lesson builder's task feedback panel.
- **Platform feedback** — `platformFeedback` top-level collection. Bug reports and feature requests. Visible only to admins in the Admin Portal.

Both types share the same field shape:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore auto-ID |
| `source` | `"lesson"` \| `"platform"` | Added by CLI (not stored in Firestore) |
| `lessonId` | string \| null | Lesson the feedback refers to |
| `lessonTitle` | string \| null | Display name (informational) |
| `taskId` | string \| null | Set for task-scoped feedback; null for lesson-level |
| `taskTitle` | string \| null | Display name (informational) |
| `teacherEmail` | string | Submitting teacher's email |
| `text` | string | Feedback body |
| `submittedAt` | number | Unix ms timestamp |

---

## List feedback

```
node cli/cli.mjs feedback platform
node cli/cli.mjs feedback lesson <lessonId>
node cli/cli.mjs feedback all [lessonId]
```

All list commands support optional filters:

| Flag | Effect |
|---|---|
| `--lesson-id <id>` | Platform only: limit to a specific lesson's context |
| `--task-id <id>` | Only items with this task ID |
| `--scope lesson` | Only lesson-level items (no taskId) |
| `--scope task` | Only task-scoped items (has taskId) |

Results are sorted newest-first.

```bash
# All feedback for a lesson
node cli/cli.mjs feedback lesson python-3-2

# Only task-scoped feedback across the whole platform
node cli/cli.mjs feedback all --scope task

# Platform feedback for a specific lesson context
node cli/cli.mjs feedback platform --lesson-id html-2-1
```

---

## Add feedback

```
node cli/cli.mjs feedback add-lesson <lessonId> --text "..."
node cli/cli.mjs feedback add-platform --text "..."
```

`--text` is required. All other flags are optional.

**Lesson feedback options:**

| Flag | Notes |
|---|---|
| `--text <string>` | Feedback body (required) |
| `--email <string>` | Teacher email (default: empty) |
| `--lesson-title <string>` | Lesson display name |
| `--task-id <string>` | Makes this task-scoped feedback |
| `--task-title <string>` | Task display name |

**Platform feedback options:**

| Flag | Notes |
|---|---|
| `--text <string>` | Feedback body (required) |
| `--email <string>` | Teacher email (default: empty) |
| `--lesson-id <string>` | Lesson context (optional) |
| `--lesson-title <string>` | Lesson display name |
| `--task-id <string>` | Task context (optional) |
| `--task-title <string>` | Task display name |

```bash
# Add lesson-level feedback
node cli/cli.mjs feedback add-lesson python-3-2 \
  --text "Great lesson, but task 4 starter code is too empty" \
  --email "teacher@school.com" \
  --lesson-title "Python 3 — Lists"

# Add task-scoped feedback
node cli/cli.mjs feedback add-lesson python-3-2 \
  --text "Students found this check confusing" \
  --task-id "task-list-append" \
  --task-title "Appending to a list"

# Add platform feedback
node cli/cli.mjs feedback add-platform \
  --text "The Run button sometimes doesn't respond on first click" \
  --email "teacher@school.com"
```

Returns `{ success, id, lessonId?, source }`.

---

## Delete a single item

Use the item's `id` from a list command.

```
node cli/cli.mjs feedback delete-lesson <lessonId> <id>
node cli/cli.mjs feedback delete-platform <id>
```

Throws an error if the item does not exist. Returns `{ success, id, lessonId? }`.

---

## Clear all feedback (bulk delete)

```
node cli/cli.mjs feedback clear-lesson <lessonId>
node cli/cli.mjs feedback clear-platform
```

Both support `--task-id` and `--scope` to narrow what gets deleted. `clear-platform` also accepts `--lesson-id`.

Returns `{ success, deleted }` with a count of items removed.

```bash
# Remove all feedback from a lesson
node cli/cli.mjs feedback clear-lesson python-3-2

# Remove only task-scoped feedback from a lesson
node cli/cli.mjs feedback clear-lesson python-3-2 --scope task

# Remove all platform feedback
node cli/cli.mjs feedback clear-platform

# Remove platform feedback linked to one lesson
node cli/cli.mjs feedback clear-platform --lesson-id html-2-1
```
