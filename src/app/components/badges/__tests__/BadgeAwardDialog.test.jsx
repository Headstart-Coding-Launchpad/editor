import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgeAwardDialog from '../BadgeAwardDialog'
import { getBadgeDefinitions } from '../../../../badges/registry'

const ALEX = { anonymousId: 's1', displayName: 'Alex' }
const SAM = { anonymousId: 's2', displayName: 'Sam' }

function renderDialog(props = {}) {
  const handlers = {
    onDecideBadge: vi.fn(async () => ({ committed: true })),
    onRevokeBadge: vi.fn(async () => ({ committed: true })),
    onClose: vi.fn(),
  }
  render(<BadgeAwardDialog students={[ALEX]} decisions={{}} taskId={4} {...handlers} {...props} />)
  return { ...handlers, ...props }
}

describe('BadgeAwardDialog', () => {
  it('lists every registry badge, rule-backed and tutor-only', () => {
    renderDialog()
    for (const badge of getBadgeDefinitions()) {
      expect(screen.getByTestId(`badge-option-${badge.id}`)).toHaveTextContent(badge.title)
    }
  })

  it('lists catalogue badges and leaves archived ones out', () => {
    renderDialog({
      catalogueBadges: [
        { id: 'star_speaker', emoji: '🎤', title: 'Star Speaker', blurb: 'Presented well.' },
        { id: 'old_one', emoji: '🗿', title: 'Old One', archived: true },
      ],
    })
    expect(screen.getByTestId('badge-option-star_speaker')).toHaveTextContent('Star Speaker')
    expect(screen.queryByTestId('badge-option-old_one')).not.toBeInTheDocument()
  })

  it('greys a badge the student already holds and does not award it again', async () => {
    const user = userEvent.setup()
    const { onDecideBadge } = renderDialog({
      decisions: { s1: { bug_hunter: { status: 'awarded' }, code_fixer: { status: 'revoked' } } },
    })
    const held = screen.getByTestId('badge-option-bug_hunter')
    expect(held).toHaveAttribute('aria-disabled', 'true')
    expect(held).toHaveTextContent('Awarded')
    expect(screen.getByTestId('badge-option-code_fixer')).toHaveAttribute('aria-disabled', 'false')
    await user.click(held)
    expect(onDecideBadge).not.toHaveBeenCalled()
  })

  it('shows the exact rule on hover', () => {
    renderDialog()
    const option = screen.getByTestId('badge-option-bug_hunter')
    expect(option.getAttribute('title')).toContain('First in class to make a real pass')
    fireEvent.mouseEnter(option)
    expect(screen.getByTestId('badge-rule-detail')).toHaveTextContent(
      'First in class to make a real pass on a Debug Code Task'
    )
  })

  it('awards manually, replacing a dismissal or revoke', async () => {
    const user = userEvent.setup()
    const { onDecideBadge } = renderDialog()
    await user.click(screen.getByTestId('badge-option-helpful_coder'))
    expect(onDecideBadge).toHaveBeenCalledWith(
      's1',
      'helpful_coder',
      {
        status: 'awarded',
        source: 'manual',
        reason: null,
        taskId: 4,
        announce: true,
        bulkId: null,
        badge: null,
      },
      { replaceStatuses: ['dismissed', 'revoked'] }
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Helpful Coder awarded to Alex')
  })

  it("copies a catalogue badge's emoji, title and blurb onto the decision", async () => {
    const user = userEvent.setup()
    const { onDecideBadge } = renderDialog({
      catalogueBadges: [
        { id: 'star_speaker', emoji: '🎤', title: 'Star Speaker', blurb: 'Presented well.' },
      ],
    })
    await user.click(screen.getByTestId('badge-option-star_speaker'))
    expect(onDecideBadge.mock.calls[0][2].badge).toEqual({
      emoji: '🎤',
      title: 'Star Speaker',
      blurb: 'Presented well.',
    })
  })

  it('renders a held catalogue badge from its snapshot when the catalogue is not loaded', () => {
    renderDialog({
      decisions: {
        s1: {
          star_speaker: {
            status: 'awarded',
            badge: { emoji: '🎤', title: 'Star Speaker', blurb: 'Presented well.' },
          },
        },
      },
    })
    const list = screen.getByRole('region', { name: "Alex's badges" })
    expect(within(list).getByText('Star Speaker')).toBeInTheDocument()
  })

  it('respects the announce checkbox', async () => {
    const user = userEvent.setup()
    const { onDecideBadge } = renderDialog()
    await user.click(screen.getByLabelText('Announce to class'))
    await user.click(screen.getByTestId('badge-option-creative_coder'))
    expect(onDecideBadge.mock.calls[0][2].announce).toBe(false)
  })

  it('awards several students with one shared bulkId, skipping those who hold it', async () => {
    const user = userEvent.setup()
    const CARA = { anonymousId: 's3', displayName: 'Cara' }
    const { onDecideBadge } = renderDialog({
      students: [ALEX, SAM, CARA],
      decisions: { s3: { experimenter: { status: 'awarded' } } },
    })
    expect(screen.queryByText('Awarded this lesson')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('badge-option-experimenter'))
    expect(onDecideBadge).toHaveBeenCalledTimes(2)
    const ids = onDecideBadge.mock.calls.map((call) => call[0])
    expect(ids).toEqual(['s1', 's2'])
    const bulkIds = onDecideBadge.mock.calls.map((call) => call[2].bulkId)
    expect(bulkIds[0]).toMatch(/^bulk-experimenter-/)
    expect(bulkIds[1]).toBe(bulkIds[0])
  })

  it('reports an award another tab made first', async () => {
    const user = userEvent.setup()
    renderDialog({
      onDecideBadge: vi.fn(async () => ({ committed: false, decision: { status: 'awarded' } })),
    })
    await user.click(screen.getByTestId('badge-option-focused_coder'))
    expect(await screen.findByRole('status')).toHaveTextContent('already awarded')
  })

  it("lists the student's awarded badges with Revoke", async () => {
    const user = userEvent.setup()
    const { onRevokeBadge } = renderDialog({
      decisions: {
        s1: { bug_hunter: { status: 'awarded' }, persistence: { status: 'dismissed' } },
      },
    })
    const list = screen.getByRole('region', { name: "Alex's badges" })
    expect(within(list).getByText('Bug Hunter')).toBeInTheDocument()
    expect(within(list).queryByText('Persistence')).not.toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Revoke Bug Hunter' }))
    expect(onRevokeBadge).toHaveBeenCalledWith('s1', 'bug_hunter')
  })

  it('closes on Escape without letting it reach the window', () => {
    const windowKey = vi.fn()
    window.addEventListener('keydown', windowKey)
    const { onClose } = renderDialog()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close badge picker' }), {
      key: 'Escape',
    })
    expect(onClose).toHaveBeenCalled()
    expect(windowKey).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowKey)
  })
})
