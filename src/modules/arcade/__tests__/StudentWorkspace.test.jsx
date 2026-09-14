import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

vi.mock('../../python/PythonEditor', () => ({
  default: () => <div>python-editor</div>,
}))
vi.mock('../ArcadePreview', () => ({
  default: () => <div>arcade-preview</div>,
}))
vi.mock('../ArcadeDesignStudio', () => ({
  default: () => <div>arcade-design-studio</div>,
}))
vi.mock('../../../shared/AssetBrowser', () => ({
  default: ({ storageAssets }) => (
    <div>asset-browser:{storageAssets.map((a) => a.name).join(',')}</div>
  ),
}))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({
    storageAssets: [
      { name: 'shown.png', url: 'https://storage.test/shown.png', showInEditor: true },
      { name: 'hidden.png', url: 'https://storage.test/hidden.png', showInEditor: false },
      { name: 'legacy.png', url: 'https://storage.test/legacy.png' },
    ],
  }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({
    typeStorageAssets: [
      {
        name: 'shared-shown.png',
        url: 'https://storage.test/shared-shown.png',
        showInEditor: true,
      },
      {
        name: 'shared-hidden.png',
        url: 'https://storage.test/shared-hidden.png',
        showInEditor: false,
      },
    ],
  }),
}))

const lesson = { id: 'lesson-1', tasks: [], storageAssets: [] }
const cs = {
  code: '',
  arcadeDesign: {},
  handleCodeChange: vi.fn(),
  handleResetCode: vi.fn(),
  handleArcadeDesignChange: vi.fn(),
  readSavedTaskCode: vi.fn(),
}

describe('Arcade StudentWorkspace asset filtering', () => {
  it('only lists lesson and shared storage assets flagged for the web editor', () => {
    render(
      <StudentWorkspace
        task={{}}
        lessonId="lesson-1"
        lesson={lesson}
        cs={cs}
        isMobile={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
        displayCode=""
        displayArcadeDesign={null}
        teacherLiveCode=""
        teacherLiveArcadeDesign={null}
        teacherLiveWorkspace="code"
      />
    )

    const assetBrowserText = screen.getByText(/^asset-browser:/).textContent
    expect(assetBrowserText).toContain('shown.png')
    expect(assetBrowserText).toContain('shared-shown.png')
    expect(assetBrowserText).toBe('asset-browser:shown.png,shared-shown.png')
  })
})

describe('Arcade StudentWorkspace onVisiblePanesChange reporting (teacher live-status badge)', () => {
  it('reports the active workspace tab, and adds "running" while the game is running', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{ arcadeTools: 'both' }}
        lessonId="lesson-1"
        lesson={lesson}
        cs={cs}
        isMobile={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
        displayCode=""
        displayArcadeDesign={null}
        teacherLiveCode=""
        teacherLiveArcadeDesign={null}
        teacherLiveWorkspace="code"
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])

    fireEvent.click(screen.getByText('Sprites'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['sprites'])

    fireEvent.click(screen.getByText('Code'))
    fireEvent.click(screen.getByText('Run game'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'running'])

    fireEvent.click(screen.getByText('Stop'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })
})

describe('Arcade StudentWorkspace copy code panel', () => {
  const copyTask = { arcadeTools: 'both', copyCode: 'player = Sprite("cat")' }

  function renderWorkspace(props = {}) {
    return render(
      <StudentWorkspace
        task={copyTask}
        lessonId="lesson-1"
        lesson={lesson}
        cs={cs}
        isMobile={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
        {...props}
      />
    )
  }

  it('shows the reference code on the Code tab only', () => {
    renderWorkspace()

    expect(screen.getByLabelText('Python reference code')).toHaveTextContent(
      'player = Sprite("cat")'
    )

    fireEvent.click(screen.getByText('Sprites'))
    expect(screen.queryByLabelText('Python reference code')).toBeNull()

    fireEvent.click(screen.getByText('Code'))
    expect(screen.getByLabelText('Python reference code')).toBeInTheDocument()
  })

  it('still shows the reference code in read-only states', () => {
    renderWorkspace({ isForcedTeacherLive: true, displayCode: '' })
    expect(screen.getByLabelText('Python reference code')).toBeInTheDocument()
  })

  it('hides the reference code in the sandbox, personal sandbox, or when blank', () => {
    const { unmount } = renderWorkspace({ isSandbox: true })
    expect(screen.queryByLabelText('Python reference code')).toBeNull()
    unmount()

    const personal = renderWorkspace({ cs: { ...cs, inPersonalSandbox: true } })
    expect(screen.queryByLabelText('Python reference code')).toBeNull()
    personal.unmount()

    renderWorkspace({ task: { copyCode: '   ' } })
    expect(screen.queryByLabelText('Python reference code')).toBeNull()
  })
})

describe('Arcade StudentWorkspace code checks', () => {
  it('evaluates the task checks against the code each time Run game is pressed', () => {
    const handleArcadeRun = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        lessonId="lesson-1"
        lesson={lesson}
        cs={{ ...cs, code: 'game.run()', handleArcadeRun }}
        isMobile={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
      />
    )

    fireEvent.click(screen.getByText('Run game'))
    expect(handleArcadeRun).toHaveBeenCalledWith('game.run()')
  })
})
