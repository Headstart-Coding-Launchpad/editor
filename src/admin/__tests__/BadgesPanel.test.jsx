import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BadgesPanel from '../BadgesPanel'
import { getBadgeDefinitions } from '../../badges/registry'

const service = vi.hoisted(() => ({
  fetchBadgeCatalogue: vi.fn(),
  saveCatalogueBadge: vi.fn(),
  setCatalogueBadgeArchived: vi.fn(),
}))

vi.mock('../../badges/catalogueService', () => service)
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'admin@x.test' } }) }))

const STAR = {
  id: 'star_speaker',
  emoji: '🎤',
  title: 'Star Speaker',
  blurb: 'Presented well.',
  archived: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  service.fetchBadgeCatalogue.mockResolvedValue([STAR])
  service.saveCatalogueBadge.mockImplementation(async (entry) => ({ ...entry, archived: false }))
  service.setCatalogueBadgeArchived.mockResolvedValue(undefined)
})

describe('BadgesPanel', () => {
  it('lists every registry badge read-only, with its rule and kind', async () => {
    render(<BadgesPanel />)
    await screen.findByTestId('catalogue-row-star_speaker')
    for (const badge of getBadgeDefinitions()) {
      const row = screen.getByTestId(`registry-row-${badge.id}`)
      expect(row).toHaveTextContent(badge.title)
      expect(row).toHaveTextContent(badge.rule ? 'Rule-backed' : 'Tutor-only')
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    }
    expect(screen.getByTestId('registry-row-bug_hunter')).toHaveTextContent('Yes')
  })

  it('adds a catalogue badge, deriving its id from the title', async () => {
    const user = userEvent.setup()
    render(<BadgesPanel />)
    await screen.findByTestId('catalogue-row-star_speaker')
    await user.click(screen.getByRole('button', { name: 'Add badge' }))
    await user.type(screen.getByLabelText('Emoji'), '🌈')
    await user.type(screen.getByLabelText('Title'), 'Great Teamwork')
    expect(screen.getByLabelText('Id')).toHaveValue('great_teamwork')
    await user.type(screen.getByLabelText(/Blurb/), 'Worked well with a partner.')
    await user.click(screen.getByRole('button', { name: 'Save badge' }))
    expect(service.saveCatalogueBadge).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'great_teamwork', emoji: '🌈', title: 'Great Teamwork' }),
      expect.objectContaining({ isNew: true, updatedBy: 'admin@x.test' })
    )
    expect(await screen.findByTestId('catalogue-row-great_teamwork')).toBeInTheDocument()
  })

  it('refuses a registry id and an emoji another badge already uses', async () => {
    const user = userEvent.setup()
    render(<BadgesPanel />)
    await screen.findByTestId('catalogue-row-star_speaker')
    await user.click(screen.getByRole('button', { name: 'Add badge' }))
    await user.type(screen.getByLabelText('Emoji'), '🐛')
    await user.type(screen.getByLabelText('Title'), 'Bug Hunter')
    await user.type(screen.getByLabelText(/Blurb/), 'Copy.')
    await user.click(screen.getByRole('button', { name: 'Save badge' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('"bug_hunter" is a built-in badge id')
    expect(alert).toHaveTextContent('🐛 is already the Bug Hunter badge')
    expect(service.saveCatalogueBadge).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Emoji'))
    await user.type(screen.getByLabelText('Emoji'), '🎤')
    await user.clear(screen.getByLabelText('Id'))
    await user.type(screen.getByLabelText('Id'), 'mic_drop')
    await user.click(screen.getByRole('button', { name: 'Save badge' }))
    expect(screen.getByRole('alert')).toHaveTextContent('🎤 is already the Star Speaker badge')
  })

  it('edits a badge without changing its id', async () => {
    const user = userEvent.setup()
    render(<BadgesPanel />)
    await user.click(await screen.findByRole('button', { name: 'Edit Star Speaker' }))
    expect(screen.getByLabelText('Id')).toBeDisabled()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Super Speaker')
    await user.click(screen.getByRole('button', { name: 'Save badge' }))
    expect(service.saveCatalogueBadge).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'star_speaker', title: 'Super Speaker', emoji: '🎤' }),
      expect.objectContaining({ isNew: false })
    )
  })

  it('archives and restores a badge', async () => {
    const user = userEvent.setup()
    render(<BadgesPanel />)
    await user.click(await screen.findByRole('button', { name: 'Archive Star Speaker' }))
    expect(service.setCatalogueBadgeArchived).toHaveBeenCalledWith('star_speaker', true, {
      updatedBy: 'admin@x.test',
    })
    expect(screen.getByTestId('catalogue-row-star_speaker')).toHaveTextContent('Archived')
    await user.click(screen.getByRole('button', { name: 'Restore Star Speaker' }))
    expect(service.setCatalogueBadgeArchived).toHaveBeenLastCalledWith('star_speaker', false, {
      updatedBy: 'admin@x.test',
    })
  })
})
