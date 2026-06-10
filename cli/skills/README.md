# CLI Skills

Workflow skill files for the HSC CLI tool (`node cli/cli.mjs`).

| File | Slash command | Purpose |
|---|---|---|
| `hsc-list.md` | `/hsc-list` | List all published lessons and topics |
| `hsc-author.md` | `/hsc-author` | Author a new lesson from scratch |
| `hsc-edit.md` | `/hsc-edit` | Edit an existing lesson or individual task |
| `hsc-topics.md` | `/hsc-topics` | Manage the topic library |
| `hsc-assets.md` | `/hsc-assets` | Upload, list, and delete lesson assets |

## Installing as slash commands

Copy any skill file to `.claude/commands/` to make it available as a slash command in Claude Code:

```
cp cli/skills/hsc-list.md .claude/commands/hsc-list.md
```

Or install all at once:

```
cp cli/skills/hsc-*.md .claude/commands/
```
