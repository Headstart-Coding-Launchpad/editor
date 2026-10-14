/**
 * Python source for reading the student's variables inside the Pyodide worker
 * (pyodide.worker.js runs it before each run's wrapper). Kept in its own module so the name-tag
 * panel (showVariables, src/shared/variablesPanel/) and later per-step recorders (slow-mo)
 * share one capture path.
 *
 * Why frames, not globals: the worker rewrites the student's program into
 * `async def __hs_run__()`, so every top-level variable is a LOCAL of that coroutine's frame.
 * The wrapper wraps the body in `try: … finally: _hs_end_capture(locals())`, so the end-of-run
 * state is read from the frame even when the program raised an error.
 *
 * What it defines (all names start with `_hs`, so they never show as student variables):
 *
 *   _hs_encode_value(value, depth=0, budget=None) → node
 *       One value as a small JSON-safe tree (see VALUE NODES below). Size-capped.
 *   _hs_snapshot(namespace, hidden=(), scope=None) → { vars: [{ n, v }], scope }
 *       The visible variables of a namespace dict, in its order (a function frame's locals come
 *       in the order the names first appear in the code), each encoded with _hs_encode_value.
 *       Hidden: dunder names, `_hs…` names, modules, anything callable (functions, classes,
 *       methods, builtins) and `hidden` (the author's `hide` plus names imported from the
 *       turtle / stage modules — see _hs_imported_names).
 *   _hs_frame_namespace(frame) → (namespace, scope)
 *       The variables visible at a traced line: the `__hs_run__` frame's locals, with a student
 *       function's own locals on top when the line is inside one (scope = its name).
 *   _HsLineWatch(on_line)
 *       A sys.settrace wrapper that calls on_line(frame, lineno) before each line of the
 *       student's file ('<student>') runs, in the top level and inside student functions,
 *       including after an `await input()` resumes. on_line returns False to stop watching
 *       (the tracer is removed at once, so the rest of the run is untraced). start() / stop().
 *       A recorder (slow-mo) can keep returning True and snapshot every step with
 *       _hs_snapshot(*_hs_frame_namespace(frame)). on_line may raise _HsStopRun (a BaseException,
 *       so a student's `except Exception` can't swallow it) to end the
 *       student's program there (slow-mo's 2,000-step cap): the watch stops and the exception
 *       goes on into the program, for the caller to catch around __hs_run__.
 *   _hs_imported_names(tree, modules) → set
 *       Names bound by `from <module> import …` for the given top-level modules.
 *
 * VALUE NODES (`t` is the kind):
 *   { t: 'str', v, more? }              more = characters cut off the end
 *   { t: 'int', v } | { t: 'int', r }   r (text) when too big for a JS number
 *   { t: 'float', v?, r }               r is Python's repr, so 5.0 still reads 5.0
 *   { t: 'bool', v } | { t: 'none' }
 *   { t: 'list' | 'tuple' | 'set', items: [node], len, cut? }
 *   { t: 'dict', items: [{ k: node, v: node }], len, cut? }
 *   { t: 'obj', type, r }               anything else: its type name and a short repr
 * `cut: true` means the items were not read (too deep, or the size budget ran out); `len` is
 * always the real length, so the UI can say how many were left out.
 *
 * Exported for unit tests as plain text; nothing here runs in Node.
 */
export const VARIABLE_CAPTURE_LIMITS = Object.freeze({
  maxStringChars: 500,
  maxItems: 50,
  maxDepth: 3,
  maxNodes: 600,
  maxReprChars: 120,
})

const L = VARIABLE_CAPTURE_LIMITS

