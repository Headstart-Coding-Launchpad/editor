// @vitest-environment node
// The worker's exact Python wrapper (PYTHON_WRAPPER in ../pyodide.worker.js), run in a real
// CPython through ./wrapperDriver.py: a student's program must behave like ordinary Python.
//
// Needs `python3` (Linux, CI's ubuntu runners) or `python` / `py` (Windows), 3.10 or newer.
// Skipped on a machine with none, but never in CI.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { buildMicroPythonProgram } from '../../electronics/index.js'
import { buildTurtleProgram, TURTLE_LINE_OFFSET } from '../../turtle/shim.js'
import { STAGE_MODULE_PY } from '../../../shared/stage/stagePy.js'
import { explainPythonError } from '../../../shared/pythonErrors.js'

// The worker module assigns self.onmessage when imported.
vi.hoisted(() => {
  globalThis.self ??= globalThis
})

const { PYTHON_WRAPPER, formatPythonError } = await import('../pyodide.worker.js')

function findPython() {
  const names = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  return names.find((name) => {
    const probe = spawnSync(name, ['-c', 'import sys; print(sys.version_info >= (3, 10))'], {
      encoding: 'utf8',
      timeout: 15000,
    })
    return probe.status === 0 && probe.stdout.trim() === 'True'
  })
}

const PYTHON = findPython()

const lines = (...parts) => parts.join('\n')

