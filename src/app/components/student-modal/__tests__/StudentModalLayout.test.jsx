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
const { stageSizes, OUTPUT_FLOOR } = await import('../stageOutputSizes.js')

const TASK = { id: 't1', title: 'A Circle and a Name', explainer: 'Look: a circle.' }
const STAGE = { commands: [{ type: 'circle', x: 0, y: 0, r: 50 }] }

function renderBody(student = {}) {
  return render(
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
})

describe('stageSizes', () => {
  it('keeps the small Stage square at the column width, however short the column', () => {
    expect(stageSizes({ width: 320, height: 300, big: false }).stage).toBe(320)
  })

  it('grows the big Stage but stops while the Output keeps its floor', () => {
    const roomy = stageSizes({ width: 320, height: 1000, big: true, bigWidth: 600 })
    expect(roomy.stage).toBe(600)
    const tight = stageSizes({ width: 320, height: 700, big: true, bigWidth: 600 })
    expect(tight.stage).toBeLessThan(600)
    expect(tight.stage).toBeGreaterThanOrEqual(320)
    expect(700 - tight.used).toBeGreaterThanOrEqual(OUTPUT_FLOOR)
  })

  it('never shrinks the big Stage below the small one', () => {
    expect(stageSizes({ width: 320, height: 400, big: true, bigWidth: 600 }).stage).toBe(320)
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
})