export const VARIABLE_CAPTURE_PY = `
import sys as _hs_sys, types as _hs_types, ast as _hs_ast

_HS_MAX_STR = ${L.maxStringChars}
_HS_MAX_ITEMS = ${L.maxItems}
_HS_MAX_DEPTH = ${L.maxDepth}
_HS_MAX_NODES = ${L.maxNodes}
_HS_MAX_REPR = ${L.maxReprChars}

def _hs_short_repr(value):
    try:
        text = repr(value)
    except Exception:
        text = '<' + type(value).__name__ + '>'
    if len(text) > _HS_MAX_REPR:
        text = text[:_HS_MAX_REPR] + '...'
    return text

def _hs_encode_value(value, depth=0, budget=None):
    if budget is None:
        budget = [_HS_MAX_NODES]
    budget[0] -= 1
    if value is None:
        return {'t': 'none'}
    if isinstance(value, bool):
        return {'t': 'bool', 'v': value}
    if isinstance(value, int):
        if -9007199254740991 <= value <= 9007199254740991:
            return {'t': 'int', 'v': value}
        return {'t': 'int', 'r': _hs_short_repr(value)}
    if isinstance(value, float):
        node = {'t': 'float', 'r': repr(value)}
        if value == value and value not in (float('inf'), float('-inf')):
            node['v'] = value
        return node
    if isinstance(value, str):
        node = {'t': 'str', 'v': value[:_HS_MAX_STR]}
        if len(value) > _HS_MAX_STR:
            node['more'] = len(value) - _HS_MAX_STR
        return node
    if isinstance(value, (list, tuple, set, frozenset)):
        kind = 'list' if isinstance(value, list) else ('tuple' if isinstance(value, tuple) else 'set')
        items = list(value)
        if kind == 'set':
            try:
                items = sorted(items, key=repr)
            except Exception:
                pass
        node = {'t': kind, 'len': len(items), 'items': []}
        if depth >= _HS_MAX_DEPTH or budget[0] <= 0:
            node['cut'] = True
            return node
        for item in items[:_HS_MAX_ITEMS]:
            if budget[0] <= 0:
                node['cut'] = True
                break
            node['items'].append(_hs_encode_value(item, depth + 1, budget))
        return node
    if isinstance(value, dict):
        node = {'t': 'dict', 'len': len(value), 'items': []}
        if depth >= _HS_MAX_DEPTH or budget[0] <= 0:
            node['cut'] = True
            return node
        for key, item in list(value.items())[:_HS_MAX_ITEMS]:
            if budget[0] <= 0:
                node['cut'] = True
                break
            node['items'].append({
                'k': _hs_encode_value(key, depth + 1, budget),
                'v': _hs_encode_value(item, depth + 1, budget),
            })
        return node
    return {'t': 'obj', 'type': type(value).__name__, 'r': _hs_short_repr(value)}

def _hs_visible_name(name, value, hidden):
    if name.startswith('__') or name.startswith('_hs'):
        return False
    if name in hidden:
        return False
    if isinstance(value, _hs_types.ModuleType):
        return False
    try:
        if callable(value):
            return False
    except Exception:
        return False
    return True

def _hs_snapshot(namespace, hidden=(), scope=None):
    budget = [_HS_MAX_NODES]
    out = []
    for name, value in list(namespace.items()):
        if not _hs_visible_name(name, value, hidden):
            continue
        try:
            out.append({'n': name, 'v': _hs_encode_value(value, 0, budget)})
        except Exception:
            out.append({'n': name, 'v': {'t': 'obj', 'type': type(value).__name__, 'r': '?'}})
    return {'vars': out, 'scope': scope}

def _hs_is_run_frame(frame):
    return frame.f_code.co_name == '__hs_run__' and frame.f_code.co_filename == '<student>'

def _hs_frame_namespace(frame):
    top = frame
    while top is not None and not _hs_is_run_frame(top):
        top = top.f_back
    namespace = {}
    if top is not None:
        namespace.update(top.f_locals)
    if top is frame:
        return namespace, None
    namespace.update(frame.f_locals)
    return namespace, frame.f_code.co_name

def _hs_imported_names(tree, modules):
    names = set()
    for node in _hs_ast.walk(tree):
        if isinstance(node, _hs_ast.ImportFrom) and (node.module or '').split('.')[0] in modules:
            for alias in node.names:
                names.add(alias.asname or alias.name)
    return names

class _HsStopRun(BaseException):
    pass

class _HsLineWatch:
    def __init__(self, on_line):
        self.on_line = on_line
        self.active = False

    def _on_call(self, frame, event, arg):
        if not self.active or frame.f_code.co_filename != '<student>':
            return None
        return self._on_event

    def _on_event(self, frame, event, arg):
        if not self.active:
            return None
        if event == 'line':
            try:
                keep = self.on_line(frame, frame.f_lineno)
            except _HsStopRun:
                self.stop(frame)
                raise
            except Exception:
                keep = False
            if keep is False:
                self.stop(frame)
                return None
        return self._on_event

    def start(self):
        self.active = True
        _hs_sys.settrace(self._on_call)

    def stop(self, frame=None):
        self.active = False
        _hs_sys.settrace(None)
        while frame is not None:
            try:
                frame.f_trace = None
            except Exception:
                pass
            frame = frame.f_back
`
