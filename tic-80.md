# Plan: TIC-80 Lesson Type (Issue #118)

## Context

Issue #118 requests a `tic80` lesson type. Students write Python code using TIC-80's API (`TIC()`, `cls()`, `spr()`, `map()`, etc.). The game renders in a sandboxed iframe alongside the code editor — identical layout to the HTML lesson type (SplitPane). Teachers build lessons in the builder and can create pixel-art sprites via a custom sprite editor UI. Sprites are stored in the lesson JSON, embedded in the cartridge at run time.

TIC-80 uses its own Python interpreter (pocketpy, not CPython/Pyodide), so it is a completely separate runtime from the existing Pyodide integration. The WASM binary is bundled as static assets.

---

## Phase 0 — Acquire TIC-80 WASM (prerequisite, no code changes)

Download the TIC-80 web/WASM build from the official TIC-80 GitHub releases. Place two files as static assets:
- `public/tic80/tic80.js`
- `public/tic80/tic80.wasm`

Verify by inspecting `tic80.js` for: (a) the global variable it uses to read the cartridge (expected: `ticcart`), (b) whether it reads a text-format cartridge starting with `# script: python`, (c) the `Module.print` / `Module.printErr` / `Module.onRuntimeInitialized` hooks.

---

## Phase 1 — Static runner page: `public/tic80/runner.html`

This page is served from the app origin and loads TIC-80 WASM. It accepts student code + sprites encoded as base64 JSON in `location.hash`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html,body{margin:0;background:#000;width:100%;height:100%;overflow:hidden}
    canvas{display:block;margin:0 auto}
  </style>
</head>
<body>
<script>
(function(){
  var payload = {}
  try { payload = JSON.parse(atob(location.hash.slice(1))) } catch(e) {}
  var code    = payload.code    ?? ''
  var sprites = payload.sprites ?? []   // [{ id, pixels }] — 64 hex nibbles each

  // Build TIC-80 text cartridge
  var cart = '# script: python\n' + code + '\n'
  if (sprites.length) {
    cart += '# <TILES>\n'
    sprites.forEach(function(s) {
      var idx = String(s.id).padStart(3,'0')
      // TIC-80 text format stores pixels low-nibble-first per byte pair
      var hex = ''
      for (var i = 0; i < 64; i += 2) hex += s.pixels[i+1] + s.pixels[i]
      cart += '# ' + idx + ':' + hex + '\n'
    })
    cart += '# </TILES>\n'
  }

  function post(msg) { try { window.parent.postMessage(msg,'*') } catch(e){} }

  window.ticcart = btoa(unescape(encodeURIComponent(cart)))
  window.Module = {
    canvas: null,
    print:    function(t){ post({ source:'hsc-tic80', type:'trace',   text:String(t) }) },
    printErr: function(t){ post({ source:'hsc-tic80', type:'error',   message:String(t) }) },
    onRuntimeInitialized: function(){ post({ source:'hsc-tic80', type:'ready' }) }
  }
})()
</script>
<canvas id="canvas"></canvas>
<script>Module.canvas = document.getElementById('canvas')</script>
<script src="tic80.js"></script>
</body>
</html>
```

**Risk:** If `ticcart` API or text-cartridge format differs in the actual WASM build, adjust after inspecting `tic80.js` in Phase 0.

---

## Phase 2 — New shared module: `src/shared/tic80.js`

```js
export function buildTic80IframeSrc(code, sprites = []) {
  const base = import.meta.env.BASE_URL          // '/editor/'
  const runnerUrl = base.replace(/\/editor\/?$/, '') + '/tic80/runner.html'
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ code, sprites }))))
  return `${runnerUrl}#${encoded}`
}

export function waitForTic80Message(type, timeout = 5000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { window.removeEventListener('message', h); resolve(null) }, timeout)
    function h(e) {
      if (e.data?.source === 'hsc-tic80' && e.data?.type === type) {
        clearTimeout(timer); window.removeEventListener('message', h); resolve(e.data)
      }
    }
    window.addEventListener('message', h)
  })
}

