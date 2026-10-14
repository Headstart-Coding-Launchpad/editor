/**
 * Pyodide Web Worker — runs Python in a background thread so the main UI
 * never freezes, even on infinite loops. Terminate the worker to stop execution.
 *
 * Message protocol
 * ────────────────
 * Main → Worker : { type: 'init' }
 *                 { type: 'run',   code: string, capture?: { panel, peekLine, hide },
 *                                  record?: { lineOffset, hide } }
 *                 { type: 'stage_render', id: number, code: string }
 *                 { type: 'input', value: string }
 *                 { type: 'gpio_inputs', values: object, requestId?: number }
 *
 * Worker → Main : { type: 'progress',      msg: string }
 *                 { type: 'ready' }
 *                 { type: 'load_error',    msg: string }
 *                 { type: 'output',        text: string, kind: 'stdout'|'stderr', line?: number|null }
 *                 { type: 'input_required', prompt: string }
 *                 { type: 'done',          status: 'success'|'error'|'stopped', variables,
 *                                          variablesPanel, turtle, stage, slowMo }
 *                 { type: 'stage_rendered', id, status: 'success'|'error', commands, error }
 *                 { type: 'gpio_write',     pin: string, value: 0|1 }
 *                 { type: 'gpio_configure', pin: string, mode: number, pull: number|null }
 *                 { type: 'gpio_poll',      requestId: number }
 *
 * GPIO messages carry MicroPython-style pin I/O for Electronics-module tasks:
 * the worker emits 'gpio_write'/'gpio_configure' as Python calls the GPIO API,
 * and emits 'gpio_poll' (awaiting the matching 'gpio_inputs' reply) whenever
 * Python sleeps, so the main thread can push updated input pin state.
 *
 * `line` is only meaningful on a 'stderr' output produced from a caught Python
 * exception (see formatPythonError): it is the innermost `<student>` frame's
 * line number, used by the UI to highlight the failing line in the editor.
 *
 * `capture` turns on the name-tag panel capture (showVariables, see variableCapture.py.js):
 * `panel` true reads the visible variables at the end of the run (also when it errors),
 * `peekLine` (a line of the code as run) also reads them the first time that line is about to
 * run, and `hide` lists names never to show. `done` then carries `variablesPanel`:
 * { end, peek, peekLine, peekReached } (null without `capture.panel`). `variables` (the
 * check variables, { name: { type, json, repr } }) is always sent.
 *
 * `done` also always carries `turtle: { state, commands, calls }` for Turtle-module
 * tasks (see ../turtle/shim.js) — `state` is the final position/heading/pen snapshot,
 * `commands` the drawn-line log (for rendering + path checks), `calls` the raw
 * command-invocation log (for "command used" checks). Harmless/empty for plain
 * Python and Electronics tasks, which never call the __hsTurtle* bridge below.
 *
 * `done` also always carries `stage: { commands }`: the Python Stage drawing (see
 * src/shared/stage/). The `stage` module is registered in sys.modules once, when Python loads
 * (STAGE_INSTALL_PY), never prepended to the student's code; each call records one command
 * through __hsStageCall. Empty when the code never draws.
 *
 * `record` turns on slow-mo recording (src/modules/python/slowMo/): every line of the student's
 * file that runs becomes a step (see recording.js for the shape), and `done` carries the
 * recording as `slowMo` (null without `record`). At 2,000 steps the program is ended there and
 * `done` says 'stopped' with `slowMo.status: 'capped'`, so the run is treated like one the
 * student stopped: no check, no attempt.
 *
 * `stage_render` runs a task's stageTarget code silently (no output, `input()` answers '') and
 * replies with its stage commands only. The main thread never sends it while a run is going.
 */

import {
  createTurtleState,
  applyTurtleForward,
  applyTurtleTurn,
  applyTurtleSetHeading,
  applyTurtleGoto,
  applyTurtleHome,
  applyTurtleSetFillColor,
  applyTurtleSetBackground,
  applyTurtleSetVisible,
} from '../turtle/engine.js'
import { VARIABLE_CAPTURE_PY } from './variableCapture.py.js'
import { STAGE_INSTALL_PY, STAGE_MODULE_PY } from '../../shared/stage/stagePy.js'
import { createStageRecorder } from '../../shared/stage/commands.js'
import { PYTHON_SLOW_MO_MAX_STEPS } from './slowMo/config.js'

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

