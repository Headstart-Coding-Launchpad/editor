// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { stripTaskLineHints } from '../../lineHints.js'
import {
  compactVariablesForSync,
  getPanelPeekLine,
  getPeekBand,
  panelRunForTask,
} from '../variablesPanel.js'

// The example task from the P6-17 request: the values just before `coins = coins * 2`.
const AUTHORED = {
  id: 74,
  moduleType: 'python',
  showVariables: { mode: 'predict', at: 'marker', predict: ['coins'] },
  codeStages: [
    { role: 'starter', code: 'coins = 10\ncoins = coins + 5\n#@peek\ncoins = coins * 2\n' },
  ],
}
const TASK = stripTaskLineHints(AUTHORED, 'python')
const CODE = TASK.codeStages[0].code

describe('getPanelPeekLine', () => {
  it('is the marked line as the student sees it, following their edits', () => {
    expect(CODE).toBe('coins = 10\ncoins = coins + 5\ncoins = coins * 2\n')
    expect(getPanelPeekLine(TASK, CODE)).toBe(3)
    expect(getPanelPeekLine(TASK, `# start\n\n${CODE}`)).toBe(5)
  })

  it('is null with at: end, without a panel, or when the line no longer anchors', () => {
    expect(getPanelPeekLine({ ...TASK, showVariables: { mode: 'view' } }, CODE)).toBeNull()
    expect(getPanelPeekLine({ ...TASK, showVariables: undefined }, CODE)).toBeNull()
    expect(getPanelPeekLine(TASK, 'coins = 10\nprint(coins)')).toBeNull()
    expect(getPanelPeekLine(null, CODE)).toBeNull()
  })
})

describe('getPeekBand', () => {
  it('shows before any run, so predict mode knows where to predict', () => {
    expect(getPeekBand(TASK, CODE)).toEqual({ line: 3, missed: false })
    expect(getPeekBand(TASK, CODE, null)).toEqual({ line: 3, missed: false })
  })

  it('says the program never reached the line after a run that missed it', () => {
    const reached = { taskId: 74, at: 'marker', peekReached: true }
    const missed = { taskId: 74, at: 'marker', peekReached: false }
    expect(getPeekBand(TASK, CODE, reached)).toEqual({ line: 3, missed: false })
    expect(getPeekBand(TASK, CODE, missed)).toEqual({ line: 3, missed: true })
  })

  it('is null for a task without a marker panel', () => {
    expect(getPeekBand({ ...TASK, showVariables: { at: 'end' } }, CODE)).toBeNull()
  })
})

describe('panelRunForTask', () => {
  const run = { taskId: 74, at: 'marker', peekReached: false, snapshots: [] }

  it("reads the student's own run for this task only", () => {
    expect(panelRunForTask(TASK, { panel: { run } })).toBe(run)
    expect(panelRunForTask(TASK, { panel: { run: { ...run, taskId: '74' } } })).toBeTruthy()
    expect(panelRunForTask(TASK, { panel: { run: { ...run, taskId: 9 } } })).toBeNull()
    expect(panelRunForTask(TASK, {})).toBeNull()
  })

  it('reads a synced copy (tutor views, Go Live) when one is given', () => {
    const synced = compactVariablesForSync(run)
    const back = panelRunForTask(TASK, { panel: { run: null }, synced })
    expect(back).toMatchObject({ taskId: 74, at: 'marker', peekReached: false })
    expect(getPeekBand(TASK, CODE, back)).toEqual({ line: 3, missed: true })
    expect(panelRunForTask(TASK, { synced: null })).toBeNull()
    expect(
      panelRunForTask(TASK, { synced: compactVariablesForSync({ ...run, taskId: 5 }) })
    ).toBeNull()
  })
})
