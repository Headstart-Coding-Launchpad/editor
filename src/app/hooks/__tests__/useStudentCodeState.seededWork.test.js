import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useStudentCodeState } from '../useStudentCodeState'
import {
  NOOP_SESSION_WRITES,
  seedSharedWorkspace,
  shareViewerLessonId,
} from '../../components/SharedWorkspaceViewer'

// Platform request #76: opening a classmate's shared work showed the task's starter, because the
// hook's mount-time clear of the in-memory store ran before its task load and wiped what
// SharedWorkspaceViewer had seeded. keepSeededWork keeps it.

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [] }),
}))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  runPython: vi.fn(),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  isPyodideReady: () => true,
  getStopCount: () => 0,
  isPythonRunning: () => false,
}))

const VIEWER = { anonymousId: 'shared-workspace-viewer', displayName: 'Test Ben' }
const LESSON = {
  id: 'python-lesson',
  title: 'Posters',
  type: 'python',
  tasks: [{ id: 1, title: 'Make the poster yours', starterCode: 'print("starter")\n' }],
}

function renderViewerState({ keepSeededWork }) {
  const shareLessonId = shareViewerLessonId(`share-${keepSeededWork}`)
  seedSharedWorkspace({
    shareLessonId,
    taskId: 1,
    moduleType: 'python',
    snapshot: { taskId: 1, code: 'print("Ben and the Moon")\n' },
  })
  return renderHook(() =>
    useStudentCodeState({
      lessonId: shareLessonId,
      lesson: LESSON,
      currentTaskId: 1,
      viewingTaskId: null,
      phase: 'solo',
      effectiveIdentity: VIEWER,
      identity: VIEWER,
      session: null,
      connected: false,
      teacherPresentation: false,
      previewMode: true,
      keepSeededWork,
      ...NOOP_SESSION_WRITES,
    })
  )
}

describe('useStudentCodeState keepSeededWork', () => {
  it("loads the classmate's seeded work, not the starter", () => {
    const { result } = renderViewerState({ keepSeededWork: true })
    expect(result.current.code).toBe('print("Ben and the Moon")\n')
  })

  it('without it, a preview starts clean on the starter', () => {
    const { result } = renderViewerState({ keepSeededWork: false })
    expect(result.current.code).toBe('print("starter")\n')
  })
})
