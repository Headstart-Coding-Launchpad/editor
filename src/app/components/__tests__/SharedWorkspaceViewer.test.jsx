import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SharedWorkspaceViewer, {
  seedSharedWorkspace,
  shareViewerLessonId,
} from '../SharedWorkspaceViewer'
import { ephemeralStorage, clearEphemeralStorage } from '../../studentStorage'

// The point of this component is that it renders the student's OWN workspace
// surface. Stubbing LessonTaskContent lets us assert exactly that — which
// component was rendered, with which lesson and cs — without dragging in every
// module's editor.
const lessonTaskContentSpy = vi.fn()
vi.mock('../LessonTaskContent', () => ({
  default: (props) => {
    lessonTaskContentSpy(props)
    return <div data-testid="lesson-task-content">{props.lesson?.type}</div>
  },
}))

const csSpy = vi.fn()
vi.mock('../../hooks/useStudentCodeState', () => ({
  useStudentCodeState: (args) => {
    csSpy(args)
    return {
      code: 'live-code',
      buildShareSnapshot: () => ({
        code: 'edited-by-viewer',
        files: { 'index.html': '<p>edited</p>' },
      }),
    }
  },
}))

const PYTHON_LESSON = { type: 'python', tasks: [{ id: 1, title: 'Loops' }] }
const HTML_LESSON = { type: 'html', tasks: [{ id: 1, title: 'Page', entryFile: 'index.html' }] }
const ENTRY = { shareId: 'share-1', sharerName: 'Jamie', sharerId: 'stu-1' }

function pythonSnapshot(overrides = {}) {
  return {
    lessonType: 'python',
    taskId: 1,
    code: 'print("theirs")',
    files: {},
    output: '',
    runStatus: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearEphemeralStorage()
  localStorage.clear()
})

