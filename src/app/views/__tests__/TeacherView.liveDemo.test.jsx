import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Dashboard Go Live demo: the editor is editable and edits reach updateTeacherLive.
// (harness copied from the sandboxWire test) // Plan step 4.6: the teacher sandbox (stage, edit, go live, push, reset, leave) goes through the
// module definitions' wire and lifecycle hooks. For every module this drives the real TeacherView
// and pins the Realtime Database writes (enterSandbox / pushSandboxCode / pushSandboxFiles
// arguments) to the values the per-type branches used to send, byte for byte.

const captured = {}

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}))
vi.mock('../../../shared/firebase', () => ({ firestore: {} }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 't1' }, role: 'teacher' }),
}))
vi.mock('../../../shared/topicLibrary', () => ({ useTopicLibrary: () => ({ topics: [] }) }))
// Class roster (Firestore listeners and the tutor-side saver) is covered by its own tests.
vi.mock('../../hooks/useClassRoster', () => ({
  useClassRoster: () => ({ roster: [], loading: false, error: null }),
  useClassList: () => [],
}))
vi.mock('../../hooks/useRosterWorkSaver', () => ({ useRosterWorkSaver: () => {} }))
vi.mock('../../hooks/useTypingHistory', () => ({ useTypingHistory: () => ({}) }))
vi.mock('../../../shared/roster/rosterService', () => ({
  addRosterEntry: vi.fn(),
  matchStudent: vi.fn(),
  setSessionClass: vi.fn(),
  unmatchStudent: vi.fn(),
}))

const sessionCommands = {}
let mockSession = null
vi.mock('../../hooks/usePeerHelp', async () => {
  const { peerHelpModuleMock } = await import('../../hooks/__tests__/peerHelpMock.js')
  return peerHelpModuleMock
})
vi.mock('../../hooks/useSession', () => ({
  useSession: () =>
    new Proxy(
      { session: mockSession, loading: false },
      {
        get(target, key) {
          if (key in target) return target[key]
          if (!sessionCommands[key]) sessionCommands[key] = vi.fn(async () => {})
          return sessionCommands[key]
        },
      }
    ),
}))

function capture(name) {
  return (props) => {
    captured[name] = props
    return null
  }
}
vi.mock('../teacher/TeacherEditorPanel', () => ({ default: capture('editor') }))
vi.mock('../../components/TaskNavigator', () => ({ default: capture('navigator') }))
vi.mock('../../components/TeacherSandboxBanner', () => ({ default: capture('sandboxBanner') }))
vi.mock('../../components/TopBar', () => ({ default: () => null }))
vi.mock('../../components/StudentGrid', () => ({ default: () => null }))
vi.mock('../../components/ExplainerPanel', () => ({ default: () => null }))
vi.mock('../../components/TeacherTimers', () => ({ default: () => null }))
vi.mock('../teacher/TaskRatingPanel', () => ({ default: () => null }))
vi.mock('../teacher/CheckConditionsPanel', () => ({ default: () => null }))

import { getDoc } from 'firebase/firestore'
import TeacherView from '../TeacherView'

const LESSON = {
  id: 'py-live',
  title: 'py',
  type: 'python',
  tasks: [{ id: 1, title: 'Task', starterCode: 'print("starter")' }],
}

let rerenderView = null
function setSession(next) {
  mockSession = next
  act(() => rerenderView())
}

beforeEach(() => {
  vi.useRealTimers()
  for (const key of Object.keys(captured)) delete captured[key]
  for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
  mockSession = { state: 'active', currentTaskId: 1, students: {} }
})

async function renderView() {
  getDoc.mockResolvedValue({ exists: () => true, data: () => LESSON })
  const { rerender } = render(<TeacherView lessonId={LESSON.id} />)
  rerenderView = () => rerender(<TeacherView lessonId={LESSON.id} />)
  await waitFor(() => expect(captured.editor?.task).toBeTruthy())
  await act(async () => {})
}

const LIVE = { active: true, source: 'teacher', publisher: 'dashboard', taskId: 1, layout: 'both' }

describe('TeacherView dashboard Go Live demo', () => {
  it('is read-only (no liveDemo) when not live', async () => {
    await renderView()
    expect(captured.editor.liveDemo).toBe(false)
    expect(captured.editor.onChange).toBeUndefined()
  })

  it('is editable while dashboard-live and publishes edits, then reloads the starter on stop', async () => {
    await renderView()
    setSession({ ...mockSession, teacherLive: LIVE })
    expect(captured.editor.liveDemo).toBe(true)
    expect(captured.editor.onChange).toBeTypeOf('function')

    vi.useFakeTimers()
    act(() => captured.editor.onChange('print("demo")'))
    expect(captured.editor.liveState).toBe('print("demo")')
    act(() => {
      vi.advanceTimersByTime(400)
    })
    vi.useRealTimers()
    const last = sessionCommands.updateTeacherLive.mock.calls.at(-1)[0]
    expect(last).toMatchObject({ publisher: 'dashboard', code: 'print("demo")' })

    setSession({ ...mockSession, teacherLive: null })
    await waitFor(() => expect(captured.editor.liveDemo).toBe(false))
    await waitFor(() => expect(captured.editor.liveState).toBe('print("starter")'))
  })

  it('is read-only while a pop-up Go Live is running', async () => {
    await renderView()
    setSession({ ...mockSession, teacherLive: { ...LIVE, publisher: 'presentation' } })
    expect(captured.editor.liveDemo).toBe(false)
  })
})
