// The teacher's per-student "every task" reference (students.{id}.autoRevealStage):
// the student's client re-applies it as each task loads.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANON, makeSession, renderStudentCodeState } from '../../../test/studentCodeStateHarness'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

afterEach(() => {
  vi.restoreAllMocks()
})

const lesson = () => ({
  id: 'lesson-1',
  type: 'python',
  title: 'python lesson',
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      starterCode: 'print("start")',
      codeStages: [
        { label: 'Hint A', role: 'support', code: '# a' },
        { label: 'Hint B', role: 'support', code: '# b' },
        { label: 'Done', role: 'complete', code: 'print("done")' },
      ],
    },
    {
      id: 't2',
      title: 'Task 2',
      starterCode: '# t2',
      codeStages: [{ label: 'Hint C', role: 'support', code: '# c' }],
    },
    { id: 't3', title: 'Info', taskType: 'information' },
  ],
})

function revealsFor(h, taskId) {
  return h.writers.recordSupportStageReveal.mock.calls
    .filter(([anon, id]) => anon === ANON && id === taskId)
    .map(([, , stageIndex, opts]) => ({ stageIndex, source: opts.source }))
}

describe('auto reveal ("every task" reference)', () => {
  it('first: opens the first hint on this task and again on the next task', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      session: makeSession({ student: { autoRevealStage: 'first' } }),
    })
    expect(revealsFor(h, 't1')).toEqual([{ stageIndex: 0, source: 'teacher-auto' }])
    expect(h.result.current.activeSupportStageIndex).toBe(0)
    expect(h.result.current.completePreviewShown).toBe(false)

    h.update({ currentTaskId: 't2' })
    expect(revealsFor(h, 't2')).toEqual([{ stageIndex: 0, source: 'teacher-auto' }])
    expect(h.result.current.activeSupportStageIndex).toBe(0)
  })

  it('support: opens every hint but never the solution', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()

    h.updateStudent({ autoRevealStage: 'support' })
    expect(revealsFor(h, 't1')).toEqual([
      { stageIndex: 0, source: 'teacher-auto' },
      { stageIndex: 1, source: 'teacher-auto' },
    ])
    expect(h.result.current.activeSupportStageIndex).toBe(1)
    expect(h.result.current.completePreviewShown).toBe(false)
  })

  it('solution: shows the complete stage, falling back to hints where there is none', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      session: makeSession({ student: { autoRevealStage: 'solution' } }),
    })
    expect(revealsFor(h, 't1')).toEqual([{ stageIndex: 2, source: 'teacher-auto' }])
    expect(h.result.current.completePreviewShown).toBe(true)

    h.update({ currentTaskId: 't2' })
    expect(revealsFor(h, 't2')).toEqual([{ stageIndex: 0, source: 'teacher-auto' }])
  })

  it('does nothing on information tasks, in solo mode, or once turned off', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't3',
      session: makeSession({ student: { autoRevealStage: 'first' } }),
    })
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()

    h.updateStudent({ autoRevealStage: null })
    h.update({ currentTaskId: 't1' })
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()

    const solo = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      phase: 'solo',
      session: makeSession({ student: { autoRevealStage: 'first' } }),
    })
    expect(solo.writers.recordSupportStageReveal).not.toHaveBeenCalled()
  })
})
