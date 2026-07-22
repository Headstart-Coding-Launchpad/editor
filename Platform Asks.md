# Platform Asks — Implementation List

Work items for the LaunchPad platform, arising from the review recorded in `Proposals.md`.

Written to be worked through by an implementing agent. Each item states why it exists, where to look, the steps, and how to know it is done. Background evidence is in the **Reference** appendix at the end — read it before starting PA3 or PA1.

## How to use this document

- **Work top to bottom.** Items are ordered by dependency, not by value.
- **Do not start PA4.** It is blocked on an authoring trial that has not happened.
- **Paths marked verified** were checked against this workspace. Paths marked *unknown* were not — the platform web app is not linked into this workspace, only `cli/` and `platform-docs/` are. Locate them before assuming.
- **`platform-docs/` is real.** It is a symlink into the platform repo. Doc updates listed here are real edits, not notes.
- Anything marked **Decision needed** must go back to Ryan, not be resolved by the implementer.

## What is not in this workspace

The session report generator is **not** in `cli/`. Searching `cli/*.mjs` for `taskSummary`, `distinctAttempts`, `sessionId`, `anonymousId` and `finalResult` returns nothing. The CLI only *deletes* reports, via the `sessionReports` Firestore subcollection (`cli/lessons.mjs:151`). Report generation lives in the platform web app. Start PA3 by locating it there.

---

## Work item index

| ID  | Item                                                      | Ask  | Size | Depends on  |
| --- | --------------------------------------------------------- | ---- | ---- | ----------- |
| T1  | [Done] Fix the report task-inclusion rule                 | PA3  | M    | —           |
| T2  | [Done] Add `taskType` to every report entry               | PA3  | S    | T1          |
| T3  | [Done] Record submissions for check-less task types       | PA3  | M    | T1          |
| T4  | [Done] Fix `taskSummary` aggregates for no-pass/fail tasks | PA3  | S    | T1, T2      |
| T23 | [Done] Record teacher check overrides in the report        | PA3  | M    | T1          |
| T5  | Regression-test PA3 against Python Level 1 Lesson 2       | PA3  | S    | T1–T4       |
| T24 | Carry code through a skipped task                         | PA5  | M    | —           |
| T6  | Add `priority` to the task schema and CLI validator       | PA2  | S    | —           |
| T7  | Round-trip `priority` through the YAML converter          | PA2  | S    | T6          |
| T8  | Surface `priority` in the Lesson Builder                  | PA2  | M    | T6          |
| T9  | Surface `priority` in the teacher live view               | PA2  | M    | T6          |
| T10 | Include `priority` in session reports                     | PA2  | S    | T6, T1      |
| T11 | Document `priority`                                       | PA2  | S    | T6          |
| T12 | Make `copyCode` hideable and revealable                   | PA1a | M    | —           |
| T13 | Add a student-initiated reveal control                    | PA1a | S    | T12         |
| T14 | Record reveals in the session report                      | PA1a | S    | T12, T1     |
| T15 | Add `role` to code stages                                 | PA1b | S    | —           |
| T16 | Design the task-variant data model                        | PA1c | M    | T15         |
| T17 | Implement variant runtime behaviour                       | PA1c | L    | T16         |
| T18 | Record the active variant in session reports              | PA1c | S    | T16, T1     |
| T19 | Variant authoring in the Lesson Builder                   | PA1c | M    | T16         |
| T20 | Document stage roles and variants                         | PA1  | S    | T15, T16    |
| T21 | Add an `ordering` quiz type                               | PA4  | M    | **Blocked** |
| T22 | Fix `copyCode` omission in the code-task field references | Docs | XS   | —           |

---

# PA3 — Report every completed task, not only tasks with an explicit check

**Do this first.** It is small, it is a bug, and nothing else on this list can be evaluated without it — the platform currently cannot tell anyone whether PA1 or PA4 worked.

**Status update, 22 July 2026.** T1–T4 are complete on branch `codex/platform-phase-1-reports`. Reports now include all non-information tasks, add `taskType`/`quizType`, record detailed fill-blank and match submissions, record confidence/open short-answer responses, use `not_applicable` for response-only tasks, and add response/failure summaries. T23 is complete on branch `codex/platform-phase-2-overrides`; T5 remains open.

## T1 — Fix the report task-inclusion rule

