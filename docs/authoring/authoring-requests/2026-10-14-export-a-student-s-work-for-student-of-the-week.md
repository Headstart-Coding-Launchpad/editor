# Export a student's work for Student of the Week

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Tutors want to export a student's work to show off as Student of the Week: Projects, Python code, sprites, Scratch projects and so on. Tutor feedback 2026-10-13: 'Export students work for student of the week - Projects, Python Code, Sprites, Scratch etc'.

Closest existing capability (from `lessons capabilities`): Session reports (session-reports.md) carry submissions per attempt, and scratch-render-cli.md renders block images, but there is no tutor-facing export of a student's saved work: no .sb3 or sprite download, no Python or HTML file download, no shareable snapshot.

Current workaround and why it falls short: Screenshots of the student's screen. A screenshot can't show a Scratch project running or a whole Python program, and the student can't take it home.

## Example task

    Tutor StudentModal → 'Export work': per task or whole lesson; Scratch → .sb3 (plus sprite PNGs), Python/Turtle → .py, HTML → .zip; optional 'share link' with a read-only, name-hidden view for showing the class

## Notes

From tutor feedback relayed by Ryan, 2026-10-13. Mind safeguarding: student names and any shared link should be opt-in.

## Resolution

Shipped on branch `feature/export-student-work` (2026-10-14). StudentModal ▸ More ▸ **🎁 Export work**
(tutor-only, live only; nothing is written to the student): this task or the whole lesson, from
the live mirror on the current task and the latest logged attempt on the others.

- **Code files:** Python/Turtle `.py`; HTML `.zip` of the files plus one self-contained `.html`;
  Scratch a real `.sb3` (every LaunchPad block mapped to Scratch 3, with menu shadow blocks,
  variables, broadcasts, costumes drawn to PNG, synth sounds rendered to WAV and MP3/WAV files
  fetched; anything without a match is listed) plus a LaunchPad JSON copy.
- **Pictures (PNG):** Turtle drawing, Scratch stage, each sprite's scripts as blocks, every costume.
- **Names:** task title + date; the first name only when "Include first name in file names" is
  ticked (off by default).
- **Share link** (opt-in, current task only): a frozen, name-hidden snapshot at `/share/:id`
  (Firestore `sharedWork`), read-only, 30 days, revocable from the dialog and Admin ▸ Shared Work.

No lesson fields were added. Modules plug in through an optional `exportWork` UI hook
(`src/shared/exportWork/exporters.js`). Docs: `docs/FEATURES.md` (Student Actions),
`docs/agents/runtime-model.md` (Share Links, `/share/:id`).
