# assets list-type scratch: include defaultSounds

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-02
- **Lessons blocked:** none yet

## Need

Lesson agents pick Scratch assets from 'node cli/cli.mjs assets list-type scratch' before requesting anything new. Since the 2026-10-02 per-sprite sounds change there is a shared sound-file library (lessonTypeAssets/scratch.defaultSounds, { id, name, audio }), but list-type returns only type, storageAssets, defaultSprites and defaultBackdrops, so agents can't see uploaded sound files (e.g. music loops for Scratch Level 1 Lesson 6 'Add the Music' and Lesson 12) and would request duplicates.

Closest existing capability (from `lessons capabilities`): cli 'assets list-type scratch' (platform-docs/lesson-assets-cli.md), which already returns defaultSprites and defaultBackdrops; 'assets upload-sound' / 'set-default-sounds' write the sound library but nothing reads it back.

Current workaround and why it falls short: Ryan tells each lesson by hand which sound files exist; the Scratch asset request register catches only sounds requested through it, not ones uploaded directly in Admin.

## Checks wanted

list-type scratch --format json includes defaultSounds: [{ id, name, audio }] (empty array when none); lesson-assets-cli.md documents it.

## Notes

Lesson Gen Agent's packet builder (authoring-context.mjs) already renders library.defaultSounds as a table once present. Also note: the sounds change itself isn't on pushed main yet (checked 2026-10-02).

## Resolution

Branch `feature/scratch-costumes-sounds-tabs` (merged to main with the per-sprite sounds change): `assets list-type <type>` returns `defaultSounds: [{ id, name, audio }]` alongside `defaultSprites` / `defaultBackdrops`, `[]` when none are set (and always for non-Scratch types). Populated by `assets upload-sound scratch <file>` / `assets set-default-sounds scratch [file]` or Admin → Shared Assets → Scratch → Default sounds. Docs: [lesson-assets-cli.md](../lesson-assets-cli.md#shared-lesson-type-assets).
