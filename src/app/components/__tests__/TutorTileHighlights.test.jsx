// Tutor tile highlights on the three boards (Match, Fill in the Gaps drag, code_arrange): the
// highlighted blank is outlined with "👀 Look again" and the note; StudentModal's highlight mode
// turns a tap on a blank into onTargetTap(targetId, tileId) instead of picking the tile up.
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuizTask from '../QuizTask'
import CodeArrangeTask from '../../../activities/code_arrange/CodeArrangeTask.jsx'
import TileHighlightBar from '../student-modal/TileHighlightBar'
import ActivityHost from '../../../activities/ActivityHost.jsx'
import {
  FILL_BLANK_DRAG_TASK,
  MATCH_TASK,
  PYTHON_CODE_ARRANGE_TASK,
} from '../../../test/fixtures/legacyActivityTasks.js'

describe('Match', () => {
  const answer = JSON.stringify({ p1: 'p2' })

  it('outlines the highlighted prompt’s slot with the tutor’s note', () => {
    render(
      <QuizTask
        task={MATCH_TASK}
        selectedAnswer={answer}
        onSelectAnswer={() => {}}
        tileHighlights={{ p1: { id: 'h1', tileId: 'p2', note: 'Read the prompt again' } }}
      />
    )
    expect(screen.getByTestId('match-slot-p1')).toHaveAttribute('data-tutor-highlight', 'true')
    expect(screen.getByTestId('match-slot-p2')).not.toHaveAttribute('data-tutor-highlight')
    expect(screen.getByTestId('tutor-tile-highlight-note')).toHaveTextContent(
      'Look again: Read the prompt again'
    )
  })

  it('in highlight mode a tap reports the slot and its tile and moves nothing', () => {
    const onTargetTap = vi.fn()
    const onSelectAnswer = vi.fn()
    render(
      <QuizTask
        task={MATCH_TASK}
        selectedAnswer={answer}
        onSelectAnswer={onSelectAnswer}
        disabled
        onTargetTap={onTargetTap}
      />
    )
    fireEvent.click(screen.getByTestId('match-slot-p1'))
    fireEvent.click(screen.getByTestId('match-slot-p3'))
    expect(onTargetTap).toHaveBeenNthCalledWith(1, 'p1', 'p2')
    expect(onTargetTap).toHaveBeenNthCalledWith(2, 'p3', null)
    expect(onSelectAnswer).not.toHaveBeenCalled()
  })
})

describe('Fill in the Gaps (drag)', () => {
  it('outlines the blank and names its tile under the passage', () => {
    render(
      <QuizTask
        task={FILL_BLANK_DRAG_TASK}
        selectedAnswer={JSON.stringify({ b1: 'd1' })}
        onSelectAnswer={() => {}}
        tileHighlights={{ b1: { id: 'h1', tileId: 'd1', note: null } }}
      />
    )
    expect(screen.getByTestId('fill-blank-b1')).toHaveAttribute('data-tutor-highlight', 'true')
    expect(screen.getByTestId('tutor-tile-highlight-note')).toHaveTextContent('Look again at len')
  })

  it('in highlight mode a tap reports the blank', () => {
    const onTargetTap = vi.fn()
    render(
      <QuizTask
        task={FILL_BLANK_DRAG_TASK}
        selectedAnswer={JSON.stringify({ b1: 'd1' })}
        disabled
        onTargetTap={onTargetTap}
      />
    )
    fireEvent.click(screen.getByTestId('fill-blank-b1'))
    expect(onTargetTap).toHaveBeenCalledWith('b1', 'd1')
  })
})

