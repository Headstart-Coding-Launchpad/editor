// students/{id}/health from the student's own screen (deep review R3, review fixes 10 Nov): one
// value derived from every source (Python stuck, each screen error boundary), written on a
// change only. A re-render, a phase change or Python getting ready never writes 'ok' over a
// screen error that is still showing.
import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANON, makeSession, renderStudentCodeState } from '../../../test/studentCodeStateHarness'
import { setPythonSlow, setPythonStuck } from '../../../modules/python/pythonHealth'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

afterEach(() => {
  act(() => setPythonStuck(false))
  vi.restoreAllMocks()
})

const lesson = () => ({
  id: 'lesson-1',
  type: 'python',
  title: 'Loops',
  tasks: [{ id: 't1', title: 'Task 1', starterCode: 'print(1)' }],
})

const healthCalls = (h) =>
  h.writers.writeStudentHealth.mock.calls.filter(([id]) => id === ANON).map(([, v]) => v)
const lastHealth = (h) => healthCalls(h).at(-1)

describe('student health (R3)', () => {
  it('Python stuck is written once; re-renders write nothing more', () => {
    const h = renderStudentCodeState({ lesson: lesson() })
    act(() => setPythonStuck(true))
    expect(lastHealth(h)).toBe('python_stuck')
    const count = healthCalls(h).length
    h.updateStudent({ online: true })
    h.updateStudent({ lastActivityAt: 5 })
    expect(healthCalls(h)).toHaveLength(count)
  })

  it("a screen error stays until every boundary has recovered; phase changes never write 'ok' over it", () => {
    const h = renderStudentCodeState({ lesson: lesson() })
    act(() => {
      h.result.current.setScreenError('task', true)
      h.result.current.setScreenError('codePane', true)
    })
    expect(lastHealth(h)).toBe('screen_error')
    act(() => h.result.current.setScreenError('codePane', false))
    expect(lastHealth(h)).toBe('screen_error')
    h.update({ phase: 'sandbox' })
    h.update({ phase: 'lesson' })
    h.updateStudent({ online: true })
    expect(lastHealth(h)).toBe('screen_error')
    act(() => h.result.current.setScreenError('task', false))
    expect(lastHealth(h)).toBe('ok')
  })

  it('Python getting ready again does not clear a screen error', () => {
    const h = renderStudentCodeState({ lesson: lesson() })
    act(() => h.result.current.setScreenError('codePane', true))
    act(() => setPythonStuck(true))
    act(() => setPythonStuck(false))
    expect(h.result.current.pyodideStatus).toBe('ready')
    expect(lastHealth(h)).toBe('screen_error')
    act(() => h.result.current.setScreenError('codePane', false))
    expect(lastHealth(h)).toBe('ok')
  })

  it('the screen error shows over Python stuck; clearing it leaves Python stuck', () => {
    const h = renderStudentCodeState({ lesson: lesson() })
    act(() => setPythonStuck(true))
    act(() => h.result.current.setScreenError('task', true))
    expect(lastHealth(h)).toBe('screen_error')
    act(() => h.result.current.setScreenError('task', false))
    expect(lastHealth(h)).toBe('python_stuck')
  })

  // Second review (10 Nov): a plain load error is not "stuck" (Run still retries the load), and
  // a workspace without Python never reports Python stuck.
  it("a plain load error ('error' without the stuck flag) is not python_stuck, and Run stays allowed", async () => {
    const { getLessonModule } = await import('../../../modules/registry')
    vi.spyOn(getLessonModule('python').runtime, 'isReady').mockReturnValue(false)
    vi.spyOn(getLessonModule('python').runtime, 'init').mockRejectedValue(new Error('net'))
    const h = renderStudentCodeState({ lesson: lesson() })
    await act(async () => {})
    expect(h.result.current.pyodideStatus).toBe('error')
    expect(h.result.current.pythonStuck).toBe(false)
    expect(healthCalls(h)).not.toContain('python_stuck')
    act(() => setPythonStuck(true))
    expect(h.result.current.pythonStuck).toBe(true)
    expect(lastHealth(h)).toBe('python_stuck')
  })

  it('never reports python_stuck from a workspace without Python', () => {
    const h = renderStudentCodeState({
      lesson: {
        id: 'lesson-h',
        type: 'html',
        title: 'Web',
        tasks: [
          {
            id: 't1',
            title: 'Task 1',
            starterFiles: [{ name: 'index.html', content: '<p>hi</p>' }],
          },
        ],
      },
    })
    act(() => setPythonStuck(true))
    expect(h.result.current.pythonStuck).toBe(false)
    expect(healthCalls(h)).not.toContain('python_stuck')
  })

  // Third review (10 Nov): a slow load shows the student the prompt but tells the tutor nothing
  // until it is really stuck (the worker errored, or 180 s).
  it('a slow load blocks Run but is not python_stuck until it is really stuck', () => {
    const h = renderStudentCodeState({ lesson: lesson() })
    act(() => setPythonSlow())
    expect(h.result.current.pythonStuck).toBe(true)
    expect(healthCalls(h)).not.toContain('python_stuck')
    act(() => setPythonStuck(true))
    expect(lastHealth(h)).toBe('python_stuck')
  })

  // Third review (10 Nov): a stale problem left on the node by an earlier page is cleared by the
  // next page load in any phase where the node exists; no node, no write (never created).
  it.each(['waiting', 'solo', 'lesson-complete', 'sandbox'])(
    "a fresh page in phase '%s' clears a stale problem on an existing node",
    (phase) => {
      const h = renderStudentCodeState({
        lesson: lesson(),
        phase,
        session: makeSession({ student: { health: 'python_stuck' } }),
      })
      expect(healthCalls(h)).toContain('ok')
    }
  )

  it('outside a live lesson, writes nothing while the student has no node', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      phase: 'solo',
      session: { status: 'active', activeStudentView: null, students: {} },
    })
    act(() => setPythonStuck(true))
    expect(healthCalls(h)).toEqual([])
  })

  it('writes nothing from a teacher presentation or a preview', () => {
    const h = renderStudentCodeState({ lesson: lesson(), previewMode: true })
    act(() => setPythonStuck(true))
    act(() => h.result.current.setScreenError('task', true))
    expect(healthCalls(h)).toEqual([])
  })
})
