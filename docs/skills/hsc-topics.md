# HSC: Manage the Topic Library

Use with the requested topic-library action: list, get `<id>`, add, edit `<id>`, or delete `<id>`.

Create, update, or remove entries in the topic library used by the lesson builder.

## List all topics

```
node cli/cli.mjs topics list
```

Returns id, title, category, and types for every topic. Use this before creating a new topic to check for duplicates.

## Fetch a topic

```
node cli/cli.mjs topics get <id>
```

Returns the full topic object including `description` (Markdown) and `syntax` fields.

## Create or update a topic

Topic JSON shape (see `docs/TOPIC_LIBRARY_SCHEMA.md` for all fields):

```json
{
  "id": "python-for-loops",
  "title": "For Loops",
  "category": "Python",
  "types": ["python"],
  "description": "Markdown description shown in the topic panel…",
  "syntax": "for item in collection:\n    # body"
}
```

Rules:
- `id` must be a lowercase slug (letters, digits, dots, underscores, hyphens)
- `title` and `id` are required; all other fields are optional but recommended
- Wiki-link syntax `[[other-topic-id]]` is supported in `description`

Publish:

```
node cli/cli.mjs topics upsert topic.json
```

Or pipe the JSON. Upsert creates if the ID is new, updates if it already exists.

## Delete a topic

```
node cli/cli.mjs topics delete <id>
```

Permanent — confirm the ID with the user before running.
