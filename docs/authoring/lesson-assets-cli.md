# Lesson Asset CLI

The lesson asset CLI manages files stored for one lesson. The Storage folder is the authoritative inventory; `storageAssets` on the lesson is optional metadata used by the editor.

## Commands

| Command | Required inputs | Behaviour |
|---|---|---|
| `node cli/cli.mjs assets list <lessonId>` | Lesson ID | Lists the lesson's stored assets, merged with matching `storageAssets` metadata. |
| `node cli/cli.mjs assets upload <lessonId> <filepath>` | Lesson ID and a readable local file | Uploads the local file and returns its hosted URL. |
| `node cli/cli.mjs assets delete <lessonId> <filename>` | Lesson ID and storage filename | Deletes the stored file and its matching metadata entry. |

Lesson IDs must be lowercase slugs (letters, digits, and hyphens). Upload and delete filenames must be a single safe filename: they cannot contain path components or begin with a dot.

## Uploads and Markdown use

By default, upload uses the local file's basename as its storage filename and detects MIME type from its extension. Use `--filename <name>` to choose a different storage filename and `--mime-type <type>` to override MIME detection.

```bash
node cli/cli.mjs assets upload python-loops ./hero.png
node cli/cli.mjs assets upload html-layout ./diagram.svg --filename layout.svg
node cli/cli.mjs assets upload html-layout ./font.woff2 --mime-type font/woff2
```

The result includes the hosted `url`. Use that URL in learner-facing task Markdown, for example:

```yaml
explainer: |
  ![Annotated page layout](https://firebasestorage.googleapis.com/...)
```

Assets are stored in Firebase Storage at `lessons/{lessonId}/assets/{filename}`. Successful uploads also add or replace a matching `storageAssets` entry with the filename, hosted URL, and `showInEditor: true`. A full lesson upsert preserves existing `storageAssets` metadata when the incoming lesson omits that field.

Uploading an existing filename replaces the stored object, creates a fresh hosted URL, and replaces that filename's metadata entry. It does not create a second asset. Before deleting an asset, remove or replace any Markdown links that use its URL.

## Shared lesson-type assets

Separate from a single lesson's own assets, each lesson type can carry a shared library of reusable files — an admin-curated pool any lesson of that type can draw on, stored in Firestore `lessonTypeAssets/{type}` and Storage under `shared/{type}/assets/`.

| Command | Required inputs | Behaviour |
|---|---|---|
| `node cli/cli.mjs assets list-type <type>` | Lesson type (e.g. `scratch`, `arcade`) | Lists the type's shared assets: `storageAssets` (generic uploaded files, `name`/`url`/`showInEditor`, merged with the shared Storage folder) for any type, plus, for `type: scratch` only, `defaultSprites` and `defaultBackdrops` — the curated preset libraries managed in Admin → Shared Assets → Scratch (each backdrop preset carries at least `id`, `name`, `colour`, and `image`). |

Before authoring a new sprite, backdrop, or scene image for a lesson, run `list-type` for that lesson's type and check whether an existing shared entry already fits — see each type's own lesson/task type profile (e.g. `guides/Scratch Lesson Guide.md`, `guides/Arcade Task Type Profile.md`) for when this check applies and what to do with the result.

`defaultSprites`/`defaultBackdrops` are Scratch-only; `assets upload-type`, `assets set-default-sprites`, and `assets upload-backdrop` are the matching admin-curation commands that populate this library, used to add to the shared pool rather than to author a specific lesson.

## Restrictions

The CLI does not impose an allow-list of file types or a file-size limit. It accepts any readable local file with a valid filename and uses `application/octet-stream` when it cannot infer a MIME type. Firebase Storage project policies and quotas can still reject an upload.
