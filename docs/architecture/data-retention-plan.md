# Data retention plan (Hub #303)

Status: **proposal for Ryan, 2026-10-27.** Nothing is deleted until he OKs it. Ryan asked for a
time limit on what LaunchPad keeps (finding from #223 Child-safe defaults; `docs/agents/student-data.md`
lists every field).

## What is kept today

| Data | Where | Holds | Kept |
|---|---|---|---|
| Live session | Realtime Database `sessions/{lessonId}` | Typed names, live code, answers | Wiped at End Session (unchanged) |
| Session reports | Firestore `lessons/{id}/sessionReports` | "Student N" labels, code, attempts, timings; reports from before July 2026 may hold first names | Forever |
| Class lists | Firestore `classes/{id}/roster` + `work` + `typing` | A child's display name, their saved work and typing history | Forever |
| Share links | Firestore `sharedWork` | One child's code or page, no name | Expire after 30 days, but the doc stays |
| Old US database | Firestore `(default)` + backup `gs://headstartcoding-repl-backups/2026-10-pre-eu` | A copy of everything before the London move | Until Ryan OKs deleting (not before 26 Nov) |

## Proposed limits

1. **Session reports: delete after 2 years.** Lesson Gen reviews them within weeks; two years
   covers a re-run of a course. Reports from before July 2026 that may hold names: delete after
   **1 year** (by July 2027).
2. **Class lists: delete a child's entry, work and typing 1 year after the class's last activity**
   (latest `savedAt` / `updatedAt` in the class). An archived class: **90 days** after archiving.
3. **Share links: delete the doc 30 days after it expires** (so 60 days after it was made).
4. **Old US database and its backup: delete on 26 Nov** if nothing went wrong after the move.

## How

- One scheduled Cloud Function, `retentionSweep`, daily at 03:00 (europe-west1, next to the other
  Functions). It reads the limits above from one config object and deletes with the Admin SDK.
- **First two weeks: dry run only.** It writes what it *would* delete (counts per collection, no
  names) to a `retentionLog` doc; LaunchPad Dev checks it and shows Ryan. Deletes start only after
  his second OK.
- Cost: Cloud Scheduler's free tier covers one job; the reads are a few hundred docs a day.
- Docs: `docs/agents/student-data.md` gets a "Kept for" column; Brand.md can then say how long we
  keep children's work.

## Choices for Ryan

- **The limits** (recommended as above), or shorter (reports 1 year, class lists 6 months).
- **Scheduled Function** (recommended: runs by itself, logged) or a CLI command LaunchPad Dev runs
  monthly (no new moving part, but depends on someone remembering).