**Status: Done, 22 July 2026.** Implemented in `src/shared/lessonReport.js`; all non-information tasks are now included in per-student report rows and `taskSummary`.

**Why.** Session reports silently omit every task that completes without an explicit `check`. This loses all fill-in-the-blank, match, and confidence data. See **Reference A** for the evidence and **Reference B** for the root cause.

**Where to look.** Platform web app, session report generation (*unknown path* — not in `cli/`). Look for whatever builds the per-student `tasks` array and the lesson-level `taskSummary`.

**Steps.**
1. Locate the report generator and confirm the inclusion predicate. The expected finding is that it iterates tasks holding a `check` object, or filters on the presence of a check before recording.
2. Change the predicate to **"the student interacted with this task"** rather than "this task has a check".
3. Decide the treatment for `information` tasks. They have no interaction and should stay excluded — but confirm this is now an explicit choice rather than a side effect of the check test.
4. Make sure `taskSummary` is built from the same corrected set, not a second filtered pass.

**Acceptance criteria.**
- A lesson containing `fill_blank`, `match`, `confidence` and open `short_answer` tasks produces report entries for all of them, in both the per-student `tasks` array and `taskSummary`.
- Information tasks remain excluded.
- Existing code-task and multiple-choice reporting is byte-identical to before for a lesson containing only those types.

**Out of scope.** Changing what `submission` contains — that is T3.

## T2 — Add `taskType` to every report entry

**Status: Done, 22 July 2026.** Per-student task entries and task summaries now include `taskType`; quiz entries also include `quizType`; code tasks report `taskType: code`.

**Why.** Report consumers currently cross-reference the lesson YAML to know what kind of task they are reading. Once T1 lands and four more task types appear, that becomes untenable.

**Steps.**
1. Add `taskType` to each entry in the per-student `tasks` array and in `taskSummary`.
2. Use the values already in the lesson JSON: `information`, `quiz`, `draft`, or omitted for a code task. For quiz tasks also emit `quizType` (`multiple_choice`, `match`, `fill_blank`, `short_answer`, `confidence`).
3. For code tasks, emit an explicit value rather than an absent field — report consumers should not have to infer from absence.

**Acceptance criteria.**
- Every report entry names its task type without reference to the lesson.
- A quiz entry names its `quizType`.

## T3 — Record submissions for check-less task types

**Status: Done, 22 July 2026.** Quiz attempts now log detailed fill-blank and match submissions, numeric confidence ratings, and open short-answer text. Reports normalize older/raw fill-blank and match submissions where possible.

**Why.** `submission` already carries the option id for multiple choice and full source for code tasks, so the mechanism works. It needs extending to the newly-included types.

**Steps.** Populate `submission` per type:

| Task type | `submission` contains |
|---|---|
| `fill_blank` (drag or type) | The value placed in each blank, keyed by blank id |
| `match` | The pairing produced, keyed by pair id |
| `confidence` | The 1–5 rating |
| `short_answer` (open, no check) | The typed text |

1. For `fill_blank` and `match`, record **per-blank and per-pair detail**, not a single pass/fail. Knowing a student got 3 of 4 blanks and specifically which one they missed is the entire value; a boolean is nearly worthless.
2. Preserve the existing `distinctAttempts` structure — it already supports multiple attempts with separate submissions, so the per-attempt breakdown lands inside it unchanged.
3. Set `finalResult` to an explicit not-applicable value for `confidence` and open `short_answer`. Do not force them into passed/failed.

**Acceptance criteria.**
- A student who fills 3 of 4 blanks correctly produces a submission identifying which blank was wrong and what they put in it.
- A confidence task records the rating and does not claim a pass or a fail.
- Re-attempts on a fill-blank task appear as separate `distinctAttempts` entries.

**Decision needed.** Whether `attempts` is meaningful for confidence tasks (a student can change their rating). Suggest recording the final rating and treating a change as a new attempt, but confirm.

## T4 — Fix `taskSummary` aggregates for no-pass/fail tasks

**Status: Done, 22 July 2026.** Confidence and open short-answer summaries use response counts instead of pass/fail completion metrics; confidence summaries include rating distribution; fill-blank and match summaries include per-blank/per-pair failure breakdowns.

**Why.** `completionRate` and `avgAttempts` are meaningless for confidence and open short-answer tasks and will distort lesson-level figures once T1 includes them.