let pyodide = null
let _inputResolve = null
let _lastVariables = {}
// The name-tag panel capture of the current run (showVariables, see variableCapture.py.js):
// { end, peek, peekLine, peekReached }, or null when the task has no panel / the code never ran.
let _lastVariablesPanel = null
let _gpioInputs = {}
let _gpioOutputs = {}
let _gpioPollId = 0
const _gpioPollResolvers = new Map()
let _turtleState = createTurtleState()
let _turtleCommands = []
let _turtleCalls = []
let _turtleFilling = false
let _turtleFillPoints = []
// The Python Stage's command log for the current run (src/shared/stage/commands.js).
let _stageRecorder = createStageRecorder()
// A stage_render run: no output, and input() answers '' at once.
let _silentRun = false
// The slow-mo recording of the current run (record), or null.
let _slowMo = null
// The most output characters a recording keeps, and how many line events (counting the ones
// merged away, e.g. a one-line loop that changes nothing) end a run that never makes a step.
const SLOW_MO_MAX_OUTPUT = 50_000
const SLOW_MO_MAX_EVENTS = PYTHON_SLOW_MO_MAX_STEPS * 20

// Python wrapper — same AST-transform approach as before, but now running in a Worker.
// `import js as _js` gives access to this worker's globalThis. The variable-capture helpers
// (variableCapture.py.js) come first.
const WRAPPER =
  VARIABLE_CAPTURE_PY +
  `
import js as _js
import sys, builtins, ast, json

async def _hs_input(prompt=''):
    val = await _js.__hsInput(str(prompt) if prompt else '')
    return str(val).rstrip('\\n')

builtins.input = _hs_input

class _Tx(ast.NodeTransformer):
    def __init__(self, async_names):
        self._async = async_names
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id in self._async:
            return ast.Await(value=node)
        if isinstance(node.func, ast.Attribute) and node.func.attr in self._async:
            return ast.Await(value=node)
        return node
    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        new = ast.AsyncFunctionDef(
            name=node.name, args=node.args, body=node.body,
            decorator_list=node.decorator_list, returns=node.returns,
            lineno=node.lineno, col_offset=node.col_offset,
            type_comment=getattr(node, 'type_comment', None),
        )
        ast.copy_location(new, node)
        return new

_tree = ast.parse(_hs_user_code, filename='<student>')

# The student's top level becomes the body of async def __hs_run__, where Python refuses
# 'from m import *'. Spell the names out instead (the module's __all__, else its public names),
# on the same line, so 'from stage import *' works. A module that can't be imported is left
# alone, so the error is the same as before.
class _HsStarImports(ast.NodeTransformer):
    def visit_FunctionDef(self, node):
        return node
    def visit_AsyncFunctionDef(self, node):
        return node
    def visit_ClassDef(self, node):
        return node
    def visit_ImportFrom(self, node):
        if node.level or not any(a.name == '*' for a in node.names):
            return node
        # Turtle's module only exists once its shim (the first line of a Turtle program) has
        # run, so it could expand on one run and not the one before: leave it as it was.
        if node.module == 'turtle':
            return node
        try:
            import importlib
            _hs_mod = importlib.import_module(node.module)
        except Exception:
            return node
        _hs_names = getattr(_hs_mod, '__all__', None)
        if _hs_names is None:
            _hs_names = [n for n in dir(_hs_mod) if not n.startswith('_')]
        _hs_new = ast.ImportFrom(
            module=node.module,
            names=[ast.alias(name=str(n), asname=None) for n in _hs_names],
            level=0,
        )
        return ast.copy_location(_hs_new, node)

_HsStarImports().visit(_tree)
_async_names = set(json.loads(_hs_async_names_json or '[]'))
_async_names.update({n.name for n in ast.walk(_tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))})
_async_names.add('input')
_Tx(_async_names).visit(_tree)
ast.fix_missing_locations(_tree)

# The student's top-level variables are locals of __hs_run__: read them from the frame in a
# finally, so they are there even when the program raised (see variableCapture.py.js).
_hs_cfg = json.loads(_hs_capture_json or '{}')
_hs_panel_on = bool(_hs_cfg.get('panel'))
_hs_peek_line = _hs_cfg.get('peekLine')
_hs_rec_cfg = json.loads(_hs_record_json or '{}')
_hs_rec_on = bool(_hs_rec_cfg.get('on'))
_hs_hidden = (
    set(_hs_cfg.get('hide') or [])
    | set(_hs_rec_cfg.get('hide') or [])
    | _hs_imported_names(_tree, ('turtle', 'stage'))
)
_hs_end_locals = {}
_hs_panel = {'end': None, 'peek': None, 'peekLine': _hs_peek_line, 'peekReached': False}

def _hs_end_capture(ns):
    _hs_end_locals.update(ns)

_hs_body = _tree.body or [ast.Pass()]
# The finally line sits just past the student's last line, so a line watcher (peek, slow-mo)
# never mistakes it for one of theirs.
_hs_after_line = len(_hs_user_code.split(chr(10))) + 1
_hs_final = ast.parse('_hs_end_capture(locals())').body
for _hs_node in ast.walk(_hs_final[0]):
    if hasattr(_hs_node, 'lineno'):
        _hs_node.lineno = _hs_after_line
        _hs_node.end_lineno = _hs_after_line
_hs_try = ast.Try(body=_hs_body, handlers=[], orelse=[], finalbody=_hs_final)
ast.copy_location(_hs_try, _hs_body[0])

_fn = ast.AsyncFunctionDef(
    name='__hs_run__',
    args=ast.arguments(
        posonlyargs=[], args=[], vararg=None,
        kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[],
    ),
    body=[_hs_try],
    decorator_list=[],
    returns=None,
    lineno=1, col_offset=0,
    type_comment=None,
)
ast.fix_missing_locations(_fn)
_mod = ast.Module(body=[_fn], type_ignores=[])
ast.fix_missing_locations(_mod)

_g = {
    '_hs_input': _hs_input,
    '_hs_end_capture': _hs_end_capture,
    '__builtins__': builtins,
    '__name__': '__main__',
}
exec(compile(_mod, '<student>', 'exec'), _g)

# '#@peek' (showVariables at: marker): the variables the first time that line is about to run.
def _hs_on_peek_line(frame, lineno):
    if lineno != _hs_peek_line:
        return True
    _hs_ns, _hs_scope = _hs_frame_namespace(frame)
    _hs_panel['peek'] = _hs_snapshot(_hs_ns, _hs_hidden, _hs_scope)
    _hs_panel['peekReached'] = True
    return False

# Slow-mo (record): one step per line of the student's file that runs, sent to the worker's
# __hsSlowMoStep (see src/modules/python/slowMo/recording.js for the step shape). A 'line'
# event fires BEFORE its line runs, so each event closes the previous line's step with the
# variables as that line left them. The worker answers 1 at the step cap, which ends the program.
_hs_rec_offset = int(_hs_rec_cfg.get('lineOffset') or 0)
_hs_rec_last = len(_hs_user_code.split(chr(10)))
_hs_rec = {'pending': None, 'scope': None, 'prev': {}, 'capped': False}

def _hs_rec_depth(frame):
    depth = 0
    while frame is not None and not _hs_is_run_frame(frame):
        depth += 1
        frame = frame.f_back
    return depth

def _hs_rec_const_int(node):
    if isinstance(node, ast.Constant) and type(node.value) is int:
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        inner = _hs_rec_const_int(node.operand)
        return None if inner is None else -inner
    return None

def _hs_rec_loop_total(node):
    if not isinstance(node, (ast.For, ast.AsyncFor)):
        return None
    it = node.iter
    try:
        if isinstance(it, (ast.List, ast.Tuple, ast.Set)):
            if any(isinstance(e, ast.Starred) for e in it.elts):
                return None
            return len(it.elts)
        if isinstance(it, ast.Dict):
            return None if None in it.keys else len(it.keys)
        if isinstance(it, ast.Constant) and isinstance(it.value, str):
            return len(it.value)
        if (isinstance(it, ast.Call) and isinstance(it.func, ast.Name) and it.func.id == 'range'
                and not it.keywords and 1 <= len(it.args) <= 3):
            nums = [_hs_rec_const_int(a) for a in it.args]
            if None in nums or (len(nums) == 3 and nums[2] == 0):
                return None
            return len(range(*nums))
    except Exception:
        return None
    return None

def _hs_rec_loops():
    out = []
    for node in ast.walk(_tree):
        if not isinstance(node, (ast.For, ast.AsyncFor, ast.While)):
            continue
        line = node.lineno - _hs_rec_offset
        if line < 1:
            continue
        end = max([getattr(b, 'end_lineno', None) or b.lineno for b in node.body] or [node.lineno])
        out.append({'line': line, 'end': end - _hs_rec_offset, 'total': _hs_rec_loop_total(node)})
    return out

def _hs_rec_close(namespace, scope, final=False):
    pending = _hs_rec['pending']
    if pending is None:
        return
    _hs_rec['pending'] = None
    step = {'l': pending[0], 'k': pending[1]}
    prev = _hs_rec['prev']
    changed = {}
    seen = set()
    for item in _hs_snapshot(namespace, _hs_hidden, scope)['vars']:
        name = item['n']
        seen.add(name)
        encoded = json.dumps(item['v'], sort_keys=True)
        if prev.get(name) != encoded:
            prev[name] = encoded
            changed[name] = item['v']
    gone = [name for name in prev if name not in seen]
    for name in gone:
        del prev[name]
    if changed:
        step['s'] = changed
    if gone:
        step['d'] = gone
    if scope != _hs_rec['scope']:
        step['c'] = scope
        _hs_rec['scope'] = scope
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except Exception:
        pass
    if _js.__hsSlowMoStep(json.dumps(step)) and not final:
        _hs_rec['capped'] = True
        raise _HsStopRun()

def _hs_rec_on_line(frame, lineno):
    _hs_ns, _hs_scope = _hs_frame_namespace(frame)
    _hs_rec_close(_hs_ns, _hs_scope)
    line = lineno - _hs_rec_offset
    # The runtime's own lines (Turtle's shim) and the wrapper's finally line are not steps.
    if line >= 1 and lineno <= _hs_rec_last:
        _hs_rec['pending'] = (line, _hs_rec_depth(frame))
    return True

if _hs_rec_on:
    _js.__hsSlowMoLoops(json.dumps(_hs_rec_loops()))

_hs_peek_on = [_hs_panel_on and isinstance(_hs_peek_line, int)]

def _hs_on_line(frame, lineno):
    if _hs_peek_on[0]:
        _hs_peek_on[0] = bool(_hs_on_peek_line(frame, lineno))
    if _hs_rec_on:
        return _hs_rec_on_line(frame, lineno)
    return _hs_peek_on[0]

_hs_watch = _HsLineWatch(_hs_on_line)
if _hs_peek_on[0] or _hs_rec_on:
    _hs_watch.start()
try:
    await _g['__hs_run__']()
except _HsStopRun:
    pass
finally:
    _hs_watch.stop()
    if _hs_rec_on:
        try:
            _hs_rec_close(_hs_end_locals, None, True)
        except Exception:
            pass
    if _hs_panel_on:
        try:
            _hs_panel['end'] = _hs_snapshot(_hs_end_locals, _hs_hidden)
        except Exception:
            _hs_panel['end'] = None
        _js.__hsSetVariablesPanel(json.dumps(_hs_panel))
    _hs_vars = {}
    _hs_check_ns = dict(_g)
    _hs_check_ns.update(_hs_end_locals)
    for _name, _value in _hs_check_ns.items():
        if _name.startswith('_') or _name in ('__builtins__', '__name__'):
            continue
        try:
            _hs_json = json.dumps(_value)
            _hs_vars[_name] = {
                'type': type(_value).__name__,
                'json': _hs_json,
                'repr': repr(_value),
            }
        except Exception:
            _hs_vars[_name] = {
                'type': type(_value).__name__,
                'json': None,
                'repr': repr(_value),
            }
    _js.__hsSetVariables(_hs_vars)
    sys.stdout.flush()
    sys.stderr.flush()
`

