# Agent Playbooks

Reusable workflow playbooks for the HSC platform. Each file can be read directly by any agent, or exposed as a Claude Code slash command by copying it to `.claude/commands/`.

| File | Purpose |
|---|---|
| `hsc-list.md` | List all published lessons and topics |
| `hsc-author.md` | Author a new lesson from scratch |
| `hsc-edit.md` | Edit an existing lesson or individual task |
| `hsc-topics.md` | Manage the topic library |
| `hsc-assets.md` | Upload, list, and delete lesson assets |

## Install as Claude Code slash commands

```bash
cp docs/skills/hsc-*.md .claude/commands/
```
