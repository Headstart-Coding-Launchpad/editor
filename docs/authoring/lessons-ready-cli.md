# Is a lesson ready for class? (CLI)

`hsc lessons ready` runs a lesson the way a child would before a class does, and says what broke. It never changes the lesson and writes nothing to Firebase.

```bash
node cli/cli.mjs lessons ready lesson.yaml                  # a JSON or YAML file
node cli/cli.mjs lessons ready caakmdqj5j                   # a published lesson (reads Firestore)
node cli/cli.mjs lessons ready lesson.yaml --inputs answers.yaml --out report.json
```

It prints a JSON report on stdout and a short plain summary on stderr, and exits:

| Exit | `result` | Meaning |
|---|---|---|
| 0 | `ready` | Every step ran and passed. |
| 1 | `not_ready` | Something failed: fix it before class. |
| 2 | `not_fully_checked` | Nothing failed, but something was not checked (each with its reason). |

A lesson with anything not checked is never reported as `ready`.

## What it checks

1. **Validate as published.** The usual `lessons validate`, with the Draft flag ignored, so a Draft gets every check rule a published lesson does.
2. **Assets.** Every image and asset URL the lesson uses (Markdown images, `src` attributes, `storageAssets`, picture and sprite URLs) is fetched. A broken one fails. A relative path is listed as not checked.
3. **Python and Turtle tasks are run** in Chromium on the app's `#/shot` page (as `lessons screenshot` does) at 1366×768:
   - **the starter must not pass** (a child could otherwise finish without changing anything). A run-and-read task, whose starter is its complete code or whose only check is `run_attempted`, must pass instead. A `carryCodeFrom` task starts from the complete code of the task it carries from;
   - **the complete code must pass**, and its failure shows the hint the child would see;
   - **`setupCode` must run clean** (no "This task's setup has a problem");
   - a task with no check: its complete code must run without an error;
   - **each authored hint** (on a check or a feedback check) is looked for in the banner after each run. A hint no run showed is listed as not checked.
4. **Scratch tasks** are judged on each stage's blocks without a run, as the classroom judges block checks: the starter must not pass and each complete stage must pass (the shared stage verification `lessons test-checks` uses). Run-time checks (`sprite_property`…) are not checked.

## What it does not check

Each of these is reported as not checked, with its reason:

- quizzes, activities and `code_arrange` tasks;
- Arcade and Electronics tasks; HTML, Filesystem and Desktop tasks (frozen modules);
- Python `tests` (Run Tests) and submit-mode tasks;
- code that calls `input()`, unless you give the answers with `--inputs`;
- predict-mode tasks whose Run waits for the child's predictions;
- `carryCodeFromLesson` starters (the child's own work from an earlier lesson).

Never looked at: Topic Library links (use `lessons preflight`), tutor views and live sessions, how the lesson reads or looks (use `lessons screenshot`), code stages other than starter and complete.

## Options

| Option | Meaning |
|---|---|
| `<lesson>` | A JSON or YAML file, or a published lesson id (needs CLI credentials, one Firestore read). |
| `--inputs <file>` | Answers to `input()` questions, JSON or YAML: `{ "8": ["Ava", "7"] }` for every run of task 8, or `{ "8": { starter: [...], complete: [...] } }`. A run that asks more questions than were given is not checked; nothing is made up. |
| `--task <id>` | Only this task. |
| `--out <file>` | Also write the JSON report to this file. |
| `--base <url>` | The LaunchPad site to run on. The default is the live site; `--base http://localhost:5173/editor/` uses a local `npm run dev`. |
| `--no-run` | Run nothing: every run is reported as not checked. |
| `--no-assets` | Fetch nothing: every asset is reported as not checked. |

Runs need the repo's dev dependencies and Chromium, as for `lessons screenshot`: `npm install` at the repo root and `npx playwright install chromium`.

## No Firebase writes

The `#/shot` page keeps the code in memory (the Builder preview's mode): no session, progress, solo log or saved code. On top of that, the command blocks every request the page makes to Firestore, the Realtime Database, Auth and Functions, and every Storage upload; Storage file reads are allowed so images load. The report's `network.blocked` lists what the page tried.

## The report

```json
{
  "lessonId": "caakmdqj5j",
  "result": "not_fully_checked",
  "exitCode": 2,
  "steps": {
    "validate": { "status": "pass", "wasDraft": false, "errors": [], "warnings": [] },
    "assets": { "status": "pass", "checked": 10, "broken": [], "notChecked": [] }
  },
  "tasks": [
    {
      "id": 19,
      "title": "My Pet Is...",
      "module": "python",
      "status": "not_checked",
      "checks": [
        { "name": "starter does not pass", "role": "starter", "status": "pass" },
        { "name": "complete code passes", "role": "complete", "status": "pass" }
      ],
      "hints": [
        { "source": "feedbackChecks[0]", "hint": "…", "status": "not_checked", "reason": "no run of the authored code showed this hint" }
      ]
    }
  ],
  "summary": { "tasks": 46, "passed": 0, "failed": 0, "notChecked": 31, "nothingToRun": 15 },
  "network": { "blocked": ["POST identitytoolkit.googleapis.com/v1/accounts:signUp"], "blockedCount": 72 },
  "notCovered": ["Topic Library links (use lessons preflight)", "…"]
}
```

Each task's `status` is `pass`, `fail`, `not_checked` (with `reason`, or a reason on each check or hint) or `nothing_to_run` (information tasks). Each check is `pass`, `fail` (with `detail`) or `not_checked` (with `reason`).

The verdict is read from what the child sees: the check banner (pass or fail, and its hint) and the output panel. `cli/lesson-ready-run.test.js` renders the real banner and output panel, so a UI change that would make the command misread a run fails the test suite.