// Expose input handler on the worker global so Python can call it via `import js`
globalThis.__hsInput = async (prompt) => {
  if (_silentRun) return ''
  return new Promise((resolve) => {
    if (prompt) self.postMessage({ type: 'output', text: String(prompt), kind: 'stdout' })
    self.postMessage({ type: 'input_required', prompt: String(prompt) })
    slowMoAppendOutput(String(prompt ?? ''))
    // The classroom echoes the answer into the output; the recording does the same.
    _inputResolve = (value) => {
      slowMoAppendOutput(String(value) + '\n')
      resolve(value)
    }
  })
}

// ─── Slow-mo recorder (src/modules/python/slowMo/recording.js) ─────────────────

function createSlowMoRecording() {
  return {
    steps: [],
    events: 0,
    output: '',
    outputCut: false,
    loops: [],
    marks: { o: 0, t: 0, te: 0, ts: -1, g: 0 },
    turtleArray: null,
    turtleEpochs: [],
    turtleStates: [],
    turtleStateKeys: new Map(),
    capped: false,
  }
}

function slowMoAppendOutput(text) {
  const rec = _slowMo
  if (!rec || !text) return
  const room = SLOW_MO_MAX_OUTPUT - rec.output.length
  if (room <= 0) {
    rec.outputCut = true
    return
  }
  if (text.length > room) {
    rec.output += text.slice(0, room)
    rec.outputCut = true
  } else {
    rec.output += text
  }
}

