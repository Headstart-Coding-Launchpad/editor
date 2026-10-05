# markdown-renderer.md: broken code fence swallows the Scratch Blocks heading

- **Status:** shipped
- **Kind:** docs
- **Requested by:** Ryan (approved by Ryan), 2026-10-04
- **Lessons blocked:** none yet

## Need

platform-docs/markdown-renderer.md has a broken code fence around its WRONG/RIGHT example (about lines 77-85) that swallows the following 'Scratch Blocks (fenced)' heading. authoring-context.mjs --check falls back to a fence-blind heading lookup, so create-lesson-skeleton's 'Fenced Code Blocks' slice also pulls in the Scratch Blocks section.

Closest existing capability (from `lessons capabilities`): platform-docs/markdown-renderer.md, Fenced Code Blocks section: the fence around the WRONG/RIGHT example is unbalanced.

Current workaround and why it falls short: authoring-context.mjs's fence-blind fallback. Works, but every create-lesson-skeleton packet carries an unrelated Scratch Blocks section.

## Notes

Moved from Missing Information.md on 2026-10-02 (logged 2026-09-28).

## Resolution

Branch `fix/authoring-docs-cli-batch`: fences in [markdown-renderer.md](../markdown-renderer.md) balanced (4-backtick outer fences). The break also swallowed Block colours, Value pills, Supported Scratch shapes and Maintenance contract; all now render as sections, and 'Fenced Code Blocks' ends before 'Scratch Blocks (fenced)'.