// name → one run, or a list of runs sharing one interpreter (one worker).
const JOBS = {
  globalChange: {
    code: lines(
      'score = 0',
      'def add_point():',
      '    global score',
      '    score = score + 1',
      'add_point()',
      'print(score)'
    ),
  },
  globalAssignOnly: {
    code: lines(
      'score = 0',
      'def win():',
      '    global score',
      '    score = 10',
      'win()',
      'print(score)'
    ),
  },
  classInit: {
    code: lines(
      'class Dog:',
      '    def __init__(self, name):',
      '        self.name = name',
      '    def bark(self):',
      '        return self.name + " says woof"',
      'd = Dog("Rex")',
      'print(d.bark())'
    ),
  },
  higherOrder: {
    code: lines(
      'def double(n):',
      '    return n * 2',
      'def size(w):',
      '    return len(w)',
      'print(list(map(double, [1, 2])))',
      'print(sorted(["ccc", "a", "bb"], key=size))',
      'print(sum(double(i) for i in range(4)))',
      'f = lambda x: double(x)',
      'print(f(3))',
      'def nums():',
      '    yield double(1)',
      '    yield 3',
      'for n in nums():',
      '    print(n)'
    ),
  },
  ownAdd: {
    code: lines(
      'def add(a, b):',
      '    return a + b',
      's = set()',
      's.add(1)',
      'print(add(1, 2), s)'
    ),
  },
  passFunction: {
    code: lines(
      'def hello():',
      '    print("hello")',
      'def run(f):',
      '    f()',
      'run(hello)',
      'again = hello',
      'again()'
    ),
  },
  higherOrderBesideInput: {
    code: lines(
      'def double(n):',
      '    return n * 2',
      'name = input("Name? ")',
      'print(name, list(map(double, [1, 2])), sum(double(i) for i in range(4)))'
    ),
    inputs: ['Sam'],
  },
  inputTopAndFunctions: {
    code: lines(
      'def ask():',
      '    return input("n? ")',
      'def both():',
      '    return ask() + ask()',
      'first = int(input("a? "))',
      'print(first + 1, both())',
      'print([input() for i in range(2)])'
    ),
    inputs: ['4', 'x', 'y', 'p', 'q'],
  },
  inputInMethods: {
    code: lines(
      'class Quiz:',
      '    def __init__(self):',
      '        self.score = 0',
      '    def ask(self):',
      '        return input("? ")',
      '    def play(self):',
      '        if self.ask() == "yes":',
      '            self.score += 1',
      'q = Quiz()',
      'q.play()',
      's = set()',
      's.add(q.score)',
      'print(s)'
    ),
    inputs: ['yes'],
  },
  inputThroughValues: {
    code: lines(
      'def ask():',
      '    return input("? ")',
      'def run(f):',
      '    answer = f()',
      '    print("got", answer)',
      'run(ask)',
      'run(input)',
      'actions = {"a": ask}',
      'print(actions["a"]())',
      'def menu():',
      '    choices = {"b": lambda: ask()}',
      '    picked = choices["b"]()',
      '    print(picked)',
      'menu()'
    ),
    inputs: ['1', '2', '3', '4'],
  },
  inputThroughAttribute: {
    code: lines(
      'def get():',
      '    return input("? ")',
      'def rank(k):',
      '    return {"a": 2, "b": 1}.get(k)',
      'class Button:',
      '    def __init__(self, action):',
      '        self.action = action',
      '    def press(self):',
      '        print("pressed", self.action())',
      'Button(get).press()',
      'print(sorted("ab", key=rank))'
    ),
    inputs: ['z'],
  },
  slowLoop: {
    code: lines('for i in range(3):', '    print(i)', 'input()'),
    record: { on: true },
  },
  inputWithDecorator: {
    code: lines(
      'def twice(f):',
      '    def wrapper():',
      '        first = f()',
      '        return first + f()',
      '    return wrapper',
      '@twice',
      'def ask():',
      '    return input("? ")',
      'print(ask())'
    ),
    inputs: ['a', 'b'],
  },
  recursiveInput: {
    code: lines(
      'def menu(n):',
      '    if input() == "stop":',
      '        return n',
      '    return menu(n + 1)',
      'print(menu(0))'
    ),
    inputs: [...Array(150).fill('go'), 'stop'],
  },
  // Where input() cannot wait: always an error on a useful line, never a quiet wrong answer.
  cannotInit: {
    code: lines(
      'class Dog:',
      '    def __init__(self):',
      '        self.name = input("name? ")',
      'd = Dog()',
      'print("after")'
    ),
  },
  cannotInitBare: {
    code: lines('class Dog:', '    def __init__(self):', '        input("press enter")', 'Dog()'),
  },
  cannotMap: {
    code: lines('def ask(n):', '    return input()', 'print(list(map(ask, [1, 2])))'),
  },
  cannotMapUnused: {
    code: lines(
      'def ask(n):',
      '    return input()',
      'answers = list(map(ask, [1]))',
      'print("done")'
    ),
  },
  cannotSorted: {
    code: lines('def key(w):', '    return input()', 'print(sorted(["a", "b"], key=key))'),
  },
  cannotGenExp: {
    code: lines('total = sum(int(input()) for i in range(2))', 'print(total)'),
  },
  cannotJoin: {
    code: lines('def ask(n):', '    return input()', 'print(",".join(map(ask, [1])))'),
  },
  cannotGenerator: {
    code: lines('def asks():', '    answer = input()', '    yield answer', 'print(list(asks()))'),
  },
  uncaughtKeepsOwnError: {
    code: lines('def ask(n):', '    return input()', 'later = map(ask, [1])', 'print(missing)'),
  },
  errorLines: {
    code: lines('def go():', '    x = input()', '    return x + missing', '', 'go()'),
    inputs: ['1'],
  },
  topReturn: { code: lines('x = 1', 'return') },
  setupError: { code: lines('print(start)'), setup: { code: 'start = 1 / 0' } },
  setupAndStar: {
    code: lines(
      'from stage import *',
      'def bump():',
      '    global start',
      '    start += WIDTH',
      'bump()'
    ),
    setup: { code: 'start = 1' },
    capture: { panel: true },
  },
  variables: {
    code: lines(
      'score = 0',
      'name = "Sam"',
      'def bump():',
      '    global score',
      '    bonus = 2',
      '    score += bonus      #@peek',
      'for i in range(2):',
      '    bump()',
      'guess = input()',
      'qzxvw'
    ),
    inputs: ['7'],
    capture: { panel: true, peekLine: 6, countLines: [3, 6, 8, 9], lineOffset: 0 },
    record: { on: true },
  },
  turtle: {
    code: buildTurtleProgram(
      lines(
        'from turtle import *',
        'types = ["a"]',
        'def side():',
        '    global count',
        '    forward(int(input()))',
        '    count += 1',
        'count = 0',
        'side()',
        'qzxvw'
      )
    ),
    inputs: ['30'],
    capture: { panel: true, lineOffset: TURTLE_LINE_OFFSET, countLines: [5] },
    record: { on: true, lineOffset: TURTLE_LINE_OFFSET },
  },
  countsWhenWaiting: {
    code: lines(
      'def ask():',
      '    return input()',
      'for i in range(2):',
      '    ask()',
      'print("a",',
      '      ask())'
    ),
    capture: { countLines: [1, 2, 4, 5] },
  },
  // A student's names never reach into the shims, which use math and json themselves.
  shimNames: {
    code: buildTurtleProgram(
      lines('from turtle import *', 'math = 5', 'json = "x"', 'circle(10)', 'print(heading())')
    ),
  },
  // Review and browser-check faults (28 Nov).
  turtleOwnNames: {
    code: buildTurtleProgram(
      lines(
        'from turtle import *',
        'color = "red"',
        'speed = 3',
        'width = 4',
        'heading = 90',
        'position = [0, 0]',
        'forward(10)'
      )
    ),
    capture: { panel: true, lineOffset: TURTLE_LINE_OFFSET },
    record: { on: true, lineOffset: TURTLE_LINE_OFFSET },
  },
  boundCallback: {
    code: lines(
      'class Game:',
      '    def play(self):',
      '        print("played", input())',
      'def run(f):',
      '    f()',
      'g = Game()',
      'run(g.play)'
    ),
    inputs: ['a'],
  },
  storedLambda: {
    code: lines(
      'def ask():',
      '    return input()',
      'actions = {"1": lambda: ask() if True else ""}',
      'def menu():',
      '    answer = actions["1"]()',
      '    print("got", answer)',
      'menu()'
    ),
    inputs: ['b'],
  },
  methodInList: {
    code: lines(
      'class Game:',
      '    def start(self):',
      '        print("start", input())',
      'g = Game()',
      'def go():',
      '    for step in [g.start]:',
      '        step()',
      'go()'
    ),
    inputs: ['c'],
  },
  initAppend: {
    code: lines(
      'class Bag:',
      '    def __init__(self):',
      '        self.items = []',
      '        self.items.append(input())',
      '    def first(self):',
      '        return self.items[0]',
      'b = Bag()',
      'print("made")',
      'print(b.first())'
    ),
    inputs: ['late'],
  },
  initContainer: {
    code: lines(
      'class Bag:',
      '    def __init__(self):',
      '        self.items = [input()]',
      '    def first(self):',
      '        return self.items[0]',
      'b = Bag()',
      'print(b.first())'
    ),
    inputs: ['late'],
  },
  initTry: {
    code: lines(
      'class Dog:',
      '    def __init__(self):',
      '        try:',
      '            self.age = int(input())',
      '        except ValueError:',
      '            print("not a number")',
      '        except Exception:',
      '            print("oops")',
      'Dog()'
    ),
  },
  initBareExcept: {
    code: lines(
      'class Dog:',
      '    def __init__(self):',
      '        try:',
      '            self.age = int(input())',
      '        except:',
      '            print("not a number")',
      'try:',
      '    Dog()',
      'except:',
      '    print("oops")'
    ),
  },
  deepRecursion: {
    code: lines(
      'def count(n):',
      '    if n == 0:',
      '        return int(input())',
      '    return count(n - 1) + 1',
      'print(count(600))'
    ),
    inputs: ['0'],
  },
  classAndLambdaSlots: {
    code: lines(
      'def keep(label):',
      '    return lambda cls: cls',
      'class Meta(type):',
      '    def __new__(m, n, b, d, **kw):',
      '        print("kw", kw.get("tag"))',
      '        return super().__new__(m, n, b, d)',
      '    def __init__(c, n, b, d, **kw):',
      '        pass',
      '@keep(input())',
      'class A(dict if input() == "d" else list, metaclass=Meta, tag=input()):',
      '    pass',
      'f = lambda x=input(): x',
      'print(f(), A.__bases__[0].__name__)',
      'def make():',
      '    class B(dict if input() == "d" else list):',
      '        pass',
      '    g = lambda y=input(): y',
      '    print(B.__bases__[0].__name__, g())',
      'make()'
    ),
    inputs: ['1', 'd', 'k', 'v', 'd', 'w'],
  },
  ownAwaitLoop: {
    code: lines(
      'async def get():',
      '    return [1, 2]',
      'co = get()',
      'for x in await co:',
      '    print(x)',
      'class C:',
      '    def __init__(self):',
      '        for i in range(3):',
      '            pass',
      'C()',
      'if False:',
      '    input()'
    ),
    record: { on: true },
  },
  mapLaterPrint: {
    code: lines(
      'def ask(n):',
      '    return input()',
      'answers = list(map(ask, [1]))',
      'print("one")',
      'print(answers)'
    ),
  },
  waitingInTags: {
    code: lines(
      'def ask(n):',
      '    return input()',
      'answers = list(map(ask, [1]))',
      'lookup = {"a": answers}'
    ),
    capture: { panel: true },
    record: { on: true },
  },
  sleepInInit: {
    code: buildMicroPythonProgram(
      lines('import time', 'class A:', '    def __init__(self):', '        time.sleep(1)', 'A()')
    ),
    asyncNames: ['sleep', 'sleep_ms'],
  },
  ownBareExec: { code: lines('exec()', 'input()') },
  ownExec: {
    code: lines('exec("x = 1", globals())', 'y = x', 'print(y, input())'),
    inputs: ['z'],
    capture: { panel: true },
  },
  property: {
    code: lines(
      'class Dog:',
      '    @property',
      '    def name(self):',
      '        return input()',
      'd = Dog()',
      'print(d.name)'
    ),
  },
  electronics: [
    {
      code: buildMicroPythonProgram(
        lines(
          'from machine import Pin',
          'import time',
          'from utime import sleep_ms as pause',
          'led = Pin("GP0", Pin.OUT)',
          'class Blinker:',
          '    def blink(self):',
          '        led.on()',
          '        time.sleep(1)',
          '        pause(500)',
          'Blinker().blink()',
          'print("done")'
        )
      ),
      asyncNames: ['sleep', 'sleep_ms'],
      capture: { panel: true },
    },
    // A later plain Python run in the same worker still has the shim's `time`.
    { code: lines('import time', 'def wait():', '    time.sleep(2)', 'wait()', 'print("ok")') },
  ],
}