// Where the Turtle drawing is now: { t, te, ts } (nothing before the first turtle call).
function slowMoTurtleMarks(rec) {
  if (_turtleCalls.length === 0) return {}
  if (_turtleCommands !== rec.turtleArray) {
    // reset() swaps in a new command list: a new epoch.
    rec.turtleArray = _turtleCommands
    rec.turtleEpochs.push(_turtleCommands)
  }
  const key = JSON.stringify(_turtleState)
  let index = rec.turtleStateKeys.get(key)
  if (index === undefined) {
    index = rec.turtleStates.length
    rec.turtleStates.push({ ..._turtleState })
    rec.turtleStateKeys.set(key, index)
  }
  return { t: _turtleCommands.length, te: rec.turtleEpochs.length - 1, ts: index }
}

// One step from Python ({ l, k, s?, d?, c? } as JSON). Adds the output and drawing marks that
// changed, merges a step that changed nothing on the same line as the one before (a one-line
// loop or a comprehension), and answers 1 once the recording is full.
globalThis.__hsSlowMoStep = (json) => {
  const rec = _slowMo
  if (!rec || rec.capped) return 0
  let raw
  try {
    raw = JSON.parse(String(json))
  } catch {
    return 0
  }
  rec.events += 1
  const step = { l: raw.l, k: raw.k || 0 }
  if (raw.s) step.s = raw.s
  if (raw.d) step.d = raw.d
  if ('c' in raw) step.c = raw.c ?? null
  const marks = {
    ...rec.marks,
    o: rec.output.length,
    ...slowMoTurtleMarks(rec),
    g: _stageRecorder.commands.length,
  }
  for (const key of ['o', 't', 'te', 'ts', 'g']) {
    if (marks[key] !== rec.marks[key]) step[key] = marks[key]
  }
  rec.marks = marks
  const before = rec.steps[rec.steps.length - 1]
  const nothingNew = Object.keys(step).length === 2
  if (!(nothingNew && before && before.l === step.l && before.k === step.k)) rec.steps.push(step)
  if (rec.steps.length >= PYTHON_SLOW_MO_MAX_STEPS || rec.events >= SLOW_MO_MAX_EVENTS) {
    rec.capped = true
    return 1
  }
  return 0
}

