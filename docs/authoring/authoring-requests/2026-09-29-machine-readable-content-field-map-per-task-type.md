# Machine-readable content-field map per task type

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

The lesson workspace needs to know which fields hold authored content for each task type and module (code, information, quiz sub-type, code_arrange, each activity) to decide which pipeline stage has work and what a revision clears. Today it hardcodes those lists.

Closest existing capability (from `lessons capabilities`): lessons capabilities (no field lists); lesson-schema.md Task Format Matrix (prose).

Current workaround and why it falls short: Hand-kept lists in Lesson Info/scripts/lib/stageFields.mjs; a new platform field is silently ignored until someone notices.

## Checks wanted

capabilities (or a sibling command) returns, per task type/module/activity, its content fields vs structural fields.

## Notes

### Decisions (Ryan, 2026-09-29)

- Built in the same PR as the `lessons capabilities` modes/fields request, from fields declared as data in the definitions. The platform uses a generic name (e.g. `authoredFields`) rather than the lesson workspace's "content vs structural" terms.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
