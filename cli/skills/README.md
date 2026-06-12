# CLI Agent Playbooks

Reusable, agent-neutral workflow playbooks for the HSC CLI tool (`node cli/cli.mjs`).

| File | Purpose |
|---|---|
| `hsc-list.md` | List all published lessons and topics |
| `hsc-author.md` | Author a new lesson from scratch |
| `hsc-edit.md` | Edit an existing lesson or individual task |
| `hsc-topics.md` | Manage the topic library |
| `hsc-assets.md` | Upload, list, and delete lesson assets |

## Optional Claude Code compatibility

These files can be read directly by any agent. If you want to expose them as Claude Code slash commands, copy them into `.claude/commands/`:

```
cp cli/skills/hsc-list.md .claude/commands/hsc-list.md
```

Or install all at once:

```
cp cli/skills/hsc-*.md .claude/commands/
```