globalThis.__hsSlowMoLoops = (json) => {
  if (!_slowMo) return
  try {
    const loops = JSON.parse(String(json))
    _slowMo.loops = Array.isArray(loops) ? loops : []
  } catch {
    _slowMo.loops = []
  }
}

// The finished recording for `done` (see recording.js), or null when not recording.
function finishSlowMo(status) {
  const rec = _slowMo
  _slowMo = null
  if (!rec) return null
  return {
    steps: rec.steps,
    output: rec.output,
    ...(rec.outputCut ? { outputCut: true } : {}),
    loops: rec.loops,
    turtle:
      rec.turtleEpochs.length > 0 ? { epochs: rec.turtleEpochs, states: rec.turtleStates } : null,
    stage: _stageRecorder.commands.length > 0 ? { commands: _stageRecorder.commands } : null,
    status: rec.capped ? 'capped' : status,
  }
}

globalThis.__hsSetVariablesPanel = (json) => {
  try {
    _lastVariablesPanel = JSON.parse(String(json))
  } catch {
    _lastVariablesPanel = null
  }
}

globalThis.__hsSetVariables = (variables) => {
  _lastVariables = variables?.toJs
    ? variables.toJs({ dict_converter: Object.fromEntries })
    : (variables ?? {})
}

function normalizeGpioInputs(values = {}) {
  const source = values?.toJs ? values.toJs({ dict_converter: Object.fromEntries }) : values
  return Object.fromEntries(
    Object.entries(source ?? {})
      .map(([pin, value]) => {
        const key = String(pin ?? '').trim()
        if (!key) return null
        return [key, value == null ? null : value ? 1 : 0]
      })
      .filter(Boolean)
  )
}

globalThis.__hsGpioWrite = (pin, value) => {
  const key = String(pin ?? '').trim()
  if (!key) return
  const nextValue = value ? 1 : 0
  _gpioOutputs[key] = nextValue
  self.postMessage({ type: 'gpio_write', pin: key, value: nextValue })
}

globalThis.__hsGpioConfigure = (pin, mode, pull) => {
  const key = String(pin ?? '').trim()
  if (!key) return
  self.postMessage({
    type: 'gpio_configure',
    pin: key,
    mode: Number(mode) || 0,
    pull: pull == null ? null : Number(pull),
  })
}

globalThis.__hsGpioRead = (pin) => {
  const key = String(pin ?? '').trim()
  if (!key) return null
  if (_gpioOutputs[key] !== undefined) return _gpioOutputs[key]
  return _gpioInputs[key] ?? null
}

globalThis.__hsGpioSleep = async (seconds) => {
  const delayMs = Math.max(0, Number(seconds) || 0) * 1000
  await new Promise((resolve) => setTimeout(resolve, delayMs))
  const requestId = ++_gpioPollId
  self.postMessage({ type: 'gpio_poll', requestId })
  return new Promise((resolve) => {
    _gpioPollResolvers.set(requestId, resolve)
  })
}

// ─── Stage bridge (see ../../shared/stage/) ─────────────────────────────────────
// One call of the `stage` module: '' when it drew, or 'Kind|message' for Python to raise.
globalThis.__hsStageCall = (name, argsJson) => {
  let args = []
  try {
    args = JSON.parse(String(argsJson))
  } catch {
    return `ValueError|${String(name)}(): those values can't be drawn`
  }
  return _stageRecorder.call(String(name), args)
}

