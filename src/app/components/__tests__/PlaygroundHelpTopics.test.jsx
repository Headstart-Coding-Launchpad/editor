import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDocs } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTopicCache } from '../../../shared/topicLibrary'
import PlaygroundHelpTopics from '../PlaygroundHelpTopics'

vi.mock('../../../shared/firebase', () => ({ firestore: {}, db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(() =>
    Promise.resolve({
      docs: [
        { id: 'loops', data: () => ({ title: 'Loops', types: ['python', 'turtle'] }) },
        { id: 'sprites', data: () => ({ title: 'Sprites', types: ['arcade'] }) },
        { id: 'print', data: () => ({ title: 'Print', types: [] }) },
      ],
    })
  ),
}))

describe('PlaygroundHelpTopics', () => {
  beforeEach(() => clearTopicCache())

  it.each(['python', 'turtle', 'arcade', 'electronics'])('shows Help topics for %s', (type) => {
    render(<PlaygroundHelpTopics type={type} />)
    expect(screen.getByRole('button', { name: /help topics/i })).toBeInTheDocument()
  })

  it('shows nothing for Scratch (no topic library)', () => {
    const { container } = render(<PlaygroundHelpTopics type="scratch" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the topic library filtered to the playground type', async () => {
    const user = userEvent.setup()
    render(<PlaygroundHelpTopics type="turtle" />)

    await user.click(screen.getByRole('button', { name: /help topics/i }))

    const dialog = await screen.findByRole('dialog', { name: /topic library/i })
    expect(dialog).toHaveTextContent('Loops')
    expect(dialog).toHaveTextContent('Print')
    expect(dialog).not.toHaveTextContent('Sprites')

    await user.click(screen.getByRole('button', { name: /close topic library/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the dialog with its Close button while topics are still loading', async () => {
    getDocs.mockImplementationOnce(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<PlaygroundHelpTopics type="python" />)

    await user.click(screen.getByRole('button', { name: /help topics/i }))

    const dialog = screen.getByRole('dialog', { name: /topic library/i })
    expect(dialog).toHaveTextContent('Loading topics...')
    await user.click(screen.getByRole('button', { name: /close topic library/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says the topics could not load, and loads them on the next open', async () => {
    getDocs.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    const user = userEvent.setup()
    render(<PlaygroundHelpTopics type="python" />)

    await user.click(screen.getByRole('button', { name: /help topics/i }))
    const dialog = screen.getByRole('dialog', { name: /topic library/i })
    expect(await screen.findByText(/couldn't load topics, try again/i)).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('No matching topics')

    await user.click(screen.getByRole('button', { name: /close topic library/i }))
    await user.click(screen.getByRole('button', { name: /help topics/i }))
    expect(await screen.findByRole('dialog', { name: /topic library/i })).toHaveTextContent('Loops')
  })
})
