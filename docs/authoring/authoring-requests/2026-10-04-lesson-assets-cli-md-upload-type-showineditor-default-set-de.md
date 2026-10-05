# lesson-assets-cli.md: upload-type showInEditor default, set-default-sprites replaces, multi-costume preset example

- **Status:** shipped
- **Kind:** docs
- **Requested by:** Ryan (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

Adding multi-costume sprites to the shared Scratch library needed three facts lesson-assets-cli.md doesn't give: what showInEditor value assets upload-type stores and whether it matters for a Scratch preset's costume images (cli/type-assets.mjs stores false; arcade.md explains the flag only for Arcade), that set-default-sprites replaces rather than merges (only its --help says so), and a worked defaultSprites preset with several costumes pointing at shared Storage URLs (scratch.md has none either).

Closest existing capability (from `lessons capabilities`): platform-docs/lesson-assets-cli.md (assets upload-type, set-default-sprites) and scratch.md.

Current workaround and why it falls short: Read cli/type-assets.mjs and the command's --help directly. Works, but outside the docs every authoring task is meant to use.

## Notes

Moved from Missing Information.md on 2026-10-02 (logged 2026-09-28, shared Scratch sprite upload).

## Resolution

Branch `fix/authoring-docs-cli-batch`: [lesson-assets-cli.md](../lesson-assets-cli.md) now says `upload-type` stores `showInEditor: false` (Scratch never reads it; Arcade does), and which commands append vs replace (`set-default-sprites` / `set-default-sounds` replace the whole list; fetch it first with `assets list-type scratch`). Multi-costume preset example in [scratch.md](../scratch.md). CLI `--help` updated.