// ─── Turtle bridge (see ../turtle/shim.js and ../turtle/engine.js) ────────────
// Single default turtle only. Every mutating call is recorded in _turtleCalls
// (for turtle_command_used checks); forward/backward/goto/home also append a
// drawn-line segment to _turtleCommands when the pen is down, and (Phase 2) a
// fill-polygon vertex to _turtleFillPoints while begin_fill()/end_fill() is active.

function _recordTurtleCall(name, args) {
  _turtleCalls.push({ name, args })
}

function _trackFillPoint(x, y) {
  if (_turtleFilling) _turtleFillPoints.push({ x, y })
}

globalThis.__hsTurtleForward = (distance) => {
  _recordTurtleCall('forward', [distance])
  const { nextState, segment } = applyTurtleForward(_turtleState, distance)
  _turtleState = nextState
  if (segment) _turtleCommands.push({ type: 'line', ...segment })
  _trackFillPoint(nextState.x, nextState.y)
}

globalThis.__hsTurtleTurn = (degrees) => {
  _recordTurtleCall('turn', [degrees])
  _turtleState = applyTurtleTurn(_turtleState, degrees)
}

globalThis.__hsTurtleGoto = (x, y) => {
  _recordTurtleCall('goto', [x, y])
  const { nextState, segment } = applyTurtleGoto(_turtleState, x, y)
  _turtleState = nextState
  if (segment) _turtleCommands.push({ type: 'line', ...segment })
  _trackFillPoint(nextState.x, nextState.y)
}

globalThis.__hsTurtleSetHeading = (degrees) => {
  _recordTurtleCall('setheading', [degrees])
  _turtleState = applyTurtleSetHeading(_turtleState, degrees)
}

globalThis.__hsTurtleHome = () => {
  _recordTurtleCall('home', [])
  const { nextState, segment } = applyTurtleHome(_turtleState)
  _turtleState = nextState
  if (segment) _turtleCommands.push({ type: 'line', ...segment })
  _trackFillPoint(nextState.x, nextState.y)
}

globalThis.__hsTurtleReset = () => {
  _recordTurtleCall('reset', [])
  _turtleState = createTurtleState()
  _turtleCommands = []
  _turtleFilling = false
  _turtleFillPoints = []
}

globalThis.__hsTurtlePenUp = () => {
  _recordTurtleCall('penup', [])
  _turtleState = { ..._turtleState, penDown: false }
}

globalThis.__hsTurtlePenDown = () => {
  _recordTurtleCall('pendown', [])
  _turtleState = { ..._turtleState, penDown: true }
}

globalThis.__hsTurtleSetColor = (color) => {
  _recordTurtleCall('pencolor', [color])
  _turtleState = { ..._turtleState, color: String(color) }
}

globalThis.__hsTurtleSetVisible = (visible) => {
  _recordTurtleCall(visible ? 'showturtle' : 'hideturtle', [])
  _turtleState = applyTurtleSetVisible(_turtleState, visible)
}

globalThis.__hsTurtleGetState = () => JSON.stringify(_turtleState)

// ── Phase 2: fill, circle-detection, stamp, write, background ────────────────

globalThis.__hsTurtleSetFillColor = (color) => {
  _recordTurtleCall('fillcolor', [color])
  _turtleState = applyTurtleSetFillColor(_turtleState, color)
}

globalThis.__hsTurtleSetBackground = (color) => {
  _recordTurtleCall('bgcolor', [color])
  _turtleState = applyTurtleSetBackground(_turtleState, color)
}

globalThis.__hsTurtleBeginFill = () => {
  _recordTurtleCall('beginfill', [])
  _turtleFilling = true
  _turtleFillPoints = [{ x: _turtleState.x, y: _turtleState.y }]
}

globalThis.__hsTurtleEndFill = () => {
  _recordTurtleCall('endfill', [])
  if (_turtleFilling && _turtleFillPoints.length >= 3) {
    _turtleCommands.push({ type: 'fill', points: _turtleFillPoints, color: _turtleState.fillColor })
  }
  _turtleFilling = false
  _turtleFillPoints = []
}

globalThis.__hsTurtleStamp = () => {
  _recordTurtleCall('stamp', [])
  _turtleCommands.push({
    type: 'stamp',
    x: _turtleState.x,
    y: _turtleState.y,
    heading: _turtleState.heading,
    color: _turtleState.color,
  })
}

globalThis.__hsTurtleWrite = (text, align, fontSize) => {
  _recordTurtleCall('write', [text])
  _turtleCommands.push({
    type: 'text',
    x: _turtleState.x,
    y: _turtleState.y,
    text: String(text),
    color: _turtleState.color,
    align: String(align),
    fontSize: Number(fontSize) || 8,
  })
}

