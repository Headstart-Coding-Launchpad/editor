import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'

const mocks = vi.hoisted(() => ({
  fetchLessonById: vi.fn(),
  useSession: vi.fn(),
  useIdentity: vi.fn(),
  scratchWorkspace: vi.fn(),
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
  buildIframeSrc: vi.fn(() => 'blob:preview'),
  waitForIframeText: vi.fn(() => Promise.resolve('')),
}))

vi.mock('../../components/TopBar', () => ({
  default: ({ lessonTitle, isSolo }) => <div>{lessonTitle} {isSolo ? 'SOLO' : 'LIVE'}</div>,
}))

vi.mock('../../../modules/python/PythonEditor', () => ({
  default: ({ code }) => <textarea aria-label="code" readOnly value={code} />,
}))

vi.mock('../../components/OutputPanel', () => ({
  default: () => <div>Output</div>,
}))

vi.mock('../../components/TaskProgressDots', () => ({
  default: () => <div>Progress</div>,
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
  default: () => <div>HTML editor</div>,
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
    render(<StudentView lessonId="python-1-1" soloMode />)

    await waitFor(() => {
      expect(screen.getByText(/Python 1\.1 SOLO/)).toBeInTheDocument()
    })
    expect(mocks.useSession).toHaveBeenCalledWith(null, { enabled: false })
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
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
        soloMode
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
})
