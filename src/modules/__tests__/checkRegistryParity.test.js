// Parity between the registry-backed evaluateSingleCheck and the frozen pre-registry
// dispatcher (./legacyCheckDispatcher.js). Three layers:
//   1. A generated case table: every registered type id and alias (plus unknown and
//      missing types) × operators × values × contexts, including the electronics
//      `code` override and missing/null contexts.
//   2. The existing check test corpus (imported below) re-run with every registry
//      dispatch mirrored through the legacy dispatcher.
//   3. RUN_REQUIRED / SUBMIT_ALLOWED and the helpers built on them.
import { afterAll, describe, expect, it } from 'vitest'
import {
  CHECK_TYPES,
  CODE_CHECK_TYPES,
  CORE_CHECKS,
  checkAllowedForSubmit,
  checkRegistry,
  checkRequiresRun,
  evaluateSingleCheck,
  getCheckDefinition,
  normalizeCheckShape,
} from '../checks.js'
import { createCheckRegistry } from '../checkRegistry.js'
import { CHECKS as FS_CHECKS, FS_CHECK_TYPES } from '../filesystem/checks.js'
import { CHECKS as DESKTOP_CHECKS, DESKTOP_CHECK_TYPES } from '../desktop/checks.js'
import { CHECKS as PYTHON_CHECKS, PYTHON_CHECK_TYPES } from '../python/checks.js'
import { CHECKS as HTML_CHECKS, HTML_CHECK_TYPES } from '../html/checks.js'
import { CHECKS as ELECTRONICS_CHECKS } from '../electronics/checks.js'
import { ELECTRONICS_CHECK_TYPES } from '../electronics/circuit.js'
import { CHECKS as TURTLE_CHECKS, TURTLE_CHECK_TYPES } from '../turtle/checks.js'
import {
  LEGACY_RUN_REQUIRED,
  LEGACY_SUBMIT_ALLOWED,
  legacyCheckAllowedForSubmit,
  legacyCheckRequiresRun,
  legacyEvaluateSingleCheck,
} from './legacyCheckDispatcher.js'
// The existing check corpus. ESM evaluates these before the mirror below is installed,
// but that only registers their suites; every test body runs after installation.
import './checks.test.js'
import '../desktop/__tests__/checks.test.js'
import './compareParity.test.js'
import '../../shared/__tests__/codeArrange.test.js'
import '../../app/__tests__/codeCheckContext.test.js'

// ─── Layer 2: mirror every registry dispatch made by the existing corpus ─────────
// Installed at import time (before any test body runs) by replacing the method on the
// shared registry object, so calls from inside checks.js (evaluateCheck,
// evaluateCheckWithFeedback, getIncorrectCheckHint, ...) are observed too.
const corpusMismatches = []
let corpusDispatches = 0
const originalEvaluate = checkRegistry.evaluate
checkRegistry.evaluate = function mirroredEvaluate(check, output, context) {
  const next = outcome(() => originalEvaluate(check, output, context))
  const legacy = outcome(() => legacyEvaluateSingleCheck(check, output, context))
  corpusDispatches += 1
  if (!sameOutcome(next, legacy)) corpusMismatches.push({ check, next, legacy })
  if (next.threw) throw next.error
  return next.value
}

afterAll(() => {
  checkRegistry.evaluate = originalEvaluate
})

describe('check registry parity — existing corpus', () => {
  it('mirrors every registry dispatch made by the existing check suites', () => {
    // Declared after the imported suites, so it runs once they have all finished; the
    // mirror is removed here so the generated table below runs unmirrored.
    checkRegistry.evaluate = originalEvaluate
    expect(corpusMismatches).toEqual([])
    expect(corpusDispatches).toBeGreaterThanOrEqual(200)
  })
})

function outcome(fn) {
  try {
    return { threw: false, value: fn() }
  } catch (error) {
    return { threw: true, error, errorName: error?.constructor?.name }
  }
}

function sameOutcome(a, b) {
  if (a.threw || b.threw) return a.threw === b.threw && a.errorName === b.errorName
  return Object.is(a.value, b.value)
}

// ─── Fixtures for the generated case table ────────────────────────────────────────
function makeIframeDoc() {
  const doc = document.implementation.createHTMLDocument('parity')
  doc.body.innerHTML =
    '<h1 class="title" style="color: red">Hello World</h1><p id="p1">hello</p><p>42</p>'
  return doc
}

