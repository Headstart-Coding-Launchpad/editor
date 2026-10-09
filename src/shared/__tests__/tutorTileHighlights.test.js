// Tutor tile highlights: which boards have them, which highlights are still on their tile, which
// a student's move clears, the StudentCard count and the report log.
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  activeTileHighlights,
  countActiveTileHighlights,
  isTileHighlightCurrent,
  listTileHighlights,
  normalizeTileHighlightLog,
  normalizeTileHighlightNote,
  staleTileHighlightIds,
  supportsTileHighlights,
  tileHighlightIdsForTarget,
  TILE_HIGHLIGHT_NOTE_MAX_LENGTH,
} from '../tutorTileHighlights.js'
import { useBoardTileHighlights } from '../../app/hooks/useBoardTileHighlights.js'
import {
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  INDENT_CODE_ARRANGE_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  PYTHON_CODE_ARRANGE_TASK,
} from '../../test/fixtures/legacyActivityTasks.js'

const RAW = {
  h2: { taskId: '8', targetId: 'L2', tileId: null, note: '', createdAt: 20 },
  h1: { taskId: '8', targetId: 'S1', tileId: 'S1d1', note: ' Count again ', createdAt: 10 },
  other: { taskId: '3', targetId: 'b1', tileId: 'd1', note: null, createdAt: 5 },
  broken: { taskId: '8', createdAt: 1 },
}

describe('supportsTileHighlights', () => {
  it('covers code_arrange slot mode, Match and Fill in the Gaps drag mode only', () => {
    expect(supportsTileHighlights(PYTHON_CODE_ARRANGE_TASK)).toBe(true)
    expect(supportsTileHighlights(MATCH_TASK)).toBe(true)
    expect(supportsTileHighlights(FILL_BLANK_DRAG_TASK)).toBe(true)
    expect(supportsTileHighlights(INDENT_CODE_ARRANGE_TASK)).toBe(false)
    expect(supportsTileHighlights(FILL_BLANK_TYPE_TASK)).toBe(false)
    expect(supportsTileHighlights(MULTIPLE_CHOICE_TASK)).toBe(false)
    expect(supportsTileHighlights({ id: 1, title: 'Code' })).toBe(false)
    expect(supportsTileHighlights(null)).toBe(false)
  })
})

describe('listing and drawing highlights', () => {
  it('lists the task’s well-formed highlights oldest first, with tidy notes', () => {
    expect(listTileHighlights(RAW, 8)).toEqual([
      { id: 'h1', taskId: '8', targetId: 'S1', tileId: 'S1d1', note: 'Count again', createdAt: 10 },
      { id: 'h2', taskId: '8', targetId: 'L2', tileId: null, note: null, createdAt: 20 },
    ])
    expect(listTileHighlights(RAW, 99)).toEqual([])
    expect(listTileHighlights(null, 8)).toEqual([])
  })

  it('draws only highlights whose blank still holds the tile they were made on', () => {
    const list = listTileHighlights(RAW, 8)
    expect(activeTileHighlights(list, { S1: 'S1d1' })).toEqual({
      S1: { id: 'h1', tileId: 'S1d1', note: 'Count again' },
      L2: { id: 'h2', tileId: null, note: null },
    })
    // The tile moved out of S1, and a tile now fills the highlighted empty L2.
    expect(activeTileHighlights(list, { S1: 'S1', L2: 'S1d1' })).toEqual({})
    expect(isTileHighlightCurrent(list[1], {})).toBe(true)
    expect(isTileHighlightCurrent(list[1], { L2: '' })).toBe(true)
  })

  it('finds every entry on one blank', () => {
    const list = listTileHighlights(RAW, 8)
    expect(tileHighlightIdsForTarget(list, 'S1')).toEqual(['h1'])
    expect(tileHighlightIdsForTarget(list, 'X')).toEqual([])
  })

  it('caps and trims notes', () => {
    expect(normalizeTileHighlightNote('   ')).toBeNull()
    expect(normalizeTileHighlightNote('x'.repeat(500))).toHaveLength(TILE_HIGHLIGHT_NOTE_MAX_LENGTH)
  })
})

