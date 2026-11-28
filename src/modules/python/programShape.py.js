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
 * sorted(key=), a lambda's caller, a generator), using it, or leaving it unrun at the end, raises
 * a plain RuntimeError on the student's line: never a silent wrong answer.
 */
export const PROGRAM_SHAPE_PY = `
import ast as _hs_ast, asyncio as _hs_asyncio, functools as _hs_functools, sys as _hs_sys

_hs_waiting = {}

class _HsPending:
    def __init__(self, coroutine, name):
        frame = _hs_sys._getframe(1)
        while frame is not None and frame.f_code.co_filename != '<student>':
            frame = frame.f_back
        self._hs_coroutine, self._hs_name = coroutine, name
        self._hs_line = frame.f_lineno if frame is not None else 1
        _hs_waiting[id(self)] = self

    def __await__(self):
        _hs_waiting.pop(id(self), None)
        return self._hs_coroutine.__await__()

    def _hs_message(self):
        return (self._hs_name + '() has to wait, and Python cannot wait here (inside __init__, '
                'map(), sorted(), a lambda or yield). Use it on its own line first, then use '
                'what it gives you.')

    def _hs_use(self, *args, **kwargs):
        raise RuntimeError(self._hs_message())

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

# Where the program can wait: await what has to be awaited, pass anything else through.
async def _hs_aw(value):
    while type(value) is _HsPending:
        value = await value
    return value

# Where it can't, and the value is kept or dropped there and then.
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
    left = list(_hs_waiting.values())
    if not left:
        return
    message, line = left[0]._hs_message(), left[0]._hs_line
    _hs_close_waiting()
    code = compile(chr(10) * (line - 1) + 'raise RuntimeError(_hs_message)', '<student>', 'exec')
    exec(code, {'_hs_message': message})

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
        if not isinstance(node, (_hs_ast.FunctionDef, _hs_ast.AsyncFunctionDef, _hs_ast.ClassDef)):
            stack.extend(_hs_ast.iter_child_nodes(node))

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
        node.body = self._within(False, node.body)
        return node

    def visit_Lambda(self, node):
        node.body = self._within(False, [node.body])[0]
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
            return node
        return _hs_ast.copy_location(_hs_ast.Await(value=self._call('_hs_aw', node)), node)

    def visit_Await(self, node):
        # The student's own await: leave that call to it.
        self.generic_visit(node.value)
        return node

    def _kept(self, node):
        now = not self.can_wait and isinstance(node.value, _hs_ast.Call)
        self.generic_visit(node)
        if now:
            node.value = self._call('_hs_now', node.value)
        return node

    visit_Expr = visit_Assign = visit_AugAssign = visit_AnnAssign = _kept

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
