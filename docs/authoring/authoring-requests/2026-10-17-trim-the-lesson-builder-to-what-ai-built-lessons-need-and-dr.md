# Trim the Lesson Builder to what AI-built lessons need, and drop the 'which lesson' step

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 6. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md, theme 4: "The Lesson Builder was built for humans. AI builds lessons now, so most of its options go unused." Retire box: "Lesson Builder options (2: AI builds lessons now, "which lesson" step makes no sense)". HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md, group 27: "There's no way back to the app, no lesson list and no account menu", and developer wording ("Create composed lesson", "lesson modules", "Upload existing JSON").

Closest existing capability (from `lessons capabilities`): The Lesson Builder. Lesson Gen now creates and edits lessons through the CLI (lessons upsert); Ryan uses the Builder to look lessons over, edit intents and leave task feedback.

Current workaround and why it falls short: Ryan ignores most options. Nothing is blocked; the cost is a confusing tool and the 'which lesson' step on every visit.

## Checks wanted

- The Builder opens straight on the lesson it was opened for, with no 'which lesson' step, and has a way back to the app.
- It keeps what Ryan uses on AI-built lessons: viewing tasks, editing intents and text, task feedback, Draft on/off. Ask Ryan before removing anything else.
- Options only needed for hand-building (composed lesson set-up, Upload JSON, module wiring) are hidden or removed, and the wording is plain.
- CLI lessons upsert and the lesson schema are unchanged.

## Devices

Desktop.

## Notes

Lesson Gen's revise-lesson skill relies on Ryan editing intents in the Builder; keep that.

## Resolution

Ryan, 2026-10-17: hide (not delete) Create composed lesson, Upload existing JSON, module wiring / type set-up, and New blank lesson.

Branch `feature/builder-trim-for-ai-lessons` (not merged). `?load=<id>` opens straight on the lesson; with none, a plain lesson list (title, Draft flag). Header has Back (Admin or app), Account and All lessons. Hidden unless `?advanced=1`: New blank lesson, Upload JSON, Lesson type badge, Sandbox starter, task module picker. Wording: "Download JSON" is now "Download lesson file"; no "composed"/"modules" in the visible start screen. CLI and schema untouched. Docs: `docs/FEATURES.md` Lesson Builder Features.