**Steps.**
1. Exclude confidence and open short-answer tasks from `completionRate` and `avgAttempts`.
2. Add a confidence-specific summary shape:

```yaml
  - taskId: 6
    title: How Confident Do You Feel with print()?
    taskType: quiz
    quizType: confidence
    totalStudents: 3
    respondedCount: 3
    ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 }
```

3. For `fill_blank` and `match`, add a per-blank / per-pair failure breakdown to `taskSummary`, in the spirit of the existing `commonFailures` array — which blank was most often wrong, and with what value.

**Acceptance criteria.**
- Lesson-level completion figures are unchanged by the presence of confidence tasks.
- A confidence task's summary shows the rating spread.
- A fill-blank summary identifies the most-missed blank.

## T23 — Record teacher check overrides in the report

**Status: Done, 22 July 2026.** Implemented in `src/app/hooks/useSession.js`, `src/app/views/TeacherView.jsx`, and `src/shared/lessonReport.js`. Manual pass overrides and whole-class advance now write `overrideLog` records; reports map them to `overridden_failed` or `overridden_unattempted`, keep `completed: true`, and add override summary counts without claiming a real pass.

**Why.** A tutor can pass a student on without the check passing — to keep the class together, because the check is wrong, or because the student has clearly understood it and the check is being pedantic. The report currently cannot tell that apart from a genuine pass, so `completionRate` reads as evidence of learning when some of it is evidence of triage. This blocks the same thing T1 blocks: nothing on this list can be evaluated if the pass data is not honest. It is also the other half of T18 — a completion rate is uninterpretable if you know neither which check a student was graded against nor whether they were graded at all.

**Where to look.** Teacher session UI and the report generator (*both unknown paths*).

**Steps.**
1. Establish what the override routes actually are before designing the record. Cover **every** way a task reaches completed without its own check passing — manual mark-complete, force-advance, advancing the whole class past a task, and anything else found. Do not assume there is only one.
2. Record per student per task: that an override happened, at what attempt number, and what the check state was at that moment — still failing, or never attempted at all. Those two are different situations and should not collapse into one flag. Do not store teacher identity.
3. **Keep `finalResult` truthful.** An overridden task must not report `passed`. Suggest a distinct value alongside the existing ones, with `completed` staying separately true — the student did move on, they just did not pass.
4. In `taskSummary`, add an override count per task and keep it visible next to `completionRate`. Whether overrides also count toward `completionRate` matters less than being able to net them off.

**Acceptance criteria.**
- A task a tutor waved a student past is distinguishable from one the student passed, in both the per-student entry and `taskSummary`.
- `finalResult` never claims a pass that the check did not produce.
- A task summary shows how many of its completions were overrides.
- A lesson with no overrides produces reports identical to before.

**Decision resolved.** Override `finalResult` values are `overridden_failed` and `overridden_unattempted`; teacher identity is not stored.

**Worth flagging.** Once this exists, a task overridden for most of the class most of the time is the clearest possible signal that the task or its check is wrong. That is a reporting question, not a platform one — noted so it is not lost.

## T5 — Regression-test PA3 against Python Level 1 Lesson 2

**Why.** There is a known-bad real report to test against, with a fully known expected diff.

**Steps.**
1. Use lesson `python-1-2` and the stored session `1784127735140` (report at `Courses/Python/Level 1/Lesson 2/Reports/python-1-2-report-1784127735140.yaml` in the authoring workspace).
2. Re-generate the report against the fixed code.
3. Confirm task IDs **5, 19, 25** (fill-blank) and **6, 20, 26** (confidence) now appear, in both the per-student arrays and `taskSummary`.
4. Confirm task IDs 1, 2, 8, 9, 10, 12, 22, 30 (information) remain absent.
5. Confirm the 19 task IDs already present are unchanged.

**Acceptance criteria.**
- The regenerated report contains 25 task IDs where the stored one contains 19, with the six new IDs being exactly those listed above.
- No pre-existing entry changes value, other than gaining `taskType`.

---

# PA5 — Carry-through must survive a skipped task

**A bug, not a feature.** Small blast radius, high consequence, independent of everything else on this list.

## T24 — Carry code through a skipped task

