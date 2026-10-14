# taskActivity patterns: Which Construct Fits? and Quiz, Poll

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Lesson Format Glossary.md prescribes two taskActivity tags the platform's capabilities list doesn't recognise: 'Quiz: Which Construct Fits?' (Consolidation Lesson Format, after the last Consolidation block) and 'Quiz, Poll' (the Make It Your Own poll). Every upsert of a lesson carrying them warns 'not a recognised pattern' (seen on evc61eeilq, xdhiku2oln, ufj6g0z9d3). Task Intent Format.md says a Glossary pattern the platform lacks needs a request so the platform's copy follows the Glossary.

Closest existing capability (from `lessons capabilities`): lessons capabilities → taskActivity.patterns: no which_construct_fits pattern; the quiz format exists and quizType poll exists (quiz_poll activity), but 'Poll' isn't accepted as a taskActivity pattern for a quiz.

Current workaround and why it falls short: Keep the Glossary tags and ignore the upsert warning. No badge rule depends on either tag today, so nothing fails, but the warning hides real taskActivity typos in every upsert of these lessons.

## Example task

    taskActivity: "Quiz: Which Construct Fits?"
    taskActivity: "Quiz, Poll"

## Notes

Ryan chose filing a request over changing the Glossary tags (open-notes triage, 2026-10-14). Source: Missing Information.md entry 'Glossary taskActivity tags the platform does not recognise'.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
