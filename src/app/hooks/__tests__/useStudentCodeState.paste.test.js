// Large pastes into the student's editor are flagged to the teacher (recordStudentPaste).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANON, actSync, renderStudentCodeState } from '../../../test/studentCodeStateHarness'
import { pythonLesson } from '../../../test/fixtures/studentCodeStateLessons'

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

const BIG = 'for i in range(10):\n    print(i)\nprint("done")'

describe('handleEditorPaste', () => {
  it('records a large paste against the current task', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEditorPaste(BIG))
    expect(h.writers.recordStudentPaste).toHaveBeenCalledWith(ANON, 't1', {
      chars: BIG.length,
      lines: 3,
    })
  })

  it('ignores short snippets and text copied from the student’s own editor', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEditorPaste('print(x)'))
    actSync(() => h.result.current.handleEditorCopy(BIG))
    actSync(() => h.result.current.handleEditorPaste(BIG))
    expect(h.writers.recordStudentPaste).not.toHaveBeenCalled()
  })

  it('does not record outside a live lesson', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', phase: 'solo' })
    actSync(() => h.result.current.handleEditorPaste(BIG))
    expect(h.writers.recordStudentPaste).not.toHaveBeenCalled()
  })
})
