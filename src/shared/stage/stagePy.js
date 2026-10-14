/**
 * Python source of the `stage` module (the Python Stage, src/shared/stage/). The Pyodide worker
 * (src/modules/python/pyodide.worker.js) registers it ONCE in sys.modules when Python loads
 * (STAGE_INSTALL_PY), so `from stage import *` / `import stage` work without prepending any code
 * to the student's program: error line numbers stay the student's own.
 *
 * Every call hands its arguments, as JSON, to the worker's JS bridge
 * `__hsStageCall(name, json)`, which validates them (validateStageCall in ./commands.js), records
 * one command and returns '' — or 'Kind|message', which is raised here as a plain-English
 * TypeError / ValueError / RuntimeError naming the argument. The module is compiled as
 * '<stage>', so the error's line is the student's call (formatPythonError reads the innermost
 * '<student>' frame).
 *
 * Exported as plain text; nothing here runs in Node.
 */
export const STAGE_MODULE_PY = `
import json as _json
try:
    import js as _js
except Exception:
    _js = None

WIDTH = 400
HEIGHT = 400

__all__ = ['background', 'rect', 'circle', 'line', 'text', 'stamp', 'grid', 'clear', 'WIDTH', 'HEIGHT']


def _hs_unsendable(value):
    return {'__hs_type__': type(value).__name__}


def _draw(name, args):
    try:
        payload = _json.dumps(args, allow_nan=False, default=_hs_unsendable)
    except ValueError:
        raise ValueError(name + '(): use ordinary numbers, not infinity or nan') from None
    if _js is None:
        return
    problem = str(_js.__hsStageCall(name, payload) or '')
    if problem:
        kind, _sep, message = problem.partition('|')
        error = {'TypeError': TypeError, 'RuntimeError': RuntimeError}.get(kind, ValueError)
        raise error(message) from None


def background(colour):
    """Fills the whole stage with a colour."""
    _draw('background', [colour])


def rect(x, y, w, h, colour):
    """A rectangle: top-left corner (x, y), w wide and h tall."""
    _draw('rect', [x, y, w, h, colour])


def circle(x, y, r, colour):
    """A circle centred on (x, y) with radius r."""
    _draw('circle', [x, y, r, colour])


def line(x1, y1, x2, y2, colour, width=2):
    """A line from (x1, y1) to (x2, y2)."""
    _draw('line', [x1, y1, x2, y2, colour, width])


def text(x, y, words, colour, size=16):
    """Words with their top-left corner at (x, y)."""
    _draw('text', [x, y, str(words), colour, size])


def stamp(emoji, x, y, size=32):
    """An emoji centred on (x, y)."""
    _draw('stamp', [emoji, x, y, size])


def grid(rows, palette=None, cell=None, x=0, y=0):
    """A 2D list as a pixel grid. Values index palette, or are colours themselves."""
    _draw('grid', [rows, palette, cell, x, y])


def clear():
    """Wipes the stage back to white."""
    _draw('clear', [])
`

// Runs once per worker, after Pyodide loads, with `_hs_stage_src` set to STAGE_MODULE_PY.
export const STAGE_INSTALL_PY = `
import sys as _hs_sys, types as _hs_types
_hs_stage_module = _hs_types.ModuleType('stage')
_hs_stage_module.__file__ = '<stage>'
exec(compile(_hs_stage_src, '<stage>', 'exec'), _hs_stage_module.__dict__)
_hs_sys.modules['stage'] = _hs_stage_module
del _hs_stage_module
`
