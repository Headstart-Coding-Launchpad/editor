import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../../components/TopBar', () => ({
  default: ({ right }) => <header data-testid="top-bar">{right}</header>,
}))
vi.mock('../../components/TeacherSessionControls', () => ({ default: () => null }))
vi.mock('../../components/student-modal/PaneFocusDropdown', () => ({ default: () => null }))
vi.mock('../../components/StudentGrid', () => ({ default: () => null }))
vi.mock('../../components/ExplainerPanel', () => ({
  default: ({ title }) => <span data-testid="explainer">{title}</span>,
}))
vi.mock('../../components/TeacherTimers', () => ({ default: () => null }))
vi.mock('../teacher/TaskRatingPanel', () => ({
  default: (props) => {
    captured.rating = props
    return <span data-testid="task-rating" />
  },
}))
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

describe('TeacherView task slide', () => {
  beforeEach(() => {
    for (const key of Object.keys(captured)) delete captured[key]
    for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
    mockSession = { state: 'active', currentTaskId: 1, students: {} }
  })

  function explainerLesson() {
    const task = (id, title) => ({
      id,
      moduleType: 'turtle',
      title,
      explainer: `About ${title}`,
      starterCode: '',
      codeStages: [{ label: 'Starter', role: 'starter', code: '' }],
    })
    return {
      id: 'explainer-lesson',
      title: 'Explainers',
      type: 'composed',
      tasks: [task(1, 'One'), task(2, 'Two'), task(3, 'Three')],
    }
  }

  function enteringPanel() {
    return screen
      .getAllByTestId('explainer')
      .map((node) => node.closest('.task-slide-panel'))
      .find((panel) => panel.classList.contains('task-slide-panel--entering'))
  }

  it('slides the explainer forward to a later task and back to an earlier one', async () => {
    await renderTeacherView(explainerLesson())
    expect(enteringPanel()).toHaveTextContent('One')

    act(() => captured.navigator.onTaskSelect(3))
    await waitFor(() => expect(enteringPanel()).toHaveTextContent('Three'))
    expect(enteringPanel()).toHaveClass('task-slide-panel--forward')

    act(() => captured.navigator.onTaskSelect(2))
    await waitFor(() => expect(enteringPanel()).toHaveTextContent('Two'))
    expect(enteringPanel()).toHaveClass('task-slide-panel--backward')
  })
})

describe('TeacherView task rating', () => {
  beforeEach(() => {
    for (const key of Object.keys(captured)) delete captured[key]
    for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
    mockSession = {
      state: 'active',
      currentTaskId: 1,
      students: {},
      taskRatingLog: { 1: { rating: 4, whatWorkedWell: '', whatDidntWork: '' } },
    }
  })

  // The rating used to be an inline panel in <main> that squeezed or clipped the
  // task workspace; it now lives in the top bar and opens as a popover.
  it('renders the rating control in the top bar, not inside the centre column', async () => {
    await renderTeacherView(turtleLesson())

    const rating = screen.getByTestId('task-rating')
    expect(screen.getByTestId('top-bar').contains(rating)).toBe(true)
    expect(screen.getByRole('main').contains(rating)).toBe(false)
    expect(captured.rating.taskId).toBe(1)
    expect(captured.rating.existingRating).toEqual({
      rating: 4,
      whatWorkedWell: '',
      whatDidntWork: '',
    })
    expect(captured.rating.onSave).toBe(sessionCommands.setTaskRating)
  })

  it('hides the rating control in the sandbox', async () => {
    await renderTeacherView(turtleLesson())

    act(() => captured.navigator.onSandbox())
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    expect(screen.queryByTestId('task-rating')).not.toBeInTheDocument()
  })
})
