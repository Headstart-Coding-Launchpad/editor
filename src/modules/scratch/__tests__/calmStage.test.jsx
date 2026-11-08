import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  CALM_FULLSCREEN_Z,
  CalmRunButton,
  CalmStopButton,
  CalmEnlargeButton,
  CalmSpriteSettings,
  CalmStageShell,
} from '../calm/CalmStage.jsx'
import {
  calmExplainerWidth,
  calmFullscreenStageScale,
  calmStageResolution,
  calmStageScale,
  scratchCheckPrompt,
} from '../calm/calmPalette.js'

// The calm Scratch stage column as ScratchWorkspace lays it out: Run and Stop, then Enlarge and
// Reset Stage, then the stage inside CalmStageShell (one element, never remounted), with the
// blocks pane beside it. `onRun` counts presses so a test can see Run working in full screen.
function StageColumn({ readOnly = false, hint = 'Have a go, then tap the green flag.' }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [runs, setRuns] = useState(0)
  const run = <CalmRunButton onRun={() => setRuns((n) => n + 1)} big={!fullscreen} />
  const stop = <CalmStopButton onStop={() => {}} big={!fullscreen} />
  const reset = (
    <button type="button" data-testid="reset-stage">
      Reset Stage
    </button>
  )
  return (
    <div>
      <div data-testid="blocks-pane" style={fullscreen ? { visibility: 'hidden' } : undefined}>
        <span>when flag clicked</span>
      </div>
      {!fullscreen && (
        <div>
          {run}
          {stop}
          <CalmEnlargeButton onEnlarge={() => setFullscreen(true)} />
          {reset}
        </div>
      )}
      <CalmStageShell
        fullscreen={fullscreen}
        onBack={() => setFullscreen(false)}
        readOnly={readOnly}
        hint={hint}
        controls={
          <>
            {run}
            {stop}
            {reset}
          </>
        }
      >
        <canvas data-testid="stage-canvas" />
      </CalmStageShell>
      <span data-testid="runs">{runs}</span>
    </div>
  )
}

