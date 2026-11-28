/**
 * Python source for the only change the worker makes to a student's program (pyodide.worker.js
 * puts it in PYTHON_WRAPPER): letting input() (and Electronics' sleep()) wait without blocking.
 *
 * The top level runs as ordinary module code, with top-level await. Only the functions that reach
 * input() / sleep() become `async def`; dunder methods and generators never do. A program that
 * never names input or sleep is not changed at all.
 *
 * A call that has to wait returns an _HsPending until the program awaits it (every call at the top
 * level and inside those async functions does). Where Python can't wait (__init__, map(),
 * sorted(key=), a generator), a rewritten call refuses one at once, and one made by C code is
 * refused when used or at the end: a plain RuntimeError on the student's line, which a student's
 * except can't swallow. Never a silent wrong answer, never asked later.
 */
export const PROGRAM_SHAPE_PY = `
import ast as _hs_ast, asyncio as _hs_asyncio, functools as _hs_functools, sys as _hs_sys

_hs_waiting = {}

# "RuntimeError" to read, but a student's \`except Exception\` can't swallow it.
_HsCannotWait = type('RuntimeError', (BaseException,), {'__module__': 'builtins'})

class _HsPending:
    def __init__(self, coroutine, name):
        frame = _hs_sys._getframe(1)
        while frame is not None and frame.f_code.co_filename != '<student>':
            frame = frame.f_back
        self._hs_coroutine, self._hs_name = coroutine, name
        self._hs_line = frame.f_lineno if frame is not None else 1
        self._hs_init = frame is not None and frame.f_code.co_name == '__init__'
        _hs_waiting[id(self)] = self

    def __await__(self):
        _hs_waiting.pop(id(self), None)
        return self._hs_coroutine.__await__()

    # Raised on the line that made the call, wherever its answer was used.
    def _hs_use(self, *args, **kwargs):
        where = ('inside __init__. Do it outside the class (and pass the answer in).' if self._hs_init
                 else 'here (map(), sorted(), a lambda, yield, @property, a class body or a __special__ method).')
        error = _HsCannotWait(self._hs_name + '() has to wait, and Python cannot wait ' + where)
        code = compile(chr(10) * (self._hs_line - 1) + 'raise _hs_error', '<student>', 'exec')
        tracer = _hs_sys.gettrace()
        _hs_sys.settrace(None)
        try:
            exec(code, {'_hs_error': error})
        finally:
            _hs_sys.settrace(tracer)  # A variable tag's repr() lands here too: keep counting.

    __bool__ = __str__ = __repr__ = __format__ = __hash__ = __call__ = _hs_use
    __eq__ = __ne__ = __lt__ = __le__ = __gt__ = __ge__ = _hs_use
    __len__ = __iter__ = __getitem__ = __setitem__ = __contains__ = _hs_use
    __add__ = __radd__ = __sub__ = __rsub__ = __mul__ = __rmul__ = __pow__ = __rpow__ = _hs_use
    __truediv__ = __rtruediv__ = __floordiv__ = __rfloordiv__ = __mod__ = __rmod__ = _hs_use
    __neg__ = __abs__ = __int__ = __float__ = __index__ = __round__ = _hs_use

    def __getattr__(self, name):
        self._hs_use()

# An async function (or shim sleep) as the program sees it.
def _hs_wait(function):
    @_hs_functools.wraps(function)
    def call(*args, **kwargs):
        return _HsPending(function(*args, **kwargs), function.__name__.lstrip('_') or 'it')
    call._hs_waits = True
    return call

async def _hs_given(value):
    return value

# Where the program can wait. The coroutine itself is handed back, so waiting costs recursion
# no extra frames.
def _hs_aw(value):
    if type(value) is not _HsPending:
        return _hs_given(value)
    _hs_waiting.pop(id(value), None)
    return value._hs_coroutine

# Where it can't.
def _hs_now(value):
    if type(value) is _HsPending:
        value._hs_use()
    return value

def _hs_close_waiting():
    for pending in list(_hs_waiting.values()):
        pending._hs_coroutine.close()
    _hs_waiting.clear()

# Something that had to wait never ran: raise it on the line that called it.
def _hs_check_waited():
    for pending in list(_hs_waiting.values()):
        _hs_close_waiting()
        pending._hs_use()

# The name an expression goes by: f, or the attribute in anything.f.
def _hs_name(node):
    if isinstance(node, _hs_ast.Attribute):
        return node.attr
    return node.id if isinstance(node, _hs_ast.Name) else None

# A function's own nodes (its lambdas included, nested def and class bodies not).
def _hs_own_nodes(function):
    stack = list(function.body)
    while stack:
        node = stack.pop()
        yield node
        inner = isinstance(node, (_hs_ast.FunctionDef, _hs_ast.AsyncFunctionDef, _hs_ast.ClassDef))
        # A nested def's or class's decorators, bases and defaults run here; its body doesn't.
        body = node.body if inner else []
        stack.extend(n for n in _hs_ast.iter_child_nodes(node) if n not in body)

# The defs that must be async: they call a blocking name or another such def (anything.f() only
# reaches a method f), or hand one to a call. Once one is handed around as a value (or decorated),
# so are the defs that call a function held in a variable, parameter, attribute, list or dict.
def _hs_async_defs(tree, blocking):
    nodes = list(_hs_ast.walk(tree))
    held = {n.arg for n in nodes if isinstance(n, _hs_ast.arg)}
    held |= {_hs_name(n) for n in nodes if isinstance(getattr(n, 'ctx', None), _hs_ast.Store)}
    methods = {d for c in nodes if isinstance(c, _hs_ast.ClassDef) for d in c.body}
    called = {id(n.func) for n in nodes if isinstance(n, _hs_ast.Call)}
    values = {n.id for n in nodes if isinstance(n, _hs_ast.Name) and id(n) not in called}
    defs = [
        d for d in nodes
        if isinstance(d, _hs_ast.FunctionDef)
        and not (d.name.startswith('__') and d.name.endswith('__'))
        and not any(isinstance(n, (_hs_ast.Yield, _hs_ast.YieldFrom)) for n in _hs_own_nodes(d))
    ]
    names, attributes, chosen = set(blocking), set(blocking), set()

    def waits(n):
        if not isinstance(n, _hs_ast.Call):
            return False
        passed = [*n.args, *(k.value for k in n.keywords)]
        reach = attributes if isinstance(n.func, _hs_ast.Attribute) else names
        if _hs_name(n.func) in reach or any(_hs_name(a) in names for a in passed):
            return True
        if not (values & names or any(d.decorator_list for d in chosen)):
            return False
        return isinstance(n.func, _hs_ast.Subscript) or _hs_name(n.func) in held

    while True:
        before = len(chosen)
        for d in defs:
            if d not in chosen and any(waits(n) for n in _hs_own_nodes(d)):
                chosen.add(d)
                names.add(d.name)
                if d in methods:
                    attributes.add(d.name)
        if len(chosen) == before:
            return chosen

class _HsShape(_hs_ast.NodeTransformer):
    def __init__(self, chosen):
        self.chosen = chosen
        self.can_wait = True

    def _within(self, can_wait, nodes):
        outer, self.can_wait = self.can_wait, can_wait
        out = [self.visit(n) for n in nodes]
        self.can_wait = outer
        return out

    def visit_FunctionDef(self, node):
        waits = node in self.chosen or isinstance(node, _hs_ast.AsyncFunctionDef)
        node.decorator_list = [self.visit(d) for d in node.decorator_list]
        node.args = self.visit(node.args)
        node.body = self._within(waits, node.body)
        if node not in self.chosen:
            return node
        new = _hs_ast.AsyncFunctionDef(**{f: getattr(node, f, None) for f in node._fields})
        wrap = _hs_ast.Name(id='_hs_wait', ctx=_hs_ast.Load())
        new.decorator_list.append(_hs_ast.copy_location(wrap, node))
        return _hs_ast.copy_location(new, node)

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_ClassDef(self, node):
        body, node.body = node.body, []
        self.generic_visit(node)
        node.body = self._within(False, body)
        return node

    # A call whose answer goes straight to the caller, which can wait for it.
    def _handed_on(self, node):
        if not self.can_wait and isinstance(node, _hs_ast.IfExp):
            node.test = self.visit(node.test)
            node.body, node.orelse = self._handed_on(node.body), self._handed_on(node.orelse)
            return node
        if not self.can_wait and isinstance(node, _hs_ast.BoolOp):
            node.values = [*map(self.visit, node.values[:-1]), self._handed_on(node.values[-1])]
            return node
        if not self.can_wait and isinstance(node, _hs_ast.Call):
            self.generic_visit(node)
            return node
        return self.visit(node)

    def visit_Lambda(self, node):
        node.args = self.visit(node.args)
        outer, self.can_wait = self.can_wait, False
        node.body = self._handed_on(node.body)
        self.can_wait = outer
        return node

    def visit_Return(self, node):
        node.value = node.value and self._handed_on(node.value)
        if self.can_wait and node.value and not isinstance(node.value, _hs_ast.Await):  # return answers[0]
            node.value = _hs_ast.copy_location(_hs_ast.Await(value=self._call('_hs_aw', node.value)), node)
        return node

    # A bare except: must not swallow "cannot wait" (or slow-mo's stop).
    def visit_ExceptHandler(self, node):
        kind = _hs_ast.Name(id='Exception', ctx=_hs_ast.Load())
        node.type = node.type or _hs_ast.copy_location(kind, node)
        self.generic_visit(node)
        return node

    def visit_GeneratorExp(self, node):
        node.generators[0].iter = self.visit(node.generators[0].iter)
        first, node.generators[0].iter = node.generators[0].iter, _hs_ast.Constant(None)
        node.elt = self._within(False, [node.elt])[0]
        node.generators = self._within(False, node.generators)
        node.generators[0].iter = first
        return node

    def _call(self, name, node):
        func = _hs_ast.copy_location(_hs_ast.Name(id=name, ctx=_hs_ast.Load()), node)
        return _hs_ast.copy_location(_hs_ast.Call(func=func, args=[node], keywords=[]), node)

    def visit_Call(self, node):
        self.generic_visit(node)
        if not self.can_wait:
            return self._call('_hs_now', node)
        return _hs_ast.copy_location(_hs_ast.Await(value=self._call('_hs_aw', node)), node)

    def visit_Await(self, node):
        # The student's own await: leave that call to it.
        self.generic_visit(node.value)
        return node

# Rewrites the tree in place, only when the program names something that has to wait.
def _hs_shape(tree, blocking):
    nodes = list(_hs_ast.walk(tree))
    blocking = set(blocking)
    blocking |= {
        a.asname for n in nodes if isinstance(n, _hs_ast.ImportFrom)
        for a in n.names if a.asname and a.name in blocking
    }
    used = {n.id for n in nodes if isinstance(n, _hs_ast.Name)}
    used |= {n.attr for n in nodes if isinstance(n, _hs_ast.Attribute)}
    if used & blocking:
        _HsShape(_hs_async_defs(tree, blocking)).visit(tree)
        _hs_ast.fix_missing_locations(tree)
`
