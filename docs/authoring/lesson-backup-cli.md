# Lesson backup (`lessons backup`)

A versioned local copy of every lesson, made on this PC each night (Ryan, 26 Nov). It is read-only on Firebase and adds no Firebase data. Undo means asking Dev: there is no restore button.

```bash
node cli/cli.mjs lessons backup                 # to D:\LaunchPad-backups\lessons
node cli/cli.mjs lessons backup --out E:\copies # any other folder
```

Code: `cli/lesson-backup.mjs` (Node built-ins only), tests in `cli/lesson-backup.test.js`.

## What is copied

| Firestore | Why a restore needs it |
|---|---|
| `lessons/{id}` | The lesson itself, exactly as stored (sealed answers and encoded Scratch blocks included). Drafts, Solo Challenges and class forks are all docs here. |
| `lessonLevels/{id}` | The level a lesson's `levelId` points at. |
| `topicLibrary/{id}` | The topics lessons are checked against. |
| `lessonTypeAssets/{type}` | Shared type assets and Scratch default sprites, backdrops and sounds (the doc, not the files). |

A lesson's content lives entirely in its own doc; nothing else is needed to put it back.

## What is not copied

- **Storage files**: lesson assets (`lessons/{id}/assets/`) and shared type assets (`shared/{type}/assets/`). The docs keep their URLs, but the files themselves are not copied.
- **Anything about children**: session reports, solo logs, rosters, class lists and student work, shared work, typing, Realtime Database data. None of it is read.
- Lesson subcollections that are not lesson content: `feedback`, `reviewNotes`, `timingRuns`, `sessionReports`.
- `classes` (a fork keeps its `classId` and `className` inside the lesson doc), `users`, `badgeCatalogue`, `platformFeedback`.

## How a run works

1. For each collection, one list read with `select()` and no fields: ids and update times only, no document bodies.
2. A full read of only the docs that are new, whose update time moved since the last run, or whose last saved copy is missing or empty (that copy is written again).
3. Each fetched doc is hashed (sorted-key JSON). A new version file is written only when the hash differs from the last saved copy, so a save that changed nothing adds nothing.
4. A doc gone from Firestore is marked `deletedAt` in the index; its copies stay.

Reads: one per doc listed plus one per doc fetched. The first run on 26 Nov listed 343 docs and fetched all 343 (686 reads, 13 MB). An unchanged night costs 343 reads and writes nothing. The summary printed at the end gives the counts, and each read is in `logs/firestore-calls.log` like every CLI read.

Nothing is ever overwritten or deleted (except an empty file left by a crash, which is written again). Every file is written to a temp name, flushed to disk and renamed; the index is saved after each collection, and the previous run's index is kept as `index.json.bak`, so an interrupted run leaves only whole files and the next run picks up where it stopped. If the drive is missing, the index is unreadable or any doc fails, the command still prints the counts, then exits non-zero with the saved and read counts first and each problem listed (the copies already made are kept). The size in the summary counts only the backup's own folders and index; other folders in `--out` are ignored.

## Layout

```
D:\LaunchPad-backups\lessons\
  index.json                                   every doc, its versions, lastRun summary
  lessons\<id>\<updateTime>_<hash12>.json      one file per saved version
  lessonLevels\<id>\...  topicLibrary\<id>\...  lessonTypeAssets\<type>\...
```

A version file is `{ collection, id, updateTime, savedAt, hash, data }`. `data` is the stored doc. Values JSON cannot hold are tagged: `{ "__firestore": "timestamp", seconds, nanoseconds }`, `reference` (`path`), `bytes` (`base64`), `geopoint`, and `number` (`value`: `NaN`, `Infinity` or `-Infinity`). Only SDK value types are tagged: a plain map is always kept as a map, even one with keys like `latitude` and `longitude`. Folder names are the doc id with any character other than letters, digits, `.`, `_` and `-` written as `%XX`.

## Restoring (manual, by Dev)

There is no restore command. To put a lesson back:

1. In `index.json`, find the doc under its collection and pick the version (the last one is the newest).
2. Read that file's `data` and turn any `__firestore` tags back into Firestore values (`Timestamp`, `doc(path)`, `Buffer`, `GeoPoint`, `Number(value)`).
3. Write it with `db.collection(collection).doc(id).set(data)` from a one-off script using `cli/firebase.mjs`. Write the raw `data`; do not pass it through `lessons upsert`, which would re-run validation and audit stamps. Restoring is a Firebase write, so it needs Ryan's OK first.
4. If the lesson's level or topics were also lost, restore those docs the same way, and re-upload any Storage asset files from wherever they were kept.
