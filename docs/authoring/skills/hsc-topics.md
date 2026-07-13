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

Topic JSON shape (see `docs/authoring/TOPIC_LIBRARY_SCHEMA.md` for all fields):

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
node cli/cli.mjs topics upsert topic.yaml  # accepts YAML or JSON
```

Or pipe the JSON. Upsert creates if the ID is new, updates if it already exists.

## Delete a topic

```
node cli/cli.mjs topics delete <id>
```

Permanent — confirm the ID with the user before running.

## Bulk import a whole topic library from YAML

For authoring many topics at once as a single YAML file (an array of topic objects), rather than one at a time with `upsert`:

```
node cli/cli.mjs topics upsert-library topics.yaml   # accepts YAML or JSON; creates/updates each topic by id
node cli/cli.mjs topics yaml-to-json topics.yaml -o topics.json   # validate + convert only, no publish
node cli/cli.mjs topics json-to-yaml topics.json topics.yaml      # reverse conversion
node cli/cli.mjs topics publish-yaml topics.yaml                 # convert + validate + upsert-library in one step
```

`publish-yaml` refuses to publish if any topic fails validation (same rules as `upsert-library`). Pass `--write-json` or `--json <path>` to also save the converted JSON alongside publishing.
