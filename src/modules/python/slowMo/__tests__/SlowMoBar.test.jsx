import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SlowMoBar, { SlowMoRunLabel } from '../SlowMoBar.jsx'

const CONFIG = { speed: 1, showVariables: false, question: null, separateButton: false }

function view(extra = {}) {
  return {
    count: 4,
    position: 2,
    line: 3,
    finished: false,
    status: 'done',
    description: 'Step 2 of 4: line 3 ran.',
    ...extra,
  }
}

function controls(extra = {}) {
  return {
    config: CONFIG,
    enabled: true,
    throughRun: true,
    isViewer: false,
    pending: false,
    mode: 'idle',
    speed: 1,
    view: null,
    slowMo: vi.fn(),
    pause: vi.fn(),
    step: vi.fn(),
    back: vi.fn(),
    restart: vi.fn(),
    finish: vi.fn(),
    setSpeed: vi.fn(),
    ...extra,
  }
}

const button = (name) => screen.queryByRole('button', { name })

describe('SlowMoBar: Run plays in slow-mo (the default)', () => {
  it('has no Slow-mo button, and before a run only the speed slider and the status', () => {
    render(<SlowMoBar slowMo={controls()} />)
    expect(button('Slow-mo')).toBeNull()
    expect(button('Pause')).toBeNull()
    expect(button('Step')).toBeNull()
    expect(button('Finish')).toBeNull()
    expect(screen.getByRole('slider')).toHaveValue('1')
    expect(screen.getByText(/Press Run to watch your program/)).toBeInTheDocument()
  })

  it('shows Pause, Step, Step back, Restart and Finish while playing', () => {
    const slowMo = controls({ mode: 'playing', view: view() })
    render(<SlowMoBar slowMo={slowMo} />)
    for (const name of ['Pause', 'Step', 'Step back', 'Restart', 'Finish']) {
      expect(button(name)).toBeEnabled()
    }
    expect(button('Play')).toBeNull()
    fireEvent.click(button('Pause'))
    expect(slowMo.pause).toHaveBeenCalled()
    fireEvent.click(button('Finish'))
    expect(slowMo.finish).toHaveBeenCalled()
  })

  it('turns Pause into Play while paused, which carries on', () => {
    const slowMo = controls({ mode: 'paused', view: view() })
    render(<SlowMoBar slowMo={slowMo} />)
    expect(button('Pause')).toBeNull()
    fireEvent.click(button('Play'))
    expect(slowMo.slowMo).toHaveBeenCalled()
  })

  it('disables Step and Finish at the end, and Play plays it again', () => {
    render(
      <SlowMoBar
        slowMo={controls({ mode: 'finished', view: view({ position: 4, finished: true }) })}
      />
    )
    expect(button('Finish')).toBeDisabled()
    expect(button('Step')).toBeDisabled()
    expect(button('Play')).toBeEnabled()
    expect(button('Play')).toHaveAttribute('title', 'Play it again from the start')
  })
})

describe('SlowMoBar: separateButton', () => {
  it('keeps the Slow-mo button and every control from the start', () => {
    const slowMo = controls({ throughRun: false, config: { ...CONFIG, separateButton: true } })
    render(<SlowMoBar slowMo={slowMo} />)
    expect(button('Slow-mo')).toBeEnabled()
    expect(button('Pause')).toBeDisabled()
    expect(button('Step')).toBeEnabled()
    expect(button('Finish')).toBeDisabled()
    expect(screen.getByText(/Press Slow-mo to watch your program/)).toBeInTheDocument()
    fireEvent.click(button('Slow-mo'))
    expect(slowMo.slowMo).toHaveBeenCalled()
  })
})

describe('SlowMoBar: Go Live viewer', () => {
  it('shows the status only', () => {
    render(<SlowMoBar slowMo={controls({ isViewer: true, mode: 'playing', view: view() })} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/Slow-mo · Playing · Step 2 of 4/)).toBeInTheDocument()
  })
})

describe('SlowMoRunLabel', () => {
  it('reads "Run (slow-mo)" with the ▶ hidden from screen readers', () => {
    render(
      <button type="button">
        <SlowMoRunLabel />
      </button>
    )
    const run = screen.getByRole('button')
    expect(run).toHaveTextContent('▶ Run (slow-mo)')
    expect(run.querySelector('[aria-hidden="true"]')).toHaveTextContent('▶')
  })
})