const FS = {
  '/': { type: 'dir' },
  '/Documents/': { type: 'dir' },
  '/Documents/notes.txt': { type: 'file', content: 'Hello World\nhello' },
  '/Pictures/': { type: 'dir' },
}

const CIRCUIT = {
  components: [
    {
      id: 'microcontroller1',
      type: 'microcontroller',
      pins: ['3V3', 'GND', 'GP0'],
      props: { code: 'led = Pin("GP0", Pin.OUT)\nled.on()' },
    },
    { id: 'led1', type: 'led', pins: ['anode', 'cathode'] },
    { id: 'battery1', type: 'battery', pins: ['positive', 'negative'] },
  ],
  wires: [],
  controls: {},
}

const TURTLE = {
  state: { x: 100, y: 0, heading: 0, penDown: true, color: 'red', visible: true },
  commands: [
    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'red' },
    { type: 'stamp', x: 100, y: 0 },
  ],
  calls: [
    { name: 'forward', args: [100] },
    { name: 'pencolor', args: ['red'] },
  ],
}

const RICH_CONTEXT = {
  code: 'print("hello")\nx = 42\nled.on()',
  answer: 'hello',
  status: 'success',
  variables: {
    x: { type: 'int', json: '42' },
    name: { type: 'str', json: '"hello"' },
    items: { type: 'list', json: '[10, 20, 30]' },
    data: { type: 'dict', json: '{"name": "Alice", "age": 30}' },
  },
  fs: FS,
  currentDir: '/Documents/',
  openFile: '/Documents/notes.txt',
  desktop: {
    fs: FS,
    recycleBin: [{ path: '/Documents/old.txt' }],
    windows: [{ appId: 'fileManager', minimized: false, maximized: true }],
    browserVisited: ['home'],
    lastSearchQuery: 'hello',
  },
  turtle: TURTLE,
  iframeDoc: makeIframeDoc(),
}

// [label, output, context]; `undefined` context exercises the default parameter.
const CONTEXTS = [
  ['no context', '', undefined],
  ['empty context', 'hello', {}],
  ['null context', 'hello', null],
  ['rich context', 'Hello World\nhello\n42\n', RICH_CONTEXT],
  ['rich context + circuit', 'hello', { ...RICH_CONTEXT, circuit: CIRCUIT }],
  ['circuit only', '', { circuit: CIRCUIT, code: JSON.stringify(CIRCUIT) }],
]

const FIELD_BAG = {
  name: 'x',
  key: 'name',
  index: 0,
  selector: 'h1',
  attribute: 'class',
  property: 'color',
  path: '/Documents/notes.txt',
  dir: '/Documents/',
  appId: 'fileManager',
  appIds: ['fileManager', 'browser'],
  pageId: 'home',
  text: 'hello',
  command: 'forward',
  color: 'red',
  x: 100,
  y: 0,
  tolerance: 1,
  minCount: 1,
  component: { type: 'led' },
  from: 'battery1.positive',
  to: 'battery1.negative',
}

const VALUES = ['hello', 'Hello World', '42', 'led.on()', '^h.*o$']

const registeredIds = checkRegistry.typeIds()
const operators = [
  undefined,
  ...new Set(
    checkRegistry
      .list()
      .flatMap((def) => def.operators ?? [])
      .concat([
        'contains',
        'not_contains',
        'equals',
        'not_equals',
        'matches_regex',
        'not_matches_regex',
        'greater_than',
        'greater_than_or_equal',
        'less_than',
        'less_than_or_equal',
        'exists',
        'bogus_operator',
      ])
  ),
]

function* generateCases() {
  const ids = [
    ...registeredIds,
    'not_a_real_type',
    'block_run', // Scratch-only: never registered here
    'sprite_property_delta',
    '',
  ]
  for (const [label, output, context] of CONTEXTS) {
    yield [label, null, output, context]
    yield [label, {}, output, context]
    yield [label, { value: 'hello' }, output, context]
    for (const type of ids) {
      yield [label, { type }, output, context]
      yield [label, { type, ...FIELD_BAG }, output, context]
      yield [label, { type, value: null, ...FIELD_BAG }, output, context]
      for (const operator of operators) {
        for (const value of VALUES) {
          yield [label, { type, operator, value, ...FIELD_BAG }, output, context]
        }
      }
      yield [label, { type, operator: 'contains', value: 'HELLO', flags: 'i' }, output, context]
    }
  }
}

