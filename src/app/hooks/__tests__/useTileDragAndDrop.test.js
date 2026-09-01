import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTileDragAndDrop, removeTileFromState } from '../useTileDragAndDrop'

function makeEvent(overrides = {}) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: null,
      dropEffect: null,
      setData: vi.fn(),
      getData: vi.fn(() => ''),
      setDragImage: vi.fn(),
    },
    ...overrides,
  }
}

describe('removeTileFromState', () => {
  it('removes a tile from a filled slot', () => {
    const state = { slot1: 'tile-a', slot2: 'tile-b' }
    expect(removeTileFromState(state, 'tile-a')).toEqual({ slot2: 'tile-b' })
  })

  it('returns unchanged state when tile not placed', () => {
    const state = { slot1: 'tile-a' }
    expect(removeTileFromState(state, 'tile-x')).toEqual({ slot1: 'tile-a' })
  })
})

describe('useTileDragAndDrop', () => {
  const baseConfig = {
    blocked: false,
    getLabelForTile: id => `Label for ${id}`,
  }

  it('initialises with empty state', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    expect(result.current.draggingTile).toBeNull()
    expect(result.current.dragOverTarget).toBeNull()
    expect(result.current.touchSelectedTile).toBeNull()
  })

  it('handleDragStart sets draggingTile and clears touchSelectedTile', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const event = makeEvent()
    act(() => {
      result.current.handleDragStart(event, 'tile-1')
    })
    expect(result.current.draggingTile).toBe('tile-1')
    expect(result.current.touchSelectedTile).toBeNull()
  })

  it('handleDragStart does nothing when blocked', () => {
    const { result } = renderHook(() => useTileDragAndDrop({ ...baseConfig, blocked: true }))
    const event = makeEvent()
    act(() => {
      result.current.handleDragStart(event, 'tile-1')
    })
    expect(result.current.draggingTile).toBeNull()
  })

  it('handleDragEnd clears draggingTile and dragOverTarget', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const event = makeEvent()
    act(() => { result.current.handleDragStart(event, 'tile-1') })
    act(() => { result.current.handleTargetDragOver(event, 'slot-a') })
    act(() => { result.current.handleDragEnd() })
    expect(result.current.draggingTile).toBeNull()
    expect(result.current.dragOverTarget).toBeNull()
  })

  it('handleTileClick toggles touchSelectedTile', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    act(() => { result.current.handleTileClick('tile-1') })
    expect(result.current.touchSelectedTile).toBe('tile-1')
    act(() => { result.current.handleTileClick('tile-1') })
    expect(result.current.touchSelectedTile).toBeNull()
  })

  it('handleTileClick does nothing when dragEnabled is false', () => {
    const { result } = renderHook(() => useTileDragAndDrop({ ...baseConfig, dragEnabled: false }))
    act(() => { result.current.handleTileClick('tile-1') })
    expect(result.current.touchSelectedTile).toBeNull()
  })

  it('handleTargetClick places selected tile into target slot', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const publishState = vi.fn()
    const state = {}
    act(() => { result.current.handleTileClick('tile-1') })
    act(() => { result.current.handleTargetClick('slot-a', state, publishState) })
    expect(publishState).toHaveBeenCalledWith({ 'slot-a': 'tile-1' })
    expect(result.current.touchSelectedTile).toBeNull()
  })

  it('handleTargetClick picks up tile already in slot', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const publishState = vi.fn()
    const state = { 'slot-a': 'tile-1' }
    act(() => { result.current.handleTargetClick('slot-a', state, publishState) })
    expect(result.current.touchSelectedTile).toBe('tile-1')
    expect(publishState).toHaveBeenCalledWith({})
  })

  it('handleTargetDragOver sets dragOverTarget', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const event = makeEvent()
    act(() => { result.current.handleTargetDragOver(event, 'slot-a') })
    expect(result.current.dragOverTarget).toBe('slot-a')
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('handleTargetDrop places dragged tile into target and clears drag state', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const publishState = vi.fn()
    const state = {}
    const event = makeEvent()
    event.dataTransfer.getData = vi.fn(mime =>
      mime === 'application/x-headstart-quiz-tile' ? 'tile-1' : ''
    )
    act(() => { result.current.handleDragStart(event, 'tile-1') })
    act(() => { result.current.handleTargetDrop(event, 'slot-a', state, publishState) })
    expect(publishState).toHaveBeenCalledWith({ 'slot-a': 'tile-1' })
    expect(result.current.draggingTile).toBeNull()
    expect(result.current.dragOverTarget).toBeNull()
  })

  it('handlePoolDrop removes tile from state', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const publishState = vi.fn()
    const state = { 'slot-a': 'tile-1' }
    const event = makeEvent()
    event.dataTransfer.getData = vi.fn(mime =>
      mime === 'application/x-headstart-quiz-tile' ? 'tile-1' : ''
    )
    act(() => { result.current.handlePoolDrop(event, state, publishState) })
    expect(publishState).toHaveBeenCalledWith({})
  })

  it('calls the optional onDragStart callback with the event and tile id', () => {
    const onDragStart = vi.fn()
    const { result } = renderHook(() => useTileDragAndDrop({ ...baseConfig, onDragStart }))
    const event = makeEvent()
    act(() => { result.current.handleDragStart(event, 'tile-1') })
    expect(onDragStart).toHaveBeenCalledWith(event, 'tile-1')
  })

  it('does not call onDragStart when blocked (CodeArrangeTask\'s live-cursor mirror must not fire)', () => {
    const onDragStart = vi.fn()
    const { result } = renderHook(() => useTileDragAndDrop({ ...baseConfig, blocked: true, onDragStart }))
    act(() => { result.current.handleDragStart(makeEvent(), 'tile-1') })
    expect(onDragStart).not.toHaveBeenCalled()
  })

  it('calls the optional onDragEnd callback (CodeArrangeTask\'s live-cursor mirror clear)', () => {
    const onDragEnd = vi.fn()
    const { result } = renderHook(() => useTileDragAndDrop({ ...baseConfig, onDragEnd }))
    act(() => { result.current.handleDragEnd() })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('clearDragOver resets dragOverTarget', () => {
    const { result } = renderHook(() => useTileDragAndDrop(baseConfig))
    const event = makeEvent()
    act(() => { result.current.handleTargetDragOver(event, 'slot-a') })
    act(() => { result.current.clearDragOver() })
    expect(result.current.dragOverTarget).toBeNull()
  })
})
