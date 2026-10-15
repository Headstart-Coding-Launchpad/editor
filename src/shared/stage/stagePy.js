/**
 * Python source of the `stage` module (the Python Stage, src/shared/stage/). The Pyodide worker
 * (src/modules/python/pyodide.worker.js) registers it ONCE in sys.modules when Python loads
 * (STAGE_INSTALL_PY), so `from stage import *` / `import stage` work without prepending any code
 * to the student's program: error line numbers stay the student's own.
 *
 * Every call hands its arguments, as JSON { args, kwargs }, to the worker's JS bridge
 * `__hsStageCall(name, json)`, which binds and validates them (validateStageCall in
 * ./commands.js: size first, then colour, then x, y; the old position-first order gets its own
 * plain-English message), records one command and returns '' — or 'Kind|message', raised as a
 * plain-English TypeError / ValueError / RuntimeError naming the argument. The module is compiled as
 * '<stage>', so the error's line is the student's call (formatPythonError reads the innermost
 * '<student>' frame). `hue()` draws nothing: `__hsStageHue(json)` answers 'ok|#rrggbb' (stageHue
 * in ./commands.js).
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

__all__ = ['background', 'rect', 'square', 'circle', 'polygon', 'line', 'text', 'stamp', 'grid',
           'clear', 'hue', 'WIDTH', 'HEIGHT']


def _hs_unsendable(value):
    return {'__hs_type__': type(value).__name__}


def _payload(name, args, kwargs):
    try:
        return _json.dumps({'args': list(args), 'kwargs': kwargs}, allow_nan=False,
                           default=_hs_unsendable)
    except ValueError:
        raise ValueError(name + '(): use ordinary numbers, not infinity or nan') from None


def _raise(problem):
    kind, _sep, message = problem.partition('|')
    error = {'TypeError': TypeError, 'RuntimeError': RuntimeError}.get(kind, ValueError)
    raise error(message) from None


def _draw(name, args, kwargs):
    payload = _payload(name, args, kwargs)
    if _js is None:
        return
    problem = str(_js.__hsStageCall(name, payload) or '')
    if problem:
        _raise(problem)


def background(*args, **kwargs):
    """background(colour): fills the whole stage with a colour."""
    _draw('background', args, kwargs)


def circle(*args, **kwargs):
    """circle(r, colour, x, y): a circle of radius r centred on (x, y) (default: the middle).
    Also angle=, opacity=, outline=, width=; colour=None draws just the outline."""
    _draw('circle', args, kwargs)


def square(*args, **kwargs):
    """square(size, colour, x, y): a square centred on (x, y) (default: the middle).
    Also angle= (degrees clockwise), opacity=, outline=, width=; colour=None for an outline."""
    _draw('square', args, kwargs)


def rect(*args, **kwargs):
    """rect(w, h, colour, x, y): a rectangle w wide and h tall, centred on (x, y).
    Also angle= (degrees clockwise), opacity=, outline=, width=; colour=None for an outline."""
    _draw('rect', args, kwargs)


def polygon(*args, **kwargs):
    """polygon(sides, size, colour, x, y): a regular shape, size from centre to corner, one
    corner pointing up. Also angle=, opacity=, outline=, width=; colour=None for an outline."""
    _draw('polygon', args, kwargs)


def line(*args, **kwargs):
    """line(x1, y1, x2, y2, colour, width=2): a line from (x1, y1) to (x2, y2)."""
    _draw('line', args, kwargs)


def text(*args, **kwargs):
    """text(words, colour, x, y, size=16): words centred on (x, y). Also angle=, opacity=."""
    args = list(args)
    if args and args[0] is not None and not isinstance(args[0], str):
        args[0] = str(args[0])
    if kwargs.get('words') is not None and not isinstance(kwargs['words'], str):
        kwargs['words'] = str(kwargs['words'])
    _draw('text', args, kwargs)


def stamp(*args, **kwargs):
    """stamp(emoji, x, y, size=32): an emoji centred on (x, y). Also angle=, opacity=."""
    _draw('stamp', args, kwargs)


def grid(*args, **kwargs):
    """grid(rows, palette, cell, x, y): a 2D list as a pixel grid centred on (x, y).
    Values index palette, or are colours themselves."""
    _draw('grid', args, kwargs)


def clear(*args, **kwargs):
    """clear(): wipes the stage back to white."""
    _draw('clear', args, kwargs)


def hue(*args, **kwargs):
    """hue(n, light=50): a colour round the colour wheel as a hex string.
    hue(0) is red, hue(120) green, hue(240) blue; it wraps every 360."""
    payload = _payload('hue', args, kwargs)
    if _js is None:
        return '#ff0000'
    answer = str(_js.__hsStageHue(payload) or '')
    if answer.startswith('ok|'):
        return answer[3:]
    _raise(answer)
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
