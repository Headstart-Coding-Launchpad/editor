import { describe, expect, it } from 'vitest'
import {
  MAX_VARIABLE_LINKS,
  VARIABLE_LINK_COLOURS,
  getVariableLinks,
  linkFor,
  variableLinksKey,
} from '../links.js'
import { getShowVariables } from '../variablesPanel.js'

const int = (v) => ({ t: 'int', v })
const runOf = (names) => ({
  taskId: 1,
  status: 'success',
  at: 'end',
  snapshots: [{ vars: names.map((n) => ({ n, v: int(1) })), scope: null }],
  index: 0,
  changed: [],
})
const configOf = (showVariables) => getShowVariables({ showVariables })

describe('getVariableLinks', () => {
  it('links predict names before any run, each with a colour and a number', () => {
    const links = getVariableLinks(configOf({ mode: 'predict', predict: ['small', 'city'] }))
    expect(links).toEqual([
      { name: 'small', number: 1, colour: VARIABLE_LINK_COLOURS[0] },
      { name: 'city', number: 2, colour: VARIABLE_LINK_COLOURS[1] },
    ])
  })

  it("adds the run's other variables after the featured ones, skipping hidden names", () => {
    const config = configOf({ mode: 'predict', predict: ['small'], hide: ['secret'] })
    const links = getVariableLinks(config, runOf(['city', 'small', 'secret']))
    expect(links.map((link) => link.name)).toEqual(['small', 'city'])
  })

  it('links target names, and view-mode tags only after a run', () => {
    expect(
      getVariableLinks(configOf({ mode: 'target', target: { score: 10 } })).map((l) => l.name)
    ).toEqual(['score'])
    expect(getVariableLinks(configOf({ mode: 'view' }))).toEqual([])
    expect(getVariableLinks(configOf({ mode: 'view' }), runOf(['a', 'b']))).toHaveLength(2)
  })

  it('links at most six tags', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const links = getVariableLinks(configOf({ mode: 'view' }), runOf(names))
    expect(links).toHaveLength(MAX_VARIABLE_LINKS)
    expect(links.at(-1)).toMatchObject({ name: 'f', number: 6 })
  })

  it('is off with link: false or without a panel', () => {
    expect(getVariableLinks(configOf({ mode: 'predict', predict: ['a'], link: false }))).toEqual([])
    expect(getVariableLinks(null)).toEqual([])
  })

  it('finds a link by name and keys a list by its names', () => {
    const links = getVariableLinks(configOf({ mode: 'predict', predict: ['a', 'b'] }))
    expect(linkFor(links, 'b')?.number).toBe(2)
    expect(linkFor(links, 'zz')).toBeNull()
    expect(variableLinksKey(links)).toBe('a,b')
  })
})
