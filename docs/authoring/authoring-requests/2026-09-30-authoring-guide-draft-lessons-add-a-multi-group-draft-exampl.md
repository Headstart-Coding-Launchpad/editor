# AUTHORING_GUIDE Draft lessons: add a multi-group Draft example

- **Status:** resolved
- **Kind:** docs
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

The Draft lessons section's only worked example is one ungrouped code task. Skeleton runs need to see group/tasks nesting, informationType plus leftContent on the introduction and recap tasks (including what a heading-only leftContent value looks like), and taskActivity across the Glossary patterns.

Closest existing capability (from `lessons capabilities`): platform-docs/AUTHORING_GUIDE.md Draft lessons section (single ungrouped task) and Task Groups section; lesson-schema-yaml.md only says leftContent is 'Left-pane Markdown for recap only'.

Current workaround and why it falls short: Copy structure from live lessons as precedent. Each run re-infers the shape, and recap leftContent has been written both as plain text and as '## ...' headings in different lessons, so recaps render inconsistently.

## Notes

Lessons that hit this gap:

- python-3b-1 (Level 3B Lesson 1 — Consolidation): create-lesson-skeleton fell back to live lessons for multi-group Draft formatting
- python-2b-5 (Level 2B Lesson 5 — Data Conversion (int)): write-lesson-information: no literal example of a heading-only recap leftContent; guessed '## What we will recap' headings

Migrated from Lesson Info/Missing Information.md (entry dated 2026-08-07, plus its leftContent recurrences).

## Resolution

Branch `feature/authoring-docs-2026-10`: a second, multi-group worked Draft example (introduction, two `group:` + `tasks:` groups, code tasks with intent, quizzes, a Binary activity and a recap) that passes Draft validation, with `taskActivity` across the Glossary patterns. Canonical recap style decided by Ryan: `leftContent` is a single `## ` heading (`leftContent: "## What we covered"`) and the body goes in `explainer`; an introduction ignores `leftContent` and `explainer`. Docs: [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md#multi-group-draft-example), [lesson-schema-yaml.md](../lesson-schema-yaml.md#information-task-fields).
