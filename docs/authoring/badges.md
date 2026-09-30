# Live Badges: what lessons can tune

Live badges recognise good learning behaviour during a **live** session: finding a bug, fixing an
error, sticking with a hard task, using the Topic Library. Rules **suggest** a badge and the tutor
decides (or turns on auto-award for the high-confidence ones). There are no points, totals or
rankings. Design: [live-badges-plan.md](../architecture/live-badges-plan.md).

**Lessons define no badges.** The badges are built in (`src/badges/definitions/`). A lesson can
only:

- tag each task's `taskActivity` with its Glossary pattern (most lessons already do), which is how
  the pattern badges find their tasks;
- tune the rules with the envelope's [`badgeOptions`](#badgeoptions);
- add or suppress a badge on one task with [`badgeHints`](#badgehints).

`node cli/cli.mjs lessons capabilities` lists the badges (`badges.badges`), the options
(`badges.badgeOptions`) and the `taskActivity` patterns (`taskActivity.patterns`).

## The badges

A **real pass** is a passing check with none of these before it: teacher help, a teacher override
or move-on, complete code shown / previewed / reset to, the complete stage revealed, or a large
paste on that task. Every rule uses real passes only, and each badge is suggested at most once per
student per lesson.

| Badge | id | Suggested when | Auto-award |
|---|---|---|:---:|
| 🐛 Bug Hunter | `bug_hunter` | First in class to make a real pass on a `Debug Code Task` | ✅ |
| 📋 Code Builder | `code_builder` | First in class to make a real pass on a `Copy the Code` task (`Complete Example` excluded: nothing to type) | ✅ |
| 🔍 Code Detective | `code_detective` | First in class among students right **first time** on a `Quiz: What Is the Error?` or `Quiz: Fix a Common Bug` task | ✅ |
| 🔓 Challenge Solver | `challenge_solver` | A real pass on a `Challenge (Open-Ended)` task with no support stage revealed before it | ✅ |
| 🎯 Quiz Master | `quiz_master` | In a quiz group, at least `quizMasterThreshold` right first time (see [Quiz groups](#quiz-groups)) | ✅ |
| 🔧 Code Fixer | `code_fixer` | A real console error, then a real pass with different code (not on a `Debug Code Task`); or, in a sandbox, an error then an error-free run with different code | – |
| 🔨 Persistence | `persistence` | On a code or Code Arrange task, at least `persistenceMinFails` **different** failed submissions, then a real pass | – |
| 📚 Resourceful Coder | `resourceful_coder` | Opened a Topic Library topic themselves (not one the tutor sent), in a task or a sandbox | – |
| ⌨️ Keyboard Wizard | `keyboard_wizard` | Used a listed shortcut (Ctrl/Cmd+Enter, undo/redo, Ctrl+/, Tab / Shift+Tab in the editor, Delete, Ctrl+F, Ctrl+S, a Desktop app shortcut) | – |
| 🚀 Ready to Code | `ready_to_code` | On a code task, a real edit within `readyToCodeSeconds` of the task opening | – |
| 🧠 Problem Solver · 🧪 Experimenter · 💡 Creative Coder · 😂 Comedy Coder · 🧘 Focused Coder · 🧭 Project Explorer · 📈 Knowledge Builder · 🤝 Helpful Coder | `problem_solver`, `experimenter`, `creative_coder`, `comedy_coder`, `focused_coder`, `project_explorer`, `knowledge_builder`, `helpful_coder` | Tutor-only: never suggested | – |

"First in class" is decided per task, in the order the tasks were first passed. Each student
can win it once, and when a tutor dismisses a suggestion nobody else is suggested for that task.

### Quiz groups

A quiz group is a task group (`group:` in YAML) with at least `quizMasterMinQuizzes` **graded**
quizzes: multiple choice, match, fill in the blanks, and short answer with a `check`. Confidence
checks never count. The group is judged once the student has answered all of its graded quizzes, or
once the class has moved past it; a question they never answered counts as not right. Only a
student's first answer to each question counts.

## Pattern → badge

The pattern comes from `taskActivity` (see [Task activity patterns](#task-activity-patterns)).

| `taskActivity` | Badges it can trigger |
|---|---|
| `Code Task, Debug Code Task` | 🐛 Bug Hunter (and never 🔧 Code Fixer: fixing the bug *is* the task) |
| `Code Task, Copy the Code` | 📋 Code Builder |
| `Quiz: What Is the Error?`, `Quiz: Fix a Common Bug` | 🔍 Code Detective |
| `Code Task, Challenge (Open-Ended)` | 🔓 Challenge Solver |
| Any checked code or Code Arrange task | 🔨 Persistence, 🔧 Code Fixer, 🚀 Ready to Code |
| Graded quizzes in a group | 🎯 Quiz Master |

Pattern badges need a `check` on the task: attempts are only recorded for checked tasks.

## Badge × module coverage

| Badge | Python | Turtle | Arcade | HTML | Scratch | Filesystem | Desktop | Electronics | Quizzes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Pattern badges (🐛 📋 🔓), 🔨 Persistence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| 🔍 Code Detective, 🎯 Quiz Master | – | – | – | – | – | – | – | – | ✅ |
| 🔧 Code Fixer | ✅ | ✅ | ✅ | ✅ runtime errors | ❌ no console | – | – | – | – |
| 📚 Resourceful Coder | ✅ | ✅ | ✅ | ✅ | ❌ no Topic Library | ✅ | ✅ | ✅ | ✅ |
| ⌨️ Keyboard Wizard | ✅ editor | ✅ editor | ✅ editor, not the game | ✅ editor, not the preview | ✅ Blockly | ✅ | ✅ | ✅ | – |
| 🚀 Ready to Code | ✅ | ✅ | ✅ | ✅ | ✅ block moves | ✅ | ✅ | ✅ | – |

"–" means the badge has no signal there. The live signals (console errors, topic opens, shortcuts,
first edits) are recorded from each module's work area; see the plan's PR sequence for when each
lands.

## Sandboxes

⌨️ Keyboard Wizard, 📚 Resourceful Coder and the sandbox version of 🔧 Code Fixer count in the
teacher's session sandbox and in a student's personal sandbox. Badges that need a checked task
(the pattern badges, 🎯, 🔨 and 🚀) don't.

The session report records the teacher sandbox in full (when the class went in, for how long,
after which task, the tutor's explainer and pushes, and each student's last sandbox code) as a
*possible lesson gap*, and each student's personal sandbox as activity only (time, runs, error
runs, fixes).

## Badge Summary task

An information task with `informationType: badges` shows **Today's Coding Moments**:

```yaml
  - type: information
    informationType: badges
    title: Today's Coding Moments   # optional heading; this is the default
    explainer: Look what we did today!   # optional, shown above the wall
```

- **Students** see their own badges as a sticker sheet flipping in one by one, then the class wall
  grouped by badge ("🐛 Bug Hunter: Alex, Sam"). A student with no badges gets a warm line about
  the class, never an empty state.
- **The teacher** sees a projector-friendly class wall and **Copy class summary** (plain text,
  grouped by badge). The presentation window shows the wall only.
- Names only, never counts or ranks. Revoked badges drop out.
- **Solo:** skipped, exactly as if it were `taskMode: live` (solo badges are a later feature).
- The session report has the same wall in its **Coding moments** section, with student labels
  ("Student 3") because reports are anonymised.

## badgeOptions

Optional, on the lesson envelope. Leave it out to use the defaults.

| Option | Default | Allowed | Tunes |
|---|---|---|---|
| `quizMasterThreshold` | `0.8` | a number from 0 to 1 | 🎯 share right first time |
| `quizMasterMinQuizzes` | `3` | a whole number ≥ 1 | 🎯 graded quizzes a group needs |
| `persistenceMinFails` | `2` | a whole number ≥ 1 | 🔨 different failed submissions before the pass |
| `readyToCodeSeconds` | `10` | a number > 0 | 🚀 seconds to the first real edit |

## badgeHints

Optional, on any task: lists of badge ids.

- `suggest`: treat a real pass on this task as the badge's trigger, for a task whose
  `taskActivity` doesn't say so. Only the pattern badges (`bug_hunter`, `code_builder`,
  `code_detective`, `challenge_solver`) can be suggested this way.
- `suppress`: never suggest this badge from this task (for example `ready_to_code` on a task that
  opens with a long read, or `code_fixer` on a task that deliberately starts broken without being
  a Debug Code Task).

```yaml
id: badge-hints-example
type: composed
title: Badge hints example
description: A debugging task that isn't tagged as one, and a slow-start task.
badgeOptions:
  quizMasterThreshold: 0.75
  readyToCodeSeconds: 15
tasks:
  - title: Mend the broken greeting
    moduleType: python
    taskActivity: Code Task
    badgeHints:
      suggest: [bug_hunter]
      suppress: [code_fixer]
    explainer: The greeting has a mistake in it. Fix it so it prints hello.
    starterCode: 'prnt("hello")'
    check:
      type: output_contains
      value: hello
  - title: Read, then write
    moduleType: python
    taskActivity: Code Task, Meaningful Change
    badgeHints:
      suppress: [ready_to_code]
    explainer: Read the code carefully first, then change the loop to count to 5.
    starterCode: |
      for i in range(3):
          print(i)
    check:
      type: output_contains
      value: '4'
```

Unknown badge ids, other keys, and out-of-range options are validation errors
([validation-errors.md](validation-errors.md)).

**In the Builder:** task editor → Authoring metadata → **Badge hints** (every task except
information tasks). *Also suggest* offers the four pattern badges and *Never suggest* the
rule-backed ones, so only valid ids can be picked; a badge is in one list at most, and clearing
both lists removes `badgeHints`. A read-only line above them names the badges the task's
`taskActivity` pattern already triggers. `badgeOptions` is YAML-only.

## Task activity patterns

`taskActivity` stays free text, but the platform reads the Glossary pattern it names
(`src/shared/taskActivity.js`, the platform copy of the content workspace's Lesson Format
Glossary). Case, spacing, punctuation and `,` vs `:` after the format don't matter. An
unrecognised pattern is a validation **warning**, and the task then triggers no pattern badge.

| Format | Written as | Patterns (id) |
|---|---|---|
| Information | `Information` or `Information: <pattern>` | Brief Description (`brief_description`), Coming Up Next (`coming_up_next`), Take It Further (`take_it_further`), Tooling Introduction (`tooling_introduction`) |
| Code Task | `Code Task` or `Code Task, <pattern>` | Complete Example (`complete_example`), Meaningful Change (`meaningful_change`), Copy the Code (`copy_the_code`), Debug Code Task (`debug_code_task`), Challenge (Open-Ended) (`challenge_open_ended`), Take It Further (`take_it_further`), Make It Your Own (`make_it_your_own`), Visual Fun Application (`visual_fun_application`), Tooling Introduction (`tooling_introduction`) |
| Arrange Task | `Arrange Task` or `Arrange Task, <pattern>` | Meaningful Fill in the Blanks (`meaningful_fill_in_the_blanks`) |
| Quiz (pedagogical) | `Quiz: <pattern>` | What Do You Expect the Code to Do (`quiz_what_do_you_expect`), When to Implement (`quiz_when_to_implement`), Fix a Common Bug (`quiz_fix_a_common_bug`), What Is the Error? (`quiz_what_is_the_error`), Confirm / Recall the Syntax (`quiz_confirm_the_syntax`), Vocabulary Check (`quiz_vocabulary_check`), Which of These Is a [Type] (`quiz_which_of_these_is_a_type`), Vocabulary Match (`quiz_vocabulary_match`), Block Match (`quiz_block_match`), Design (`quiz_design`), Confidence Check (`quiz_confidence_check`), Concept Refresh Check (`quiz_concept_refresh_check`), Meaningful Fill in the Blanks (`meaningful_fill_in_the_blanks`) |
| Quiz (mechanical) | `Quiz, <type>` | Multiple Choice (`quiz_multiple_choice`), Match (`quiz_match`), Fill in the Blank (`quiz_fill_in_the_blank`), Short Answer (`quiz_short_answer`), Confidence Rating (`quiz_confidence_rating`) |
| Activity | `Activity, <label>: <mode>` | The activity's label, id or YAML type (`Activity, Binary: to_decimal`, `Activity, Mouse`) |

Pattern ids are stable: badges and reports store them, so a renamed pattern gets an alias instead.

## Signals the rules read

Rules read a per-student timeline of events, never Firebase directly
(`src/badges/timeline.js`): `attempt`, `sandbox_run`, `topic_open`, `reveal`, `complete_shown`,
`paste`, `override`, `shortcut` and `first_edit`. A new badge that needs a new signal adds an
event type there; a new stored field needs its own data-model sign-off.

## Admin catalogue badges

Tutors can also award **manual-only** badges that an admin adds in Admin Portal → **Badges**,
with no deploy: an emoji, a title and a blurb (Firestore `badgeCatalogue`). They are never
suggested and lessons can't name them in `badgeHints`. Their ids can't clash with a built-in
badge, and every badge's emoji is unique. An archived catalogue badge leaves the tutor's picker
but still shows wherever it was awarded. Students see the emoji, title and blurb stored on the
award itself.

## Adding a built-in badge

`npm run new:badge -- <id> --emoji <emoji> [--title "<Title>"] [--blurb "<Blurb>"] [--tutor-only]`
scaffolds `src/badges/definitions/<id>.js` (a stub rule with two examples, or a tutor-only
badge), registers it and adds a row to the table above. The `new-badge` skill
(`.claude/skills/new-badge/SKILL.md`) covers the rest, including a new signal. Why badges work
this way: [ADR 0011](../adr/0011-live-badges-registry-and-rules.md).
