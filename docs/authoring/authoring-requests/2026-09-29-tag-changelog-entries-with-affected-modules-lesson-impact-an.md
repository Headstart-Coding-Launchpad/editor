# Tag CHANGELOG entries with affected modules, lesson impact and resolved requests

- **Status:** open
- **Kind:** docs
- **Requested by:** Ryan (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

Lesson agents read CHANGELOG.md to spot changes that affect existing lessons or guides. Entries don't say consistently which modules/activities they touch, whether existing lessons need changes, or which authoring request they resolve.

Closest existing capability (from `lessons capabilities`): CHANGELOG.md (free-form entries; some say 'Existing lessons need no changes').

Current workaround and why it falls short: An agent reads every entry in full and infers impact; shipped requests are only noticed via the request file's Status line.

## Checks wanted

Each entry carries a short line such as 'Affects: arcade, turtle · Existing lessons: no changes needed · Resolves: authoring-requests/2026-09-29-<slug>.md'.

## Notes

### Decisions (Ryan, 2026-09-29)

- Applies to new entries only (no backfill). Format documented in `docs/agents/workflows.md`: `Affects: … · Existing lessons: … · Resolves: authoring-requests/<file>.md`.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
