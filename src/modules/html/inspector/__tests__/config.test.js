import { describe, expect, it } from 'vitest'
import { getInspectorConfig, getInspectorProperty, normalizeInspectorLiveState } from '../config'
import { selectorPathFor, resolveSelector } from '../selectorPath'
import { inspectorReportFields, summarizeInspectorUse } from '../../../../shared/inspectorUse'
import { getModuleDefinition } from '../../../definitions'

describe('getInspectorConfig', () => {
  it('is off unless enabled is true', () => {
    expect(getInspectorConfig({})).toBe(null)
    expect(getInspectorConfig({ inspector: { open: true } })).toBe(null)
    expect(getInspectorConfig({ inspector: { enabled: 'yes' } })).toBe(null)
  })

  it('fills in defaults and keeps known sections in order', () => {
    expect(getInspectorConfig({ inspector: { enabled: true } })).toEqual({
      enabled: true,
      open: false,
      focus: null,
      show: ['box', 'cascade', 'layout'],
    })
    expect(
      getInspectorConfig({
        inspector: { enabled: true, open: true, focus: ' .card p ', show: ['cascade', 'x', 'box'] },
      })
    ).toEqual({ enabled: true, open: true, focus: '.card p', show: ['cascade', 'box'] })
  })

  it('falls back to text colour for an unknown property', () => {
    expect(getInspectorProperty('nope').key).toBe('color')
    expect(getInspectorProperty('margin').longhands).toHaveLength(4)
  })
})

describe('normalizeInspectorLiveState', () => {
  it('keeps on, selector and a known property, and is null when nothing is showing', () => {
    expect(
      normalizeInspectorLiveState({ on: true, selector: 'body > p', property: 'color' })
    ).toEqual({ on: true, selector: 'body > p', property: 'color' })
    expect(normalizeInspectorLiveState({ on: false, selector: null })).toBe(null)
    expect(normalizeInspectorLiveState(null)).toBe(null)
    expect(normalizeInspectorLiveState({ on: true, property: 'evil' })).toEqual({
      on: true,
      selector: null,
      property: null,
    })
  })
})

describe('selectorPathFor', () => {
  it('builds a path that finds the same element again', () => {
    document.body.innerHTML =
      '<div><p>a</p><p>b</p></div><section id="only"><span>x</span></section>'
    const second = document.querySelectorAll('p')[1]
    const path = selectorPathFor(second)
    expect(path).toBe('body > div:nth-of-type(1) > p:nth-of-type(2)')
    expect(resolveSelector(document, path)).toBe(second)
    expect(selectorPathFor(document.querySelector('span'))).toBe('#only > span:nth-of-type(1)')
    expect(resolveSelector(document, '((bad')).toBe(null)
    document.body.innerHTML = ''
  })
})

describe('inspector report fields', () => {
  it('reports use only when the student opened or chose something', () => {
    expect(inspectorReportFields(null)).toBe(null)
    expect(inspectorReportFields({ opens: 0, selects: 0, lastAt: 1 })).toBe(null)
    expect(inspectorReportFields({ opens: 2, selects: 5, lastAt: 1 })).toEqual({
      used: true,
      opens: 2,
      selects: 5,
    })
    expect(summarizeInspectorUse([{ inspector: { used: true } }, {}])).toEqual({
      inspectorUsedCount: 1,
    })
    expect(summarizeInspectorUse([{}])).toEqual({})
  })
})

describe('html validateTask: inspector', () => {
  const validate = (inspector, extra = {}) => {
    const errors = []
    const warnings = []
    getModuleDefinition('html').validateTask(
      {
        id: '1',
        starterFiles: [{ name: 'index.html', type: 'html', content: '<p></p>' }],
        inspector,
        ...extra,
      },
      { n: 1, errors, warnings }
    )
    return {
      errors: errors.filter((e) => e.includes('inspector')),
      warnings: warnings.filter((w) => w.includes('inspector')),
    }
  }

  it('accepts a full inspector field', () => {
    expect(
      validate({ enabled: true, open: true, focus: '.card p', show: ['box', 'cascade', 'layout'] })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('rejects bad shapes and warns about unknown fields or a disabled inspector', () => {
    expect(validate('yes').errors).toHaveLength(1)
    expect(validate({ enabled: true, show: ['boxes'] }).errors[0]).toContain('inspector.show')
    expect(validate({ enabled: true, open: 'yes' }).errors[0]).toContain('inspector.open')
    expect(validate({ enabled: true, focus: '' }).errors[0]).toContain('inspector.focus')
    expect(validate({ enabled: true, colour: 'red' }).warnings[0]).toContain('unknown fields')
    expect(validate({ open: true }).warnings[0]).toContain('not enabled')
    expect(validate({ enabled: true }, { interactionMode: 'submit' }).warnings[0]).toContain(
      'submit-mode'
    )
  })
})
