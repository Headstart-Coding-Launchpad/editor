import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpRequestProvider, useHelpRequest } from '../helpRequestContext'
import { ASK_FOR_HELP_LABEL, HELP_BUTTON_LABEL, HELP_REQUESTED_LABEL } from '../helpLabel'

// StudentView re-renders often; the hint beside the task and the check popup read this context,
// so its value must only change when the offer of help does.
function Probe({ seen }) {
  seen.push(useHelpRequest())
  return null
}

describe('HelpRequestProvider', () => {
  it('keeps one value across re-renders with a new handler, and calls the newest handler', () => {
    const seen = []
    const first = vi.fn()
    const second = vi.fn()
    const at = (onAsk, requested = false) => (
      <HelpRequestProvider enabled onAsk={onAsk} requested={requested}>
        <Probe seen={seen} />
      </HelpRequestProvider>
    )
    const { rerender } = render(at(first))
    rerender(at(second))
    expect(seen.at(-1)).toBe(seen[0])
    seen.at(-1).onAsk()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    rerender(at(second, true))
    expect(seen.at(-1)).not.toBe(seen[0])
    expect(seen.at(-1).requested).toBe(true)
  })

  it('offers nothing where the top-bar Help does not show', () => {
    const seen = []
    render(
      <HelpRequestProvider enabled={false} onAsk={vi.fn()} requested={false}>
        <Probe seen={seen} />
      </HelpRequestProvider>
    )
    expect(seen.at(-1)).toBeNull()
  })

  it('keeps every Help wording in helpLabel.js', () => {
    expect(HELP_BUTTON_LABEL).toBe('✋ Help')
    expect(ASK_FOR_HELP_LABEL).toBe('✋ Ask for help')
    expect(HELP_REQUESTED_LABEL).toBe('✋ Help requested')
  })
})
