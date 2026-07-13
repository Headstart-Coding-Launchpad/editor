# HSC: Edit an Existing Lesson

Use with a lesson ID and a description of what to change.

Edit a published lesson — either a targeted single-task edit (cheaper) or a full lesson rewrite.

## Step 1 — Understand the current state

Always start with the skeleton, not the full lesson:

```
node cli/cli.mjs lessons skeleton <lessonId>
```

This shows the task list with flat indices and types without fetching all the task bodies. Use this to decide whether you need a targeted edit or a full rewrite.

---

## Path A — Edit one or a few tasks (preferred)

Use this when the change is confined to specific tasks. It avoids sending the full lesson JSON.

### 1. Fetch the tasks you need

```
node cli/cli.mjs tasks get <lessonId> <taskIndex>
```

Repeat for each task you need to inspect or modify.

### 2. Edit the task JSON

Make the required changes to the returned task object. Keep the `id` field intact.

### 3. Write back

```
node cli/cli.mjs tasks upsert <lessonId> <taskIndex> task.json
```

Or pipe the edited JSON. The command validates the full lesson before writing and returns any errors or warnings.

### 4. Append a new task (if adding rather than replacing)

```
node cli/cli.mjs tasks append <lessonId> task.json
# or into a specific group:
node cli/cli.mjs tasks append <lessonId> task.json --group "Group Title"
```

---

## Path B — Full lesson rewrite

Use this when restructuring, reordering, or making many changes at once.

### 1. Fetch the full lesson

```
node cli/cli.mjs lessons get <lessonId>
```

### 2. Edit the JSON (or convert back to YAML, edit, reconvert)

For YAML-first editing, convert the lesson JSON into YAML, edit, then reconvert:

```
node cli/cli.mjs lessons json-to-yaml lesson.json lesson.yaml
node cli/cli.mjs lessons yaml-to-json lesson.yaml
```

Review the output before publishing.

### 3. Validate and publish

```
node cli/cli.mjs lessons validate lesson.json   # check first
node cli/cli.mjs lessons upsert lesson.json     # then publish
```

### 4. Confirm

```
node cli/cli.mjs lessons skeleton <lessonId>
```

Verify the task count and structure match the intent.

---

## Deleting a lesson

```
node cli/cli.mjs lessons delete <lessonId>
```

Permanently removes the lesson document from Firestore — not reversible. Confirm the ID with the user before running; this is different from removing/editing individual tasks (Path A above), which keeps the lesson itself intact.
