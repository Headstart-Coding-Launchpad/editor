# Lesson Screenshots (CLI)

`hsc lessons screenshot` saves a PNG of a lesson task as a student or tutor sees it in LaunchPad. It's for the screenshots lessons show (Tooling Introductions, editor and output examples, the Stage, Shared work moments) so Attach assets can take them instead of Ryan. It never changes the lesson.

There are two kinds of shot:

- **Student views** (`--view student`, the default) render the task on its own, with no session. The lesson is handed straight to the page, so **Drafts work** and nothing is written to Firebase: no session, solo log, progress or saved code.
- **Session views** (`student-live`, `tutor`, `tutor-grid`, `student-modal`, `shared-work`) need a real live session. The command copies the lesson to a throwaway Draft (`[Screenshot] <title>`, id `shot-…`), the test tutor runs a session on it with made-up `Test …` students, and afterwards the copy, its session reports and its live-session data are deleted, even when a shot fails. The real lesson's sessions and reports are never touched.

## Requirements

- Run `npm install` at the repo root as well as in `cli/`, and install Chromium once with `npx playwright install chromium` (as for `scratch render`).
- A lesson id reads Firestore and needs CLI credentials (`cli/.env`). `--file` needs none for student views.
- Session views also need the test tutor's login and the app's Firebase keys: `AUDIT_TUTOR_EMAIL`, `AUDIT_TUTOR_PASSWORD`, `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_DATABASE_URL`. They're read from the shell or `cli/.env`, then from the file `HSC_ENV` names, then from the repo-root `.env`.
- Shots are taken on the live site by default. `--base http://localhost:5173/editor/` uses a local `npm run dev` instead.

## One shot

```bash
# Task 21 as a student first sees it
node cli/cli.mjs lessons screenshot caakmdqj5j --task 21

# With its complete code, after Run, cropped to the Stage
node cli/cli.mjs lessons screenshot caakmdqj5j --task 21 --code-stage complete --run --crop stage

# Your own code, answering input() prompts, on a tablet
node cli/cli.mjs lessons screenshot caakmdqj5j --task 26 --code @hero.py --run --inputs "Ava,the Moon" --device tablet

# The tutor's student grid with two made-up students
node cli/cli.mjs lessons screenshot caakmdqj5j --task 21 --view tutor-grid
```

| Option | Meaning |
|---|---|
| `[id]` or `--file <lesson>` | The lesson: a Firestore id, or a JSON or YAML file. |
| `--task <id>` | The task id (as in the lesson, not a 0-based index). |
| `--open-task <id>` | Show this task instead, for an image that belongs to one task but shows the next. The file is named after the task shown. |
| `--view` | `student` (default), `student-live`, `tutor`, `tutor-grid`, `student-modal` or `shared-work`. See [Session views](#session-views). The names `editor+output`, `editor`, `output`, `stage`, `student-page` and `tutor-page` also work. |
| `--crop` | `page` (default, the whole window), `workspace` (editor and output together), `instructions`, `editor`, `output`, `console` or `stage`. Student and `student-live` views only. |
| `--device` | `desktop` (1440×900, default) or `tablet` (1024×768, touch). `--width` / `--height` override it. |
| `--scale <n>` | Pixel ratio. `2` gives sharper, double-size images. |
| `--code <text\|@file>` | Code to show instead of the starter. Python and Turtle take code; HTML takes the entry file's content; Scratch takes a blocks JSON state. A path after `@` is read relative to the working folder. |
| `--code-stage <name>` | Show a code stage instead: `complete`, `starter`, a stage label or its index. Not with `--code`. |
| `--run` | Press Run (the green flag on Scratch) and wait for the run to finish, including a Turtle drawing. |
| `--inputs "a,b"` | Answers to `input()` prompts, in order. |
| `--click <name>` | A button or tab to click first, by its name, e.g. `--click Stage` for the Stage tab on a tablet. Repeatable. |
| `--wait <ms>` | Extra wait before the capture (Scratch scripts that keep moving, animations). |
| `--students "Test Ava,Test Ben"` | Session views: the made-up students. Every name must start with `Test`. |
| `--student <name>` | Session views: whose screen or modal to capture. `--click` clicks on this student's screen. |
| `--tutor-click <name>` | Session views: a button the tutor clicks before the capture, e.g. `--tutor-click "Shared work"` to open the tutor's list. Repeatable. In a spec: `tutorClick`. |
| `--out <path>` / `--out-dir <folder>` | Where to save. By default the file is `task <id>[ - view][ - crop][ - WxH].png` in `--out-dir` (the current folder by default). |
| `--base <url>` | The LaunchPad site to use. The default is the live site. |

The command prints one result per shot: `{ task, view, crop, file }`, or `{ task, view, error }`.

## Many shots (`--spec`)

Attach assets can pass every screenshot for a lesson in one JSON file. Each entry takes the options above in camelCase (`openTask`, `codeStage`), and command-line options are defaults for every entry. `code` values starting with `@` are read relative to the spec file.

```json
[
  { "task": 20, "openTask": 21, "crop": "workspace" },
  { "task": 21, "codeStage": "complete", "run": true, "crop": "stage" },
  { "task": 26, "code": "@code/hero.py", "run": true, "inputs": ["Ava", "the Moon"] },
  { "task": 21, "view": "tutor-grid", "students": [
      { "name": "Test Ava", "code": "@code/ava.py", "run": true },
      { "name": "Test Ben", "code": "@code/ben.py", "run": true }
  ] },
  { "task": 37, "view": "shared-work", "students": [
      { "name": "Test Ava", "code": "@code/ava.py", "run": true, "share": true },
      { "name": "Test Ben", "code": "@code/ben.py", "run": true, "share": true },
      "Test Cara"
  ] }
]
```

```bash
node cli/cli.mjs lessons screenshot caakmdqj5j --spec shots.json --out-dir images/
```

All the session shots of one size share one throwaway session, in the order listed, so later shots see what earlier ones did (for example, shares stay in the gallery).

## Session views

| View | What it captures |
|---|---|
| `student-live` | `--student`'s own screen in the live session. Takes `--crop`. |
| `tutor` | The tutor's whole page. |
| `tutor-grid` | The tutor's student grid (opened from its rail on a tablet). |
| `student-modal` | The tutor's modal for `--student`, over the page. |
| `shared-work` | The Shared work gallery, as `--student` sees it. By default that's a classmate who didn't share, so no entry says "(you)". |

Each student in `students` can be a name, or `{ "name", "code", "run", "inputs", "share" }`:

- `code` is typed into that student's editor (Python, Turtle and HTML).
- `run` presses Run, answering `inputs`.
- `share` sends their work to the class and the tutor approves it. Sharing only appears on tasks with `allowSharing`, so the throwaway copy turns it on for any task a shot shares on. The lesson itself is unchanged.

A `shared-work` shot with nobody marked `share` makes the first student share. Session views default to two students, `Test Ava` and `Test Ben`.

The class is moved to each shot's task with the tutor's navigator, by the task's title.

## When a shot fails

A shot that can't do what it was asked fails with its task named and writes **no file**: a panel it can't find (for example `--crop stage` on an HTML task), a Run that never finishes, an `input()` that never comes, a button it can't click. The other shots carry on, and the command exits with code 1. Fix the spec, or report a broken panel to LaunchPad Dev. A test in LaunchPad (`cli/lesson-screenshot-input.test.js`) checks that the panel hooks the command relies on are still in the app.

What it can't capture stays on Ryan's list: other websites, Ryan's own logins, and recordings (GIFs).
