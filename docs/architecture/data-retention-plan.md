# Data retention plan (Hub #303)

Status: **deleting session reports and share links only, Ryan's second OK 2026-11-26** (approved
as a dry run 2026-10-27; 28 nightly counts to 26 Nov were all zero). Built as `retentionSweep`
(`functions/retention.js`, `DELETE = true`, `DELETE_CLASSES = false`); live only once the function
is released. A read-only run on 27 Oct found nothing past its limit yet (159 reports, all from
9 Jul 2026 on); a year from then it would take 4 idle classes and 13 expired share links. Ryan
asked for a time limit on what LaunchPad keeps (finding from #223 Child-safe defaults;
`docs/agents/student-data.md` lists every field).

## What the sweep deletes, and what it does not

| Data | What happens |
|---|---|
| Session reports | **Deleted** 2 years after the session; 1 year if saved on or before 16 Jul 2026 (may hold names) |
| Share links (`sharedWork`) | **Deleted** 30 days after the link's expiry date |
| Class lists (`roster` + `work` + `typing`) | **Not deleted.** Past-limit ones are counted (a class with no children is not counted) |
| Class records, lessons, live sessions, the browser's `localStorage` | Not touched by the sweep |
| Old US database and its backup | Not touched by the sweep |

Class lists stay count-only because "last activity" only sees a child added, work saved, typing
recorded or the class record edited. A class still being taught, or an archived class still in use,
can look idle. Setting `DELETE_CLASSES = true` needs a better activity signal and Ryan's OK.

Each run writes `retentionLog/{date}`: `deletes` (which kinds are really deleted), `counts` (past
the limit), `deleted` (actually removed), `error` (null, or what failed, with document paths taken
out) and `finished`. It is first written before the sweep starts, so `finished: false` means the
run was killed part-way (timeout 540 s, 512 MiB). One failed delete or read does not stop the rest.

## What is kept today

| Data | Where | Holds | Kept |
|---|---|---|---|
| Live session | Realtime Database `sessions/{lessonId}` | Typed names, live code, answers | Wiped at End Session (unchanged) |
| Session reports | Firestore `lessons/{id}/sessionReports` | "Student N" labels, code, attempts, timings; reports saved on or before 16 Jul 2026 may hold first names | Forever |
| Class lists | Firestore `classes/{id}/roster` + `work` + `typing` | A child's display name, their saved work and typing history | Forever |
| Share links | Firestore `sharedWork` | One child's code or page, no name | Expire after 30 days, but the doc stays |
| Old US database | Firestore `(default)` + backup `gs://headstartcoding-repl-backups/2026-10-pre-eu` | A copy of everything before the London move | Until Ryan OKs deleting (not before 26 Nov) |

## Proposed limits

As proposed on 27 Oct; what runs today is in the table above.

1. **Session reports: delete after 2 years.** Lesson Gen reviews them within weeks; two years
   covers a re-run of a course. Reports saved on or before 16 Jul 2026, which may hold names:
   delete after **1 year** (by July 2027).
2. **Class lists (count only for now): delete a child's entry, work and typing 1 year after the class's last activity**
   (latest saved work `savedAt`, typing `recordedAt`, child added, or class `updatedAt`). An archived class: **90 days** after archiving.
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
