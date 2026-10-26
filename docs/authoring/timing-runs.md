# Tutor timing runs

A tutor walks through a lesson in the admin preview with a stopwatch running, so Lesson Gen can
see how long each task takes a confident adult. Lesson Gen converts tutor time into class
estimates itself; the platform records only what the tutor did.

## Taking a run

1. Open the lesson in the Admin Portal preview (`#/lesson/<lessonId>?preview=true`, teacher or
   admin sign-in). The builder's own preview does not offer it.
2. Press **Start timing run** (bottom-left). A bar shows the current task's time, the total,
   **Pause/Resume** and **Finish**.
3. Move through the tasks as normal (free navigation). Each task is timed while it is on screen;
   going back to a task adds to its time and counts another visit. Thinking time counts.
4. The clock pauses by itself while the browser tab is hidden and restarts when it is visible.
5. **Finish** saves one document and offers **Download JSON**. If the save fails the download is
   still offered.

An unfinished run is kept in `localStorage` (`headstart_timingrun_<lessonId>_<tutorUid>`) and
survives a reload; it comes back paused (the gap counts as paused time). Nothing is written per
keystroke or per task, only once on Finish.

## Saved shape

`lessons/{lessonId}/timingRuns/{autoId}`:

```json
{
  "lessonId": "...", "lessonTitle": "...", "startedAt": 0, "finishedAt": 0,
  "totalSeconds": 0, "pausedSeconds": 0, "otherSeconds": 0,
  "tutorUid": "...", "tutorEmail": "...", "appVersion": "LaunchPad v1.0.985 · 7a69ce2 · built ...",
  "tasks": [
    { "taskId": "...", "title": "...", "type": "python | activity:<id> | quiz | ...",
      "estimatedMinutes": 5, "seconds": 0, "visits": 0 }
  ]
}
```

`tasks` is in lesson order (groups flattened); tasks never opened have `seconds: 0`.
`totalSeconds` is the sum of the task seconds; `otherSeconds` is time on screens that are not a
task (name entry, lesson complete); `pausedSeconds` is user pauses, hidden-tab time and reload gaps.
Teachers and admins can create and read runs; nobody can edit or delete them from the client.

## CLI

```bash
node cli/cli.mjs lessons timing <lessonId> [--latest] [--yaml]
```

Lists runs newest first with per-task seconds. `--latest` returns only the newest; `--yaml`
prints YAML instead of JSON.
