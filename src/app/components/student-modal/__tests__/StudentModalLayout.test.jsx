// The tutor's StudentModal layout (sketch OK'd 8 Nov 2026): the instructions card fills the
// left column and never clips behind "show more"; on a Python Stage task the Stage sits ABOVE
// the Output in one right-hand column, so the code gets the wide middle; with no drawing the
// right column is the Output only, as before.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const size = { width: 0, height: 0 }
vi.mock('../../../../shared/useElementSize', () => ({
  useElementSize: () => [() => {}, size],
}))
vi.mock('../../../../shared/stage/StagePane.jsx', () => ({
  default: ({ title }) => <section aria-label={title} data-testid="stage-pane" />,
}))
vi.mock('../../../../shared/CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))
vi.mock('../../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output-panel">{output}</div>,
}))
vi.mock('../StudentHintPanel', () => ({ default: () => null }))

const { default: StudentWorkspaceBody } = await import('../StudentWorkspaceBody.jsx')
const { default: StudentModalLeftColumn } = await import('../StudentModalLeftColumn.jsx')
const { stageSizes, columnWidths, OUTPUT_FLOOR, GAP, MIN_STAGE, CODE_MIN } =
  await import('../stageOutputSizes.js')

const TASK = { id: 't1', title: 'A Circle and a Name', explainer: 'Look: a circle.' }
const STAGE = { commands: [{ type: 'circle', x: 0, y: 0, r: 50 }] }

function body(student = {}) {
  return (
    <div data-testid="body">
      <StudentWorkspaceBody
        lesson={{ type: 'python', tasks: [TASK] }}
        task={TASK}
        student={{ anonymousId: 's1', currentCode: 'circle(50)', currentOutput: '', ...student }}
        session={{ state: 'active', currentTaskId: 't1' }}
        mirror="code"
        outputColumn
        isInformation={false}
        isQuiz={false}
        isSessionSandbox={false}
        files={[]}
        iframeRef={{ current: null }}
      />
    </div>
  )
}

function renderBody(student = {}) {
  return render(body(student))
}

