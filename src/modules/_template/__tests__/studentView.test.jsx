import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getModuleDefinition } from '../../definitions.js'

// Real click-through: renders the real StudentView → LessonTaskContent → module StudentWorkspace
// → useStudentCodeState chain for a Template Module lesson, mocking only Firebase-backed hooks.
// Unit tests of a workspace can pass while the real classroom crashes on the first click (a new
// module falling into another module's branch); this catches that. It also covers the "no
// per-keystroke Firebase write unless watched" rule. (Skipped inside src/modules/_template, which
// is never registered; src/app/views/__tests__/StudentViewModules.test.jsx holds the registry-wide
// entry the generator added.)
// TODO(new-module): drive the real controls, and for a 'runtime' module click Run then Stop.

const mocks = vi.hoisted(() => ({ session: null, identity: null }))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: vi.fn(() => Promise.resolve(null)),
  findSoloCompanion: vi.fn(() => Promise.resolve(null)),
  applyLessonOverride: (lesson, overrideTasks) =>
    overrideTasks ? { ...lesson, tasks: overrideTasks } : lesson,
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({
    storageAssets: [],
    folderAssets: [],
    loading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({
    typeStorageAssets: [],
    defaultSprites: [],
    defaultBackdrops: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../../../app/hooks/useSession', () => ({ useSession: () => mocks.session }))
vi.mock('../../../app/hooks/useIdentity', () => ({ useIdentity: () => mocks.identity }))

// A live session on task `currentTaskId`. Every writer useSession exposes is a spy.
function makeSession(lessonId, currentTaskId = 1) {
  const writers = new Map()
  const values = {
    session: {
      lessonId,
      state: 'active',
      createdAt: 456,
      currentTaskId,
      students: { 'student-1': { displayName: 'Sam' } },
    },
    loading: false,
    connected: true,
  }
  return new Proxy(values, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!writers.has(prop))
        writers.set(
          prop,
          vi.fn(() => Promise.resolve())
        )
      return writers.get(prop)
    },
  })
}

const LESSON = {
  id: 'template-module-click',
  title: 'Template Module click-through',
  type: 'template_module',
  tasks: [
    {
      id: 1,
      title: 'Write hello',
      starterCode: 'say ',
      check: { type: 'code_contains', value: 'hello' },
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  mocks.session = makeSession(LESSON.id)
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
})

describe.skipIf(!getModuleDefinition('template_module'))(
  'Template Module StudentView click-through',
  () => {
    it('loads the starter, saves edits locally and reports a passing Check', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      const editor = await screen.findByLabelText('Your work')
      await waitFor(() => expect(editor).toHaveValue('say '))
      await user.type(editor, 'hello')
      // Typing is never mirrored to Firebase while the teacher isn't watching this student.
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Check' }))
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
          code: 'say hello',
          output: '',
          status: 'success',
          checkPassed: true,
        })
      )
      expect(JSON.parse(localStorage.getItem(`headstart_${LESSON.id}_1_student-1`))).toMatchObject({
        code: 'say hello',
      })
    })
  }
)