**Why.** Carry-through points at a single task ID. When a tutor skips that task, no student ever saves anything against it, so the next task that carries from it finds nothing and falls back to `starterCode`. The student loses the work they built up over the preceding tasks, mid-build, with no warning to them or the tutor. This is exactly the situation PA2 describes: in the Python Level 1 Lesson 2 session the walkthrough skipped task 24, a code task sitting between two attempted code tasks. Skipping is normal and necessary triage — it should cost the class time, not their code.

**Where to look.** Carry-through resolution in the student runtime (*unknown path*). The fields, all *verified*:

| Task type | Field | Doc |
|---|---|---|
| Python | `carryCodeFrom` | `platform-docs/python-tasks.md:14` |
| HTML | `carryCodeFrom` (files matched by filename) | `platform-docs/html-tasks.md:16` |
| Scratch | `carryBlocksFrom` | `platform-docs/scratch.md:51` |
| Filesystem | `carryFsFrom` | `platform-docs/filesystem-tasks.md:30` |
| Electronics | `carryCircuitFrom` | `platform-docs/electronics.md:35` |

**Steps.**
1. When the referenced task has no saved state for that student, **walk back the carry chain** to the nearest earlier task that does, instead of falling back to starter. If task 28 carries from 24, and 24 carries from 21, a skipped 24 resolves to the student's saved 21.
2. Fix it in all five carry fields, not just Python. The failure is identical in each.
3. **Absence of a save is the only trigger.** A student who opened the task and deleted everything has saved an empty editor, and that empty editor is their real state — use it. Do not treat empty content as a skip.
4. Preserve each type's existing carry semantics at every step of the walk-back. For HTML in particular, files are matched by filename and files not named in the current `starterFiles` are hidden — that rule applies to the task the walk-back lands on, unchanged.
5. Record in the session report when carry fell back to an earlier task, and to which. A silent fallback is how this went unnoticed in the first place.

**Acceptance criteria.**
- A class that skips a task carrying code between two attempted tasks arrives at the later task holding the code they wrote, not starter code.
- A student who cleared their editor on the carried-from task gets their empty editor, not a walk-back.
- Carry behaviour is unchanged for every lesson where no task is skipped.
- Behaviour is identical across all five carry fields.
- The report shows where a walk-back occurred.

**Decision needed.** What to do when the skipped task has no carry field of its own to walk back through — the chain ends and there is nothing to inherit. Options are falling back to the nearest earlier task of the same type with a save regardless of the authored chain, or falling back to starter as today. The first is more likely right in the room and less predictable to author against.

**Interacts with PA1c.** T16 already asks how a variant interacts with carry-through. Settle T24 first — it is the simpler half of the same question, and a walk-back that lands on a task the student did in variant form needs to carry the variant's code.

---

# PA2 — Task priority field

Display-only. No behavioural change: the platform shows the priority, the tutor still decides.

**Context.** A tutor triages live with eight children and no signal about which tasks are safe to drop or which later tasks depend on the one they are about to skip. In the Python Level 1 Lesson 2 session, task 24 — a code task between two attempted code tasks — was skipped by the walkthrough. It was a dependency, not a spare.

## T6 — Add `priority` to the task schema and CLI validator

**Where to look.** `cli/validate.mjs` — *verified*. Task-level validation runs in the `flat.forEach` loop from line 61. `estimatedMinutes` validation at line 66 is the closest existing precedent for an optional scalar task field.

**Steps.**
1. Accept `priority` on any task type. Permitted values: `core`, `optional`.
2. **Default to `core` when omitted**, so no existing lesson silently becomes droppable.
3. Add validation next to the `estimatedMinutes` check: reject any value that is not one of the two permitted strings, with a message in the style of the surrounding errors.
4. Note that the browser-only Lesson Builder validator is stricter and separate — `platform-docs/lesson-schema-yaml.md` documents this. Mirror the rule there too.

**Acceptance criteria.**
- `cli lessons validate` accepts `priority: core` and `priority: optional`, and rejects any other value with a clear message.
- A lesson with no `priority` anywhere validates unchanged.

## T7 — Round-trip `priority` through the YAML converter

**Where to look.** `cli/yaml-converter.mjs` — *verified*. `taskToYamlObject` (line 165) spreads the task and then deletes or renames specific fields, so an unknown field likely passes through untouched in both directions.

**Steps.**
1. Confirm passthrough in both directions rather than assuming it.
2. Add a round-trip test: YAML to JSON to YAML preserves `priority` exactly, including its absence.

