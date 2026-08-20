import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

vi.mock('../HtmlEditor', () => ({
  default: () => <div>html-editor</div>,
}))
vi.mock('../../../app/components/CollapsibleIframePreview', () => ({
  default: ({ collapsed, onToggle, src }) => (
    <button onClick={onToggle} data-src={src}>{collapsed ? 'show-preview' : 'hide-preview'}</button>
  ),
}))
vi.mock('../iframe', () => ({
  buildIframeSrc: vi.fn(() => 'PREV_TASK_SRC'),
}))
vi.mock('../../../app/studentTaskContent', () => ({
  selectHtmlTaskFiles: vi.fn(() => [{ name: 'index.html', content: '<p>prev task</p>' }]),
}))
vi.mock('../../../app/components/StudentEditorHeader', () => ({
  default: () => <div>editor-header</div>,
}))
vi.mock('../../../app/components/CopyCodePanel', () => ({
  default: () => <div>copy-code-panel</div>,
}))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [] }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))

const lesson = { id: 'lesson-1', tasks: [], storageAssets: [] }
const files = [{ name: 'index.html', content: '' }, { name: 'style.css', content: '' }]

function makeCs(overrides = {}) {
  return {
    iframeSrc: '', iframeRef: { current: null }, teacherLiveIframeSrc: '',
    htmlPreviewCollapsed: false, setHtmlPreviewCollapsed: vi.fn(),
    running: false, handleRun: vi.fn(), handleSubmit: vi.fn(), handleResetCode: vi.fn(),
    handleFileTabChange: vi.fn(), handleFileChange: vi.fn(), handleEditorSelection: vi.fn(),
    handleEditorActivity: vi.fn(), teacherHighlights: [], dismissHighlight: vi.fn(),
    htmlErrorLocation: null, inPersonalSandbox: false, handleHtmlRuntimeError: vi.fn(),
    readSavedTaskFile: vi.fn(),
    ...overrides,
  }
}

describe('HTML StudentWorkspace onVisiblePanesChange reporting (teacher live-status badge)', () => {
  it('reports the active file and adds "preview" while the preview pane is shown', () => {
    const onVisiblePanesChange = vi.fn()
    const cs = makeCs({ htmlPreviewCollapsed: false })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={{}}
        cs={cs}
        isSandbox={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile
        displayFiles={files}
        displayActiveFile="index.html"
        isTeacherEditing={false}
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['index.html', 'preview'])

    fireEvent.click(screen.getByText('hide-preview'))
    expect(cs.setHtmlPreviewCollapsed).toHaveBeenCalled()
  })

  it('drops "preview" once the preview pane is collapsed', () => {
    const onVisiblePanesChange = vi.fn()
    const cs = makeCs({ htmlPreviewCollapsed: true })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={{}}
        cs={cs}
        isSandbox={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile
        displayFiles={files}
        displayActiveFile="style.css"
        isTeacherEditing={false}
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['style.css'])
  })

  it('never reports "preview" for submit-mode tasks, since the preview pane never renders', () => {
    const onVisiblePanesChange = vi.fn()
    const cs = makeCs({ htmlPreviewCollapsed: false })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={{ interactionMode: 'submit' }}
        cs={cs}
        isSandbox={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile
        displayFiles={files}
        displayActiveFile="index.html"
        isTeacherEditing={false}
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['index.html'])
  })
})

describe('HTML StudentWorkspace collapsed preview source (desktop)', () => {
  it('shows the previous task\'s content, not the current task\'s, while collapsed and viewing a previous task', () => {
    const cs = makeCs({ htmlPreviewCollapsed: true, iframeSrc: 'CURRENT_TASK_SRC' })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={{}}
        cs={cs}
        isSandbox={false}
        viewingTaskId="prev-task-id"
        isViewingPrev
        isForcedTeacherLive={false}
        isMobile={false}
        displayFiles={files}
        displayActiveFile="index.html"
        isTeacherEditing={false}
        onVisiblePanesChange={vi.fn()}
      />
    )

    const collapsedButton = screen.getByText('show-preview')
    expect(collapsedButton).toHaveAttribute('data-src', 'PREV_TASK_SRC')
    expect(collapsedButton).not.toHaveAttribute('data-src', 'CURRENT_TASK_SRC')
  })

  it('shows the current task\'s content while collapsed and not viewing a previous task', () => {
    const cs = makeCs({ htmlPreviewCollapsed: true, iframeSrc: 'CURRENT_TASK_SRC' })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={{}}
        cs={cs}
        isSandbox={false}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        displayFiles={files}
        displayActiveFile="index.html"
        isTeacherEditing={false}
        onVisiblePanesChange={vi.fn()}
      />
    )

    const collapsedButton = screen.getByText('show-preview')
    expect(collapsedButton).toHaveAttribute('data-src', 'CURRENT_TASK_SRC')
  })
})