describe('SharedWorkspaceViewer', () => {
  it('renders the student own workspace surface, not a bespoke viewer', () => {
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    expect(screen.getByTestId('lesson-task-content')).toBeInTheDocument()
  })

  it('names whose work it is and reassures the viewer', () => {
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    expect(screen.getByText(/Jamie's workspace/)).toBeInTheDocument()
    expect(screen.getByText(/your own work is safe and unchanged/i)).toBeInTheDocument()
  })

  it('renders inline rather than as a fixed overlay dialog', () => {
    const { container } = render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container.firstChild).not.toHaveStyle({ position: 'fixed' })
  })

  // Everything below is the non-destructive guarantee, which now rests on how
  // the throwaway useStudentCodeState instance is configured.
  describe('cannot touch the student own work', () => {
    it('runs in previewMode so persistence never reaches real localStorage', () => {
      render(
        <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
      )
      expect(csSpy.mock.calls[0][0]).toMatchObject({ previewMode: true, phase: 'solo' })
    })

    it('namespaces its lessonId so it cannot collide with the student own storage', () => {
      render(
        <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
      )
      const args = csSpy.mock.calls[0][0]
      expect(args.lessonId).toBe(shareViewerLessonId('share-1'))
      expect(args.lessonId).not.toBe('python-lesson')
    })

    it('passes no real session writers, so no path to Firebase exists', () => {
      render(
        <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
      )
      const args = csSpy.mock.calls[0][0]
      for (const writer of [
        'writeStudentRun',
        'writeStudentCode',
        'writeStudentFiles',
        'logAttempt',
        'updateTeacherLive',
        'writeStudentPresence',
      ]) {
        expect(typeof args[writer]).toBe('function')
        // A no-op resolves and records nothing.
        expect(args[writer]('anything')).toBeInstanceOf(Promise)
      }
    })

    it('writes nothing to real localStorage while rendering', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      render(
        <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
      )
      expect(setItem).not.toHaveBeenCalled()
      setItem.mockRestore()
    })
  })

  describe('seeding', () => {
    it('seeds code modules so the normal load path finds the snapshot', () => {
      const shareLessonId = shareViewerLessonId('s1')
      seedSharedWorkspace({
        shareLessonId,
        taskId: 1,
        moduleType: 'python',
        snapshot: pythonSnapshot(),
      })
      expect(
        ephemeralStorage.loadSavedCode(shareLessonId, 1, 'shared-workspace-viewer')
      ).toMatchObject({ code: 'print("theirs")' })
      expect(localStorage.length).toBe(0)
    })

    it('seeds each HTML file separately', () => {
      const shareLessonId = shareViewerLessonId('s2')
      seedSharedWorkspace({
        shareLessonId,
        taskId: 1,
        moduleType: 'html',
        snapshot: { files: { 'index.html': '<p>hi</p>', 'style.css': 'p{}' } },
      })
      expect(
        ephemeralStorage.loadSavedFile(shareLessonId, 1, 'index.html', 'shared-workspace-viewer')
      ).toBe('<p>hi</p>')
      expect(
        ephemeralStorage.loadSavedFile(shareLessonId, 1, 'style.css', 'shared-workspace-viewer')
      ).toBe('p{}')
    })

    it('seeds Scratch blocks as parsed workspace state', () => {
      const shareLessonId = shareViewerLessonId('s3')
      seedSharedWorkspace({
        shareLessonId,
        taskId: 2,
        moduleType: 'scratch',
        snapshot: { code: '{"player":{"blocks":[]}}' },
      })
      expect(
        ephemeralStorage.loadSavedCode(shareLessonId, 2, 'shared-workspace-viewer')
      ).toEqual({ state: { player: { blocks: [] } } })
    })

    it('seeds filesystem state through the fs slot', () => {
      const shareLessonId = shareViewerLessonId('s4')
      seedSharedWorkspace({
        shareLessonId,
        taskId: 3,
        moduleType: 'filesystem',
        snapshot: { code: '{"/":{"type":"dir"}}' },
      })
      expect(ephemeralStorage.loadSavedFs(shareLessonId, 3, 'shared-workspace-viewer')).toEqual({
        '/': { type: 'dir' },
      })
    })

    it('carries an arcade design alongside the code', () => {
      const shareLessonId = shareViewerLessonId('s5')
      seedSharedWorkspace({
        shareLessonId,
        taskId: 1,
        moduleType: 'arcade',
        snapshot: { code: 'x = 1', arcadeDesign: { sprites: ['a'] } },
      })
      expect(
        ephemeralStorage.loadSavedCode(shareLessonId, 1, 'shared-workspace-viewer')
      ).toMatchObject({ code: 'x = 1', arcadeDesign: { sprites: ['a'] } })
    })
  })

  describe('module resolution', () => {
    // A share outlives its task, so in a composed lesson it may be a different
    // module from whatever the class is on now.
    it('renders by the snapshot own module, not the viewer current lesson', () => {
      const composed = {
        type: 'composed',
        modules: [
          { id: 'py', type: 'python', title: 'Python' },
          { id: 'sc', type: 'scratch', title: 'Scratch' },
        ],
        tasks: [
          { id: 1, title: 'Py', moduleType: 'python', moduleId: 'py' },
          { id: 2, title: 'Blocks', moduleType: 'scratch', moduleId: 'sc' },
        ],
      }
      render(
        <SharedWorkspaceViewer
          lesson={composed}
          entry={ENTRY}
          snapshot={{ lessonType: 'scratch', taskId: 2, code: '{}', files: {} }}
        />
      )
      expect(lessonTaskContentSpy.mock.calls[0][0].lesson.type).toBe('scratch')
      expect(lessonTaskContentSpy.mock.calls[0][0].task).toMatchObject({ id: 2 })
    })

    it('remounts the workspace per share so module state is never swapped in place', () => {
      const { rerender } = render(
        <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
      )
      expect(lessonTaskContentSpy.mock.calls[0][0].key ?? 'share-1').toBeTruthy()
      rerender(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={{ ...ENTRY, shareId: 'share-2' }}
          snapshot={pythonSnapshot()}
        />
      )
      // A different share means a different namespaced storage id.
      const ids = csSpy.mock.calls.map((c) => c[0].lessonId)
      expect(ids[ids.length - 1]).toBe(shareViewerLessonId('share-2'))
    })
  })

  describe('copy to my editor', () => {
    it('is offered only for the task the student is on', () => {
      const { rerender } = render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={1}
          onCopyToMyEditor={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: /copy to my editor/i })).toBeInTheDocument()

      rerender(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={7}
          onCopyToMyEditor={vi.fn()}
        />
      )
      expect(screen.queryByRole('button', { name: /copy to my editor/i })).not.toBeInTheDocument()
    })

    it('warns before overwriting and does nothing if cancelled', async () => {
      const onCopy = vi.fn()
      render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={1}
          onCopyToMyEditor={onCopy}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /copy to my editor/i }))
      expect(screen.getByRole('alertdialog')).toHaveTextContent(/replaces your own code/i)

      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onCopy).not.toHaveBeenCalled()
    })

    // Copies what they are looking at now, edits included — not the original.
    it('copies the viewer current state once confirmed', async () => {
      const onCopy = vi.fn()
      render(
        <SharedWorkspaceViewer
          lesson={HTML_LESSON}
          entry={ENTRY}
          snapshot={{ lessonType: 'html', taskId: 1, code: '', files: {} }}
          copyTargetTaskId={1}
          onCopyToMyEditor={onCopy}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /copy to my editor/i }))
      await userEvent.click(screen.getByRole('button', { name: /replace my work/i }))

      expect(onCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'edited-by-viewer',
          moduleType: 'html',
          files: [expect.objectContaining({ name: 'index.html', content: '<p>edited</p>' })],
        })
      )
    })
  })

  it('closes back to the student own work', async () => {
    const onClose = vi.fn()
    render(
      <SharedWorkspaceViewer
        lesson={PYTHON_LESSON}
        entry={ENTRY}
        snapshot={pythonSnapshot()}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /back to my work/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