export function createTic80TraceListener() {
  const lines = []
  function h(e) {
    if (e.data?.source === 'hsc-tic80' && e.data?.type === 'trace') lines.push(e.data.text)
  }
  window.addEventListener('message', h)
  return { getOutput: () => lines.join('\n'), stop: () => window.removeEventListener('message', h) }
}
```

---

## Phase 3 — Minimal shared edits

**`src/shared/codemirror.js`** — in the language switch, add one case:
```js
case 'tic80': return python()
```

**`src/shared/checks.js`** — add two new run-required check types:

In `CHECK_TYPES`: add `'trace_contains'`, `'trace_equals'`

In `evaluateSingleCheck`, before the final fallback:
```js
if (check.type === 'trace_contains') {
  return wildcardContains(normalizeOutput(context.traceOutput ?? ''), normalizeOutput(check.value))
}
if (check.type === 'trace_equals') {
  return wildcardEquals(normalizeOutput(context.traceOutput ?? ''), normalizeOutput(check.value))
}
```

`context.traceOutput` = joined string of all `trace()` calls during the run.
`code_no_error` requires no change — already checks `context.status === 'success'`.

---

## Phase 4 — Sprite editor: `src/builder/components/SpriteEditor.jsx`

New builder-only component. Teachers use this to create sprites for TIC-80 lessons. Shown in the lesson-level metadata section of BuilderView (not inside TaskEditor — sprites are shared across all tasks).

### Data model

`lesson.sprites` — array of `{ id: number, pixels: string }` where `pixels` is 64 hex nibbles (one per pixel, color index 0–15, row-major left→right top→bottom).

Empty sprite: `"0000000000000000000000000000000000000000000000000000000000000000"`

### TIC-80 default palette (hardcode in component)
```js
const TIC80_PALETTE = [
  '#1A1C2C','#5D275D','#B13E53','#EF7D57',
  '#FFCD75','#A7F070','#38B764','#257179',
  '#29366F','#3B5DC9','#41A6F6','#73EFF7',
  '#F4F4F4','#94B0C2','#566C86','#333C57',
]
```

### Layout

```
+--[ Sprite Sheet ]-------------+--[ Editor (8×8 grid) ]--+
|  4×4 or 8×8 thumbnail grid   |  ~32px per cell          |
|  of sprite slots              |                          |
|  Click to select              +--[ Palette ]------------+|
|                               |  16 color swatches       |
|                               |  + selected color badge  |
+-------------------------------+--------------------------+
```

### Operations
- Click pixel in editor → set to `selectedColor`
- Click swatch → set `selectedColor`
- Click sheet slot → set `selectedId` (creates blank sprite entry if absent)
- "Clear" button → fill all pixels of `selectedId` with `0`

### Props
- `sprites` (controlled, from `lesson.sprites`)
- `onChange(sprites)` — called on any pixel edit

---

## Phase 5 — Lesson schema and validator

**`LESSON_SCHEMA.md`**:
- Add `tic80` to the type list in the lesson envelope
- Add `lesson.sprites` field (optional, `tic80` only): array of sprite objects
- Add `tic80` row to the Task Format Matrix
- Add "TIC-80 Code Tasks" section documenting `starterCode`, `completeCode`, `carryCodeFrom`, `codeStages`, and supported check types (`code_*`, `code_no_error`, `trace_contains`, `trace_equals`)

**`src/builder/lessonUtils.js`**:
- Add `'tic80'` to valid types
- In `hasStarter`, `checkHasValue`, `typeFields`: add `type === 'tic80'` alongside `type === 'python'`

---

## Phase 6 — StudentView: `src/app/views/StudentView.jsx`

TIC-80 uses Python for **storage/carry-through** and HTML for **rendering/layout**.

**Storage (treat identically to Python):**
- `saveCurrentWorkSnapshot` — add `tic80` branch alongside `python`
- `loadTaskContent` — use `selectPythonTaskCode` for `tic80` (same carry-through fields)
- `handleResetCode`, `handleShowCompleteCode`, `handleSoloNavigate` — add `tic80` alongside `python`
- Remote reset handler — add `tic80` branch (same stage/code logic as Python)
- Personal sandbox — add `tic80` alongside `python`
- `handleCodeChange` Firebase keystroke write — add `tic80` to the `lesson?.type === 'python'` condition

**Run handler — new `tic80` block (after Python, before HTML):**
```js
if (lesson.type === 'tic80') {
  const traceListener = createTic80TraceListener()
  const src = buildTic80IframeSrc(code, lesson.sprites ?? [])
  setIframeSrc(src)
  setHtmlPreviewCollapsed(false)
  setRunning(true)

  Promise.race([
    waitForTic80Message('ready', 6000),
    waitForTic80Message('error', 6000),
  ]).then(msg => {
    const isError = !msg || msg.type === 'error'
    const status  = isError ? 'error' : 'success'
    setRunStatus(status)
    setTimeout(() => {
      const traceOutput = traceListener.getOutput()
      traceListener.stop()
      const checkCtx = { status, code, traceOutput }
      const passed = evaluateCheck(task?.check, traceOutput, checkCtx)
      if (task?.check) applyCheckFeedback(passed, '')
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output: traceOutput, runStatus: status })
      writeStudentRun(identity.anonymousId, { code, output: traceOutput, status, checkPassed: passed })
      setRunning(false)
    }, 500)
  })
}
```

**Layout render — new `tic80` branch** (mirrors HTML, uses `PythonEditor` with `pyodideStatus="idle"` to suppress loading banner):
- SplitPane: left = `StudentEditorHeader` (Run / Reset) + `PythonEditor`, right = `CollapsibleIframePreview`
- Mobile: stacked layout like HTML mobile
- Reuses `htmlPreviewCollapsed` state

**`hasPersonalSandbox`:** add `tic80` branch — `!!(lesson.sandboxStarter != null)`

---

## Phase 7 — TeacherView: `src/app/views/TeacherView.jsx`

Add `tic80` alongside `python` everywhere `lesson.type === 'python'` is checked:
- `loadCurrentTaskContent`, `handleEnterSandbox`, `handleGoLiveSandbox`, `handleResetSandboxStarter`, `handleDeactivateSandbox`
- Render: show read-only `PythonEditor` for `tic80` tasks (no run button needed in teacher view)

---

## Phase 8 — Builder: TaskEditor + BuilderView + wiring

**`src/builder/components/TaskEditor.jsx`:**
- `const isTic80 = lesson.type === 'tic80'`
- `getTaskInlineCodeLanguages`: `if (lessonType === 'tic80') return ['python']`
- Complete-code tab, `handleAddStage`: add `isTic80` alongside `isPython`
- `handleRun`: new `else if (isTic80)` block — `buildTic80IframeSrc(code, lesson.sprites ?? [])`, collect trace (500ms), evaluate checks
- Render: `isTic80` uses code editor (left) + `IframePreview` (right), not `BuilderOutputPanel`
- `allowCodeNoError`: add `isTic80` alongside `isPython`

**`src/builder/components/task-editor/CheckEditors.jsx`:**
- Add `trace_contains` / `trace_equals` as check types
- Add "Trace" subject option in subject dropdown when `lessonType === 'tic80'`

**`src/builder/views/BuilderView.jsx`:**
- `defaultTypeFields`: add `tic80` returning same shape as `python`
- `typeLabel` map: `'tic80': 'TIC-80 (Python)'`
- `buildPrintHtml`: add `tic80` alongside `python`
- Wire `<SpriteEditor>` in the lesson-level metadata/settings panel for `tic80` lessons (below sandbox section, lesson-wide)

**`src/builder/components/LessonMetaPanel.jsx`:**
- Add `tic80` alongside `python` for sandbox starter code input

**`src/builder/App.jsx` (lesson type chooser):**
- Add TIC-80 option alongside Python / HTML / Scratch

---

## Phase 9 — Docs

- **`LESSON_SCHEMA.md`**: add `tic80` type, `sprites` field, TIC-80 tasks section
- **`CODEBASE_MAP.md`**: add `src/shared/tic80.js`, `src/builder/components/SpriteEditor.jsx`, `public/tic80/runner.html`
- **`AGENTS.md`** tech stack table: `TIC-80 Python execution | public/tic80/runner.html + TIC-80 WASM; sprites in lesson JSON`

---

## Sprite Data Format (reference)

- `lesson.sprites`: `[{ id: 0–255, pixels: "<64 hex nibbles>" }, ...]`
- `pixels`: 64 nibbles, one per pixel, row-major, color index 0–15
- TIC-80 text serialization: for each byte pair of pixels, swap nibbles before writing (low-nibble-first per byte)
- Palette: TIC-80 Sweetie-16 default (see Phase 4)

---

## Risks

| Risk | Mitigation |
|---|---|
| `ticcart` var name / text-cartridge format differs in actual WASM build | Inspect `tic80.js` in Phase 0 before writing runner.html |
| Nibble-swap spec incorrect for TILES section | Test with a known sprite exported from a real TIC-80 `.tic` file |
| `# script: python` header not accepted (binary-only cartridge load) | Fall back to minimal binary `.tic` (CODE chunk 0x05 + LANG chunk 0x11 value 7) |
| `ready` fires before first `TIC()` executes | Increase timeout or add explicit `init_done` postMessage from runner after first tick hook |
| URL hash too large with many sprites | Only encode non-empty sprites; 20 sprites ≈ 1.4 KB base64 — fine for most lessons |

---

## Verification

1. `npm test` must pass before and after all changes
2. Builder test: create TIC-80 lesson, draw a sprite (id 0), write `spr(0, 10, 10)` in `TIC()`, press Run — sprite should appear on canvas
3. Student test: solo mode, press Run, canvas appears in right pane; `trace_contains` check passes after `trace('hello')`
4. Carry-through: `carryCodeFrom` on task 2 pointing to task 1 — code carries correctly
5. Mobile: collapsible preview works on narrow viewport
6. Live session: teacher watching a student sees run status and code via Firebase
