import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BrowserApp from '../BrowserApp.jsx'
import { makeDefaultDesktop } from '../../../desktopState.js'

const SITE_GRAPH = {
  homepageId: 'home',
  pages: {
    home: { url: 'https://kidsearch.example', title: 'KidSearch', kind: 'search', content: 'Search away.', links: [] },
    'wildlife-facts': {
      url: 'https://wildlife.example/facts',
      title: 'Wildlife Facts',
      kind: 'page',
      content: 'Blue whales are huge.',
      links: [{ label: 'Back home', to: 'home' }],
      searchable: { keywords: ['whale'], snippet: 'Facts about whales.' },
    },
    'poster-download': {
      url: 'https://wildlife.example/poster',
      title: 'Ocean Poster',
      kind: 'download',
      content: 'Get the poster.',
      download: { fileName: 'poster.txt', content: 'poster body' },
    },
    'broken-page': { url: 'https://wildlife.example/missing', title: 'Missing', kind: 'broken' },
  },
}

function setup(overrides = {}) {
  let state = makeDefaultDesktop(['browser'])
  const win = { ...state.windows[0], appId: 'browser', ...overrides }
  state = { ...state, windows: [win] }
  const onStateChange = vi.fn()
  const onInteraction = vi.fn()
  render(<BrowserApp win={win} state={state} onStateChange={onStateChange} disabled={false} siteGraph={SITE_GRAPH} onInteraction={onInteraction} />)
  return { state, win, onStateChange, onInteraction }
}

describe('BrowserApp', () => {
  it('opens on the site graph homepage by default, with its search box visible', () => {
    setup()
    expect(screen.getByText('KidSearch')).toBeInTheDocument()
    expect(screen.getByLabelText('Search the web')).toBeInTheDocument()
  })

  it('clicking a link navigates to the target page and records the visit', () => {
    const { onStateChange, onInteraction } = setup({ pageId: 'wildlife-facts' })
    expect(screen.getByText('Wildlife Facts')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Back home'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.windows[0].pageId).toBe('home')
    expect(nextState.browserVisited).toContain('home')
    expect(onInteraction).toHaveBeenCalledWith({ browserPage: 'home' })
  })

  it('submitting a search records the query and shows ranked results', () => {
    const { onStateChange, onInteraction } = setup()
    fireEvent.change(screen.getByLabelText('Search the web'), { target: { value: 'whale' } })
    fireEvent.submit(screen.getByLabelText('Search the web').closest('form'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.lastSearchQuery).toBe('whale')
    expect(nextState.windows[0].searchQuery).toBe('whale')
    expect(onInteraction).toHaveBeenCalledWith({ browserSearch: 'whale' })
    expect(screen.getByText('Wildlife Facts')).toBeInTheDocument()
  })

  it('Back is disabled at the start of history and enabled after navigating', () => {
    setup({ pageId: 'wildlife-facts' })
    expect(screen.getByLabelText('Back')).toBeDisabled()
    fireEvent.click(screen.getByText('Back home'))
    expect(screen.getByLabelText('Back')).not.toBeDisabled()
  })

  it('a broken page shows an unreachable message instead of content', () => {
    setup({ pageId: 'broken-page' })
    expect(screen.getByText("This page can't be reached.")).toBeInTheDocument()
  })

  it('typing an unknown address shows a not-found message', () => {
    setup()
    fireEvent.focus(screen.getByLabelText('Address bar'))
    fireEvent.change(screen.getByLabelText('Address bar'), { target: { value: 'https://nope.example' } })
    fireEvent.submit(screen.getByLabelText('Address bar').closest('form'))
    expect(screen.getByText(/can't find that page/)).toBeInTheDocument()
  })

  it('downloading a file writes it into /Downloads/ in fs', () => {
    const { onStateChange } = setup({ pageId: 'poster-download' })
    fireEvent.click(screen.getByText('⬇ Download poster.txt'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.fs['/Downloads/poster.txt']).toEqual({ type: 'file', content: 'poster body' })
  })
})
