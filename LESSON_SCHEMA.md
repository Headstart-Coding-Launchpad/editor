# Headstart Lesson Schema

This document describes the lesson JSON format currently supported by the classroom app and lesson builder. Lesson files live in `lessons/` and are static JSON.

The schema has three lesson types:

- `python`
- `html`
- `scratch`

Every lesson can contain code tasks plus `information` and `quiz` tasks.

## Lesson Envelope

```json
{
  "id": "python-for-loops",
  "type": "python",
  "title": "Python For Loops",
  "description": "Practise loops in Python.",
  "sandboxStarter": "# Sandbox — try anything here!\n",
  "assetsPath": "scratch-assets",
  "tasks": []
}
```

| Field | Required | Type | Applies to | Notes |
|---|---:|---|---|---|
| `id` | Yes | string | all lessons | Lowercase slug used in URLs and export filename. |
| `type` | Yes | string | all lessons | One of `python`, `html`, `scratch`, or `filesystem`. |
| `title` | Yes | string | all lessons | Display title. |
| `description` | Yes | string | all lessons | Short entry screen summary. |
| `level` | No | number | all lessons | Difficulty level shown as a badge in the TopBar. |
| `sandboxStarter` | No | string | Python, Scratch | Pre-loaded Python code or Scratch state for sandbox mode. |
| `sandboxStarterFiles` | No | file array | HTML | Pre-loaded HTML files for sandbox mode. |
| `sandboxToolbox` | No | string | Scratch | Scratch XML toolbox to use in sandbox mode. |
| `sandboxSprites` | No | sprite array | Scratch | Sprites to use in sandbox mode. |
| `sandboxBackdrops` | No | backdrop array | Scratch | Backdrops to use in sandbox mode. |
| `assetsPath` | No | string | all lessons | Base URL path for asset resolution (backdrops, costumes, AssetBrowser). |
| `assets` | No | string array | all lessons | List of asset file paths shown in the AssetBrowser. |
| `tasks` | Yes | array | all lessons | Ordered task list. IDs should be sequential integers starting at `1`. May also contain group objects. |

## Common Task Fields

These fields can appear on tasks unless noted otherwise.

| Field | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | integer | Sequential task number. |
| `title` | Yes | string | Short task title. |
| `explainer` | Yes | string | Markdown shown to students. |
| `estimatedMinutes` | No | positive integer | Approximate duration; totaled in the builder and used for the teacher countdown. |
| `taskMode` | No | string | Controls where the task is visible. Omit or use `both` (default) to show in all modes. Use `live` to show only during live sessions. Use `solo` to show only in solo mode. |
| `taskType` | No | string | Omit for normal code tasks. Use `information` or `quiz` for non-code tasks. |
| `hints` | No | string array | Optional hints shown by the hint panel. Empty strings are stripped on export. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. |
| `_checkTested` | No | boolean | Builder-only validation flag. Export may include it if present. |

## Task Format Matrix

| Lesson type | Normal code task | Information task | Quiz task |
|---|---|---|---|
| `python` | Python editor and output panel | Supported | Supported |
| `html` | Multi-file HTML/CSS/JS editor and iframe | Supported | Supported |
| `scratch` | Scratch blocks and stage | Supported | Supported |
| `filesystem` | Virtual file manager (Windows Explorer-style) | Supported | Supported |

`information` and `quiz` tasks ignore lesson-specific code fields such as `starterCode`, `starterFiles`, `starterBlocks`, and carry-through fields.

## Python Code Tasks

