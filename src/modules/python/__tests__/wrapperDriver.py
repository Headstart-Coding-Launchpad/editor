# Runs the Pyodide worker's exact Python wrapper in an ordinary CPython, with a stand-in for the
# worker's `js` module (programWrapper.test.js). Reads one JSON job list on stdin, writes one JSON
# result list on stdout. Each job is { wrapper, stage, runs: [run] }; the runs of one job share
# their globals, like runs in one worker.
import ast
import asyncio
import builtins
import contextlib
import gc
import io
import json
import sys
import time
import traceback
import types
import warnings

REAL_INPUT = builtins.input
REAL_TIME = sys.modules['time']


class FakeJs(types.ModuleType):
    def __init__(self):
        super().__init__('js')
        self.inputs, self.log = [], {}

    def reset(self, inputs):
        self.inputs = list(inputs)
        self.log = {'prompts': [], 'sleeps': [], 'steps': [], 'gpio': [], 'turtle': []}

    async def _do_hsInput(self, prompt):
        self.log['prompts'].append(prompt)
        await asyncio.sleep(0)
        return self.inputs.pop(0) if self.inputs else ''

    async def _do_hsGpioSleep(self, seconds):
        self.log['sleeps'].append(seconds)

    def _do_hsSetVariables(self, variables):
        self.log['variables'] = variables

    def _do_hsSetVariablesPanel(self, text):
        self.log['panel'] = json.loads(text)

    def _do_hsSetLineCounts(self, text):
        self.log['lineCounts'] = json.loads(text)

    def _do_hsSlowMoStep(self, text):
        self.log['steps'].append(json.loads(text))
        return 0

    def _do_hsTurtleGetState(self):
        return json.dumps({'x': 0, 'y': 0, 'heading': 0, 'penDown': True})

    def _do_hsSlowMoLoops(self, text):
        self.log['loops'] = json.loads(text)

    # The worker's __hs… bridge names (a class body would mangle them as method names).
    def __getattr__(self, name):
        handler = getattr(type(self), f'_do_{name[2:]}', None)
        if handler:
            return handler.__get__(self)
        if name.startswith('__hsTurtle'):
            return lambda *args: self.log['turtle'].append([name[10:], *args])
        if name.startswith('__hs'):
            return lambda *args: None
        raise AttributeError(name)


js = FakeJs()
sys.modules['js'] = js


async def run_one(wrapper, run, scope):
    js.reset(run.get('inputs', []))
    scope['_hs_user_code'] = run['code']
    scope['_hs_async_names_json'] = json.dumps(run.get('asyncNames', []))
    for key in ('capture', 'record', 'setup'):
        scope[f'_hs_{key}_json'] = json.dumps(run.get(key, {}))
    out = io.StringIO()
    error = None
    with contextlib.redirect_stdout(out), warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        try:
            compiled = compile(wrapper, '<exec>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
            pending = eval(compiled, scope)
            if pending is not None:
                await pending
        except BaseException as caught_error:
            error = ''.join(
                traceback.format_exception(
                    type(caught_error), caught_error, caught_error.__traceback__
                )
            )
        gc.collect()
    never = [str(w.message) for w in caught if 'never awaited' in str(w.message)]
    return {'out': out.getvalue(), 'traceback': error, 'warnings': never, **js.log}


async def main():
    results = []
    for job in json.load(sys.stdin):
        stage = types.ModuleType('stage')
        exec(compile(job['stage'], '<stage>', 'exec'), stage.__dict__)
        sys.modules['stage'] = stage
        scope = {'__builtins__': builtins}
        results.append([await run_one(job['wrapper'], run, scope) for run in job['runs']])
        # Undo what a run installs for the whole interpreter.
        builtins.input = REAL_INPUT
        sys.modules['time'] = REAL_TIME
        for name in ('turtle', 'machine', 'utime', 'lcd1602'):
            sys.modules.pop(name, None)
    sys.__stdout__.write(json.dumps(results, default=repr))


asyncio.run(main())
