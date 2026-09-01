import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'

const mocks = vi.hoisted(() => ({
  fetchLessonById: vi.fn(),
  useSession: vi.fn(),
  useIdentity: vi.fn(),
  scratchWorkspace: vi.fn(),
  buildIframeSrc: vi.fn(() => 'blob:preview'),
}))

vi.mock('../../../shared/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: (...args) => mocks.fetchLessonById(...args),
  applyLessonOverride: (lesson, overrideTasks) => (overrideTasks ? { ...lesson, tasks: overrideTasks } : lesson),
}))

vi.mock('../../hooks/useSession', () => ({
  useSession: (...args) => mocks.useSession(...args),
}))

vi.mock('../../hooks/useIdentity', () => ({
  useIdentity: (...args) => mocks.useIdentity(...args),
}))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  runPython: vi.fn(),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  isPyodideReady: () => true,
}))

vi.mock('../../../modules/html/iframe', () => ({
  buildIframeSrc: (...args) => mocks.buildIframeSrc(...args),
  waitForIframeText: vi.fn(() => Promise.resolve('')),
}))

vi.mock('../../components/TopBar', () => ({
  default: ({ lessonTitle, isSolo, right }) => <div>{lessonTitle} {isSolo ? 'SOLO' : 'LIVE'}{right}</div>,
}))

vi.mock('../../../modules/python/PythonEditor', () => ({
  default: ({ code }) => <textarea aria-label="code" readOnly value={code} />,
}))

vi.mock('../../components/OutputPanel', () => ({
  default: () => <div>Output</div>,
}))

vi.mock('../../components/TaskProgressDots', () => ({
  default: ({ tasks, onDotClick }) => (
    <div>
      {tasks.map(task => <button key={task.id} type="button" onClick={() => onDotClick(task.id)}>{task.title}</button>)}
    </div>
  ),
}))

vi.mock('../../components/ExplainerPanel', () => ({
  default: ({ task }) => <div>{task?.title}</div>,
}))

vi.mock('../../components/TaskSlideTransition', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../../components/LoadingScreen', () => ({
  default: ({ message }) => <div>{message}</div>,
}))

vi.mock('../../components/NameEntry', () => ({
  default: () => <div>Name entry</div>,
}))

vi.mock('../../components/WaitingRoom', () => ({
  default: ({ lessonTitle }) => <div>Waiting for {lessonTitle}</div>,
}))

vi.mock('../../components/InformationTask', () => ({
  default: () => <div>Information</div>,
}))

vi.mock('../../../modules/html/HtmlEditor', () => ({
  default: ({ files = [] }) => <output data-testid="html-files">{files.map(file => file.content).join('\n')}</output>,
}))

vi.mock('../../components/CollapsibleIframePreview', () => ({
  default: () => <div>Preview</div>,
}))

vi.mock('../../../modules/scratch/ScratchWorkspace', () => ({
  default: props => {
    mocks.scratchWorkspace(props)
    return <div>Scratch</div>
  },
  SPRITE_TYPES: ['cat', 'ball', 'star', 'arrow', 'bat', 'parrot'],
  // Real values (not mocked) — LessonTaskContent.jsx imports these directly to keep its
  // own Instructions/Code threshold in lockstep with ScratchWorkspace's compact detection.
  NARROW_BREAKPOINT: 1000,
  NARROW_BREAKPOINT_HEIGHT: 600,
}))

vi.mock('../../components/QuizTask', () => ({
  default: () => <div>Quiz</div>,
}))

vi.mock('../../../modules/filesystem/FilesystemTask', () => ({
  default: () => <div>Filesystem</div>,
}))

vi.mock('../../components/CheckFeedbackBanner', () => ({
  default: () => <div>Feedback</div>,
}))

vi.mock('../../components/LiveActivityToast', () => ({
  default: () => <div>Activity</div>,
}))

vi.mock('../../../shared/SplitPane', () => ({
  default: ({ left, right }) => <div>{left}{right}</div>,
}))

vi.mock('../../components/StudentEditorHeader', () => ({
  default: () => <div>Editor header</div>,
}))