```json
{
  "id": 1,
  "title": "Print a message",
  "explainer": "Use `print()` to show text.",
  "starterCode": "print('Hello')\n",
  "completeCode": "print('Hello Headstart')\n",
  "carryCodeFrom": null,
  "interactionMode": "run",
  "hints": ["Use quotes inside the print brackets."],
  "check": {
    "type": "output_contains",
    "value": "Hello"
  }
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `starterCode` | No | string | Code loaded when no carry-through work exists. |
| `completeCode` | No | string | Reference solution used by the builder for preview/copy-forward workflows. |
| `codeStages` | No | stage array | Optional intermediate stages between starter and complete. Each stage has a `label` and `code`. Teacher can send any stage to students. |
| `carryCodeFrom` | No | integer or null | Previous task ID to load saved code from. |
| `interactionMode` | No | string | Omit or use `run` for Run button. Use `submit` for code-only checks without running. |

Supported combinations:

- No `starterCode`, no `carryCodeFrom`: student starts with an empty editor.
- `starterCode` only: student starts from the starter code.
- `carryCodeFrom` only: load previous saved code if available, otherwise empty editor.
- Both `carryCodeFrom` and `starterCode`: load previous saved code if available, otherwise starter code.
- `interactionMode: "run"` or omitted: Run executes Python and checks against output/code/status.
- `interactionMode: "submit"`: Submit checks code text only; use only submit-compatible checks.

## HTML/CSS/JS Code Tasks

```json
{
  "id": 1,
  "title": "Build a page",
  "explainer": "Add a heading to the page.",
  "entryFile": "index.html",
  "completeEntryFile": "index.html",
  "carryCodeFrom": null,
  "starterFiles": [
    {
      "name": "index.html",
      "type": "html",
      "content": "<!DOCTYPE html>\n<html>\n<body>\n</body>\n</html>"
    },
    {
      "name": "style.css",
      "type": "css",
      "content": "body { font-family: sans-serif; }\n"
    },
    {
      "name": "script.js",
      "type": "javascript",
      "content": "console.log('ready')\n"
    }
  ],
  "completeFiles": [
    {
      "name": "index.html",
      "type": "html",
      "content": "<!DOCTYPE html>\n<html>\n<body>\n<h1>Hello</h1>\n</body>\n</html>"
    }
  ],
  "interactionMode": "run",
  "check": [
    {
      "type": "element_exists",
      "selector": "h1"
    },
    {
      "type": "output_contains",
      "value": "Hello"
    }
  ]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `starterFiles` | No | file array | Files shown as editor tabs. HTML tasks need at least one file in practice. |
| `completeFiles` | No | file array | Reference solution files used by the builder. |
| `codeStages` | No | stage array | Optional intermediate stages between starter and complete. Each stage has a `label`, `files`, and optional `entryFile`. Teacher can send any stage to students. |
| `entryFile` | No | string | HTML file rendered in the iframe. Defaults to `index.html` when available. |
| `completeEntryFile` | No | string | Entry file for `completeFiles`. |
| `carryCodeFrom` | No | integer or null | Previous task ID to load saved files from, matched by filename. |
| `interactionMode` | No | string | Omit or use `run` for iframe execution. Use `submit` for code-only checks. |

File object:

| Field | Required | Type | Allowed values |
|---|---:|---|---|
| `name` | Yes | string | Any unique filename, for example `index.html`. |
| `type` | Yes | string | `html`, `css`, or `javascript`. |
| `content` | Yes | string | File contents. |

Supported combinations:

- Single HTML file.
- HTML file plus CSS and/or JavaScript files.
- Multiple HTML pages linked by `href` and `src`.
- `entryFile` omitted: app uses `index.html` when possible.
- `carryCodeFrom` with matching filenames: carries each matching file independently.
- New files in the current task: use current `starterFiles` content.
- Files from the carried task that are not in current `starterFiles`: hidden.
- `interactionMode: "run"` or omitted: Run renders iframe and checks output, code, and DOM.
- `interactionMode: "submit"`: Submit checks source code only; DOM/output checks are invalid.

## Scratch Code Tasks

```json
{
  "id": 1,
  "title": "Move the Rocket",
  "explainer": "Make the rocket move to the right.",
  "toolbox": "<xml><category name=\"Motion\"><block type=\"motion_movesteps\"/></category></xml>",
  "sprites": [
    {
      "id": "sprite1",
      "name": "Rocket",
      "type": "arrow",
      "x": -100,
      "y": 0,
      "size": 100,
      "direction": 90,
      "costumes": [
        {
          "name": "rocket",
          "image": "sprites/rocket.png"
        }
      ]
    }
  ],
  "backdrops": [
    {
      "id": "backdrop1",
      "name": "Space",
      "image": "backdrops/space.png"
    },
    {
      "id": "backdrop2",
      "name": "Plain",
      "colour": "#ffffff"
    }
  ],
  "starterBlocks": {
    "sprite1": {}
  },
  "completeBlocks": {
    "sprite1": {}
  },
  "carryBlocksFrom": null,
  "check": {
    "type": "sprite_property",
    "evaluation": "after_run",
    "spriteName": "Rocket",
    "property": "x",
    "operator": "greater_than",
    "value": 50
  }
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `toolbox` | No | string | Scratch toolbox XML. Empty or omitted means the default toolbox. |
| `sprites` | No | sprite array | Defaults to one cat sprite if omitted. |
| `backdrops` | No | backdrop array | Defaults to plain white if omitted. |
| `variables` | No | variable array | Predefined variables available in variable blocks. Omit or empty means a single `score` variable is available as fallback. |
| `starterBlocks` | No | object or null | Blockly workspace state. Multi-sprite projects are keyed by sprite ID. |
| `completeBlocks` | No | object or null | Reference solution workspace state. |
| `codeStages` | No | stage array | Optional intermediate stages between starter and complete. Each stage has a `label` and `blocks` (Blockly workspace state). Teacher can send any stage to students. |
| `carryBlocksFrom` | No | integer or null | Previous task ID to carry saved Scratch blocks from. |

Variable object:

| Field | Required | Type | Notes |
|---|---:|---|---|
| `name` | Yes | string | Variable name used in blocks and checks. |
| `showOnStage` | No | boolean | When `true`, a monitor overlay is displayed on the stage showing the variable's current value. |

Sprite object:

| Field | Required | Type | Allowed values / notes |
|---|---:|---|---|
| `id` | Yes | string | Stable sprite ID, for example `sprite1`. |
| `name` | Yes | string | Display name and check target name. |
| `type` | No | string | `cat`, `ball`, `star`, `arrow`, `bat`, or `parrot`. |
| `x` | No | number | Scratch stage x coordinate, clamped around `-240` to `240`. |
| `y` | No | number | Scratch stage y coordinate, clamped around `-180` to `180`. |
| `size` | No | number | Percent size. Defaults to `100`. |
| `direction` | No | number | Scratch direction. Defaults to `90`. |
| `visible` | No | boolean | Initial visibility. Defaults to `true`. |
| `rotationStyle` | No | string | Initial rotation style: `all around`, `left-right`, or `don't rotate`. Defaults to `all around`. |
| `costume` | No | string | Initial costume name when `costumes` are configured. Defaults to the first costume. |
| `costumes` | No | costume array | Optional image costumes. First costume is default. |

Costume object:

| Field | Required | Type | Notes |
|---|---:|---|---|
| `name` | Yes | string | Costume name used by costume blocks. |
| `image` | No | string | Path relative to lesson `assetsPath`, or a public root path such as `/assets/shared/cat.png`. |

Backdrop object:

| Field | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | string | Stable backdrop ID. |
| `name` | Yes | string | Display name used by backdrop blocks. |
| `colour` | No | string | CSS colour for solid backdrop. |
| `image` | No | string | Path relative to lesson `assetsPath`, or a public root path. If present, image mode is used. |

Supported combinations:

- Default sprite and default toolbox: omit `sprites`, `backdrops`, and `toolbox`.
- Restricted toolbox: provide `toolbox` XML with only allowed blocks.
- Single sprite: one sprite in `sprites`.
- Multi-sprite project: multiple `sprites`, with `starterBlocks` keyed by each sprite ID.
- Shape sprites: use `type` with no costumes.
- Image sprites: add `costumes` and set lesson-level `assetsPath`.
- Shared image sprites: use a public root path in `costumes[].image`; no lesson `assetsPath` is required.
- Solid backdrop: use `colour`.
- Image backdrop: use `image` and lesson-level `assetsPath`.
- Manual checks: `evaluation: "manual"` shows a Check button.
- After-run checks: `evaluation: "after_run"` evaluates after running.

### Public Sprite Presets

The builder loads reusable Scratch sprite definitions from `public/scratch-assets/sprites.json`.
Each object is a normal sprite object whose `id` is used only as the catalogue key.
When selected in the builder, it is copied into the lesson with a new unique `spriteN` ID.

```json
[
  {
    "id": "rocket",
    "name": "Rocket",
    "type": "arrow",
    "x": -120,
    "y": 0,
    "size": 80,
    "direction": 90,
    "rotationStyle": "all around",
    "costumes": [
      { "name": "rocket", "image": "/assets/shared/sprites/rocket.png" }
    ]
  }
]
```

Preset definitions may use the same location, rotation, visibility, costume, and built-in type fields as lesson sprites. Root-relative costume paths allow one public preset catalogue to be shared across lessons.

## Information Tasks

Information tasks work in every lesson type. They can render as a standard explainer, a recap slide, or an introduction slide.

```json
{
  "id": 2,
  "taskType": "information",
  "informationType": "standard",
  "title": "How loops work",
  "explainer": "A loop repeats code while a condition is true.",
  "hints": ["Read the example carefully before moving on."]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `taskType` | Yes | string | Must be `information`. |
| `informationType` | No | string | `standard`, `recap`, or `introduction`. Defaults to `standard`. |
| `title` | Yes | string | Shown in progress UI. |
| `leftContent` | No | string | Markdown for the left pane. Only used when `informationType` is `recap`. |
| `explainer` | Yes* | string | Markdown content. Required for `standard` and `recap` (right pane); optional for `introduction`, which renders lesson metadata. |
| `hints` | No | string array | Optional, although information tasks normally do not need hints. |

`standard` renders the explainer as before. `recap` (also called "Two Pane View" in the builder) renders two side-by-side markdown panes: a purple left pane using `leftContent` and a white right pane using `explainer`. `introduction` renders the lesson title, level, lesson type, and description from the lesson metadata on a purple background.

Do not include code fields, carry fields, `interactionMode`, `options`, or `check`.

## Quiz Tasks

Quiz tasks work in every lesson type. There are four sub-types controlled by `quizType`.

### Multiple Choice

```json
{
  "id": 3,
  "taskType": "quiz",
  "quizType": "multiple_choice",
  "title": "Loop quiz",
  "explainer": "Which loop repeats exactly five times?",
  "options": [
    { "id": "a", "text": "for i in range(5)" },
    { "id": "b", "text": "while True", "feedback": "This loop runs forever." }
  ],
  "check": {
    "type": "answer_equals",
    "value": "a"
  },
  "hints": ["Look for the option with a fixed count."]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `taskType` | Yes | string | Must be `quiz`. |
| `quizType` | No | string | `multiple_choice` (default), `match`, `fill_blank`, or `short_answer`. |
| `title` | Yes | string | Shown in progress UI. |
| `explainer` | Yes | string | Question text, rendered as Markdown. |
| `options` | Yes (multiple_choice) | array | At least two options. |
| `check` | Yes | object | `{ "type": "answer_equals", "value": "<option id>" }`. |
| `hints` | No | string array | Optional. |

Option object:

| Field | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | string | Usually `a`, `b`, `c`, etc. |
| `text` | Yes | string | Option label shown to students. Markdown supported. |
| `feedback` | No | string | Shown when this wrong option is selected. Markdown supported. |

### Match

Student drags tiles to match each prompt with its answer. All pairs must be correct.

```json
{
  "id": 4,
  "taskType": "quiz",
  "quizType": "match",
  "title": "Hardware match",
  "explainer": "Match each component to its role.",
  "pairs": [
    { "id": "1", "prompt": "CPU", "answer": "Processes instructions" },
    { "id": "2", "prompt": "RAM", "answer": "Temporary memory" }
  ]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `pairs` | Yes | array | At least two pairs. Tiles are shuffled on render. |

Pair object: `{ id: string, prompt: string, answer: string }`. Markdown supported in both fields.

### Fill Blank

Student fills blanks in a sentence by dragging tiles (`mode: "drag"`) or typing (`mode: "type"`).

```json
{
  "id": 5,
  "taskType": "quiz",
  "quizType": "fill_blank",
  "title": "Fill the blank",
  "text": "A ___ repeats code while a condition is true.",
  "mode": "drag",
  "blanks": [
    { "id": "1", "answer": "loop" }
  ]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `text` | Yes | string | Sentence with `___` marking each blank position. |
| `mode` | No | string | `"drag"` (default) or `"type"`. |
| `blanks` | Yes | array | One entry per `___` in `text`, in order. |
| `distractors` | No | array | Extra tiles shown in the answer bank that are not the correct answer for any blank. Drag mode only; ignored in type mode. |

Blank object: `{ id: string, answer: string }`.

Distractor object: `{ id: string, text: string }`. Markdown supported in `text`.

### Short Answer

Student types a free-text answer. The `check` field is optional:

- **With a check**: the answer is evaluated automatically and the task passes when the check succeeds.
- **Without a check** (open-ended): any submitted answer completes the task. The teacher can review what each student wrote in the student grid and modal.

```json
{
  "id": 6,
  "taskType": "quiz",
  "quizType": "short_answer",
  "title": "What does CPU stand for?",
  "explainer": "Type the full name of the CPU.",
  "check": {
    "type": "answer_contains",
    "value": "Central Processing Unit"
  }
}
```

Open-ended example (no correct answer — teacher review only):

```json
{
  "id": 7,
  "taskType": "quiz",
  "quizType": "short_answer",
  "title": "What did you find hardest?",
  "explainer": "Write one thing you found difficult in today's lesson."
}
```

Supported check types for short answer: `answer_equals`, `answer_contains`, `answer_matches_regex`.

Do not include code fields, carry fields, or `interactionMode` on any quiz task.

## Task Groups

Tasks can be wrapped in group objects. Groups are collapsible in the teacher's TaskNavigator and rendered as sections in the student's progress dots. Subtask titles are auto-derived from the group name ("Group Title - 1", "Group Title - 2", etc.) and should not be set manually.

```json
{
  "id": "g-1234567890",
  "type": "group",
  "title": "Loops",
  "subtasks": [
    {
      "id": 3,
      "title": "Loops - 1",
      "explainer": "...",
      "starterCode": "..."
    },
    {
      "id": 4,
      "title": "Loops - 2",
      "explainer": "...",
      "starterCode": "..."
    }
  ]
}
```

| Field | Required | Type | Notes |
|---|---:|---|---|
| `id` | Yes | string | String ID (e.g. `"g-1234567890"`) — not an integer. |
| `type` | Yes | string | Must be `"group"`. |
| `title` | Yes | string | Group display name. Subtask titles are derived from this. |
| `subtasks` | Yes | array | Ordered task objects. These follow the same task format as top-level tasks. |

Groups may not be nested (no groups within groups). `carryCodeFrom` / `carryBlocksFrom` references from within a subtask use the subtask's integer `id`.

## Check Shapes

`check` can be either a single object:

```json
{
  "type": "output_contains",
  "value": "Hello"
}
```

or an array:

```json
[
  {
    "type": "code_contains",
    "value": "for "
  },
  {
    "type": "output_line_count",
    "value": 5
  }
]
```

When `check` is an array, every check must pass.

Regex check types are case-sensitive. Non-regex string comparison and containment checks remain case-insensitive.

## Python and HTML Check Types

| Check type | Fields | Run mode | Submit mode | Python | HTML | Behaviour |
|---|---|---:|---:|---:|---:|---|
| `code_no_error` | `type` | Yes | No | Yes | No | Passes when Python run status is `success`. |
| `output_contains` | `type`, `value` | Yes | No | Yes | Yes | Case-insensitive containment against stdout or iframe body text. |
| `output_equals` | `type`, `value` | Yes | No | Yes | Yes | Case-insensitive exact output/body-text match after trimming trailing newlines. |
| `output_line_count` | `type`, `value` | Yes | No | Yes | Yes | Output/body text must contain exactly this many lines. |
| `output_not_empty` | `type` | Yes | No | Yes | Yes | Output/body text must not be empty. |
| `output_empty` | `type` | Yes | No | Yes | Yes | Output/body text must be empty or whitespace-only. |
| `code_contains` | `type`, `value` | Yes | Yes | Yes | Yes | Source code contains value, case-insensitive; ignores whitespace outside quoted text. |
| `code_does_not_contain` | `type`, `value` | Yes | Yes | Yes | Yes | Source code does not contain value, case-insensitive; ignores whitespace outside quoted text. |
| `code_equals` | `type`, `value` | Yes | Yes | Yes | Yes | Source code equals value, case-insensitive; ignores whitespace outside quoted text. |
| `element_exists` | `type`, `selector` | Yes | No | No | Yes | At least one iframe element matches CSS selector. |
| `element_count` | `type`, `selector`, `value` | Yes | No | No | Yes | Number of matching iframe elements equals `value`. |
| `element_value` | `type`, `selector`, `value` | Yes | No | No | Yes | Matching element text/value contains `value`, case-insensitive. |
| `answer_equals` | `type`, `value` | Quiz only | Quiz only | n/a | n/a | Selected answer ID (multiple choice) or text equals `value`. |
| `answer_contains` | `type`, `value` | Quiz only | Quiz only | n/a | n/a | Free-text answer contains `value` (short answer). |
| `answer_matches_regex` | `type`, `value` | Quiz only | Quiz only | n/a | n/a | Free-text answer matches regex pattern (short answer). |
| `quiz_result` | `type` | Quiz only | Quiz only | n/a | n/a | All pairs/blanks correct (match, fill_blank). No `value` needed. |

Submit mode accepts only:

- `code_contains`
- `code_does_not_contain`
- `code_equals`

## Scratch Check Types

Scratch checks can also be a single object or an array. Every check must pass.

### `block_used`

```json
{
  "type": "block_used",
  "evaluation": "manual",
  "opcode": "control_repeat"
}
```

| Field | Required | Notes |
|---|---:|---|
| `type` | Yes | Must be `block_used`. |
| `evaluation` | No | `manual`, `after_run`, or `continuous`. Defaults to `manual` in the builder. |
| `opcode` | Yes | Scratch block opcode, for example `motion_movesteps`. |

### `sprite_property`

```json
{
  "type": "sprite_property",
  "evaluation": "after_run",
  "spriteName": "Rocket",
  "property": "x",
  "operator": "greater_than",
  "value": 50
}
```

| Field | Required | Allowed values / notes |
|---|---:|---|
| `type` | Yes | Must be `sprite_property`. |
| `evaluation` | No | `manual`, `after_run`, or `continuous`. |
| `spriteName` | Yes | Name of sprite to evaluate. |
| `property` | Yes | `x`, `y`, `size`, `direction`, or `visible`. |
| `operator` | Yes | `equals`, `greater_than`, or `less_than`. |
| `value` | Yes | Expected value. Numeric comparison is used when possible. |

### `variable_equals`

```json
{
  "type": "variable_equals",
  "evaluation": "after_run",
  "variableName": "score",
  "value": 5
}
```

| Field | Required | Notes |
|---|---:|---|
| `type` | Yes | Must be `variable_equals`. |
| `evaluation` | No | `manual` or `after_run`. |
| `variableName` | Yes | Variable name. Legacy `name` is also read by the evaluator. |
| `value` | Yes | Expected value. |

## Scratch Block Opcodes

These are the block opcodes currently defined by the shared Scratch module and available to use in toolbox XML or `block_used` checks.

Events:

- `event_whenflagclicked`
- `event_whenkeypressed`
- `event_whenthisspriteclicked`
- `event_whenbackdropswitchesto`
- `event_broadcast`
- `event_broadcastandwait`
- `event_whenbroadcastreceived`

Motion:

- `motion_movesteps`
- `motion_turnright`
- `motion_turnleft`
- `motion_gotoxy`
- `motion_goto`
- `motion_glidesecstoxy`
- `motion_glideto`
- `motion_pointindirection`
- `motion_ifonedge_bounce`
- `motion_setx`
- `motion_sety`
- `motion_changexby`
- `motion_changeyby`
- `motion_xposition`
- `motion_yposition`
- `motion_direction`
- `motion_setrotationstyle`

Looks:

- `looks_sayforsecs`
- `looks_say`
- `looks_think`
- `looks_thinkforsecs`
- `looks_show`
- `looks_hide`
- `looks_setsizeto`
- `looks_changesizeby`
- `looks_switchcostumeto`
- `looks_nextcostume`
- `looks_costumenumber`
- `looks_switchbackdropto`
- `looks_nextbackdrop`

Sound:

- `sound_play`
- `sound_playuntildone`
- `sound_stopallsounds`

Control:

- `control_wait`
- `control_repeat`
- `control_forever`
- `control_if`
- `control_if_else`
- `control_stop`

Sensing:

- `sensing_askandwait`
- `sensing_answer`
- `sensing_keypressed`
- `sensing_mousedown`
- `sensing_touchingedge`
- `sensing_touchingobject`

Operators:

- `operator_equals`
- `operator_gt`
- `operator_lt`
- `operator_and`
- `operator_or`
- `operator_not`
- `operator_add`
- `operator_subtract`
- `operator_join`

Variables:

- `data_variable`
- `data_setvariableto`
- `data_changevariableby`

## Explainer Markdown

`explainer` supports Markdown rendered by the shared Markdown renderer:

- Inline code
- Fenced code blocks such as `python`, `html`, `css`, and `javascript`
- Bold text
- Headings
- Bulleted and numbered lists
- Blockquotes
- Tables
- Paragraphs and line breaks
- Topic-library links written as `[[topic-id]]` or `[[topic-id|visible text]]`

Topic-library links resolve against `public/assets/topic-library.json`. The renderer displays a short definition on hover and opens the searchable, lesson-type-filtered library when the linked topic title is clicked. For example:

```markdown
Use a [[for-loop|for loop]] with [[range]] to repeat your instructions.
```

The builder's Markdown toolbar can insert topic links, and offers to link recognised topic words already written in explainer text.

## Scratch Block Markdown

Scratch tasks use the same `explainer` Markdown field as Python and HTML tasks. There is no custom Scratch-block renderer in Markdown, so block names should be written as inline code and grouped in normal Markdown instructions.

Recommended Scratch explainer style:

```json
{
  "explainer": "## Move the Sprite\n\nUse these blocks:\n\n1. Add `when green flag clicked`.\n2. Add `move [] steps` underneath it.\n3. Change the number to `150`.\n\n> The check passes when the sprite moves far enough to the right."
}
```

Use inline code for visible block labels:

- `when green flag clicked`
- `move [] steps`
- `repeat []`
- `forever`
- `if <> then`
- `say []`
- `set [score] to []`
- `change [score] by []`

Use placeholders inside the inline code to show editable block inputs:

| Pattern | Meaning |
|---|---|
| `move [] steps` | A numeric or text input slot. |
| `if <> then` | A Boolean input slot. |
| `set [score] to []` | A dropdown or variable field plus an input slot. |
| `key [space] pressed?` | A dropdown value. |

For multi-step Scratch instructions, prefer a short goal followed by numbered steps:

```markdown
## Score Counter

Make the star count to five.

1. Add `when green flag clicked`.
2. Add `set [score] to [0]`.
3. Add `repeat [5]`.
4. Inside the repeat, add `change [score] by [1]`.
5. Add `say [score]`.
```

For Scratch toolbox XML, use fenced `xml` code blocks only when documenting the lesson file itself. In student-facing explainers, describe the blocks by name instead of pasting XML.

## Filesystem Lesson Type

The `filesystem` lesson type presents a virtual Windows Explorer-style file manager. Students create, rename, move, and delete files and folders; checks evaluate the resulting structure automatically (no Run button).

### Lesson envelope

```json
{
  "id": "files-and-folders-basics",
  "type": "filesystem",
  "title": "Files and Folders",
  "description": "Learn to organise files and folders.",
  "sandboxStarterFs": { "/": { "type": "dir" } },
  "tasks": []
}
```

| Field | Required | Notes |
|---|---:|---|
| `sandboxStarterFs` | No | Initial filesystem for sandbox mode. Flat path map (see below). |

### Filesystem state model

All state is a **flat path map**. Directories end with `/`; files do not. Root `/` always exists.
Text files store editable `content`. Image files may store a static lesson-asset path in `src`; the explorer also falls back to a lesson asset with the same basename.

```json
{
  "/":                          { "type": "dir" },
  "/Documents/":                { "type": "dir" },
  "/Documents/notes.txt":       { "type": "file", "content": "Hello!" },
  "/Pictures/":                 { "type": "dir" },
  "/Pictures/avatar.png":       { "type": "file", "src": "avatar.png" }
}
```

### Filesystem code task fields

```json
{
  "id": 1,
  "title": "Create a Documents folder",
  "explainer": "Inside the root folder, create a new folder called **Documents**.",
  "starterFs": { "/": { "type": "dir" } },
  "completeFs": {
    "/": { "type": "dir" },
    "/Documents/": { "type": "dir" }
  },
  "carryFsFrom": null,
  "check": { "type": "fs_dir_exists", "path": "/Documents/" }
}
```

| Field | Required | Notes |
|---|---:|---|
| `starterFs` | No | Initial filesystem state when no carry-through exists. Defaults to `{ "/": { type: "dir" } }`. |
| `completeFs` | No | Reference solution filesystem used in the builder. |
| `carryFsFrom` | No | Previous task ID to carry the saved filesystem state from. |

### Filesystem check types

Checks evaluate automatically after each student operation — there is no Run button.

| Check type | Fields | Behaviour |
|---|---|---|
| `fs_file_exists` | `path` | File at `path` exists |
| `fs_dir_exists` | `path` | Directory at `path` exists |
| `fs_not_exists` | `path` | Path (file or dir) does not exist |
| `fs_content_contains` | `path`, `value` | File content contains `value` (case-insensitive) |
| `fs_content_equals` | `path`, `value` | File content equals `value` (trimmed, case-insensitive) |
| `fs_file_in_dir` | `path`, `dir` | File exists and its direct parent equals `dir` |
| `fs_dir_opened` | `path` | Student navigated to the folder at `path` |
| `fs_file_opened` | `path` | Student opened the file at `path` |

### Minimal filesystem lesson example

```json
{
  "id": "filesystem-minimal",
  "type": "filesystem",
  "title": "Filesystem Minimal",
  "description": "Organise your files.",
  "tasks": [
    {
      "id": 1,
      "title": "Create a Documents folder",
      "explainer": "Create a folder called **Documents** in the root folder.",
      "starterFs": { "/": { "type": "dir" } },
      "completeFs": {
        "/": { "type": "dir" },
        "/Documents/": { "type": "dir" }
      },
      "check": { "type": "fs_dir_exists", "path": "/Documents/" }
    }
  ]
}
```

---

## Validation Rules to Keep in Mind

- Lesson ID, title, and at least one task are required.
- Every task needs a title.
- Information tasks need an explainer unless `informationType` is `introduction`.
- Quiz tasks need at least two non-empty options and an `answer_equals` check.
- HTML code tasks should have files, unique filenames, and an HTML entry file.
- `carryCodeFrom` and `carryBlocksFrom` must reference an existing task ID.
- Submit mode cannot use run-required checks.
- DOM checks need a CSS selector.
- Checks that need a value must provide one, except `code_no_error`, `output_not_empty`, `output_empty`, and `element_exists`.
- Scratch toolbox XML must parse if provided.
- Scratch `sprite_property` checks need `property`, `operator`, and `value`.
- Scratch `block_used` checks need `opcode`.

## Minimal Complete Examples

### Python Lesson With Run Check

```json
{
  "id": "python-minimal",
  "type": "python",
  "title": "Python Minimal",
  "description": "A short Python lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Hello",
      "explainer": "Print `Hello`.",
      "starterCode": "",
      "carryCodeFrom": null,
      "check": {
        "type": "output_contains",
        "value": "Hello"
      }
    }
  ]
}
```

### Python Lesson With Submit Check

```json
{
  "id": "python-submit",
  "type": "python",
  "title": "Python Submit",
  "description": "A code-reading Python lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Use a loop",
      "explainer": "Write code that uses a `for` loop.",
      "starterCode": "",
      "interactionMode": "submit",
      "check": {
        "type": "code_contains",
        "value": "for "
      }
    }
  ]
}
```

### HTML Lesson With DOM Checks

```json
{
  "id": "html-minimal",
  "type": "html",
  "title": "HTML Minimal",
  "description": "A short HTML lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Heading",
      "explainer": "Add a heading.",
      "entryFile": "index.html",
      "starterFiles": [
        {
          "name": "index.html",
          "type": "html",
          "content": "<!DOCTYPE html>\n<html>\n<body>\n</body>\n</html>"
        }
      ],
      "check": {
        "type": "element_exists",
        "selector": "h1"
      }
    }
  ]
}
```

### Lesson With Information and Quiz Tasks

```json
{
  "id": "mixed-python",
  "type": "python",
  "title": "Mixed Python",
  "description": "Information, quiz, and code tasks.",
  "tasks": [
    {
      "id": 1,
      "taskType": "information",
      "title": "Read first",
      "explainer": "Loops repeat code."
    },
    {
      "id": 2,
      "taskType": "quiz",
      "title": "Quick check",
      "explainer": "Which keyword starts a counted loop?",
      "options": [
        { "id": "a", "text": "for" },
        { "id": "b", "text": "print" }
      ],
      "check": {
        "type": "answer_equals",
        "value": "a"
      }
    },
    {
      "id": 3,
      "title": "Try it",
      "explainer": "Print three numbers.",
      "starterCode": "for i in range(3):\n    print(i)\n",
      "check": {
        "type": "output_line_count",
        "value": 3
      }
    }
  ]
}
```

### Scratch Lesson With After-Run Check

```json
{
  "id": "scratch-minimal",
  "type": "scratch",
  "title": "Scratch Minimal",
  "description": "A short Scratch lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Move",
      "explainer": "Move the sprite to the right.",
      "sprites": [
        {
          "id": "sprite1",
          "name": "Sprite 1",
          "type": "cat",
          "x": 0,
          "y": 0,
          "size": 100,
          "direction": 90
        }
      ],
      "starterBlocks": null,
      "carryBlocksFrom": null,
      "check": {
        "type": "sprite_property",
        "evaluation": "after_run",
        "spriteName": "Sprite 1",
        "property": "x",
        "operator": "greater_than",
        "value": 50
      }
    }
  ]
}
```