**Acceptance criteria.** A lesson with mixed `priority` values survives a full round trip with no field added, dropped, or reordered.

## T8 — Surface `priority` in the Lesson Builder

**Where to look.** *Unknown path* — Lesson Builder UI in the platform web app.

**Steps.**
1. Make `priority` settable per task.
2. Show a lesson-level total alongside the existing `estimatedMinutes` total — the builder already totals estimated time, so this is the same surface. Something like "22 core, 8 optional".

**Acceptance criteria.** An author can set priority per task and see the split for the whole lesson without counting manually.

## T9 — Surface `priority` in the teacher live view

**Where to look.** *Unknown path* — teacher session UI.

**Why this one matters most.** This is the entire point of PA2. A priority the tutor cannot see in the room delivers nothing.

**Steps.**
1. Mark priority visibly on each task in whatever list or timeline the tutor uses to navigate the lesson during a live session.
2. **Never show it to students.** Treat it the way `codeStages` labels are already treated — teacher-facing only.

**Acceptance criteria.**
- A tutor can see at a glance which upcoming tasks are optional.
- No student-facing view exposes the field.

## T10 — Include `priority` in session reports

**Why.** So a report can distinguish "the tutor dropped an optional task as designed" from "the tutor dropped a core task and the lesson is overrunning".

**Steps.** Add `priority` to each `taskSummary` entry.

**Acceptance criteria.** A skipped task's summary entry shows whether it was core or optional.

## T11 — Document `priority`

**Where to look.** `platform-docs/lesson-schema-yaml.md` — *verified*. Add to the **Common Task Fields** table (line 83 onwards), which already documents `estimatedMinutes`, `taskMode`, `check` and `feedbackChecks`.

**Acceptance criteria.** The common-task-fields table lists `priority`, its permitted values, its default, and that it is teacher-facing only.

**Not in scope, but worth flagging back to Ryan.** A "skip all optional" control that advances a whole class past optional tasks at once. Not requested — the obvious next step if per-task display proves fiddly in the room.

---

# PA1 — Redesign the code stage model

Three separable features. `codeStages` is being asked to do three jobs and is equipped for one. See **Reference C** for what exists today and **Reference D** for why extension stages have never been buildable.

## PA1a — Show a stage without replacing the student's code

**Context.** One student in the Python Level 1 Lesson 2 session made 33 attempts on a single task, mostly unbalanced-quote and misspelling errors. A support stage existed. Pushing it would have replaced everything they had typed.

**Keep the existing destructive push.** It is not being removed. Slower students and students with additional needs genuinely need to be placed onto a working baseline. This adds an alternative.

### T12 — Make `copyCode` hideable and revealable

**Where to look.** `copyCode` is documented in `platform-docs/python.md:30` and `platform-docs/html.md:43` as a "read-only panel above the student editor" — *verified*. The student-facing renderer for that panel is the target (*unknown path*).

**Steps.**
1. Add a way for `copyCode` — or a nominated code stage — to be **hidden by default and revealed on demand**, rather than always visible.
2. Revealing must **not touch the student's editor**. Their own code stays exactly as they left it, and they fix it themselves.
3. Add a teacher-side control to trigger the reveal for one student.
4. **No attempt-count automation.** Automatic reveal after N failures was considered and rejected: it undercuts the Independent pillar's "find solutions via trial and error", and the teacher already sees failure counts. Do not build a threshold.

**Acceptance criteria.**
- An author can mark a task's `copyCode` as initially hidden.
- A teacher can reveal it for an individual student mid-task.
- The student's editor content is unchanged before and after the reveal.
- Existing always-visible `copyCode` behaviour is the default and is unaffected.

**Decision needed.** Whether the revealable content should be `copyCode`, a nominated `codeStage`, or `completeCode` (currently builder-preview only). `copyCode` is the smallest build; a nominated stage is more flexible.

### T13 — Add a student-initiated reveal control

**Steps.** Give the student a "show me the target" control so someone who knows they are stuck can ask without waiting to be noticed.

**Acceptance criteria.** A student can reveal the panel themselves, and the reveal is recorded (see T14).

**Decision needed.** Whether a student reveal should carry a visible cost — marking the task as assisted in the teacher view, for example — or be freely available. Not settled.

### T14 — Record reveals in the session report

**Why.** Without this the feature generates no learning and there is no way to identify which tasks are too hard.