describe('StudentView', () => {
  beforeEach(() => {
    mocks.scratchWorkspace.mockClear()
    mocks.buildIframeSrc.mockClear()
    mocks.fetchLessonById.mockResolvedValue({
      id: 'python-1-1',
      title: 'Python 1.1',
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'First task',
          starterCode: 'print("hi")',
        },
      ],
    })
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'python-1-1',
        state: 'waiting',
        createdAt: 123,
        currentTaskId: 1,
      },
      loading: false,
      registerPresence: vi.fn(),
      joinSession: vi.fn(),
      writeStudentRun: vi.fn(),
      writeStudentCode: vi.fn(),
      writeStudentFiles: vi.fn(),
      writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(),
      writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(),
      setTeacherLive: vi.fn(),
      updateTeacherLive: vi.fn(),
      removeStudent: vi.fn(),
    })
    mocks.useIdentity.mockReturnValue({
      identity: {
        anonymousId: 'student-1',
        displayName: 'Solo',
        lastSessionTimestamp: 456,
      },
      loaded: true,
      createIdentity: vi.fn(),
      updateTimestamp: vi.fn(),
      updateDisplayName: vi.fn(),
    })
  })

  it('loads solo mode when a waiting live session exists for the lesson', async () => {
    render(<StudentView lessonId="python-1-1" forceSolo />)

    await waitFor(() => {
      expect(screen.getByText(/Python 1\.1 SOLO/)).toBeInTheDocument()
    })
    expect(mocks.useSession).toHaveBeenCalledWith(null, { enabled: false })
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('lets solo students move to the next task before passing the current check', async () => {
    const user = userEvent.setup()

    render(
      <StudentView
        lessonId="python-1-1"
        forceSolo
        lesson={{
          id: 'python-1-1',
          title: 'Python 1.1',
          type: 'python',
          tasks: [
            {
              id: 1,
              title: 'Checked task',
              starterCode: 'print("try")',
              check: { type: 'output', operator: 'contains', value: 'done' },
            },
            {
              id: 2,
              title: 'Next task',
              starterCode: 'print("next")',
            },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('code')).toHaveValue('print("try")')
    })

    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(nextButton).toBeEnabled()
    expect(nextButton).not.toHaveClass('btn-next-success')

    await user.click(nextButton)

    await waitFor(() => {
      expect(screen.getByLabelText('code')).toHaveValue('print("next")')
    })
  })

  it('passes predefined Scratch blocks to the student workspace', async () => {
    const predefinedBlocks = [
      {
        id: 'move-50',
        type: 'motion_movesteps',
        inputs: { STEPS: 50 },
      },
    ]
    const prebuiltStacks = [
      {
        id: 'stack-1',
        label: 'Move',
        stack: { type: 'motion_movesteps' },
      },
    ]

    render(
      <StudentView
        lessonId="scratch-1-1"
        forceSolo
        lesson={{
          id: 'scratch-1-1',
          title: 'Scratch 1.1',
          type: 'scratch',
          tasks: [
            {
              id: 1,
              title: 'Move',
              starterBlocks: null,
              predefinedBlocks,
              prebuiltStacks,
            },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(mocks.scratchWorkspace).toHaveBeenCalled()
    })

    const latestProps = mocks.scratchWorkspace.mock.calls.at(-1)[0]
    expect(latestProps.predefinedBlocks).toEqual(predefinedBlocks)
    expect(latestProps.prebuiltStacks).toEqual(prebuiltStacks)
    expect(latestProps.respectStudentEditable).toBe(true)
  })

  it('shows the saved workspace when viewing a previous task in another composed module', async () => {
    const user = userEvent.setup()
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'composed-1',
        state: 'active',
        createdAt: 456,
        currentTaskId: 2,
        students: {},
      },
      loading: false,
      registerPresence: vi.fn(), joinSession: vi.fn(),
      writeStudentRun: vi.fn(), writeStudentCode: vi.fn(), writeStudentFiles: vi.fn(), writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(), writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(), setTeacherLive: vi.fn(), updateTeacherLive: vi.fn(), removeStudent: vi.fn(),
    })
    localStorage.setItem('headstart_composed-1_1_index.html_student-1', JSON.stringify({ content: '<h1>Saved HTML</h1>' }))

    render(
      <StudentView
        lessonId="composed-1"
        lesson={{
          id: 'composed-1', title: 'Composed', type: 'composed',
          tasks: [
            { id: 1, title: 'HTML task', moduleType: 'html', starterFiles: [{ name: 'index.html', type: 'html', content: '<h1>Starter HTML</h1>' }] },
            { id: 2, title: 'Python task', moduleType: 'python', starterCode: 'print("current")' },
          ],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("current")'))
    await user.click(screen.getByRole('button', { name: 'HTML task' }))

    await waitFor(() => expect(screen.getByTestId('html-files')).toHaveTextContent('<h1>Saved HTML</h1>'))
  })

  it('builds the HTML preview when teacher live switches composed modules', async () => {
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'composed-live', state: 'active', createdAt: 456, currentTaskId: 1, students: {},
        teacherLive: {
          active: true, source: 'teacher', taskId: 2, updatedAt: 789,
          files: { 'index.html': '<h1>Teacher live</h1>' }, activeFile: 'index.html',
        },
      },
      loading: false,
      registerPresence: vi.fn(), joinSession: vi.fn(),
      writeStudentRun: vi.fn(), writeStudentCode: vi.fn(), writeStudentFiles: vi.fn(), writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(), writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(), setTeacherLive: vi.fn(), updateTeacherLive: vi.fn(), removeStudent: vi.fn(),
    })

    render(
      <StudentView
        lessonId="composed-live"
        lesson={{
          id: 'composed-live', title: 'Composed live', type: 'composed',
          tasks: [
            { id: 1, title: 'Python task', moduleType: 'python', starterCode: 'print("current")' },
            { id: 2, title: 'HTML task', moduleType: 'html', starterFiles: [{ name: 'index.html', type: 'html', content: '<h1>Starter</h1>' }] },
          ],
        }}
      />
    )

    await waitFor(() => expect(screen.getByTestId('html-files')).toHaveTextContent('<h1>Teacher live</h1>'))
    expect(mocks.buildIframeSrc).toHaveBeenCalled()
  })

  describe('fullscreen request', () => {
    function mkLiveSession(sessionOverrides = {}, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: {},
          ...sessionOverrides,
        },
        loading: false,
        registerPresence: vi.fn(), joinSession: vi.fn(),
        writeStudentRun: vi.fn(), writeStudentCode: vi.fn(), writeStudentFiles: vi.fn(), writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(), writeStudentPersonalSandbox: vi.fn(), writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(), setTeacherLive: vi.fn(), updateTeacherLive: vi.fn(), removeStudent: vi.fn(),
        ...hookOverrides,
      }
    }

    afterEach(() => {
      delete document.documentElement.requestFullscreen
      delete document.exitFullscreen
    })

    it('shows a fullscreen modal prompt when the teacher requests it', async () => {
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => {
        expect(screen.getByText('Your teacher would like you to go fullscreen')).toBeInTheDocument()
      })
    })

    it('calls requestFullscreen from the student\'s own click and dismisses the prompt', async () => {
      const user = userEvent.setup()
      const requestFullscreen = vi.fn().mockResolvedValue(undefined)
      document.documentElement.requestFullscreen = requestFullscreen
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)

      const goFullscreenBtn = await screen.findByRole('button', { name: 'Go Fullscreen' })
      await user.click(goFullscreenBtn)

      expect(requestFullscreen).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Your teacher would like you to go fullscreen')).not.toBeInTheDocument()
    })

    it('dismisses the prompt without requesting fullscreen when Not now is clicked', async () => {
      const user = userEvent.setup()
      const requestFullscreen = vi.fn().mockResolvedValue(undefined)
      document.documentElement.requestFullscreen = requestFullscreen
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)

      const notNowBtn = await screen.findByRole('button', { name: 'Not now' })
      await user.click(notNowBtn)

      expect(requestFullscreen).not.toHaveBeenCalled()
      expect(screen.queryByText('Your teacher would like you to go fullscreen')).not.toBeInTheDocument()
    })

    it('exits fullscreen automatically once the session ends', async () => {
      const exitFullscreen = vi.fn().mockResolvedValue(undefined)
      document.exitFullscreen = exitFullscreen
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body })

      mocks.useSession.mockReturnValue(mkLiveSession())
      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      mocks.useSession.mockReturnValue(mkLiveSession({ state: 'ended' }))
      rerender(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1))

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    })
  })
})
