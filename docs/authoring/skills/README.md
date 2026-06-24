# Agent Playbooks

Reusable workflow playbooks for the HSC platform. Each file can be read directly by any agent, or exposed as a Claude Code slash command by copying it to `.claude/commands/`.

| File | Purpose |
|---|---|
| `hsc-list.md` | List all published lessons and topics |
| `hsc-author.md` | Author a new lesson from scratch |
| `hsc-edit.md` | Edit an existing lesson or individual task |
| `hsc-review.md` | Review a LaunchPad lesson and record task decisions |
| `hsc-topics.md` | Manage the topic library |
| `hsc-assets.md` | Upload, list, and delete lesson assets |
| `hsc-feedback.md` | Read, create, delete, and bulk-clear feedback |
| `hsc-authoring.md` | Authoring guidelines and lesson draft pipeline (Ideas → Published) |

## Install as Claude Code slash commands

```bash
cp docs/authoring/skills/hsc-*.md .claude/commands/
```