**Steps.** Record, per student per task: whether the panel was revealed, by whom (teacher or student), and at what attempt number.

**Acceptance criteria.** A report shows which tasks drove the most reveals and at what point students gave up unaided.

## PA1b — Give stages a machine-readable role

### T15 — Add `role` to code stages

**Why.** Whether a stage is easier, harder, or a solution reveal currently exists only as English inside `label`. Nothing can act on it.

**Where to look.** Stage shape is consistent across every task type — *verified*:

| Task type | Stage shape | Doc |
|---|---|---|
| Python | `{ label, code }` | `platform-docs/python-tasks.md:13` |
| HTML | `{ label, files, entryFile? }` | `platform-docs/html-tasks.md:13` |
| Filesystem | `{ label, fs }` | `platform-docs/filesystem-tasks.md:29` |
| Scratch | `{ label, blocks, prebuiltStacks }` | `platform-docs/scratch.md:50` |
| Electronics | `{ label, circuit }` | `platform-docs/electronics.md:33` |

**Steps.**
1. Add an optional `role` to the stage object across all five task types: `support`, `core`, `extension`, `solution`.
2. **Default to `support` when omitted** — that is what almost every existing stage is.
3. Add validation. `cli/validate.mjs:107` already validates stage `label` and `fs` for filesystem tasks; extend that pattern.
4. Flag for a follow-up pass: existing final solution-reveal stages should be relabelled `solution` rather than inheriting the `support` default.

**Acceptance criteria.**
- All five task types accept `role` on a stage.
- Omitting it produces `support`.
- An invalid role is rejected by `cli lessons validate`.

## PA1c — Task variants that carry their own check

The substantive part, and the largest. **Read Reference D before starting.**

### T16 — Design the task-variant data model

**Why.** A task has one `check`. A stage carries only a label and code. There is therefore no way to author a stage graded against a different standard. This is the structural reason no extension stage exists anywhere in Python Level 1 — not authorial oversight.

**Proposed shape** (a starting point, not a specification):

```yaml
  - id: 14
    title: Print your favourite animal
    explainer: ...
    starterCode: ...
    check:
      type: output
      operator: contains
      value: "*"
    variants:
      - role: support
        label: With the variable already created
        starterCode: ...
        check: ...
      - role: extension
        label: Combine two stored values in one print call
        starterCode: ...
        check: ...
```

**Steps.**
1. Decide whether variants are a new field or an extension of `codeStages`. They are close enough that two parallel concepts would be a mistake.
2. Resolve the design questions below.
3. Write the schema up in `platform-docs/` before implementing.

**Design questions — resolve before T17.**
- Does a variant count as the **same task** for completion and progress? **Strong preference: yes.** A student on the extension variant of task 14 is still on task 14, so the class stays visibly together. See the open question below.
- How does a variant interact with `carryCodeFrom` when a later task carries code from a task the student did in variant form? **T24 covers the simpler half of this** — do that first.
- Does solo mode's auto-advance need to understand variants, or are variants live-mode only in v1?
- Do variants apply to non-code task types, or code tasks only?

**Open question, unresolved on the authoring side.** Whether letting the class spread out is desirable at all. There is real value in every student being on the same task — problems get worked through together, nobody is visibly behind — and variants work against that. This is why the ask is framed as *variants of one task* rather than *extra tasks only fast finishers reach*, and why a third "stretch" priority tier was dropped from PA2. The specified design is the one that preserves class cohesion. If implementation pressure pushes toward separate tasks, raise it with Ryan rather than deciding.

### T17 — Implement variant runtime behaviour

**Steps.**
1. A student placed on a variant sees that variant's starter code and is graded against that variant's check.
2. Switching a student to a variant follows the T12 rule where relevant: be explicit about whether it replaces their editor content, and prefer not to once they have work in progress.
3. Teacher can place an individual student on a variant during a live session.

**Acceptance criteria.**
- A student on an extension variant passes on the harder check and is not failed by the core check.
- A student on a support variant passes on the easier check.
- Task completion and progress reflect the same task number regardless of variant.

### T18 — Record the active variant in session reports

**Why.** Without this, completion rates become uninterpretable — a 100 percent completion rate means nothing if some students were on an easier check.

**Steps.** Record which variant each student was on, per task, in both the per-student entry and `taskSummary`.

**Acceptance criteria.** A report distinguishes students who completed core from those who completed a support or extension variant.