// Records a call (e.g. 'circle') with no drawing/state effect of its own, for
// turtle_command_used checks — used by shim.js commands built as sugar over
// existing primitives (circle() draws via repeated forward()/left() calls,
// which already record + draw themselves).
globalThis.__hsTurtleMarkCommand = (name, argsJson) => {
  let args = []
  try {
    args = JSON.parse(argsJson)
  } catch {
    args = []
  }
  _recordTurtleCall(String(name), Array.isArray(args) ? args : [])
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      await loadPyodide_()
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'load_error', msg: String(err) })
    }
    return
  }

  if (data.type === 'run') {
    if (!pyodide) {
      try {
        await loadPyodide_()
      } catch {
        self.postMessage({ type: 'done', status: 'error' })
        return
      }
    }

    _inputResolve = null
    _lastVariables = {}
    _lastVariablesPanel = null
    _gpioInputs = normalizeGpioInputs(data.gpioInputs)
    _gpioOutputs = {}
    _turtleState = createTurtleState()
    _turtleCommands = []
    _turtleCalls = []
    _turtleFilling = false
    _turtleFillPoints = []
    _stageRecorder = createStageRecorder()
    _silentRun = false

    let _stdoutBuf = ''
    let _stderrBuf = ''
    let _flushPending = false
    const _stdoutDecodeByte = createUtf8ByteDecoder()
    const _stderrDecodeByte = createUtf8ByteDecoder()

    const flushBuffers = () => {
      _flushPending = false
      if (_stdoutBuf) {
        self.postMessage({ type: 'output', text: _stdoutBuf, kind: 'stdout' })
        _stdoutBuf = ''
      }
      if (_stderrBuf) {
        self.postMessage({ type: 'output', text: _stderrBuf, kind: 'stderr' })
        _stderrBuf = ''
      }
    }

    const scheduleFlush = () => {
      if (_flushPending) return
      _flushPending = true
      setTimeout(flushBuffers, 0)
    }

    pyodide.setStdout({
      raw: (charCode) => {
        const ch = _stdoutDecodeByte(charCode)
        if (!ch) return
        slowMoAppendOutput(ch)
        _stdoutBuf += ch
        if (ch === '\n') {
          self.postMessage({ type: 'output', text: _stdoutBuf, kind: 'stdout' })
          _stdoutBuf = ''
          _flushPending = false
        } else {
          scheduleFlush()
        }
      },
    })
    pyodide.setStderr({
      raw: (charCode) => {
        const ch = _stderrDecodeByte(charCode)
        if (!ch) return
        slowMoAppendOutput(ch)
        _stderrBuf += ch
        if (ch === '\n') {
          self.postMessage({ type: 'output', text: _stderrBuf, kind: 'stderr' })
          _stderrBuf = ''
          _flushPending = false
        } else {
          scheduleFlush()
        }
      },
    })

    pyodide.globals.set('_hs_user_code', data.code)
    pyodide.globals.set(
      '_hs_async_names_json',
      JSON.stringify(Array.isArray(data.asyncNames) ? data.asyncNames : [])
    )
    pyodide.globals.set('_hs_capture_json', JSON.stringify(normalizeCaptureConfig(data.capture)))
    const record = normalizeRecordConfig(data.record)
    pyodide.globals.set('_hs_record_json', JSON.stringify(record))
    _slowMo = record.on ? createSlowMoRecording() : null

    const turtleResult = () => ({
      state: _turtleState,
      commands: _turtleCommands,
      calls: _turtleCalls,
    })

    try {
      await pyodide.runPythonAsync(WRAPPER)
      flushBuffers()
      const slowMo = finishSlowMo('success')
      self.postMessage({
        type: 'done',
        // Slow-mo's step cap ended the program: treated like a run the student stopped.
        status: slowMo?.status === 'capped' ? 'stopped' : 'success',
        variables: _lastVariables,
        variablesPanel: _lastVariablesPanel,
        turtle: turtleResult(),
        stage: { commands: _stageRecorder.commands },
        slowMo,
      })
    } catch (err) {
      flushBuffers()
      const raw = String(err).replace(/^PythonError:\s*/, '')
      const { text, line } = formatPythonError(raw)
      self.postMessage({ type: 'output', text: text + '\n', kind: 'stderr', line })
      slowMoAppendOutput(text + '\n')
      const slowMo = finishSlowMo('error')
      self.postMessage({
        type: 'done',
        status: 'error',
        variables: _lastVariables,
        variablesPanel: _lastVariablesPanel,
        turtle: turtleResult(),
        stage: { commands: _stageRecorder.commands },
        slowMo,
      })
    }
    return
  }

  if (data.type === 'stage_render') {
    self.postMessage({ type: 'stage_rendered', id: data.id, ...(await renderStage(data.code)) })
    return
  }

  if (data.type === 'input') {
    _inputResolve?.(String(data.value))
    _inputResolve = null
    return
  }

  if (data.type === 'gpio_inputs') {
    _gpioInputs = normalizeGpioInputs(data.values)
    if (data.requestId != null) {
      _gpioPollResolvers.get(data.requestId)?.()
      _gpioPollResolvers.delete(data.requestId)
    }
    return
  }
}

