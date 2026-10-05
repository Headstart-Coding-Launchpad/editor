# Add bug, docs and tooling kinds to the authoring-request template

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

The lesson workspace now sends every platform-side need through authoring-requests/: new capabilities, but also platform bugs, docs errors and CLI/tooling asks. The template's Kind line only allows activity | module | check type | activity mode, and 'How requests are handled' only covers building activities/modules.

Closest existing capability (from `lessons capabilities`): docs/authoring/authoring-requests/README.md template and handling steps.

Current workaround and why it falls short: Bug, docs and tooling requests are filed with Kind set to bug / docs / tooling anyway, which the template doesn't recognise; how they are triaged is undefined.

## Checks wanted

Template lists bug | docs | tooling kinds; README says how each is handled (e.g. bug: repro + fix + CHANGELOG; docs: fix the page).

## Notes

Filed first so the other workspace requests have a valid kind. Requests from the lesson workspace are written by its pipeline-ui dashboard after Ryan approves them; the Status line is read back automatically, so please keep 'Status: shipped' / 'declined' and fill in Resolution.

## Resolution

Branch `feature/authoring-request-kinds`: README template now lists `bug | docs | tooling` kinds, and "How requests are handled" has a per-kind table.

Merged to main in `fc94c03` (2026-09-29).