### T19 — Variant authoring in the Lesson Builder

**Steps.** Let an author add, edit and preview variants with their own starter code and check, alongside the existing stage editing.

**Acceptance criteria.** An author can build a task with core plus one extension variant without hand-editing YAML.

### T20 — Document stage roles and variants

**Where.** `platform-docs/python-tasks.md`, `html-tasks.md`, `filesystem-tasks.md`, `scratch.md`, `electronics.md`, and the per-type authoring docs (`python.md`, `html.md`).

**Acceptance criteria.** Every code-task field reference documents `role` and `variants` with a worked example.

---

# PA4 — Ordering quiz type

## T21 — Add an `ordering` quiz type

**BLOCKED. Do not start.**

**Blocked on two things:**
1. **T1–T5 (PA3).** Fill-blank results are currently absent from reports entirely.
2. **An authoring trial that has not happened.** `fill_blank` in drag mode approximates a Parsons problem today — blank out whole lines and have students drag them into place. `platform-docs/quiz-tasks.md` confirms blanks can sit inside a fenced code block and render inline at the correct position. That trial runs first, and it cannot produce evidence until PA3 lands.

**Why it may eventually be wanted.** Assessment is deliberately recognition-first, and that is not being reversed. But its known failure mode is showing in real data: in the Python Level 1 Lesson 2 session students passed the syntax and naming quizzes, then on the code task printed the variable's *name* as a quoted string instead of the variable, and omitted quote marks when assigning. Recognition passed; production failed. Ordering is the mildest possible middle rung — no blank page, no typing, no written answer, no exposure for a shy student.

**If it proceeds, proposed shape:**

```yaml
- type: quiz
  quizType: ordering
  title: Put the program in order
  explainer: Drag these lines into the order that stores a name and then shows it.
  items:
    - id: "1"
      text: Create a variable holding the player's name
    - id: "2"
      text: Print the player's name
  distractors:          # optional — lines that belong nowhere
    - id: d1
      text: Ask the player for their age
```

Consistent with existing types: shuffled on render, immediate per-item feedback like `match` and `fill_blank`, completion via implicit `quiz_result` with no `check` needed, Markdown and fenced code blocks supported in `text`.

**Implementation surfaces when unblocked** — *verified*:
- `cli/validate.mjs:79-96` — the `quizType` branch chain. Add an `ordering` branch alongside `multiple_choice`, `match`, `fill_blank`, `short_answer`.
- `cli/yaml-converter.mjs:184-191` — quiz-specific conversion.
- `platform-docs/quiz-tasks.md` and `platform-docs/quiz-types.md` — both need a new section.
- Student-facing quiz renderer (*unknown path*).

**Decision needed, when unblocked.** Whether ordering becomes a required item in every concept sequence or an option authors may reach for. Ryan's call, not yet made.

---

# Documentation defects

## T22 — Fix `copyCode` omission in the code-task field references

**Size: extra small. Independent of everything else.**

`copyCode` is documented in `platform-docs/python.md:30` and `platform-docs/html.md:43`, but is **missing from the field tables** in `platform-docs/python-tasks.md` and `platform-docs/html-tasks.md`, which are the canonical per-field references. An author reading the field table would not know the panel exists.

**Steps.** Add `copyCode` to the field tables in both files, matching the description already used in the authoring docs.

**Acceptance criteria.** Both field-reference tables list `copyCode`.

**Related, but not a platform issue.** `guides/Teaching Ethos.md` and `guides/Quiz Writing Guide.md` both name ordering as a preferred assessment format, which has never been buildable. Those are authoring-side guides and Ryan is correcting them — noted here only so the platform team knows why no lesson uses ordering.

---

# Noted, deliberately not requested

Recorded so these read as decisions rather than oversights.

**Attempt-aware feedback checks.** `feedbackChecks` supports `show: after_attempt` and `show: on_idle` but has no attempt-*number* condition, so escalating hints ("on the third failure, say more") are not expressible — every hint is one fixed message. This is a real constraint and it shaped T12, which is why the reveal is human-triggered rather than escalating. Not currently requested.

**Adaptive routing.** Automatically skipping students past tasks based on earlier performance. Rejected on pedagogical grounds — the specific case examined was skipping Copy the Code for confident students, and hand-typing was judged to be thinking time rather than transcription. No routing feature is wanted.