describe('staleTileHighlightIds', () => {
  const list = listTileHighlights(RAW, 8)

  it('clears a highlight when the student moves its tile out of, or a tile into, its blank', () => {
    expect(staleTileHighlightIds(list, { S1: 'S1d1' }, {})).toEqual(['h1'])
    expect(staleTileHighlightIds(list, { S1: 'S1d1' }, { S1: 'S1' })).toEqual(['h1'])
    expect(staleTileHighlightIds(list, {}, { L2: 'D1' })).toEqual(['h2'])
  })

  it('keeps highlights the move did not touch, or that were already off their tile', () => {
    expect(staleTileHighlightIds(list, { S1: 'S1d1' }, { S1: 'S1d1', X: 'D1' })).toEqual([])
    // S1 never held S1d1 on this device (the highlight arrived late): not the student's move.
    expect(staleTileHighlightIds(list, { S1: 'S1', L2: 'L2' }, { S1: 'D1', L2: 'L2' })).toEqual([])
  })
})

describe('countActiveTileHighlights (StudentCard)', () => {
  it('counts against the student’s mirrored board', () => {
    const student = {
      teacherTileHighlights: RAW,
      currentCodeArrangeSlots: { S1: 'S1d1', L2: 'L2' },
    }
    // h1 is still on S1d1; h2's empty L2 now holds a tile.
    expect(countActiveTileHighlights(PYTHON_CODE_ARRANGE_TASK, student, 8)).toBe(1)
    expect(countActiveTileHighlights(PYTHON_CODE_ARRANGE_TASK, student, 9)).toBe(0)
    expect(countActiveTileHighlights(MULTIPLE_CHOICE_TASK, student, 8)).toBe(0)
  })

  it('reads a quiz’s currentAnswer', () => {
    const student = {
      teacherTileHighlights: {
        h: { taskId: '3', targetId: 'b1', tileId: 'd1', createdAt: 1 },
      },
      currentAnswer: JSON.stringify({ b1: 'd1' }),
    }
    expect(countActiveTileHighlights(FILL_BLANK_DRAG_TASK, student, 3)).toBe(1)
  })
})

describe('normalizeTileHighlightLog (report)', () => {
  it('lists entries oldest first and drops empty notes', () => {
    expect(
      normalizeTileHighlightLog({
        b: { targetId: 'p2', tileId: 'p1', note: null, at: 30 },
        a: { targetId: 'p1', tileId: 'p3', note: 'Read it aloud', at: 10 },
        bad: { tileId: 'p1', at: 5 },
      })
    ).toEqual([
      { targetId: 'p1', tileId: 'p3', note: 'Read it aloud', at: 10 },
      { targetId: 'p2', tileId: 'p1', at: 30 },
    ])
    expect(normalizeTileHighlightLog(undefined)).toEqual([])
  })
})

describe('useBoardTileHighlights', () => {
  const highlights = listTileHighlights(RAW, 8)

  function setup(initial) {
    const onDismiss = vi.fn()
    const hook = renderHook((props) => useBoardTileHighlights({ onDismiss, ...props }), {
      initialProps: { highlights, taskId: 8, enabled: true, ...initial },
    })
    return { ...hook, onDismiss }
  }

  it('returns the highlights still on their tile', () => {
    const { result } = setup({ state: { S1: 'S1d1' } })
    expect(Object.keys(result.current)).toEqual(['S1', 'L2'])
  })

  it('dismisses a highlight once the student moves its tile', () => {
    const { rerender, onDismiss } = setup({ state: { S1: 'S1d1' } })
    act(() => rerender({ highlights, taskId: 8, enabled: true, state: { S1: 'S1d1', L2: 'L2' } }))
    expect(onDismiss).toHaveBeenLastCalledWith(['h2'])
    act(() => rerender({ highlights, taskId: 8, enabled: true, state: { L2: 'L2' } }))
    expect(onDismiss).toHaveBeenLastCalledWith(['h1'])
  })

  it('never dismisses on a task change, a new highlight, or a read-only board', () => {
    const { rerender, onDismiss } = setup({ state: { S1: 'S1d1' } })
    act(() => rerender({ highlights, taskId: 9, enabled: true, state: {} }))
    act(() => rerender({ highlights: [...highlights], taskId: 9, enabled: true, state: {} }))
    expect(onDismiss).not.toHaveBeenCalled()

    const readOnly = setup({ state: { S1: 'S1d1' }, enabled: false })
    expect(readOnly.result.current).toEqual({})
    act(() => readOnly.rerender({ highlights, taskId: 8, enabled: false, state: {} }))
    expect(readOnly.onDismiss).not.toHaveBeenCalled()
  })
})
