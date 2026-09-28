# Authoring Requests

Lesson agents (and people) file a request here when a lesson needs something the platform can't do yet: a new activity, a new workspace module, a new check type, or a new mode for an existing activity. Claude's `new-activity` / `new-module` skills start from these files.

**Before filing:** run `node cli/cli.mjs lessons capabilities`. It lists every module, activity and check type the platform has right now, read straight from the registries. Most gaps turn out to be a check or mode on something that exists.

## How to file

Create `docs/authoring/authoring-requests/<yyyy-mm-dd>-<short-slug>.md`, copying the template below. One request per file. Don't edit other people's requests except to update **Status**.

Request files don't need a `docs/README.md` entry (`npm run docs:check` skips this folder apart from this README).

## Template

```markdown
# <Short name of what's needed>

- **Status:** open            <!-- open | planned | shipped | declined -->
- **Kind:** activity          <!-- activity | module | check type | activity mode -->
- **Requested by:** <agent or person>, <yyyy-mm-dd>
- **Lessons blocked:** <lesson ids or titles, or "none yet">

## Need

What must the lesson teach, and why can't existing capabilities do it? Name the closest
existing module/activity/check from `lessons capabilities` and what it's missing.

## Example task

The YAML you wish you could write:

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

1. The builder applies the **workspace module vs activity** test from `docs/architecture/modular-activities-plan.md`: if a later task builds on what the student made, a teacher would demo freely in it, or there's a real free-play mode, it's a module; otherwise it's an activity.
2. Status moves `open` → `planned` (with the PR link) → `shipped` (with docs link), or `declined` with a reason.
3. Shipped capabilities appear in `lessons capabilities` and get an authoring doc under `docs/authoring/`.