describe('Fun moment: Enlarge makes the stage fill the screen, Back brings the work back untouched', () => {
  it('Enlarge opens the stage full screen with a big Run, and Back returns to the same stage and blocks', async () => {
    const user = userEvent.setup()
    render(<StageColumn />)
    const canvas = screen.getByTestId('stage-canvas')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Enlarge/ }))

    const full = screen.getByRole('dialog', { name: /stage/i })
    expect(within(full).getByTestId('stage-canvas')).toBe(canvas)
    expect(full.style.position).toBe('fixed')
    await user.click(within(full).getByRole('button', { name: 'Run' }))
    expect(screen.getByTestId('runs')).toHaveTextContent('1')
    expect(within(full).getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(within(full).getByTestId('reset-stage')).toBeInTheDocument()
    expect(full).toHaveTextContent('Have a go, then tap the green flag.')
    // The blocks stay mounted (hidden), never thrown away.
    expect(screen.getByTestId('blocks-pane')).toHaveTextContent('when flag clicked')

    await user.click(within(full).getByRole('button', { name: /Back/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-canvas')).toBe(canvas)
    expect(screen.getByTestId('blocks-pane')).toBeVisible()
  })

  it('Escape goes back too', async () => {
    const user = userEvent.setup()
    render(<StageColumn />)
    await user.click(screen.getByRole('button', { name: /Enlarge/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape leaves full screen only: a window around it (the tutor’s student window) stays open', async () => {
    const user = userEvent.setup()
    const outerEscape = vi.fn()
    const onKey = (e) => e.key === 'Escape' && outerEscape()
    window.addEventListener('keydown', onKey)
    try {
      render(<StageColumn readOnly />)
      await user.click(screen.getByRole('button', { name: /Enlarge/ }))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(outerEscape).not.toHaveBeenCalled()
      await user.keyboard('{Escape}')
      expect(outerEscape).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', onKey)
    }
  })

  it('sits under the classroom’s own overlays (the tutor’s Coding Paused screen is 999)', async () => {
    const user = userEvent.setup()
    render(<StageColumn />)
    await user.click(screen.getByRole('button', { name: /Enlarge/ }))
    expect(CALM_FULLSCREEN_Z).toBeLessThan(200)
    expect(Number(screen.getByRole('dialog').style.zIndex)).toBe(CALM_FULLSCREEN_Z)
  })

  it('a tutor watching (read-only) gets the full-size stage with only Back: no Run, Stop or hint', async () => {
    const user = userEvent.setup()
    render(<StageColumn readOnly />)
    await user.click(screen.getByRole('button', { name: /Enlarge/ }))
    const full = screen.getByRole('dialog')
    expect(within(full).getByRole('button', { name: /Back/ })).toBeInTheDocument()
    expect(within(full).queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expect(full).not.toHaveTextContent('Have a go')
  })

  it('Back is the way to the hidden blocks for a highlight (category, Costumes, Sounds)', async () => {
    const user = userEvent.setup()
    render(<StageColumn />)
    await user.click(screen.getByRole('button', { name: /Enlarge/ }))
    const back = screen.getByRole('button', { name: /Back/ })
    expect(back.getAttribute('data-highlight-reveal').split(' ')).toEqual(
      expect.arrayContaining(['category', 'costumes_tab', 'sounds_tab'])
    )
  })
})

describe('the calm stage controls', () => {
  it('Run is a big labelled green button that is the green flag target; Stop is red', () => {
    render(
      <>
        <CalmRunButton onRun={() => {}} big />
        <CalmStopButton onStop={() => {}} big />
      </>
    )
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run).toHaveTextContent('Run')
    expect(run).toHaveAttribute('data-highlight-target', 'green_flag')
    expect(parseInt(run.style.minHeight, 10)).toBeGreaterThanOrEqual(52)
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop).toHaveAttribute('data-highlight-target', 'stop')
    expect(stop.style.background).toMatch(/239, 68, 68|#ef4444/i)
  })

  it('Enlarge is labelled with words', () => {
    render(<CalmEnlargeButton onEnlarge={() => {}} />)
    expect(screen.getByTestId('scratch-enlarge')).toHaveTextContent('Enlarge')
  })

  it('Sprite settings is one labelled button that folds the property row', async () => {
    const user = userEvent.setup()
    render(
      <CalmSpriteSettings>
        <label>
          x <input defaultValue="0" />
        </label>
      </CalmSpriteSettings>
    )
    const button = screen.getByTestId('scratch-sprite-settings')
    expect(button).toHaveTextContent('Sprite settings')
    expect(parseInt(button.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
    expect(screen.queryByLabelText('x')).not.toBeInTheDocument()
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('x')).toBeInTheDocument()
  })

  it('Sprite settings starts open when the task checks a sprite property (the child watches x and y)', () => {
    render(
      <CalmSpriteSettings defaultOpen>
        <label>
          x <input defaultValue="0" />
        </label>
      </CalmSpriteSettings>
    )
    expect(screen.getByLabelText('x')).toBeInTheDocument()
  })

  it('Sprite settings hides with nothing to fold (the Stage tile) but keeps its open state', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <CalmSpriteSettings available>
        <span>props</span>
      </CalmSpriteSettings>
    )
    await user.click(screen.getByTestId('scratch-sprite-settings'))
    rerender(
      <CalmSpriteSettings available={false}>
        <span>props</span>
      </CalmSpriteSettings>
    )
    expect(screen.queryByTestId('scratch-sprite-settings')).not.toBeInTheDocument()
    rerender(
      <CalmSpriteSettings available>
        <span>props</span>
      </CalmSpriteSettings>
    )
    expect(screen.getByText('props')).toBeInTheDocument()
  })
})

describe('calm stage sizes', () => {
  // The workspace beside the explainer column: about 1090px at 1366x768, 772px at 1024x768.
  it('starts small: 320x240 at 1366, about 256 wide at 1024, never under 240', () => {
    expect(Math.round(calmStageScale(1090, 690) * 480)).toBeGreaterThanOrEqual(316)
    expect(Math.round(calmStageScale(1090, 690) * 480)).toBeLessThanOrEqual(324)
    const at1024 = Math.round(calmStageScale(772, 690) * 480)
    expect(at1024).toBeGreaterThanOrEqual(240)
    expect(at1024).toBeLessThanOrEqual(258)
    expect(Math.round(calmStageScale(300, 690) * 480)).toBe(240)
    expect(calmStageScale(5000, 2000)).toBeLessThanOrEqual(1)
  })

  it('the playground (no explainer, a wider workspace) gets the same 320 at 1366', () => {
    expect(Math.round(calmStageScale(1334, 690, 1366) * 480)).toBe(320)
    expect(Math.round(calmStageScale(992, 690, 1024) * 480)).toBe(256)
    expect(Math.round(calmStageScale(1090, 690, 1366) * 480)).toBe(318)
  })

  it('a short screen shrinks it so the column still fits', () => {
    expect(calmStageScale(1090, 420)).toBeLessThan(calmStageScale(1090, 690))
  })

  it('full screen fills the window under the bar, keeping 4:3', () => {
    const scale = calmFullscreenStageScale(1366, 768)
    expect(360 * scale).toBeLessThanOrEqual(768 - 56)
    expect(360 * scale).toBeGreaterThan(640)
    expect(480 * scale).toBeLessThanOrEqual(1366)
  })

  it('draws the enlarged stage sharp (a bigger backing store), the small one at 480x360', () => {
    expect(calmStageResolution(0.66, 1)).toBe(1)
    expect(calmStageResolution(1.9, 1)).toBe(2)
    expect(calmStageResolution(1.9, 2)).toBe(3)
  })

  it('the explainer column is about 232px at 1366 and 208px at 1024, at most 320', () => {
    expect(calmExplainerWidth(1334)).toBeGreaterThanOrEqual(226)
    expect(calmExplainerWidth(1334)).toBeLessThanOrEqual(240)
    expect(calmExplainerWidth(992)).toBe(208)
    expect(calmExplainerWidth(3000)).toBe(320)
  })
})

describe('the line under the stage (calm screen)', () => {
  const base = { hasChecks: true, attempted: false, running: false }
  it('drops the grey "Run your code to check" line on the calm screen (the hint says it)', () => {
    expect(scratchCheckPrompt({ ...base, calm: true, afterRun: true })).toBeNull()
    expect(scratchCheckPrompt({ ...base, calm: false, afterRun: true })).toBe(
      'Run your code to check'
    )
  })
  it('keeps the manual-check line (it names the Check button)', () => {
    expect(scratchCheckPrompt({ ...base, calm: true, manual: true })).toBe(
      'Run your code, then click Check'
    )
  })
  it('says nothing once checked or while running', () => {
    expect(scratchCheckPrompt({ ...base, calm: false, afterRun: true, attempted: true })).toBeNull()
    expect(scratchCheckPrompt({ ...base, calm: false, afterRun: true, running: true })).toBeNull()
  })
})
