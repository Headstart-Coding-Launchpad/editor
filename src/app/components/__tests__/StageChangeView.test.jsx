import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SupportStagePanel from '../SupportStagePanel'
import CopyCodePanel from '../CopyCodePanel'
import CheckFeedbackBanner from '../CheckFeedbackBanner'

// Fun moment (platform request 134): the student sees the one line to type and exactly where it
// goes, instead of the whole program.
const STARTER = 'size = 100\nstep = 5\nsize -= step\nprint(size)'
const COMPLETE = 'size = 100\nstep = 5\nsize -= step\nturn += 10\nprint(size)'
const completeStage = (extra = {}) => ({
  label: 'Complete solution',
  role: 'complete',
  show: 'change',
  code: COMPLETE,
  ...extra,
})

function renderPanel(props = {}) {
  return render(
    <SupportStagePanel
      stage={completeStage()}
      lessonType="python"
      revealed
      sourceLabel="Complete reference"
      changeBase={STARTER}
      {...props}
    />
  )
}

describe('Complete stage change view', () => {
  it('shows only the new line and the line it goes after', () => {
    renderPanel()
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('unchanged anchor: size -= step')).toBeInTheDocument()
    expect(within(panel).getByText('after this line')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: turn += 10')).toBeInTheDocument()
    expect(within(panel).getByText('Add')).toBeInTheDocument()
    // The rest of the program is not repeated.
    expect(panel).not.toHaveTextContent('size = 100')
    expect(panel).not.toHaveTextContent('print(size)')
    // No line numbers anywhere.
    expect(panel).not.toHaveTextContent(/line \d/i)
  })

  it('"Show all the code" shows the whole program with the new line marked, and back', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Show all the code' }))
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(panel).toHaveTextContent('size = 100')
    expect(panel).toHaveTextContent('print(size)')
    expect(within(panel).getByLabelText('added: turn += 10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show only the changes' }))
    expect(screen.getByLabelText('Complete solution stage reference')).not.toHaveTextContent(
      'size = 100'
    )
  })

  it('a line that changes a lot shows the old line in red with Remove and the new line in green', () => {
    // Request 135: a small swap is one inline row; this one changes most of the line.
    renderPanel({
      stage: completeStage({ code: STARTER.replace('step = 5', 'jump = size * 2') }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('removed: step = 5')).toBeInTheDocument()
    expect(within(panel).getByText('Remove')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: jump = size * 2')).toBeInTheDocument()
    expect(within(panel).getByLabelText('unchanged anchor: size = 100')).toBeInTheDocument()
    expect(panel).not.toHaveTextContent('this line changes')
  })

  it('a re-indent shows one note with the count', () => {
    renderPanel({
      changeBase: 'x = 1\nforward(100)\nright(90)\nprint(x)\ny = 2\nz = 3',
      stage: completeStage({
        code: 'x = 1\n    forward(100)\n    right(90)\n    print(x)\ny = 2\nz = 3',
      }),
    })
    expect(screen.getByText('Indent these 3 lines (4 spaces in)')).toBeInTheDocument()
  })

  it('falls back to all the code, marked, when a lot changed', () => {
    renderPanel({ changeBase: 'size = 100' })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(panel).toHaveTextContent(
      'A lot changed in this step, so here is all of the code. Green lines are new, red lines go.'
    )
    expect(panel).toHaveTextContent('print(size)')
    expect(within(panel).getByLabelText('added: print(size)')).toBeInTheDocument()
  })

  it('says so when the code already matches', () => {
    renderPanel({ changeBase: COMPLETE })
    expect(screen.getByText('Your code already matches this step')).toBeInTheDocument()
  })

  it('compares with the code from when the stage opened, not each new keystroke', () => {
    const { rerender } = renderPanel()
    rerender(
      <SupportStagePanel
        stage={completeStage()}
        lessonType="python"
        revealed
        changeBase={COMPLETE}
      />
    )
    expect(screen.getByLabelText('added: turn += 10')).toBeInTheDocument()
  })

  it('tells its parent while the change view shows', async () => {
    const user = userEvent.setup()
    const onChangeViewShown = vi.fn()
    renderPanel({ onChangeViewShown })
    expect(onChangeViewShown).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Show all the code' }))
    expect(onChangeViewShown).toHaveBeenLastCalledWith(false)
  })

  it('a stage without show: change looks exactly as today', () => {
    renderPanel({ stage: completeStage({ show: undefined }) })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(panel.querySelector('code').textContent).toBe(COMPLETE)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a Support stage never shows the change view', () => {
    renderPanel({ stage: completeStage({ role: 'support' }) })
    expect(screen.queryByText('after this line')).not.toBeInTheDocument()
  })

  it('without a base (no student code passed) the stage shows in full', () => {
    renderPanel({ changeBase: null })
    expect(screen.queryByText('after this line')).not.toBeInTheDocument()
  })

  it('a fall-back (too much changed) offers no "Show only the changes": there is no place to show', () => {
    renderPanel({ changeBase: 'size = 100' })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(panel).toHaveTextContent('A lot changed in this step')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a fall-back for many separate changes shows no green line without a place', () => {
    const base = 'a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6\ng = 7\nh = 8\ni = 9\nj = 10\nk = 11'
    const target =
      'a = 1\nA = 1\nb = 2\nc = 3\nB = 2\nd = 4\ne = 5\nC = 3\nf = 6\ng = 7\nD = 4\nh = 8\ni = 9\nj = 10\nk = 11'
    renderPanel({ changeBase: base, stage: completeStage({ code: target }) })
    expect(screen.queryByRole('button', { name: 'Show only the changes' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Complete solution stage reference')).toHaveTextContent('k = 11')
  })

  it('works in Python only: a Turtle or Arcade Complete stage shows in full', () => {
    for (const lessonType of ['turtle', 'arcade']) {
      const { unmount } = renderPanel({ lessonType })
      expect(screen.queryByText('after this line')).not.toBeInTheDocument()
      expect(screen.queryByTestId('stage-change-view')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('compares with the code from when the stage is revealed, not when the panel mounted', () => {
    const { rerender } = renderPanel({ revealed: false })
    // The student finishes the step before the stage is revealed.
    rerender(
      <SupportStagePanel
        stage={completeStage()}
        lessonType="python"
        revealed={false}
        changeBase={COMPLETE}
      />
    )
    rerender(
      <SupportStagePanel
        stage={completeStage()}
        lessonType="python"
        revealed
        changeBase={COMPLETE}
      />
    )
    expect(screen.getByText('Your code already matches this step')).toBeInTheDocument()
  })

  it('"Show all the code" keeps the locked-line tags and the author\'s line hints', async () => {
    const user = userEvent.setup()
    renderPanel({
      lockSets: [[{ line: 1, target: 'size = 100' }]],
      lineHintsFor: () => [{ line: 4, text: 'Turn a bit more each time' }],
    })
    await user.click(screen.getByRole('button', { name: 'Show all the code' }))
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('unchanged: size = 100, locked')).toHaveTextContent(
      'Locked'
    )
    expect(
      within(panel).getByLabelText('added: turn += 10, hint: Turn a bit more each time')
    ).toHaveTextContent('Turn a bit more each time')
  })

  it("the fall-back keeps hints on the right lines when the student's removed lines sit between", () => {
    renderPanel({
      changeBase: 'old = 1\nsize = 100',
      lineHintsFor: () => [{ line: 5, text: 'Show it' }],
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('added: print(size), hint: Show it')).toBeInTheDocument()
    expect(within(panel).getByLabelText('removed: old = 1')).toBeInTheDocument()
  })

  it('its toggle is a 44px touch target', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Show all the code' })).toHaveStyle({
      minHeight: '44px',
    })
  })
})

describe('Copy the Code panel anchor', () => {
  it('copyAfter shows the line before, dimmed, then the typed lines in green', () => {
    render(
      <CopyCodePanel code={'turn += 10\nprint(turn)'} language="python" after="size -= step" />
    )
    const panel = screen.getByLabelText('Python reference code')
    expect(within(panel).getByLabelText('unchanged anchor: size -= step')).toBeInTheDocument()
    expect(within(panel).getByText('after this line')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: turn += 10')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: print(turn)')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('copyBefore puts the typed lines above the named line', () => {
    render(<CopyCodePanel code="speed(0)" language="python" before="forward(50)" />)
    expect(screen.getByText('before this line')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'added: speed(0)',
      'unchanged anchor: forward(50)',
    ])
  })

  it('with neither field the panel is as today', () => {
    render(<CopyCodePanel code="speed(0)" language="python" />)
    expect(screen.getByLabelText('Python reference code').querySelector('code').textContent).toBe(
      'speed(0)'
    )
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})

// Fun moment (platform request 135): on their circle line the student sees exactly the few
// characters to add (x=100, y=100), in one glance, not the whole line twice.
describe('Inline change inside a line', () => {
  const MOVE_START = 'from turtle import *\ncircle(100, "gold")\ndone()'
  const MOVE_DONE = 'from turtle import *\ncircle(100, "gold", x=100, y=100)\ndone()'
  const rowsOf = (panel) => within(panel).getAllByRole('listitem')

  it('a line that only gains text is one row: old part dimmed, the insert green, bold, underlined', () => {
    renderPanel({ changeBase: MOVE_START, stage: completeStage({ code: MOVE_DONE }) })
    const panel = screen.getByLabelText('Complete solution stage reference')
    const row = within(panel).getByLabelText(
      'added: “, x=100, y=100”, in the line circle(100, "gold", x=100, y=100)'
    )
    expect(row).toHaveTextContent('circle(100, "gold", x=100, y=100)')
    // No red line, no Remove word.
    expect(within(panel).queryByText('Remove')).not.toBeInTheDocument()
    expect(within(panel).queryByLabelText(/^removed:/)).not.toBeInTheDocument()
    expect(within(row).getByText('Add')).toBeInTheDocument()
    expect(within(row).getByText('+')).toBeInTheDocument()
    // Not colour alone: the inserted text is bold and underlined; the old part is plain.
    const inserted = within(row).getByText(', x=100, y=100')
    expect(inserted).toHaveStyle({ fontWeight: '700' })
    expect(inserted.style.textDecoration).toContain('underline')
    expect(within(row).getByText('circle(100, "gold"').style.textDecoration).not.toContain(
      'underline'
    )
    // Only the anchor row (from turtle import *) and this one.
    expect(rowsOf(panel)).toHaveLength(2)
  })

  it('a small swap is one row with ±: the old piece struck through, the new piece underlined', () => {
    renderPanel({
      changeBase: 'from turtle import *\nfor i in range(5):\n    forward(50)',
      stage: completeStage({ code: 'from turtle import *\nfor i in range(3):\n    forward(50)' }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    const row = within(panel).getByLabelText(
      'changed: removed “5”, added “3”, in the line for i in range(3):'
    )
    expect(within(row).getByText('±')).toBeInTheDocument()
    expect(within(row).getByText('Remove')).toBeInTheDocument()
    expect(within(row).getByText('Add')).toBeInTheDocument()
    expect(within(row).getByText('5').style.textDecoration).toContain('line-through')
    expect(within(row).getByText('3').style.textDecoration).toContain('underline')
    expect(within(panel).queryByLabelText(/^removed:/)).not.toBeInTheDocument()
    // Not colour alone in grayscale: a heavier double left border than an added or plain row.
    expect(row.style.borderLeft).toContain('double')
  })

  it('words added inside a string show inside it', () => {
    renderPanel({
      changeBase: 'from turtle import *\nprint("Hi")\ndone()',
      stage: completeStage({ code: 'from turtle import *\nprint("Hi there")\ndone()' }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    const row = within(panel).getByLabelText('added: “there”, in the line print("Hi there")')
    expect(within(row).getByText('there').style.textDecoration).toContain('underline')
  })

  it('a whitespace-only edit keeps the red and green rows', () => {
    renderPanel({
      changeBase: 'from turtle import *\nx=1\ndone()',
      stage: completeStage({ code: 'from turtle import *\nx = 1\ndone()' }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('removed: x=1')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: x = 1')).toBeInTheDocument()
  })

  it('a line whose indent changes as well keeps the red and green rows', () => {
    renderPanel({
      changeBase: 'from turtle import *\nfor i in range(3):\n    forward(50)\nforward(10)',
      stage: completeStage({
        code: 'from turtle import *\nfor i in range(3):\n    forward(50)\n    forward(10, 2)',
      }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('removed: forward(10)')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: forward(10, 2)')).toBeInTheDocument()
  })

  it('a line where more than about half changes keeps the red and green rows', () => {
    renderPanel({
      changeBase: 'from turtle import *\nprint("Hello " + name)\ndone()',
      stage: completeStage({
        code: 'from turtle import *\nfor i in range(10): forward(i * 5)\ndone()',
      }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('removed: print("Hello " + name)')).toBeInTheDocument()
    expect(
      within(panel).getByLabelText('added: for i in range(10): forward(i * 5)')
    ).toBeInTheDocument()
  })

  it('a line with 3 or more separate changes keeps the red and green rows', () => {
    renderPanel({
      changeBase: 'from turtle import *\ngo(alpha, beta, gamma, delta)\ndone()',
      stage: completeStage({
        code: 'from turtle import *\ngo(one, beta, two, delta, three)\ndone()',
      }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(
      within(panel).getByLabelText('removed: go(alpha, beta, gamma, delta)')
    ).toBeInTheDocument()
    expect(
      within(panel).getByLabelText('added: go(one, beta, two, delta, three)')
    ).toBeInTheDocument()
  })

  it('"Show all the code" shows the same one row, with its hint', async () => {
    const user = userEvent.setup()
    renderPanel({
      changeBase: MOVE_START,
      stage: completeStage({ code: MOVE_DONE }),
      lineHintsFor: () => [{ line: 2, text: 'Move it' }],
    })
    await user.click(screen.getByRole('button', { name: 'Show all the code' }))
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(
      within(panel).getByLabelText(
        'added: “, x=100, y=100”, in the line circle(100, "gold", x=100, y=100), hint: Move it'
      )
    ).toBeInTheDocument()
    expect(rowsOf(panel)).toHaveLength(3)
  })

  it('the Copy the Code anchor marks only the extension of a starter line; a new line stays green', () => {
    render(
      <CopyCodePanel
        code={'circle(100, "gold", x=100, y=100)\nturn += 10'}
        language="python"
        after="size -= step"
        starter={'size = 100\nstep = 5\nsize -= step\ncircle(100, "gold")'}
      />
    )
    const panel = screen.getByLabelText('Python reference code')
    expect(rowsOf(panel).map((row) => row.getAttribute('aria-label'))).toEqual([
      'unchanged anchor: size -= step',
      'added: “, x=100, y=100”, in the line circle(100, "gold", x=100, y=100)',
      'added: turn += 10',
    ])
    expect(within(panel).getByText(', x=100, y=100').style.textDecoration).toContain('underline')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Use the Complete code button while the change view shows', () => {
  it('reads "Replace my code with this" and still calls the same load', async () => {
    const user = userEvent.setup()
    const onShowCompleteCode = vi.fn()
    render(
      <CheckFeedbackBanner
        passed={false}
        onShowCompleteCode={onShowCompleteCode}
        showCompleteCodeLabel="Replace my code with this"
      />
    )
    await user.click(screen.getByRole('button', { name: 'Replace my code with this' }))
    expect(onShowCompleteCode).toHaveBeenCalledTimes(1)
  })

  it('keeps its old wording otherwise', () => {
    render(<CheckFeedbackBanner passed={false} onShowCompleteCode={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Load complete code into my editor' })
    ).toBeInTheDocument()
  })
})
