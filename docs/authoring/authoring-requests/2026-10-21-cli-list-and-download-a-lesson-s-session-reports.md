# CLI: list and download a lesson's session reports

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

pipeline-ui should pick up each new session report on its own after class (Ryan, 2026-10-16, via HSC Hub: 'Could we get the report from LaunchPad straight into Pipeline after the lesson?'). Today Ryan exports the YAML at End Session and uploads it by hand; when he doesn't, the Solo Challenge stalls (Python L1 L10, 21 Oct). The reports already sit in Firestore (lessons/{id}/sessionReports/{startedAt}), but the CLI has no command to read them.

Closest existing capability (from `lessons capabilities`): None: `lessons`, `feedback` and `assets` commands read lessons, feedback and files, but nothing reads sessionReports.

Current workaround and why it falls short: Ryan's manual export and upload at End Session. Works only when he remembers; the automatic Solo Challenge build (HSC Hub handoff, 2026-10-16) can't run without it.

## Example task

    node cli/cli.mjs lessons reports list <lessonId> [--since <ISO>]   # startedAt, endedAt, studentCount
    node cli/cli.mjs lessons reports get <lessonId> <startedAt> --yaml      # the same YAML End Session exports, anonymised as now

## Checks wanted

list returns every report for a lesson, newest first, with --since filtering by startedAt. get returns YAML byte-for-byte equal in content to the End Session export (same schema as platform-docs' session report page). Student names never appear in either output.

## Devices

CLI only; no student-facing change.

## Notes

pipeline-ui will poll this on a timer and in each overnight run, file new reports under the lesson's Reports/ folder, and run the usual report handling. Requested by Ryan via HSC Hub (README rule 8).

## Resolution

Shipped 2026-10-22: live on `main` (ffc031ba). `node cli/cli.mjs lessons reports list <lessonId> [--since <ISO>]`
and `lessons reports get <lessonId> <startedAt> --yaml` (the same anonymised YAML as End Session).
Docs: [session-reports.md](../session-reports.md).
