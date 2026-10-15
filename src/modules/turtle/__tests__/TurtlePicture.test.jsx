import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TurtlePicture from '../TurtlePicture.jsx'

// jsdom has no canvas: a 2D context that accepts every call, so the player really plays.
function recordingContext(canvas) {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'canvas') return canvas
        return () => {}
      },
      set() {
        return true
      },
    }
  )
}

let originalGetContext
let originalMatchMedia

beforeEach(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return recordingContext(this)
  }
  originalMatchMedia = window.matchMedia
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  window.matchMedia = originalMatchMedia
})

function reduceMotion(on) {
  window.matchMedia = vi.fn(() => ({ matches: on }))
}

// speed(1): a 100-unit line takes 310 ms, so the drawing is still playing when we look.
const slowRun = (runId) => ({
  runId,
  state: { x: 100, y: 0, heading: 0 },
  commands: [
    { type: 'speed', speed: 1 },
    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, heading: 0, color: 'red', width: 1 },
  ],
})

describe('TurtlePicture', () => {
  it('shows the first result it sees finished, and plays a new run with Skip', () => {
    reduceMotion(false)
    const onPlayingChange = vi.fn()
    const { rerender } = render(
      <TurtlePicture result={slowRun('r1')} onPlayingChange={onPlayingChange} />
    )
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()

    rerender(<TurtlePicture result={slowRun('r2')} onPlayingChange={onPlayingChange} />)
    expect(screen.getByRole('button', { name: /Skip/ })).toBeTruthy()
    expect(onPlayingChange).toHaveBeenLastCalledWith(true)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Skip/ }))
    })
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
    expect(onPlayingChange).toHaveBeenLastCalledWith(false)
  })

  it('keeps playing when the same run arrives again (a Go Live snapshot)', () => {
    reduceMotion(false)
    const { rerender } = render(<TurtlePicture result={slowRun('r1')} />)
    rerender(<TurtlePicture result={slowRun('r2')} />)
    rerender(<TurtlePicture result={slowRun('r2')} />)
    expect(screen.getByRole('button', { name: /Skip/ })).toBeTruthy()
  })

  it('a result with no runId (scrub preview, slow-mo) stops playback and draws at once', () => {
    reduceMotion(false)
    const { rerender } = render(<TurtlePicture result={slowRun('r1')} />)
    rerender(<TurtlePicture result={slowRun('r2')} />)
    rerender(<TurtlePicture result={{ ...slowRun('r2'), runId: undefined }} />)
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
  })

  it('never plays when animate is off (a watching tutor)', () => {
    reduceMotion(false)
    const { rerender } = render(<TurtlePicture result={null} animate={false} />)
    rerender(<TurtlePicture result={slowRun('r1')} animate={false} />)
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
  })

  it('under reduced motion draws at once and offers Play', () => {
    reduceMotion(true)
    const { rerender } = render(<TurtlePicture result={null} />)
    rerender(<TurtlePicture result={slowRun('r1')} />)
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    })
    expect(screen.getByRole('button', { name: /Skip/ })).toBeTruthy()
  })

  it('describes the drawing for screen readers', () => {
    reduceMotion(false)
    render(<TurtlePicture result={slowRun('r1')} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('1 line in red')
  })
})
