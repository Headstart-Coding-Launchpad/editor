import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BadgeCelebration from '../BadgeCelebration'
import BadgeClassToast from '../BadgeClassToast'
import CodingMomentsPill from '../CodingMomentsPill'
import BadgeStickerSheet from '../BadgeStickerSheet'
import { resolveBadge } from '../../../../badges/badgeDisplay'
import {
  CELEBRATION_CARD_MS,
  CELEBRATION_DOCK_MS,
  CLASS_TOAST_MS,
  PRESENTATION_TOAST_MS,
  findNewAwards,
  mergeClassToasts,
} from '../../../../badges/celebration'

const BUG_HUNTER = resolveBadge('bug_hunter')
const KEYBOARD_WIZARD = resolveBadge('keyboard_wizard')
const originalMatchMedia = window.matchMedia

function mockReducedMotion(reduced) {
  window.matchMedia = (query) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

describe('BadgeCelebration', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  it('shows the card, announces it politely, then docks and finishes', () => {
    const onDone = vi.fn()
    render(<BadgeCelebration award={{ key: 'a1' }} badge={BUG_HUNTER} onDone={onDone} />)
    const layer = screen.getByTestId('badge-celebration')
    // A small card top-centre under the top bar, not a centred overlay.
    expect(layer.className).toContain('sv-badge-layer--top')
    const card = layer.firstChild
    expect(card).toHaveTextContent(BUG_HUNTER.title)
    expect(card).toHaveTextContent(BUG_HUNTER.blurb)
    expect(card.className).not.toContain('sv-badge-card--reduced')
    const live = document.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent(`Coding moment: ${BUG_HUNTER.title}.`)

    act(() => vi.advanceTimersByTime(CELEBRATION_CARD_MS))
    expect(card.className).toContain('sv-badge-card--docking')
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(CELEBRATION_DOCK_MS))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('uses a plain fade under prefers-reduced-motion', () => {
    mockReducedMotion(true)
    render(<BadgeCelebration award={{ key: 'a1' }} badge={BUG_HUNTER} onDone={() => {}} />)
    expect(screen.getByTestId('badge-celebration').firstChild.className).toContain(
      'sv-badge-card--reduced'
    )
  })

  it('never takes focus from the editor, even when the card is clicked', () => {
    render(
      <>
        <textarea aria-label="editor" />
        <BadgeCelebration award={{ key: 'a1' }} badge={BUG_HUNTER} onDone={() => {}} />
      </>
    )
    const editor = screen.getByLabelText('editor')
    editor.focus()
    const card = screen.getByTestId('badge-celebration').firstChild
    const notCancelled = fireEvent.mouseDown(card)
    expect(notCancelled).toBe(false)
    expect(document.activeElement).toBe(editor)
    expect(card.querySelector('button, [tabindex]')).toBeNull()
  })

  it('renders only the live region when there is no award', () => {
    render(<BadgeCelebration award={null} badge={null} onDone={() => {}} />)
    expect(screen.queryByTestId('badge-celebration')).toBeNull()
  })
})

describe('BadgeClassToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows "Name earned a badge: Badge" with the blurb only in the hover title, then finishes', () => {
    const onDone = vi.fn()
    render(
      <BadgeClassToast
        toast={{ id: 't1', recipientIds: ['sam'], names: ['Sam'] }}
        badge={BUG_HUNTER}
        onDone={onDone}
      />
    )
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent(`Sam earned a badge: ${BUG_HUNTER.emoji} Bug Hunter`)
    expect(toast.querySelector('.sv-badge-toast__icon')).toHaveTextContent('🎖️')
    expect(toast).not.toHaveTextContent(BUG_HUNTER.blurb)
    expect(toast).toHaveAttribute('title', BUG_HUNTER.blurb)
    act(() => vi.advanceTimersByTime(CLASS_TOAST_MS))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('merges a bulk award as a count, and is larger and longer on the presentation window', () => {
    const onDone = vi.fn()
    render(
      <BadgeClassToast
        toast={{ id: 'bulk-1', recipientIds: ['a', 'b', 'c'], names: ['A', 'B', 'C'] }}
        badge={KEYBOARD_WIZARD}
        presentation
        onDone={onDone}
      />
    )
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent(
      `3 students earned a badge: ${KEYBOARD_WIZARD.emoji} Keyboard Wizard`
    )
    expect(toast).not.toHaveTextContent('A earned')
    expect(toast.className).toContain('sv-badge-toast--presentation')
    act(() => vi.advanceTimersByTime(CLASS_TOAST_MS))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(PRESENTATION_TOAST_MS - CLASS_TOAST_MS))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe('CodingMomentsPill', () => {
  const moments = [{ badgeId: 'bug_hunter', badge: BUG_HUNTER }]

  it('is hidden until the first moment', () => {
    const { container } = render(<CodingMomentsPill moments={[]} muted={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is a compact icon-only button with no count', () => {
    render(
      <CodingMomentsPill
        moments={[...moments, { badgeId: 'keyboard_wizard', badge: KEYBOARD_WIZARD }]}
        muted={false}
      />
    )
    const button = screen.getByRole('button', { name: 'Coding moments' })
    expect(button).toHaveTextContent(/^🎖️$/)
    expect(button).not.toHaveTextContent('2')
    // The mute lives in the popover, not beside the button.
    expect(screen.queryByRole('button', { name: 'Mute sounds' })).not.toBeInTheDocument()
  })

  it('opens a popover with the moments and the Sounds mute', async () => {
    const user = userEvent.setup()
    const onMutedChange = vi.fn()
    render(<CodingMomentsPill moments={moments} muted={false} onMutedChange={onMutedChange} />)
    await user.click(screen.getByRole('button', { name: /Coding moments/ }))
    const popover = screen.getByRole('group', { name: 'Your coding moments' })
    expect(within(popover).getByRole('list', { name: 'My coding moments' })).toHaveTextContent(
      'Bug Hunter'
    )
    await user.click(within(popover).getByRole('button', { name: 'Mute sounds' }))
    expect(onMutedChange).toHaveBeenCalledWith(true)
  })

  it('disables the mute when the tutor turned sounds off', async () => {
    const user = userEvent.setup()
    render(<CodingMomentsPill moments={moments} muted={false} soundsOff />)
    await user.click(screen.getByRole('button', { name: /Coding moments/ }))
    expect(screen.getByRole('button', { name: 'Mute sounds' })).toBeDisabled()
  })
})

describe('BadgeStickerSheet', () => {
  it('staggers the stickers when animated', () => {
    render(
      <BadgeStickerSheet
        animate
        moments={[
          { badgeId: 'bug_hunter', badge: BUG_HUNTER },
          { badgeId: 'keyboard_wizard', badge: KEYBOARD_WIZARD },
        ]}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[1].style.getPropertyValue('--sv-sticker-delay')).toBe('180ms')
  })
})

describe('an Admin-catalogue badge on a student screen', () => {
  // Students can't read Firestore `badgeCatalogue`: the award's decision carries the snapshot.
  const decision = {
    status: 'awarded',
    announce: true,
    decidedAt: 9,
    badge: { emoji: '🎤', title: 'Star Speaker', blurb: 'Presented well.' },
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("shows the real emoji, title and blurb on the recipient's card", () => {
    const [award] = findNewAwards({ alex: { star_speaker: decision } }, new Set())
    render(
      <BadgeCelebration
        award={award}
        badge={resolveBadge(award.badgeId, [], award.decision)}
        onDone={() => {}}
      />
    )
    const card = screen.getByTestId('badge-celebration').firstChild
    expect(card).toHaveTextContent('🎤')
    expect(card).toHaveTextContent('Star Speaker')
    expect(card).toHaveTextContent('Presented well.')
  })

  it("names it on a classmate's toast", () => {
    const [toast] = mergeClassToasts(
      [],
      findNewAwards({ alex: { star_speaker: decision } }, new Set()),
      { viewerId: 'sam', students: { alex: { displayName: 'Alex' } } }
    )
    render(
      <BadgeClassToast
        toast={toast}
        badge={resolveBadge(toast.badgeId, [], { badge: toast.badge })}
        onDone={() => {}}
      />
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Alex earned a badge: 🎤 Star Speaker')
    expect(status).toHaveAttribute('title', 'Presented well.')
  })
})