let results

beforeAll(() => {
  if (!PYTHON) return
  const names = Object.keys(JOBS)
  const jobs = names.map((name) => ({
    wrapper: PYTHON_WRAPPER,
    stage: STAGE_MODULE_PY,
    runs: [JOBS[name]].flat(),
  }))
  const child = spawnSync(PYTHON, [path.join(__dirname, 'wrapperDriver.py')], {
    input: JSON.stringify(jobs),
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1' },
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (child.status !== 0) throw new Error(child.stderr || String(child.error))
  const parsed = JSON.parse(child.stdout)
  results = Object.fromEntries(names.map((name, i) => [name, parsed[i]]))
}, 90000)

const result = (name, index = 0) => results[name][index]
const printed = (name, index) => result(name, index).out.trimEnd().split('\n')
const errorOf = (name, options) =>
  result(name).traceback
    ? formatPythonError(result(name).traceback.trim(), options).text
    : '(no error)'
const clean = (name, index) => {
  expect(result(name, index).traceback).toBeNull()
  expect(result(name, index).warnings).toEqual([])
}

it('has a Python to run the wrapper with (always required in CI)', () => {
  if (process.env.CI) expect(PYTHON).toBeTruthy()
})

describe.skipIf(!PYTHON)('ordinary Python behaves like ordinary Python', () => {
  it.each([
    ['globalChange', ['1']],
    ['globalAssignOnly', ['10']],
    ['classInit', ['Rex says woof']],
    ['higherOrder', ['[2, 4]', "['a', 'bb', 'ccc']", '12', '6', '2', '3']],
    ['ownAdd', ['3 {1}']],
    ['passFunction', ['hello', 'hello']],
    ['higherOrderBesideInput', ['Sam [2, 4] 12']],
  ])('%s', (name, expected) => {
    clean(name)
    expect(printed(name)).toEqual(expected)
  })
})

describe.skipIf(!PYTHON)('input() still waits', () => {
  it.each([
    ['inputTopAndFunctions', ['5 xy', "['p', 'q']"]],
    ['inputInMethods', ['{1}']],
    ['inputThroughValues', ['got 1', 'got 2', '3', '4']],
    ['inputWithDecorator', ['ab']],
    ['inputThroughAttribute', ['pressed z', "['b', 'a']"]],
    ['recursiveInput', ['150']],
  ])('%s', (name, expected) => {
    clean(name)
    expect(printed(name)).toEqual(expected)
  })

  it.each([
    ['cannotInit', 3, 'input()'],
    ['cannotInitBare', 3, 'input()'],
    ['cannotMap', 3, 'ask()'],
    ['cannotMapUnused', 3, 'ask()'],
    ['cannotSorted', 3, 'key()'],
    ['cannotGenExp', 1, 'input()'],
    ['cannotJoin', 3, 'ask()'],
    ['cannotGenerator', 2, 'input()'],
  ])('%s is a plain error, never a silent wrong answer', (name, line, what) => {
    expect(errorOf(name)).toMatch(
      new RegExp(`^Line ${line}: RuntimeError: ${what.replace(/[()]/g, '\\$&')} .*wait`)
    )
    expect(result(name).prompts).toEqual([])
    expect(result(name).warnings).toEqual([])
  })

  it('keeps the program’s own error when something else fails first', () => {
    expect(errorOf('uncaughtKeepsOwnError')).toBe(
      "Line 4: NameError: name 'missing' is not defined"
    )
    expect(result('uncaughtKeepsOwnError').warnings).toEqual([])
  })
})

describe.skipIf(!PYTHON)('review faults of 28 Nov', () => {
  it.each([
    ['boundCallback', ['played a']],
    ['storedLambda', ['got b']],
    ['methodInList', ['start c']],
    ['deepRecursion', ['600']],
    ['classAndLambdaSlots', ['kw k', 'v dict', 'dict w']],
    ['ownExec', ['1 z']],
  ])('%s still waits', (name, expected) => {
    clean(name)
    expect(printed(name)).toEqual(expected)
  })

  it.each([
    ['initAppend', 4, 'inside __init__', ''],
    ['initContainer', 3, 'inside __init__', ''],
    ['initTry', 4, 'inside __init__', ''],
    ['initBareExcept', 4, 'inside __init__', ''],
    ['mapLaterPrint', 3, 'here', 'one\n'],
    ['property', 6, 'here', ''],
  ])('%s errors at once: nothing asked later or caught', (name, line, where, out) => {
    const error = errorOf(name)
    expect(error).toMatch(new RegExp(`^Line ${line}: RuntimeError: .*has to wait.*${where}`))
    expect(error).not.toContain('own line')
    expect(result(name).prompts).toEqual([])
    expect(result(name).out).toBe(out)
    expect(result(name).warnings).toEqual([])
  })

  it('Turtle: the child’s own color, speed, width stay in the panel and slow-mo', () => {
    clean('turtleOwnNames')
    const { panel, steps } = result('turtleOwnNames')
    const own = ['color', 'speed', 'width', 'heading', 'position']
    expect(panel.end.vars.map((v) => v.n).sort()).toEqual([...own].sort())
    expect(Object.keys(Object.assign({}, ...steps.map((s) => s.s))).sort()).toEqual(own.sort())
  })

  it('slow-mo copes with the child’s own await, and totals loops that cannot wait', () => {
    clean('ownAwaitLoop')
    expect(result('ownAwaitLoop').loops.map((l) => l.total)).toEqual([null, 3])
  })

  it('has plain-words help for both kinds of "cannot wait"', () => {
    const title = (name) => explainPythonError(errorOf(name))?.title
    expect(title('initAppend')).toBe("input() can't wait inside __init__")
    expect(title('mapLaterPrint')).toBe("ask() can't wait here")
  })

  it('does not tell a sleep() in __init__ to ask, nor trip on a bare exec()', () => {
    expect(result('sleepInInit').traceback).toContain('Do it outside the class')
    expect(result('ownBareExec').traceback).toContain('TypeError: exec')
  })

  it('keeps what the child’s own first-line exec() made', () => {
    expect(result('ownExec').panel.end.vars.map((v) => v.n)).toEqual(['x', 'y'])
  })

  it('never shows _HsPending in the variable tags', () => {
    const { panel, steps, variables } = result('waitingInTags')
    expect(JSON.stringify([panel, steps, variables])).not.toContain('_HsPending')
    expect(errorOf('waitingInTags')).toMatch(/^Line 3: RuntimeError: /)
  })
})

describe.skipIf(!PYTHON)('what reads the program still works', () => {
  it('numbers errors by the student’s lines, and hides the setup’s', () => {
    expect(errorOf('errorLines')).toBe("Line 3: NameError: name 'missing' is not defined")
    expect(result('topReturn').traceback).toContain("'return' outside function")
    expect(errorOf('setupError', { setupFrom: 3 })).not.toContain('ZeroDivision')
  })

  it('shares setup variables with global, and hides star-imported names', () => {
    clean('setupAndStar')
    expect(result('setupAndStar').variables.start.json).toBe('401')
    expect(result('setupAndStar').panel.end.vars.map((v) => v.n)).toEqual(['start'])
  })

  it('variable checks, #@peek, run counts and slow-mo', () => {
    const run = result('variables')
    expect(errorOf('variables')).toBe("Line 10: NameError: name 'qzxvw' is not defined")
    expect(run.variables.score).toEqual({ type: 'int', json: '4', repr: '4' })
    expect(run.variables.guess.json).toBe('"7"')
    expect(Object.keys(run.variables).filter((n) => n.startsWith('_'))).toEqual([])
    const names = (snapshot) => snapshot.vars.map((v) => v.n)
    expect(names(run.panel.end)).toEqual(['score', 'name', 'i', 'guess'])
    expect(run.panel.peekReached).toBe(true)
    expect(run.panel.peek.scope).toBe('bump')
    expect(names(run.panel.peek)).toEqual(['score', 'name', 'i', 'bonus'])
    expect(run.lineCounts).toEqual({ 3: 1, 6: 2, 8: 2, 9: 1 })
    expect(run.steps.map((s) => `${s.l}:${s.k}`)).toEqual(
      '1:0 2:0 3:0 7:0 8:0 5:1 6:1 7:0 8:0 5:1 6:1 7:0 9:0 10:0'.split(' ')
    )
    expect(run.steps[0].s).toEqual({ score: { t: 'int', v: 0 } })
  })

  it('slow-mo still knows a loop’s total in a program that uses input()', () => {
    expect(result('slowLoop').loops).toEqual([{ line: 1, end: 2, total: 3 }])
  })

  it('counts the lines of a function that waits once per run of the line', () => {
    expect(result('countsWhenWaiting').lineCounts).toEqual({
      1: 1,
      2: 3,
      4: 2,
      5: expect.any(Number),
    })
    expect(printed('countsWhenWaiting')).toEqual(['a'])
  })

  it('Turtle: input() in a function, global, own variables only, line numbers', () => {
    const run = result('turtle')
    expect(errorOf('turtle')).toBe("Line 11: NameError: name 'qzxvw' is not defined")
    expect(run.turtle).toContainEqual(['Forward', 30, false])
    expect(run.panel.end.vars.map((v) => v.n)).toEqual(['types', 'count'])
    expect(run.variables.count.json).toBe('1')
    expect(run.lineCounts).toEqual({ 5: 1 })
    expect(run.steps.at(-1).l).toBe(9)
    expect(run.steps.find((s) => s.l === 5).k).toBe(1)
  })

  it('a student’s own names don’t break the shims', () => {
    clean('shimNames')
    expect(result('shimNames').variables.math.json).toBe('5')
  })

  it('Electronics: sleep() waits inside a method, and a later Python run is not silent', () => {
    clean('electronics')
    expect(result('electronics').sleeps).toEqual([1, 0.5])
    expect(printed('electronics')).toContain('done')
    expect(result('electronics').panel.end.vars.map((v) => v.n)).toEqual(['led'])
    clean('electronics', 1)
    expect(result('electronics', 1).sleeps).toEqual([2])
    expect(printed('electronics', 1)).toEqual(['ok'])
  })
})
