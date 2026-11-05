import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  describeHighlightTargets,
  highlightScopeForTask,
  highlightTargetText,
  listHighlightTargets,
  moduleHasHighlightTargets,
  resolveHighlightTarget,
  validateTaskHighlight,
} from '../controlHighlight.js'
import { locateHighlight } from '../useControlHighlight.js'
import { defineActivity } from '../../activities/defineActivity.js'
import { getActivityDefinitions } from '../../activities/registry.pure.js'
import OnScreenKeyboard from '../../activities/keyboard/OnScreenKeyboard.jsx'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { buildCapabilities } from '../../../cli/capabilities.mjs'

// Request 133 part B: hosted activities declare highlight targets; the Keyboard's `key:<key>`.
const KEYBOARD = { taskType: 'activity', activityType: 'keyboard', mode: 'symbols', items: [] }
const SCOPE = 'activity:keyboard'

describe('activity highlight targets', () => {
  it('scopes a hosted activity task to activity:<id>, other tasks to their module', () => {
    expect(highlightScopeForTask(KEYBOARD, 'python')).toBe(SCOPE)
    expect(highlightScopeForTask({ starterCode: '' }, 'python')).toBe('python')
    expect(highlightScopeForTask({ taskType: 'information' }, 'python')).toBe('python')
  })

  it('gives the Keyboard a key family: each UK character once, plus Space, Enter, Tab, Shift', () => {
    expect(moduleHasHighlightTargets(SCOPE)).toBe(true)
    const ids = listHighlightTargets(SCOPE).map((target) => target.id)
    for (const id of ['key:(', 'key:"', 'key:£', 'key:#', 'key:9', 'key:a', 'key:Shift']) {
      expect(ids).toContain(id)
    }
    expect(ids).not.toContain('key:A')
    expect(resolveHighlightTarget(SCOPE, 'key:A')?.id).toBe('key:a')
    expect(resolveHighlightTarget(SCOPE, 'key:enter')?.id).toBe('key:Enter')
    expect(highlightTargetText(resolveHighlightTarget(SCOPE, 'key:('))).toBe('open bracket key')
    expect(resolveHighlightTarget(SCOPE, 'run')).toBeNull()
    expect(describeHighlightTargets(SCOPE)).toContain('"key:<symbol>"')
  })

  it('leaves every other activity without targets', () => {
    const others = getActivityDefinitions().filter((def) => def.id !== 'keyboard')
    expect(others.every((def) => def.highlightTargets.length === 0)).toBe(true)
  })

  it('defineActivity defaults to none and rejects malformed targets', () => {
    const base = {
      id: 'demo',
      label: 'Demo',
      category: 'computing',
      defaultTask: () => ({}),
      validateTask: () => ({ errors: [], warnings: [] }),
      initialState: () => ({}),
      grade: () => ({ passed: false }),
    }
    expect(defineActivity(base).highlightTargets).toEqual([])
    expect(() =>
      defineActivity({ ...base, highlightTargets: [{ id: 'Bad Id', label: 'x' }] })
    ).toThrow(/defineActivity\(demo\)/)
  })
})

describe('validateTaskHighlight on activity tasks', () => {
  const run = (task) => {
    const errors = []
    validateTaskHighlight(task, { n: 1, moduleType: 'python', isModuleTask: false }, errors, [])
    return errors
  }

  it('accepts a Keyboard key and rejects anything else with a clear line', () => {
    expect(run({ ...KEYBOARD, highlight: 'key:(' })).toEqual([])
    expect(run({ ...KEYBOARD, highlight: 'key:Enter' })).toEqual([])
    expect(run({ ...KEYBOARD, highlight: 'key:Ctrl' })[0]).toMatch(
      /"key:Ctrl" is not a key the keyboard activity can light/
    )
    expect(run({ ...KEYBOARD, highlight: { key: '(' } })[0]).toBe(
      'Task 1 highlight must be one target in quotes, e.g. highlight: "key:("'
    )
  })

  it('says another activity has no highlight targets', () => {
    expect(run({ taskType: 'activity', activityType: 'binary', highlight: 'key:(' })).toEqual([
      'Task 1 highlight: the binary activity has no highlight targets',
    ])
  })

  it('keeps the code-task error for information tasks', () => {
    expect(run({ taskType: 'information', highlight: 'run' })[0]).toMatch(
      /only supported on code tasks/
    )
  })
})

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s lesson validation of a Keyboard highlight', (_name, validate) => {
  const lesson = (task) => ({
    id: 'kb',
    type: 'python',
    title: 'Keys',
    description: 'Keys',
    tasks: [{ id: 1, title: 'Find it', taskType: 'activity', activityType: 'keyboard', ...task }],
  })

  it('validates key:<key> and warns where laptops show no keyboard picture', () => {
    const ok = validate(
      lesson({ mode: 'symbols', items: [{ id: 'a', char: '(' }], highlight: 'key:(' })
    )
    expect(ok.errors.join('\n')).not.toMatch(/highlight/)
    const typing = validate(
      lesson({ mode: 'type_code', items: [{ id: 'a', code: 'print(1)' }], highlight: 'key:Enter' })
    )
    expect(typing.errors.join('\n')).not.toMatch(/highlight/)
    expect(typing.warnings.join('\n')).toMatch(/highlight only shows on the on-screen keyboard/)
    const bad = validate(
      lesson({ mode: 'symbols', items: [{ id: 'a', char: '(' }], highlight: 'run' })
    )
    expect(bad.errors.join('\n')).toMatch(/"run" is not a keyboard target/)
  })
})

describe('Keyboard picture marks its keys', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carries the data-highlight-target ids the highlight finds', () => {
    const { container } = render(<OnScreenKeyboard />)
    const key = (code) => container.querySelector(`[data-code="${code}"]`)
    expect(key('Digit9').getAttribute('data-highlight-target')).toBe('key:9 key:(')
    expect(key('KeyA').getAttribute('data-highlight-target')).toBe('key:a')
    expect(key('ShiftLeft').getAttribute('data-highlight-target')).toBe('key:Shift')
    expect(key('Enter').getAttribute('data-highlight-target')).toBe('key:Enter')
    expect(key('Backspace').hasAttribute('data-highlight-target')).toBe(false)
    key('Digit9').getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 50,
      bottom: 50,
      width: 40,
      height: 40,
    })
    expect(locateHighlight(document, resolveHighlightTarget(SCOPE, 'key:('))).toMatchObject({
      kind: 'target',
      el: key('Digit9'),
    })
  })
})

describe('lessons capabilities', () => {
  it('lists the Keyboard highlight targets and showKey, and no targets elsewhere', () => {
    const { activities } = buildCapabilities({ requests: [] })
    const kb = activities.find((activity) => activity.id === 'keyboard')
    expect(kb.highlightTargets[0]).toMatchObject({ id: 'key', example: '(' })
    expect(JSON.stringify(kb.fields)).toContain('showKey')
    expect(activities.find((activity) => activity.id === 'binary')).not.toHaveProperty(
      'highlightTargets'
    )
  })
})