// A stageTarget's code, run silently: { status, commands, error }. Output is dropped and input()
// answers '' at once; the check variables and the name-tag panel are not captured.
async function renderStage(code) {
  try {
    await loadPyodide_()
  } catch (err) {
    return { status: 'error', commands: [], error: String(err) }
  }
  _inputResolve = null
  _lastVariables = {}
  _lastVariablesPanel = null
  _stageRecorder = createStageRecorder()
  _silentRun = true
  pyodide.setStdout({ raw: () => {} })
  pyodide.setStderr({ raw: () => {} })
  pyodide.globals.set('_hs_user_code', String(code ?? ''))
  pyodide.globals.set('_hs_async_names_json', '[]')
  pyodide.globals.set('_hs_capture_json', JSON.stringify({ panel: false }))
  pyodide.globals.set('_hs_record_json', JSON.stringify({ on: false }))
  _slowMo = null
  try {
    await pyodide.runPythonAsync(WRAPPER)
    return { status: 'success', commands: _stageRecorder.commands, error: null }
  } catch (err) {
    const { text } = formatPythonError(String(err).replace(/^PythonError:\s*/, ''))
    return { status: 'error', commands: _stageRecorder.commands, error: text }
  } finally {
    _silentRun = false
  }
}

// Exported for unit testing. The run's capture options as the Python wrapper reads them
// (_hs_capture_json): { panel, peekLine, hide }, with anything malformed dropped.
export function normalizeCaptureConfig(capture) {
  if (!capture || typeof capture !== 'object' || !capture.panel) return { panel: false }
  const peekLine =
    Number.isInteger(capture.peekLine) && capture.peekLine > 0 ? capture.peekLine : null
  const hide = Array.isArray(capture.hide)
    ? capture.hide.filter((name) => typeof name === 'string' && name)
    : []
  return { panel: true, peekLine, hide }
}

// Exported for unit testing. The run's slow-mo recording options as the Python wrapper reads
// them (_hs_record_json): { on, lineOffset, hide }, or { on: false } without `record`.
export function normalizeRecordConfig(record) {
  if (!record || typeof record !== 'object') return { on: false }
  const lineOffset =
    Number.isInteger(record.lineOffset) && record.lineOffset > 0 ? record.lineOffset : 0
  const hide = Array.isArray(record.hide)
    ? record.hide.filter((name) => typeof name === 'string' && name)
    : []
  return { on: true, lineOffset, hide }
}

// Exported for unit testing (see src/modules/python/__tests__/pyodide.worker.test.js).
// Pyodide's setStdout/setStderr `raw` callback hands over one UTF-8 *byte* at a
// time, not one character — a multi-byte character (e.g. '£' or an emoji) arrives
// as several separate calls. Wraps a streaming TextDecoder so those sequences are
// reassembled correctly instead of each byte becoming its own Latin-1 character
// (which is what naively calling String.fromCharCode(byte) per call produces).
export function createUtf8ByteDecoder() {
  const decoder = new TextDecoder('utf-8')
  return (byteCode) => decoder.decode(new Uint8Array([byteCode]), { stream: true })
}

// Exported for unit testing (see src/modules/python/__tests__/pyodide.worker.test.js).
// Returns { text, line } — `text` is the existing flat display string (unchanged
// shape, still relied on elsewhere); `line` is the parsed student line number
// (or null when no clean line number could be determined, e.g. a raw
// SyntaxError before the student's <student> frame exists).
export function formatPythonError(traceback) {
  const lines = traceback
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
  if (lines.length === 0) return { text: traceback, line: null }

  // Find the innermost <student> frame to get the student's line number
  let lineNum = null
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/File "<student>", line (\d+)/)
    if (m) {
      lineNum = parseInt(m[1], 10)
      break
    }
  }

  // The last line is the actual error type and message
  const errorLine = lines[lines.length - 1]
  return lineNum != null
    ? { text: `Line ${lineNum}: ${errorLine}`, line: lineNum }
    : { text: errorLine, line: null }
}

async function loadPyodide_() {
  if (pyodide) return
  self.postMessage({ type: 'progress', msg: 'Loading Python…' })
  // @vite-ignore — dynamic CDN import, not bundled
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN + 'pyodide.mjs')
  self.postMessage({ type: 'progress', msg: 'Starting Python runtime…' })
  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
  // The Python Stage's `stage` module, registered once (see STAGE_INSTALL_PY).
  pyodide.globals.set('_hs_stage_src', STAGE_MODULE_PY)
  pyodide.runPython(STAGE_INSTALL_PY)
}