describe('check registry parity — generated case table', () => {
  it('matches the legacy dispatcher for every type, alias, operator and context', () => {
    let total = 0
    let passed = 0
    const passingTypes = new Set()
    const mismatches = []
    for (const [label, check, output, context] of generateCases()) {
      total += 1
      const next = outcome(() => evaluateSingleCheck(check, output, context))
      const legacy = outcome(() => legacyEvaluateSingleCheck(check, output, context))
      if (!sameOutcome(next, legacy)) {
        if (mismatches.length < 20) mismatches.push({ label, check, next, legacy })
        continue
      }
      if (next.value === true) {
        passed += 1
        passingTypes.add(check.type)
      }
    }
    expect(mismatches).toEqual([])
    // The table must be broad and must exercise passing results, not just `false`.
    expect(total).toBeGreaterThan(20000)
    expect(passed).toBeGreaterThan(1000)
    for (const type of ['output', 'code', 'answer', 'fs_path', 'window_state', 'html_element']) {
      expect(passingTypes).toContain(type)
    }
    for (const type of ['variable_equals', 'circuit_has_component', 'turtle_segment_count']) {
      expect(passingTypes).toContain(type)
    }
  }, 60000)

  it('keeps the electronics override: generic code checks read the MicroPython source', () => {
    const check = { type: 'code', operator: 'contains', value: 'led.on()' }
    const context = { circuit: CIRCUIT, code: 'print("nothing")' }
    expect(evaluateSingleCheck(check, '', context)).toBe(true)
    expect(legacyEvaluateSingleCheck(check, '', context)).toBe(true)
    // value == null does not short-circuit the override (legacy order preserved).
    const noValue = { type: 'code', operator: 'contains' }
    expect(evaluateSingleCheck(noValue, '', context)).toBe(
      legacyEvaluateSingleCheck(noValue, '', context)
    )
    expect(evaluateSingleCheck(check, '', { code: 'print("nothing")' })).toBe(false)
  })
})

describe('check registry parity — run/submit classification', () => {
  const sorted = (list) => [...new Set(list)].sort()

  it('derives RUN_REQUIRED and SUBMIT_ALLOWED with the same sets as before', () => {
    expect(sorted(CHECK_TYPES.RUN_REQUIRED)).toEqual(sorted(LEGACY_RUN_REQUIRED))
    expect(sorted(CHECK_TYPES.SUBMIT_ALLOWED)).toEqual(sorted(LEGACY_SUBMIT_ALLOWED))
    expect(sorted(CHECK_TYPES.SUBMIT_ALLOWED)).toEqual(sorted(CODE_CHECK_TYPES))
    expect(CHECK_TYPES.RUN_REQUIRED).toHaveLength(new Set(CHECK_TYPES.RUN_REQUIRED).size)
  })

  it('classifies every id identically in checkRequiresRun / checkAllowedForSubmit', () => {
    const ids = [...registeredIds, 'not_a_real_type', 'block_run', undefined]
    for (const type of ids) {
      for (const check of [{ type }, { type, operator: 'equals' }]) {
        expect([type, checkRequiresRun(check)]).toEqual([type, legacyCheckRequiresRun(check)])
        expect([type, checkAllowedForSubmit(check)]).toEqual([
          type,
          legacyCheckAllowedForSubmit(check),
        ])
      }
    }
    expect(checkRequiresRun(null)).toBe(legacyCheckRequiresRun(null))
    expect(checkAllowedForSubmit(undefined)).toBe(legacyCheckAllowedForSubmit(undefined))
  })
})

describe('check registry — ownership', () => {
  const ALL_DEFS = [
    ...CORE_CHECKS,
    ...FS_CHECKS,
    ...DESKTOP_CHECKS,
    ...PYTHON_CHECKS,
    ...HTML_CHECKS,
    ...ELECTRONICS_CHECKS,
    ...TURTLE_CHECKS,
  ]
  const EXPECTED_OWNERS = [
    ['module:filesystem', FS_CHECK_TYPES],
    ['module:desktop', DESKTOP_CHECK_TYPES],
    ['module:python', PYTHON_CHECK_TYPES],
    ['module:html', HTML_CHECK_TYPES],
    ['module:electronics', ELECTRONICS_CHECK_TYPES],
    ['module:turtle', TURTLE_CHECK_TYPES],
    ['core', CODE_CHECK_TYPES],
  ]

  it('gives every type in any *_CHECK_TYPES list exactly one owner', () => {
    for (const [owner, types] of EXPECTED_OWNERS) {
      for (const type of types) {
        const owners = ALL_DEFS.filter((def) => [def.type, ...(def.aliases ?? [])].includes(type))
        expect([type, owners.map((def) => def.owner)]).toEqual([type, [owner]])
        expect(getCheckDefinition(type)?.owner).toBe(owner)
      }
    }
  })

  it('registers every core alias against its canonical core type', () => {
    for (const legacyType of [
      'output_contains',
      'output_line_count_at_least',
      'code_does_not_contain',
      'answer_contains',
      'answer_not_matches_regex',
    ]) {
      const normalized = normalizeCheckShape({ type: legacyType })
      expect(checkRegistry.canonicalType(legacyType)).toBe(normalized.type)
      expect(getCheckDefinition(legacyType).owner).toBe('core')
    }
  })

  it('registers exactly the module CHECKS arrays and nothing else', () => {
    expect(checkRegistry.size()).toBe(ALL_DEFS.length)
    expect(checkRegistry.list().map((def) => def.type)).toEqual(ALL_DEFS.map((def) => def.type))
  })
})

