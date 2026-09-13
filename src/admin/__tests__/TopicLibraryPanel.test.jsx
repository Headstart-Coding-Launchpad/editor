import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TopicLibraryPanel from '../TopicLibraryPanel'
import { setDoc, deleteDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  onSnapshot: vi.fn(() => vi.fn()),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((_db, col, id) => ({ __collection: col, __id: id })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}))

vi.mock('../../shared/firebase', () => ({
  db: {},
  auth: {},
  firestore: {},
}))

vi.mock('../../shared/topicLibrary', () => ({
  normalizeTopicLibrary: (raw) => (Array.isArray(raw) ? raw.filter((t) => t.id && t.title) : []),
  searchTopics: (topics, query) => {
    if (!query) return topics
    const q = query.toLowerCase()
    return topics.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        (t.aliases ?? []).some((a) => a?.toLowerCase().includes(q))
    )
  },
  clearTopicCache: vi.fn(),
}))

vi.mock('../../shared/MarkdownFieldEditor', () => ({
  MarkdownFieldEditor: ({ value, onChange, placeholder }) => (
    <textarea
      data-testid="md-editor"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

import { onSnapshot } from 'firebase/firestore'

let snapshotCallback = null

function fireTopics(topics) {
  act(() => {
    snapshotCallback?.({
      docs: topics.map((t) => ({ id: t.id, data: () => t })),
    })
  })
}

const TOPIC_A = {
  id: 'for-loop',
  title: 'For loops',
  category: 'Loop',
  types: [],
  aliases: ['for loop'],
  related: [],
  summary: '',
  description: '',
  syntax: '',
}
const TOPIC_B = {
  id: 'variable',
  title: 'Variables',
  category: 'Concept',
  types: [],
  aliases: [],
  related: [],
  summary: '',
  description: '',
  syntax: '',
}

describe('TopicLibraryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshotCallback = null

    onSnapshot.mockImplementation((_colRef, successCb) => {
      snapshotCallback = successCb
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the topic list from a Firestore snapshot', () => {
    render(<TopicLibraryPanel />)
    fireTopics([TOPIC_A, TOPIC_B])
    expect(screen.getByText('For loops')).toBeInTheDocument()
    expect(screen.getByText('Variables')).toBeInTheDocument()
  })

  it('filters the topic list when the search input changes', async () => {
    const user = userEvent.setup()
    render(<TopicLibraryPanel />)
    fireTopics([TOPIC_A, TOPIC_B])

    await user.type(screen.getByPlaceholderText('Search topics…'), 'for')
    expect(screen.getByText('For loops')).toBeInTheDocument()
    expect(screen.queryByText('Variables')).not.toBeInTheDocument()
  })

  it('shows an empty form when New Topic is clicked', async () => {
    const user = userEvent.setup()
    render(<TopicLibraryPanel />)
    fireTopics([])

    await user.click(screen.getByRole('button', { name: /\+ New Topic/i }))
    // ID input appears (only shown for new topics)
    expect(screen.getByPlaceholderText('e.g. for-loop')).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g. For loops')).toHaveValue('')
  })

  it('populates the form when an existing topic is selected from the list', async () => {
    const user = userEvent.setup()
    render(<TopicLibraryPanel />)
    fireTopics([TOPIC_A])

    await user.click(screen.getByRole('button', { name: /For loops/i }))
    // Title input is pre-filled with the topic title
    expect(screen.getByDisplayValue('For loops')).toBeInTheDocument()
    // Category is pre-filled
    expect(screen.getByDisplayValue('Loop')).toBeInTheDocument()
  })

  it('calls setDoc with correct shape when a new topic is saved', async () => {
    const user = userEvent.setup()
    render(<TopicLibraryPanel />)
    fireTopics([])

    await user.click(screen.getByRole('button', { name: /\+ New Topic/i }))
    await user.type(screen.getByPlaceholderText('e.g. for-loop'), 'test-topic')
    await user.type(screen.getByPlaceholderText('e.g. For loops'), 'Test Topic')
    await user.click(screen.getByRole('button', { name: /Create topic/i }))

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'test-topic', title: 'Test Topic' })
    )
  })

  it('calls deleteDoc after the confirm dialog is accepted', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TopicLibraryPanel />)
    fireTopics([TOPIC_A])

    await user.click(screen.getByRole('button', { name: /For loops/i }))
    await user.click(screen.getByRole('button', { name: /Delete/i }))

    expect(window.confirm).toHaveBeenCalled()
    expect(deleteDoc).toHaveBeenCalled()
  })

  it('does not call deleteDoc when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TopicLibraryPanel />)
    fireTopics([TOPIC_A])

    await user.click(screen.getByRole('button', { name: /For loops/i }))
    await user.click(screen.getByRole('button', { name: /Delete/i }))

    expect(deleteDoc).not.toHaveBeenCalled()
  })

  describe('validation', () => {
    it('prevents save and shows an alert when the topic ID is empty', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'alert').mockReturnValue(undefined)
      render(<TopicLibraryPanel />)
      fireTopics([])

      await user.click(screen.getByRole('button', { name: /\+ New Topic/i }))
      // Leave ID empty; fill only the title
      await user.type(screen.getByPlaceholderText('e.g. For loops'), 'My Topic')
      await user.click(screen.getByRole('button', { name: /Create topic/i }))

      expect(window.alert).toHaveBeenCalledWith('Topic ID is required.')
      expect(setDoc).not.toHaveBeenCalled()
    })

    it('prevents save and shows an alert when the topic title is empty', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'alert').mockReturnValue(undefined)
      render(<TopicLibraryPanel />)
      fireTopics([])

      await user.click(screen.getByRole('button', { name: /\+ New Topic/i }))
      // Fill ID but leave title empty
      await user.type(screen.getByPlaceholderText('e.g. for-loop'), 'my-topic')
      await user.click(screen.getByRole('button', { name: /Create topic/i }))

      expect(window.alert).toHaveBeenCalledWith('Title is required.')
      expect(setDoc).not.toHaveBeenCalled()
    })
  })
})