**Milestone marking.** Every lesson is gaining a required payoff moment. As specified this is authoring framing and needs nothing built. If the moment should *feel* different to the student rather than just read differently, that becomes a platform ask. Flagged as plausible future work.

---

# Reference

## Reference A — Evidence for the PA3 report bug

Python Level 1 Lesson 2 (`python-1-2`), all 33 tasks cross-referenced against the stored session report:

| Task type in lesson       | Task IDs                              | In report? |
| ------------------------- | ------------------------------------- | ---------- |
| Code tasks                | 7, 11, 13, 14, 15, 16, 21, 24, 28, 29 | All present |
| Multiple choice quizzes   | 3, 4, 17, 18, 23, 27, 31, 32, 33      | All present |
| Fill-in-the-blank quizzes | 5, 19, 25                             | **All absent** |
| Confidence quizzes        | 6, 20, 26                             | **All absent** |
| Information tasks         | 1, 2, 8, 9, 10, 12, 22, 30            | Absent (expected) |

The absent tasks appear nowhere — not in any student's `tasks` array, not in `taskSummary`.

## Reference B — Root cause of the PA3 bug

**Every task carrying an explicit `check` is reported. Every task that completes without one is dropped.**

- **Multiple choice survives** because `cli/yaml-converter.mjs:153` expands the `answer:` shorthand into a real check object on the task. *Verified.*
- **Fill-blank and match are dropped.** They complete automatically when all blanks or pairs are correct — `platform-docs/quiz-tasks.md` states "No `check` needed... equivalent to `quiz_result`". No `check` is written into the task, so nothing is recorded.
- **Confidence is dropped.** No check by design — "Any rating completes the task".

This points to a report generator that iterates tasks holding a `check` rather than tasks the student interacted with.

**Why it matters beyond confidence data.** Every "Introduce New Concept" sequence contains a fill-in-the-blanks task, placed as the last recognition rung before the student writes code unaided. That is precisely where the recognition-to-production gap opens, and there is currently no data on it whatsoever.

## Reference C — Session report shape as it exists today

Per student, per task:

```yaml
- taskId: 14
  title: Creating and Printing a Variable - 6
  completed: true
  attempts: 5
  finalResult: passed
  timeOnTaskMs: 258522
  distinctAttempts:
    - attemptNumber: 1
      passed: false
      retries: 0
      suggestion: Print the variable you created, not a new piece of quoted text.
      submission: |-
        ...student code...
```

Per task across the session:

```yaml
taskSummary:
  - taskId: 3
    title: Recapping print(), Comments, and Errors - 2
    totalStudents: 3
    completedCount: 2
    completionRate: 0.67
    avgAttempts: 1.5
    avgTimeOnTaskMs: 19421
    commonFailures:
      - suggestion: Python's keywords, like `python:print`, must be written in lowercase.
        count: 1
```

`submission` already carries the option id for multiple choice and full source for code tasks — the mechanism for recording a non-code answer exists and works. Reports are stored in the Firestore `sessionReports` subcollection under each lesson (`cli/lessons.mjs:151`). *Verified.*

## Reference D — Why extension stages have never been buildable

Documented `codeStages` behaviour:
- The teacher can send any stage to a student, which **replaces the content of the student's editor**.
- In solo mode the platform auto-advances through stages in order to the final complete-code stage, then check-gates on the task's `check`.
- Stage labels are teacher-facing only.

**The check lives on the task, not the stage.** A task has one `check`; a stage carries only a label and code. There is no way to author a stage graded against a different standard, so a harder stage would either be failed by the core check or force that check to be loosened until it no longer tests the core task properly.

Across all of Python Level 1, every stage is a support variant or a solution reveal. There is not one extension stage. The Accessible pillar in `guides/Teaching Ethos.md` calls for core, extension and support variants — the third has never been possible to build.

## Reference E — Verification basis

Checked against: `platform-docs/lesson-schema-yaml.md`, `python-tasks.md`, `python.md`, `html-tasks.md`, `html.md`, `filesystem-tasks.md`, `quiz-tasks.md`, `quiz-types.md`, `scratch.md`, `electronics.md`; `cli/validate.mjs`, `cli/yaml-converter.mjs`, `cli/lessons.mjs`; `Courses/Python/Level 1/Lesson 2/Lesson.yaml`; and the session report `python-1-2-report-1784127735140.yaml` (3 students).
