# HSC: Review a LaunchPad Lesson

Use with a lesson ID when asked to review a LaunchPad lesson at its current stage.

This playbook covers CLI access and workflow mechanics. Review judgement belongs in the LaunchPad Authoring Guidelines, especially `teaching-ethos`, `lesson-style`, `draft-ideas`, `draft-details`, `draft-review`, and `draft-topics`.

## Step 1 - Load the review rules

Fetch the live guidelines before reviewing:

```bash
node cli/cli.mjs authoring guidelines list --format yaml
```

Read the relevant stage guideline and the Lesson Style Guide. Do not rely on local Markdown copies for review logic.

## Step 2 - Pull the lesson from LaunchPad

Start with the compact view, then fetch the full lesson:

```bash
node cli/cli.mjs lessons skeleton <lessonId> --format yaml
node cli/cli.mjs lessons get <lessonId> --format yaml
node cli/cli.mjs lessons topics <lessonId> --format yaml
node cli/cli.mjs lessons review <lessonId> --format yaml
```

Use the lesson's `stage` field to choose the review standard. If `stage` is missing, treat the lesson as `published`.

`lessons skeleton` uses flat task positions. `lessons review --task` needs the stored task `id`. Get that ID from the full lesson output or by fetching a task:

```bash
node cli/cli.mjs tasks get <lessonId> <flatTaskIndex> --format yaml
```

## Step 3 - Review stage-appropriately

Apply the live Authoring Guidelines to the stage:

- `ideas`: review structure, concept sequence, task shape, likely pitfalls, grouping, topic plans, and feasibility.
- `details`: review exact student-facing content, learner action, starter state, expected outcome, proposed checks, hints, code stages, and handoff notes.
- `review`: decide task acceptance or rejection, then approve only if every task is accepted and no unresolved change remains.
- `approved`: verify the specification is ready for faithful implementation; return to an earlier stage if the spec itself needs changes.
- `published`: review as a live lesson audit and note defects or Fast Path fixes.

While reviewing, specifically consider student simplicity, instruction clarity, check quality, realistic timing, likely blockers, code-stage support, task sequencing, and fit with the Lesson Style Guide.

## Step 4 - Record notes in LaunchPad

Reject a task when a change is needed:

```bash
node cli/cli.mjs lessons review <lessonId> --task <taskId> --decision rejected --note "Specific requested change"
```

Accept a task when it is stage-ready:

```bash
node cli/cli.mjs lessons review <lessonId> --task <taskId> --decision accepted
```

Add useful supporting context without changing the decision:

```bash
node cli/cli.mjs lessons review <lessonId> --task <taskId> --extra "Brief supporting note"
```

Make rejected notes actionable: name the blocker, the requested change, and why it matters for the learner or implementation.

## Step 5 - Set the stage outcome

If the lesson needs content or configuration changes but the structure is still right:

```bash
node cli/cli.mjs lessons set-stage <lessonId> details
```

If the lesson needs structural changes:

```bash
node cli/cli.mjs lessons set-stage <lessonId> ideas
```

If every task is accepted and the full lesson is ready:

```bash
node cli/cli.mjs lessons set-stage <lessonId> approved
```

Do not approve a lesson with rejected or pending tasks, unresolved review notes, missing required topic handling, or stage-blocking validation issues.

## Step 6 - Report back to the user

After writing LaunchPad notes, summarize through the agent:

- current stage and final decision;
- strongest parts of the lesson;
- blocking issues and which tasks were rejected;
- any pacing, clarity, support, checks, topic, or implementation risks;
- exact stage change made, if any.

Keep the user-facing summary concise, but include enough detail that the author knows what to fix next.
