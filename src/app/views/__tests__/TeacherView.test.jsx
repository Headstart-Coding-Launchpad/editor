import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const sessionCommands = {}
let mockSession = null
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

function turtleLesson() {
  return {
    id: 'turtle-lesson',
    title: 'Turtle',
    type: 'composed',
    sandboxStarter: 'turtle.circle(20)',
    tasks: [
      {
        id: 1,
        moduleType: 'turtle',
        title: 'Square',
        starterCode: 'turtle.forward(10)',
        codeStages: [{ label: 'Starter', role: 'starter', code: 'turtle.forward(10)' }],
      },
    ],
  }
}

async function renderTeacherView(lesson) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => lesson })
  render(<TeacherView lessonId={lesson.id} />)
  await waitFor(() => expect(captured.editor?.task).toBeTruthy())
}

describe('TeacherView with a Python Turtle task', () => {
  beforeEach(() => {
    for (const key of Object.keys(captured)) delete captured[key]
    for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
    mockSession = { state: 'active', currentTaskId: 1, students: {} }
  })

  it('shows the turtle starter code as a string, not an HTML files object', async () => {
    await renderTeacherView(turtleLesson())
    // The starter code loads in an effect after the task is set, so wait for it.
    await waitFor(() => expect(captured.editor.liveState).toBe('turtle.forward(10)'))
  })

  it('stages, launches and pushes a turtle sandbox as code', async () => {
    await renderTeacherView(turtleLesson())

    act(() => captured.navigator.onSandbox())
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    expect(captured.editor.liveState).toBe('turtle.circle(20)')

    act(() => captured.editor.onChange('turtle.left(90)'))
    await waitFor(() => expect(captured.editor.liveState).toBe('turtle.left(90)'))

    await act(async () => captured.sandboxBanner.onGoLive())
    expect(sessionCommands.enterSandbox).toHaveBeenCalledWith({
      code: 'turtle.left(90)',
      previousTaskId: 1,
    })

    await act(async () => captured.sandboxBanner.onPush())
    expect(sessionCommands.pushSandboxCode).toHaveBeenCalledWith('turtle.left(90)')
    expect(sessionCommands.pushSandboxFiles).not.toHaveBeenCalled()
  })
})
