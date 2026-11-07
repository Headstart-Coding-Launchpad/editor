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

  it('a swap shows the old line in red with Remove and the new line in green', () => {
    renderPanel({
      stage: completeStage({ code: STARTER.replace('step = 5', 'step = 3') }),
    })
    const panel = screen.getByLabelText('Complete solution stage reference')
    expect(within(panel).getByLabelText('removed: step = 5')).toBeInTheDocument()
    expect(within(panel).getByText('Remove')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: step = 3')).toBeInTheDocument()
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
