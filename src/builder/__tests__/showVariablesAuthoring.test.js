// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatTargetLines,
  hasPredictionCheck,
  parseNameList,
  parseTargetLines,
  setPredictionCheck,
  setShowVariablesEnabled,
  updateShowVariables,
} from '../showVariablesAuthoring.js'

describe('showVariables authoring', () => {
  it('turns the panel on and off, dropping the prediction check with it', () => {
    const on = setShowVariablesEnabled({ id: 1 }, true)
    expect(on.showVariables).toEqual({ mode: 'view', at: 'end' })
    const predicting = setPredictionCheck(
      updateShowVariables(on, { mode: 'predict', predict: ['a'] }),
      true
    )
    expect(predicting.check).toEqual([{ type: 'variables_predicted', names: ['a'] }])
    const off = setShowVariablesEnabled(predicting, false)
    expect(off.showVariables).toBeUndefined()
    expect(off.check).toBeNull()
  })

  it('keeps the check names in step and drops fields the mode does not use', () => {
    let task = {
      id: 1,
      showVariables: { mode: 'predict', predict: ['a'] },
      check: [{ type: 'code', operator: 'contains', value: 'x' }],
    }
    task = setPredictionCheck(task, true)
    expect(hasPredictionCheck(task)).toBe(true)
    task = updateShowVariables(task, { predict: ['a', 'b'] })
    expect(task.check[1]).toEqual({ type: 'variables_predicted', names: ['a', 'b'] })
    task = updateShowVariables(task, { mode: 'target', target: { a: 1 }, hide: [] })
    expect(task.showVariables).toEqual({ mode: 'target', target: { a: 1 } })
    expect(task.check).toEqual([{ type: 'code', operator: 'contains', value: 'x' }])
  })

  it('stores visuals and stageLists only when they differ from the defaults', () => {
    let task = { id: 1, showVariables: { mode: 'view', at: 'end' } }
    task = updateShowVariables(task, { visuals: false })
    expect(task.showVariables).toEqual({ mode: 'view', at: 'end', visuals: false })
    task = updateShowVariables(task, { visuals: true, stageLists: 'picture' })
    expect(task.showVariables).toEqual({ mode: 'view', at: 'end', stageLists: 'picture' })
    task = updateShowVariables(task, { stageLists: 'size' })
    expect(task.showVariables).toEqual({ mode: 'view', at: 'end' })
  })

  it('parses name lists and target lines', () => {
    expect(parseNameList('score, lives  score\nbag')).toEqual(['score', 'lives', 'bag'])
    const target = parseTargetLines(
      'score = 10\nname = "Sam"\nbag = [\'key\', "map"]\nok = True\nraw = hello\n\nnoequals'
    )
    expect(target).toEqual({ score: 10, name: 'Sam', bag: ['key', 'map'], ok: true, raw: 'hello' })
    expect(parseTargetLines(formatTargetLines(target))).toEqual(target)
    expect(parseTargetLines('d = {"a": 1}')).toEqual({ d: { a: 1 } })
  })
})