describe('StudentModal right column', () => {
  beforeEach(() => {
    size.width = 360
    size.height = 600
  })

  it('puts the Stage above the Output in one column and leaves the code on its own', () => {
    renderBody({ currentStageResult: STAGE })
    const column = screen.getByTestId('student-modal-output-column')
    const stage = within(column).getByTestId('stage-pane')
    const output = within(column).getByTestId('output-panel')
    expect(stage.compareDocumentPosition(output) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const toggle = within(column).getByRole('button', { name: 'Bigger picture' })
    expect(toggle.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Only one Stage on screen, and it is not beside the code.
    expect(screen.getAllByTestId('stage-pane')).toHaveLength(1)
    expect(screen.queryByTestId('code-stage-split')).toBeNull()
  })

  it('is the Output only when the run drew nothing', () => {
    renderBody({ currentStageResult: null })
    const column = screen.getByTestId('student-modal-output-column')
    expect(within(column).getByTestId('output-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-pane')).toBeNull()
    expect(screen.queryByRole('button', { name: /picture/ })).toBeNull()
  })

  it('Bigger picture grows the Stage and back', async () => {
    renderBody({ currentStageResult: STAGE })
    await userEvent.click(screen.getByRole('button', { name: 'Bigger picture' }))
    expect(screen.getByRole('button', { name: 'Smaller picture' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('keeps the same Output (and the Bigger picture choice) when the drawing comes and goes', async () => {
    const { rerender } = renderBody({ currentStageResult: STAGE })
    const output = screen.getByTestId('output-panel')
    const column = screen.getByTestId('student-modal-output-column')
    await userEvent.click(screen.getByRole('button', { name: 'Bigger picture' }))
    rerender(body({ currentStageResult: null }))
    expect(screen.queryByTestId('stage-pane')).toBeNull()
    expect(screen.getByTestId('output-panel')).toBe(output)
    expect(screen.getByTestId('student-modal-output-column')).toBe(column)
    rerender(body({ currentStageResult: STAGE }))
    expect(screen.getByTestId('output-panel')).toBe(output)
    expect(screen.getByRole('button', { name: 'Smaller picture' })).toBeInTheDocument()
  })
})

describe('stageSizes', () => {
  it('keeps the small Stage square at the column width when there is room', () => {
    expect(stageSizes({ width: 320, height: 800, big: false }).stage).toBe(320)
  })

  it('shrinks the small Stage on a short column so the Output keeps its floor', () => {
    expect(stageSizes({ width: 360, height: 480, big: false }).stage).toBeLessThan(360)
    for (let height = 480; height <= 1000; height += 20) {
      for (const big of [false, true]) {
        const { stage, used } = stageSizes({ width: 360, height, big, bigWidth: 580 })
        expect(stage).toBeGreaterThanOrEqual(MIN_STAGE)
        expect(height - used - GAP).toBeGreaterThanOrEqual(OUTPUT_FLOOR)
      }
    }
  })

  it('never shrinks the Stage below its minimum, however short the column', () => {
    expect(stageSizes({ width: 360, height: 200, big: false }).stage).toBe(MIN_STAGE)
  })

  it('grows the big Stage but stops while the Output keeps its floor', () => {
    const roomy = stageSizes({ width: 320, height: 1000, big: true, bigWidth: 600 })
    expect(roomy.stage).toBe(600)
    const tight = stageSizes({ width: 320, height: 700, big: true, bigWidth: 600 })
    expect(tight.stage).toBeLessThan(600)
    expect(tight.stage).toBeGreaterThanOrEqual(320)
    expect(700 - tight.used - GAP).toBeGreaterThanOrEqual(OUTPUT_FLOOR)
  })

  it('counts the name-tag panel under the Output, so the Output keeps its floor', () => {
    for (let height = 480; height <= 1000; height += 20) {
      for (const big of [false, true]) {
        for (const after of [0, 120, 268]) {
          const { stage, used, afterMax } = stageSizes({
            width: 360,
            height,
            big,
            bigWidth: 580,
            after,
          })
          expect(stage).toBeGreaterThanOrEqual(MIN_STAGE)
          const shown = Math.min(after, afterMax ?? after)
          expect(height - used - GAP - shown).toBeGreaterThanOrEqual(OUTPUT_FLOOR)
        }
      }
    }
    // Room to spare: the panel shows whole, and the Stage shrinks for it.
    const roomy = stageSizes({ width: 360, height: 900, big: false, after: 200 })
    expect(roomy.afterMax).toBeGreaterThanOrEqual(200)
    expect(stageSizes({ width: 360, height: 700, big: false, after: 200 }).stage).toBeLessThan(
      stageSizes({ width: 360, height: 700, big: false }).stage
    )
  })

  it('lets the name-tag panel scroll once the Stage is at its minimum', () => {
    const { stage, afterMax } = stageSizes({ width: 360, height: 480, big: false, after: 268 })
    expect(stage).toBe(MIN_STAGE)
    expect(afterMax).toBeLessThan(268)
    expect(afterMax).toBeGreaterThanOrEqual(0)
  })

  it('never makes the big Stage smaller than the small one', () => {
    const small = stageSizes({ width: 320, height: 400, big: false }).stage
    expect(stageSizes({ width: 320, height: 400, big: true, bigWidth: 600 }).stage).toBe(small)
  })
})

describe('columnWidths', () => {
  it('is the CSS clamp while small, and grows by the big share when the row has room', () => {
    const { small, big } = columnWidths({ free: 1400, viewportWidth: 1366 })
    expect(small).toBe(Math.round(1366 * 0.26))
    expect(big).toBeGreaterThan(small)
  })

  it('keeps the code column at least its minimum when big', () => {
    const free = 900
    const { big } = columnWidths({ free, viewportWidth: 1920 })
    expect(free - big).toBeGreaterThanOrEqual(CODE_MIN)
  })

  it('does nothing when the row has no room for a bigger column', () => {
    const { small, big } = columnWidths({ free: 650, viewportWidth: 1366 })
    expect(big).toBe(small)
  })

  it('follows the row each time: a narrower row gives a smaller big width', () => {
    const wide = columnWidths({ free: 1200, viewportWidth: 1920 }).big
    const narrow = columnWidths({ free: 1000, viewportWidth: 1920 }).big
    expect(narrow).toBeLessThan(wide)
  })
})

describe('StudentModal instructions card', () => {
  let spies = []
  beforeEach(() => {
    // jsdom has no layout: make every element report text taller than its box.
    spies = [
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900),
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100),
    ]
  })
  afterEach(() => spies.forEach((spy) => spy.mockRestore()))

  it('fills the column and scrolls inside itself, with no "show more"', async () => {
    render(
      <StudentModalLeftColumn
        task={{ ...TASK, explainer: 'Line\n\n'.repeat(60) }}
        lessonType="python"
        student={{ anonymousId: 's1' }}
        session={{}}
        isSessionSandbox={false}
        collapsed={false}
        onCollapsedChange={() => {}}
      />
    )
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(screen.queryByRole('button', { name: 'show more' })).toBeNull()
    const card = screen.getByTestId('student-modal-instructions')
    expect(card.style.flexGrow).toBe('1')
  })

  it('short text: the card grows to fill the spare height of the column', () => {
    render(
      <StudentModalLeftColumn
        task={TASK}
        lessonType="python"
        student={{ anonymousId: 's1' }}
        session={{}}
        isSessionSandbox={false}
        collapsed={false}
        onCollapsedChange={() => {}}
      />
    )
    const card = screen.getByTestId('student-modal-instructions')
    expect(card.style.flexGrow).toBe('1')
  })

  it('long text with a Type this out block: the card keeps its content height, the column scrolls', () => {
    render(
      <StudentModalLeftColumn
        task={{ ...TASK, explainer: 'Line\n\n'.repeat(60) }}
        lessonType="python"
        student={{ anonymousId: 's1' }}
        session={{}}
        isSessionSandbox={false}
        copyCode={'print("hi")\n'.repeat(10)}
        collapsed={false}
        onCollapsedChange={() => {}}
      />
    )
    const card = screen.getByTestId('student-modal-instructions')
    // Never shrinks below its content to make room for the block under it.
    expect(card.style.flexShrink).toBe('0')
    expect(card.style.flexBasis).toBe('auto')
    expect(screen.getByTestId('student-modal-left').style.overflowY).toBe('auto')
  })
})
