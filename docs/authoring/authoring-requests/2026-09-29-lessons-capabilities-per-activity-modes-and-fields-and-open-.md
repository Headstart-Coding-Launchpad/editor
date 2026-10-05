# lessons capabilities: per-activity modes and fields, and open requests

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

Lesson agents use lessons capabilities to check what exists before filing a request, but for activities it gives only id/label/description. Modes, task fields and item fields per mode live only in prose (activities/<id>.md). And 'requests' is a single hint string, so agents can't see what is already requested or in progress.

Closest existing capability (from `lessons capabilities`): lessons capabilities (activities[].taskShape, checkTypes); activities/<id>.md Task fields tables.

Current workaround and why it falls short: Agents read each activity page's tables by hand and hand-keep field lists (Lesson Info/scripts/lib/stageFields.mjs ACTIVITY_FIELDS_BY_TYPE), which drift when an activity gains a mode or field.

## Checks wanted

capabilities lists, per activity: modes, task fields (with required flag), item fields per mode; and a requests array of {file, title, kind, status} from authoring-requests/.

## Notes

### Decisions (Ryan, 2026-09-29)

- Built together with the content-field map request in one PR. Activity and module definitions declare their modes and fields as data (with required and authored flags); `lessons capabilities`, the validator, the Builder and the doc tables all read that one source.
- The `requests` array is parsed from the header lines of the files in this folder.

## Resolution

Branch `feature/capabilities-fields-and-requests` (with the content-field map request): activity definitions declare `fields` (`src/shared/fieldSpec.js`); `lessons capabilities` lists per activity `modes`, `fields` (required / authored / values / modes / itemFields), `fieldsByMode`, `authoredFields`, and a `requests` array parsed from this folder. Tests keep declarations honest against `validateTask` and the doc tables.

Merged to main in `fc94c03` (2026-09-29).
