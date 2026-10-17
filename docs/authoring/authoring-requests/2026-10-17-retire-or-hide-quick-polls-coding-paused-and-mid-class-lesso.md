# Retire or hide quick polls, Coding Paused and mid-class lesson editing (keep the countdown)

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 7. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md, Retire box: "Quick polls and countdown (never used, 2), Editing a lesson mid-class (2, failed once)"; Over-built box: "Starting a class ("Coding Paused" unused)". Ryan's change, 2026-10-17: "I also still want the countdown." So this covers quick polls, Coding Paused and mid-class editing only. HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md: group 21, the tablet poll set-up opens off-screen; group 26, Edit Lesson opens on raw authoring metadata; group 17, the Focus Class menu covers Countdown and End Session.

Closest existing capability (from `lessons capabilities`): Tutor session controls: quick class polls, Coding Paused, and Edit Lesson (this session only). The countdown stays.

Current workaround and why it falls short: Ryan ignores them; they clutter a tired tutor's header and menus, and mid-class editing failed once.

## Checks wanted

- Quick polls, Coding Paused and mid-class Edit Lesson no longer show in the tutor's session controls (removed, or behind a settings toggle that is off by default).
- The countdown is unchanged and easy to reach.
- Poll tasks inside lessons (quiz type poll) are NOT affected: only the ad hoc quick poll.
- No other session control moves or breaks.

## Devices

Tutor desktop and tablet.

## Notes

Lesson Gen authors poll quiz tasks (taskActivity 'Quiz, Poll'); those must keep working.

## Resolution

Ryan, 2026-10-17: hide them behind a setting that is off by default, rather than removing the code.

Branch `feature/hide-polls-paused-midclass-edit`. Quick polls, Pause Coding and Edit Lesson are hidden unless Account Settings > "Show extra class tools (quick polls, Coding Paused, Edit Lesson)" is on (localStorage `headstart_extra_class_tools`, off by default, `src/shared/extraClassToolsSetting.js`). Resume Coding always shows while paused. Countdown and poll quiz tasks untouched. The Focus Class menu overlap (group 17) was not changed; needs a real-browser look.
