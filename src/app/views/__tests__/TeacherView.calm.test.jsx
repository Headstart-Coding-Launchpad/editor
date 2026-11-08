import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 20_000 })

// The calm teacher view (sketch v2, 8 Nov 2026): what the tutor can do from the control desk.

const captured = {}

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  collection: vi.fn(() => ({})),
}))
vi.mock('../../../shared/firebase', () => ({ firestore: {} }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 't1' }, role: 'teacher' }),
}))
vi.mock('../../../shared/topicLibrary', () => ({ useTopicLibrary: () => ({ topics: [] }) }))
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
      { session: mockSession, loading: false, serverTimeOffset: 0 },
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
vi.mock('../../components/StudentGrid', () => ({ default: capture('grid') }))
vi.mock('../../components/ExplainerPanel', () => ({ default: () => null }))
vi.mock('../../components/TeacherTimers', () => ({ default: () => null }))
vi.mock('../teacher/CheckConditionsPanel', () => ({ default: () => null }))

import { getDoc } from 'firebase/firestore'
import TeacherView from '../TeacherView'

function lesson() {
  const task = (id, title, extra = {}) => ({
    id,
    moduleType: 'turtle',
    title,
    starterCode: '',
    codeStages: [{ label: 'Starter', role: 'starter', code: '' }],
    ...extra,
  })
  return {
    id: 'calm-lesson',
    title: 'Calm lesson',
    type: 'composed',
    tasks: [
      task(1, 'One'),
      task(2, 'Two'),
      task(3, 'Bonus', { priority: 'optional' }),
      task(4, 'Four'),
    ],
  }
}

async function renderTeacherView(l = lesson()) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => l })
  render(<TeacherView lessonId={l.id} />)
  await waitFor(() => expect(captured.editor?.task).toBeTruthy())
}

function endedCountdown() {
  const now = Date.now()
  return { startedAt: now - 120_000, endsAt: now - 1000, durationMs: 119_000 }
}

function reset(session) {
  for (const key of Object.keys(captured)) delete captured[key]
  for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
  mockSession = session
}

describe('TeacherView countdown ended', () => {
  beforeEach(() =>
    reset({ state: 'active', currentTaskId: 2, students: {}, classCountdown: endedCountdown() })
  )

  it('offers +1 min, Clear and Next task under the top bar, and nothing moves by itself', async () => {
    await renderTeacherView()
    const strip = await screen.findByTestId('countdown-ended-strip')
    expect(strip).toHaveTextContent('Time’s up')
    expect(sessionCommands.setTaskId).not.toHaveBeenCalled()
    expect(sessionCommands.clearClassCountdown).not.toHaveBeenCalled()
  })

  it('Next task moves the class on and clears the countdown', async () => {
    await renderTeacherView()
    await act(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'Next task →' }))
    )
    expect(sessionCommands.setTaskId).toHaveBeenCalledWith(3)
    expect(sessionCommands.clearClassCountdown).toHaveBeenCalled()
  })

  it('Next task honours Skip optional tasks', async () => {
    mockSession = { ...mockSession, skipOptionalTasks: true }
    await renderTeacherView()
    await act(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'Next task →' }))
    )
    expect(sessionCommands.setTaskId).toHaveBeenCalledWith(4)
  })

  it('Clear keeps the class on its task; +1 min adds a minute', async () => {
    await renderTeacherView()
    await act(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'Clear: stay here' }))
    )
    expect(sessionCommands.clearClassCountdown).toHaveBeenCalled()
    expect(sessionCommands.setTaskId).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '+1 min' })))
    expect(sessionCommands.addClassCountdownTime).toHaveBeenCalledWith(60_000)
  })
})