describe('createCheckRegistry', () => {
  const evaluate = () => true
  const def = (type, extra = {}) => ({ type, owner: 'core', timing: 'on_run', evaluate, ...extra })

  it('looks up canonical types and aliases', () => {
    const registry = createCheckRegistry([def('a', { aliases: ['a_old'], requiresRun: true })])
    expect(registry.get('a').type).toBe('a')
    expect(registry.get('a_old').type).toBe('a')
    expect(registry.has('a_old')).toBe(true)
    expect(registry.has('b')).toBe(false)
    expect(registry.get(undefined)).toBeNull()
    expect(registry.canonicalType('a_old')).toBe('a')
    expect(registry.canonicalType('nope')).toBeNull()
    expect(registry.typeIds((d) => d.requiresRun)).toEqual(['a', 'a_old'])
    expect(registry.size()).toBe(1)
  })

  it('evaluates via lookup and returns false for unknown types', () => {
    const registry = createCheckRegistry([def('a', { evaluate: (c, o, ctx) => ctx.ok === o })])
    expect(registry.evaluate({ type: 'a' }, 1, { ok: 1 })).toBe(true)
    expect(registry.evaluate({ type: 'a' }, 1)).toBe(false)
    expect(registry.evaluate({ type: 'zzz' }, 1, {})).toBe(false)
    expect(registry.evaluate(null, 1, {})).toBe(false)
  })

  it('normalises flags and freezes definitions', () => {
    const registry = createCheckRegistry([def('a', { operators: ['equals'], fields: ['value'] })])
    const a = registry.get('a')
    expect(a.requiresRun).toBe(false)
    expect(a.submitAllowed).toBe(false)
    expect(a.aliases).toEqual([])
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.operators)).toBe(true)
    expect(Object.isFrozen(a.fields)).toBe(true)
  })

  it('throws on duplicate ids across types, aliases and within one definition', () => {
    expect(() => createCheckRegistry([def('a'), def('a')])).toThrow(/Duplicate check type "a"/)
    expect(() => createCheckRegistry([def('a', { aliases: ['b'] }), def('b')])).toThrow(
      /Duplicate check type "b"/
    )
    expect(() => createCheckRegistry([def('a'), def('c', { aliases: ['a'] })])).toThrow(
      /Duplicate check type "a"/
    )
    expect(() => createCheckRegistry([def('a', { aliases: ['x', 'x'] })])).toThrow(/Duplicate/)
    const registry = createCheckRegistry([def('a')])
    expect(() => registry.registerCheckType(def('a', { owner: 'module:python' }))).toThrow(
      /module:python conflicts with core/
    )
  })

  it('rejects malformed definitions', () => {
    expect(() => createCheckRegistry([null])).toThrow(/must be an object/)
    expect(() => createCheckRegistry([def('')])).toThrow(/missing a string `type`/)
    expect(() => createCheckRegistry([def('a', { owner: 'plugin' })])).toThrow(/invalid owner/)
    expect(() => createCheckRegistry([def('a', { owner: 'activity:binary' })])).not.toThrow()
    expect(() => createCheckRegistry([def('a', { owner: 'input' })])).not.toThrow()
    expect(() => createCheckRegistry([def('a', { timing: 'later' })])).toThrow(/invalid timing/)
    expect(() => createCheckRegistry([def('a', { evaluate: null })])).toThrow(/evaluate function/)
    expect(() => createCheckRegistry([def('a', { aliases: 'x' })])).toThrow(/must be an array/)
    expect(() => createCheckRegistry([def('a', { validate: 'x' })])).toThrow(/must be a function/)
  })
})