describe('Code Arrange', () => {
  const slots = { S1: 'S1d1', L2: 'L2' }

  it('outlines the highlighted blank with the note under its line', () => {
    render(
      <CodeArrangeTask
        task={PYTHON_CODE_ARRANGE_TASK}
        moduleType="python"
        selectedAnswer={slots}
        onSelectAnswer={() => {}}
        tileHighlights={{ L2: { id: 'h1', tileId: 'L2', note: 'Which loop variable?' } }}
      />
    )
    expect(screen.getByTestId('code-arrange-slot-L2')).toHaveAttribute(
      'data-tutor-highlight',
      'true'
    )
    expect(screen.getByTestId('code-arrange-slot-S1')).not.toHaveAttribute('data-tutor-highlight')
    expect(screen.getByTestId('tutor-tile-highlight-note')).toHaveTextContent(
      'Look again: Which loop variable?'
    )
  })

  it('in highlight mode a tap on an inline or whole-line blank reports it', () => {
    const onTargetTap = vi.fn()
    render(
      <CodeArrangeTask
        task={PYTHON_CODE_ARRANGE_TASK}
        moduleType="python"
        selectedAnswer={slots}
        disabled
        onTargetTap={onTargetTap}
      />
    )
    fireEvent.click(screen.getByTestId('code-arrange-slot-S1'))
    fireEvent.click(screen.getByTestId('code-arrange-slot-L2'))
    expect(onTargetTap).toHaveBeenNthCalledWith(1, 'S1', 'S1d1')
    expect(onTargetTap).toHaveBeenNthCalledWith(2, 'L2', 'L2')
  })
})

describe('TileHighlightBar (StudentModal)', () => {
  it('shows nothing when off with no highlights', () => {
    const { container } = render(
      <TileHighlightBar active={false} count={0} note="" onNoteChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('takes a note and clears all', () => {
    const onNoteChange = vi.fn()
    const onClearAll = vi.fn()
    const onDone = vi.fn()
    render(
      <TileHighlightBar
        active
        count={2}
        note=""
        onNoteChange={onNoteChange}
        onClearAll={onClearAll}
        onDone={onDone}
      />
    )
    fireEvent.change(screen.getByLabelText('Note for the next highlighted tile'), {
      target: { value: 'Try again' },
    })
    expect(onNoteChange).toHaveBeenCalledWith('Try again')
    fireEvent.click(screen.getByTestId('tile-highlight-clear-all'))
    expect(onClearAll).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Done'))
    expect(onDone).toHaveBeenCalled()
  })
})

// The student's own quiz board (ActivityHost): drawn while the tile is still there, removed once
// the student moves it, never while they review the task.
describe('ActivityHost', () => {
  const highlights = [
    { id: 'h1', taskId: '2', targetId: 'p1', tileId: 'p2', note: 'Look closer', createdAt: 1 },
  ]
  function activityFor(state, extra = {}) {
    return {
      task: MATCH_TASK,
      state,
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      readSavedState: vi.fn(() => null),
      ...extra,
    }
  }

  it('outlines the highlighted slot and dismisses it when the student moves the tile', () => {
    const onDismiss = vi.fn()
    const props = (state) => ({
      task: MATCH_TASK,
      activity: activityFor(state),
      tileHighlights: highlights,
      onDismissTileHighlights: onDismiss,
    })
    const { rerender } = render(<ActivityHost {...props({ p1: 'p2' })} />)
    expect(screen.getByTestId('match-slot-p1')).toHaveAttribute('data-tutor-highlight', 'true')
    expect(screen.getByTestId('tutor-tile-highlight-note')).toHaveTextContent('Look closer')

    rerender(<ActivityHost {...props({})} />)
    expect(onDismiss).toHaveBeenCalledWith(['h1'])
    expect(screen.queryByTestId('tutor-tile-highlight-note')).not.toBeInTheDocument()
  })

  it('draws nothing while the student reviews the task', () => {
    render(
      <ActivityHost
        task={MATCH_TASK}
        activity={activityFor({ p1: 'p2' }, { readSavedState: () => ({ p1: 'p2' }) })}
        reviewing
        tileHighlights={highlights}
        onDismissTileHighlights={vi.fn()}
      />
    )
    expect(screen.getByTestId('match-slot-p1')).not.toHaveAttribute('data-tutor-highlight')
  })
})
