# HSC: Manage Lesson Assets

Use with a lesson ID and an asset action: list, upload `<file>`, or delete `<filename>`.

Upload, list, and delete image or file assets attached to a lesson. Assets are stored in Firebase Storage and their download URLs are recorded in the lesson's `storageAssets` field.

## List assets for a lesson

```
node cli/cli.mjs assets list <lessonId>
```

Returns the `storageAssets` array — each entry has `name`, `url`, and `showInEditor`.

## Upload a file

```
node cli/cli.mjs assets upload <lessonId> <filepath>
```

The file's basename is used as the storage filename. Override it with `--filename <name>`. MIME type is auto-detected from the file extension; override with `--mime-type <type>`.

```
# examples
node cli/cli.mjs assets upload python-3-2 ./hero.png
node cli/cli.mjs assets upload html-2-1 ./diagram.svg --filename step1.svg
```

After uploading, the returned `url` can be referenced in lesson task content (e.g. in a Markdown `![alt](url)` in an `explainer` field). The asset is automatically added to the lesson's `storageAssets` in Firestore.

## Delete a file

```
node cli/cli.mjs assets delete <lessonId> <filename>
```

Removes the file from Firebase Storage and removes it from `storageAssets` on the lesson document. If the file is referenced in any task content, remove those references first.
