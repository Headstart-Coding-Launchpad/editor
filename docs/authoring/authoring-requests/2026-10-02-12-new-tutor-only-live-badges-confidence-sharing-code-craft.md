# 12 new tutor-only live badges (confidence, sharing, code craft)

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-02
- **Lessons blocked:** none yet

## Need

Ryan teaches every class and wants more manual badges to choose from. Pencilcase (the student record) holds only one of each badge per student per level, so a wider pool keeps a new badge within reach all level (Teaching Model.md, Pencilcase). None of the existing 13 tutor-only badges covers confidence, improvement, presenting, answering, explaining, tidy code, edge-case testing, finishing, or self-testing. All tutor-only, never suggested.

Closest existing capability (from `lessons capabilities`): platform-docs/badges.md: built-in tutor-only badges via 'Adding a built-in badge' (npm run new:badge -- <id> --emoji --title --blurb --tutor-only), same route as Independent Coder. Admin catalogue badges (Admin Portal -> Badges) could hold them with no deploy.

Current workaround and why it falls short: Admin catalogue badges. They work, but Ryan wants them built in so suggestion rules can be added later (e.g. Honest Check-in from Confidence Check answers followed by a real pass), which catalogue badges can never gain.

## Example task

    npm run new:badge -- honest_check_in --emoji 🌡️ --title "Honest Check-in" --blurb "You said you weren't sure, then gave it a go and got there." --tutor-only
    npm run new:badge -- brave_coder --emoji 🦁 --title "Brave Coder" --blurb "You had a go at something tricky without waiting to be shown." --tutor-only
    npm run new:badge -- growing_coder --emoji 🌱 --title "Growing Coder" --blurb "You've grown so much as a coder this level." --tutor-only
    npm run new:badge -- comeback_coder --emoji 🔁 --title "Comeback Coder" --blurb "Something went wrong, and you came back stronger." --tutor-only
    npm run new:badge -- show_and_tell --emoji 🎤 --title "Show and Tell" --blurb "You shared your work with the class." --tutor-only
    npm run new:badge -- great_answer --emoji 💬 --title "Great Answer" --blurb "You answered a question and helped the whole class understand." --tutor-only
    npm run new:badge -- code_teacher --emoji 🧑‍🏫 --title "Code Teacher" --blurb "You explained how code works in your own words." --tutor-only
    npm run new:badge -- teacher_trap --emoji 🕵️ --title "Teacher Trap" --blurb "You spotted a mistake in the lesson. Sharp eyes!" --tutor-only
    npm run new:badge -- tidy_coder --emoji 🧹 --title "Tidy Coder" --blurb "Your code is neat, clearly named and easy to read." --tutor-only
    npm run new:badge -- edge_explorer --emoji 🔦 --title "Edge Explorer" --blurb "You tried strange inputs to see what would break." --tutor-only
    npm run new:badge -- finisher --emoji 🏁 --title "Finisher" --blurb "You finished every task, even the optional ones." --tutor-only
    npm run new:badge -- careful_checker --emoji 🧷 --title "Careful Checker" --blurb "You tested your code before calling it done." --tutor-only
    

## Notes

Filed as module only because there is no badge kind (same as the Independent Coder request). Emojis checked against every badge in badges.md: none clash. Later, not now: a suggestion rule for honest_check_in (a low confidence rating in a Confidence Check, then a real pass on the next code task), tutor-confirmed rather than auto-awarded since students could game it by always rating low.

## Resolution

Branch `feature/tutor-only-badges-12`: 12 built-in tutor-only badges (`honest_check_in`, `brave_coder`, `growing_coder`, `comeback_coder`, `show_and_tell`, `great_answer`, `code_teacher`, `teacher_trap`, `tidy_coder`, `edge_explorer`, `finisher`, `careful_checker`) in `src/badges/definitions/`, listed in the tutor's manual picker. Never suggested; `honest_check_in` can gain a tutor-confirmed suggestion rule later. Docs: [badges.md](../badges.md).
