# New tutor-only live badge: 🦸 Independent Coder

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-02
- **Lessons blocked:** none yet

## Need

Tutors want to recognise a student who worked problems out on their own — tried things, used hints and the Topic Library — before asking for help. No existing badge means this: Focused Coder is about focus, Persistence auto-suggests on repeated fails then a pass, Problem Solver is general. Tutor-only for now (never suggested).

Closest existing capability (from `lessons capabilities`): platform-docs/badges.md built-in badges; 'Adding a built-in badge': npm run new:badge -- <id> --emoji <emoji> --title --blurb --tutor-only. Admin catalogue badges could do it with no deploy but Ryan wants it built in so a suggestion rule can be added later.

Current workaround and why it falls short: An admin catalogue badge, which can never gain a suggestion rule.

## Example task

    npm run new:badge -- independent_coder --emoji 🦸 --title "Independent Coder" --blurb "Worked through problems on your own: tried things and used hints and the Topic Library before asking for help." --tutor-only

## Notes

Later (not now): a suggestion rule such as a run of real passes with no teacher help — needs a 'help requested' signal the timeline doesn't have yet. Not a workspace module: filed under module only because no badge kind exists.

## Resolution

Branch `feature/independent_coder-badge`: built-in tutor-only badge `independent_coder` (🦸 Independent Coder), `src/badges/definitions/independent_coder.js`, listed in the tutor's manual picker (student modal → More → 🏅 Award badge). Never suggested; a suggestion rule can be added to the same definition later once a help-requested signal exists. Docs: [badges.md](../badges.md).
