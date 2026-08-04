/**
 * Pyodide Web Worker — runs Python in a background thread so the main UI
 * never freezes, even on infinite loops. Terminate the worker to stop execution.
 *
 * Message protocol
 * ────────────────
 * Main → Worker : { type: 'init' }
 *                 { type: 'run',   code: string }
 *                 { type: 'input', value: string }
 *
 * Worker → Main : { type: 'progress',      msg: string }
 *                 { type: 'ready' }
 *                 { type: 'load_error',    msg: string }
 *                 { type: 'output',        text: string, kind: 'stdout'|'stderr', line?: number|null }
 *                 { type: 'input_required', prompt: string }
 *                 { type: 'done',          status: 'success'|'error' }
 *
 * `line` is only meaningful on a 'stderr' output produced from a caught Python
 * exception (see formatPythonError): it is the innermost `<student>` frame's
 * line number, used by the UI to highlight the failing line in the editor.
 */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

let pyodide = null
let _inputResolve = null
let _lastVariables = {}
let _gpioInputs = {}
let _gpioOutputs = {}
let _gpioPollId = 0
const _gpioPollResolvers = new Map()

// Python wrapper — same AST-transform approach as before, but now running in a Worker.
// `import js as _js` gives access to this worker's globalThis.
const WRAPPER = `
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
_async_names = set(json.loads(_hs_async_names_json or '[]'))
_async_names.update({n.name for n in ast.walk(_tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))})
_async_names.add('input')
_Tx(_async_names).visit(_tree)
ast.fix_missing_locations(_tree)

_hs_capture = ast.parse(
    "globals().update({_k: _v for _k, _v in locals().items() if not _k.startswith('_')})"
).body[0]
_tree.body.append(_hs_capture)

_fn = ast.AsyncFunctionDef(
    name='__hs_run__',
    args=ast.arguments(
        posonlyargs=[], args=[], vararg=None,
        kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[],
    ),
    body=_tree.body,
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
    '__builtins__': builtins,
    '__name__': '__main__',
}
exec(compile(_mod, '<student>', 'exec'), _g)
try:
    await _g['__hs_run__']()
finally:
    _hs_vars = {}
    for _name, _value in _g.items():
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
  return new Promise((resolve) => {
    if (prompt) self.postMessage({ type: 'output', text: String(prompt), kind: 'stdout' })
    self.postMessage({ type: 'input_required', prompt: String(prompt) })
    _inputResolve = resolve
  })
}

globalThis.__hsSetVariables = (variables) => {
  _lastVariables = variables?.toJs ? variables.toJs({ dict_converter: Object.fromEntries }) : (variables ?? {})
}

function normalizeGpioInputs(values = {}) {
  const source = values?.toJs ? values.toJs({ dict_converter: Object.fromEntries }) : values
  return Object.fromEntries(Object.entries(source ?? {}).map(([pin, value]) => {
    const key = String(pin ?? '').trim()
    if (!key) return null
    return [key, value == null ? null : (value ? 1 : 0)]
  }).filter(Boolean))
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
  await new Promise(resolve => setTimeout(resolve, delayMs))
  const requestId = ++_gpioPollId
  self.postMessage({ type: 'gpio_poll', requestId })
  return new Promise(resolve => {
    _gpioPollResolvers.set(requestId, resolve)
  })
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
    _gpioInputs = normalizeGpioInputs(data.gpioInputs)
    _gpioOutputs = {}

    let _stdoutBuf = ''
    let _stderrBuf = ''
    let _flushPending = false

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
        const ch = String.fromCharCode(charCode)
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
        const ch = String.fromCharCode(charCode)
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
    pyodide.globals.set('_hs_async_names_json', JSON.stringify(Array.isArray(data.asyncNames) ? data.asyncNames : []))

    try {
      await pyodide.runPythonAsync(WRAPPER)
      flushBuffers()
      self.postMessage({ type: 'done', status: 'success', variables: _lastVariables })
    } catch (err) {
      flushBuffers()
      const raw = String(err).replace(/^PythonError:\s*/, '')
      const { text, line } = formatPythonError(raw)
      self.postMessage({ type: 'output', text: text + '\n', kind: 'stderr', line })
      self.postMessage({ type: 'done', status: 'error', variables: _lastVariables })
    }
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

// Exported for unit testing (see src/modules/python/__tests__/pyodide.worker.test.js).
// Returns { text, line } — `text` is the existing flat display string (unchanged
// shape, still relied on elsewhere); `line` is the parsed student line number
// (or null when no clean line number could be determined, e.g. a raw
// SyntaxError before the student's <student> frame exists).
export function formatPythonError(traceback) {
  const lines = traceback.split('\n').map(l => l.trimEnd()).filter(Boolean)
  if (lines.length === 0) return { text: traceback, line: null }

  // Find the innermost <student> frame to get the student's line number
  let lineNum = null
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/File "<student>", line (\d+)/)
    if (m) { lineNum = parseInt(m[1], 10); break }
  }

  // The last line is the actual error type and message
  const errorLine = lines[lines.length - 1]
  return lineNum != null ? { text: `Line ${lineNum}: ${errorLine}`, line: lineNum } : { text: errorLine, line: null }
}

async function loadPyodide_() {
  if (pyodide) return
  self.postMessage({ type: 'progress', msg: 'Loading Python…' })
  // @vite-ignore — dynamic CDN import, not bundled
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN + 'pyodide.mjs')
  self.postMessage({ type: 'progress', msg: 'Starting Python runtime…' })
  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
}
