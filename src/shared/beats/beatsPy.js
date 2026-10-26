/**
 * Python source of the `beats` module (Beat Maker, docs/authoring/beats.md). Registered ONCE in
 * sys.modules when Python loads (BEATS_INSTALL_PY), like the Stage's `stage` module
 * (src/shared/stage/stagePy.js), so `from beats import *` works without prepending code to the
 * student's program.
 *
 * Every call hands its arguments, as JSON { args, kwargs }, to the worker's bridge
 * `__hsBeatsCall(name, json)` (recordBeatCall in ./patterns.js), which checks them, records one
 * Stage command and returns '' — or 'Kind|message', raised as a plain-English TypeError /
 * ValueError / RuntimeError. Compiled as '<beats>', so an error's line is the student's call.
 * Only play and stop are exported: kick, snare, hat and clap stay the student's own names.
 *
 * Exported as plain text; nothing here runs in Node.
 */
export const BEATS_MODULE_PY = `
import json as _json
try:
    import js as _js
except Exception:
    _js = None

__all__ = ['play', 'stop']


def _hs_unsendable(value):
    return {'__hs_type__': type(value).__name__}


def _raise(problem):
    kind, _sep, message = problem.partition('|')
    error = {'TypeError': TypeError, 'RuntimeError': RuntimeError}.get(kind, ValueError)
    raise error(message) from None


def _send(name, args, kwargs):
    try:
        payload = _json.dumps({'args': list(args), 'kwargs': kwargs}, allow_nan=False,
                              default=_hs_unsendable)
    except ValueError:
        raise ValueError(name + '(): use ordinary numbers, not infinity or nan') from None
    if _js is None:
        return
    problem = str(_js.__hsBeatsCall(name, payload) or '')
    if problem:
        _raise(problem)


def play(*args, **kwargs):
    """play(kick, snare, hat, clap, tempo=100): plays drum patterns together and shows them as a
    step grid on the Stage. A pattern is a string, x for a hit and . for a rest, one character
    per step: play("x...x...x...x..."). Give patterns by name too: play(hat="x.x.", clap="..x.").
    Each play() in a program is one part; the parts play one after another."""
    _send('play', args, kwargs)


def stop(*args, **kwargs):
    """stop(): the beat won't play. Any play() before it is dropped."""
    _send('stop', args, kwargs)
`

// Runs once per worker, after Pyodide loads, with `_hs_beats_src` set to BEATS_MODULE_PY.
export const BEATS_INSTALL_PY = `
import sys as _hs_sys, types as _hs_types
_hs_beats_module = _hs_types.ModuleType('beats')
_hs_beats_module.__file__ = '<beats>'
exec(compile(_hs_beats_src, '<beats>', 'exec'), _hs_beats_module.__dict__)
_hs_sys.modules['beats'] = _hs_beats_module
del _hs_beats_module
`
