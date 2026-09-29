# Authoring Requests

Lesson agents (and people) file a request here for anything a lesson needs from the platform side:

- **New capabilities:** a new activity, a new workspace module, a new check type, or a new mode for an existing activity. Claude's `new-activity` / `new-module` skills start from these files.
- **Bugs:** the platform doesn't do what the docs say, or a check fails a correct answer.
- **Docs:** an authoring page is wrong, missing or contradicts itself or the live lessons.
- **Tooling:** a CLI command or machine-readable output that lesson authoring needs.

**Before filing:** run `node cli/cli.mjs lessons capabilities`. It lists every module, activity and check type the platform has right now, read straight from the registries. Most gaps turn out to be a check or mode on something that exists.

## How to file

Create `docs/authoring/authoring-requests/<yyyy-mm-dd>-<short-slug>.md`, copying the template below. One request per file. Don't edit other people's requests except to update **Status**.

Request files don't need a `docs/README.md` entry (`npm run docs:check` skips this folder apart from this README).

## Template

```markdown
# <Short name of what's needed>

- **Status:** open            <!-- open | planned | shipped | declined -->
- **Kind:** activity          <!-- activity | module | check type | activity mode | bug | docs | tooling -->
- **Requested by:** <agent or person> (approved by <person>), <yyyy-mm-dd>   <!-- "(approved by …)" is optional -->
- **Lessons blocked:** <lesson ids or titles, or "none yet">

## Need

What must the lesson teach, and why can't existing capabilities do it? Name the closest
existing module/activity/check from `lessons capabilities` and what it's missing.
For a bug: what you did, what happened, what should have happened (a lesson id or YAML
snippet that reproduces it). For docs: the page and section, and what it should say.
For tooling: the command or output wanted and what it replaces.

## Example task

The YAML you wish you could write (omit for bug, docs and tooling requests unless it helps):

    - type: <activity or module>
      title: ...
      ...

## Checks wanted

- Outcome: what must be true at the end (e.g. "the number 13 is shown in binary").
- Method (optional): how it must be done (e.g. "used Shift, not Caps Lock"; "dragged, not cut/paste").

## Devices

Touch screens, tablets without keyboards, Chromebooks: what should happen on each?

## Notes

Anything else: age range, links to course plans, screenshots.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
```

## How requests are handled

1. Status moves `open` → `planned` (with the PR link) → `shipped` (with docs link), or `declined` with a reason. The lesson workspace reads the **Status** line back automatically, so keep those exact words and fill in **Resolution** when it ships.
2. Each kind is handled differently:

   | Kind | How it's handled | Done when |
   | --- | --- | --- |
   | `activity`, `module` | Apply the **workspace module vs activity** test from `docs/architecture/modular-activities-plan.md`: if a later task builds on what the student made, a teacher would demo freely in it, or there's a real free-play mode, it's a module; otherwise it's an activity. Then follow the steps below (activity) or the `new-module` skill. | It appears in `lessons capabilities` and has an authoring doc under `docs/authoring/`. |
   | `activity mode`, `check type` | Built in the existing activity's or module's folder (no scaffold), with tests, validation and a row in its authoring page. | The mode or check is documented and listed by `lessons capabilities`. |
   | `bug` | Reproduce it (a failing test first where possible), fix it, and add a CHANGELOG entry if it changes how lessons behave or should be written. If the docs were right, no docs change is needed. | The fix is merged and the repro test passes. |
   | `docs` | Confirm the real behaviour against the code or a live lesson, then fix the page. If the code is what's wrong, refile or relabel it as a `bug`. | The page is corrected; add a CHANGELOG entry if authors should write lessons differently. |
   | `tooling` | Changes to `cli/` (commands, `lessons capabilities` output) or other machine-readable outputs, with tests. | The command ships and is documented in the relevant `docs/authoring/` page. |
### How a request becomes an activity

Claude Code's `new-activity` skill (`.claude/skills/new-activity/SKILL.md`) does this; people can follow the same steps.

1. Read the request, apply the test above, and check `lessons capabilities` for a closer fit (a new *mode* of an existing activity is built in that activity's folder, not scaffolded). Set **Status** to `planned`.
2. Scaffold: `npm run new:activity -- <id> "<Label>" --category …` (try `--dry-run` first). This creates `src/activities/<id>/`, registers it, and writes `docs/authoring/activities/<id>.md` with a valid example, so every check passes from the start. See "Adding an activity" in [activities.md](../../architecture/activities.md).
3. Implement the request's **Example task**, **Checks wanted** and **Devices** in the scaffold: the task fields and validation, grading with hints for ages 8–14, the student UI (with `requires` / `touchFallback` for the device needs), tests including a real StudentView click-through, the authoring page, `validation-errors.md` rows and a CHANGELOG entry.
4. When the checks and a real-browser pass are done, fill in **Resolution** (PR, activity id, docs link) and set **Status** to `shipped` once merged. The blocked lessons can now use `taskType: activity` + `activityType: <id>`.

Workspace modules can't be scaffolded yet (plan step 4.8); the `new-module` skill lists the manual checklist.
