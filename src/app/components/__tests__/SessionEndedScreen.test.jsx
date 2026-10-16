import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SessionEndedScreen from '../SessionEndedScreen'

describe('SessionEndedScreen', () => {
  it('offers an explicit all-code backup when Python tasks were saved', () => {
    const onDownloadAllCode = vi.fn()
    render(
      <SessionEndedScreen
        savedCodeTaskCount={2}
        onDownloadAllCode={onDownloadAllCode}
        onContinueSolo={vi.fn()}
      />
    )

    expect(screen.getByText(/saved only on this device/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /download all my code/i }))
    expect(onDownloadAllCode).toHaveBeenCalledOnce()
  })

  it('does not show a code download prompt when no Python code was saved', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /download all my code/i })).not.toBeInTheDocument()
  })

  it('shows a non-downloadable saved-work notice for other module types, without a download button', () => {
    render(<SessionEndedScreen savedOtherTaskCount={3} onContinueSolo={vi.fn()} />)

    expect(screen.getByText(/saved only on this device/i)).toBeInTheDocument()
    expect(screen.getByText(/It can't be downloaded yet\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download all my code/i })).not.toBeInTheDocument()
  })

  it('shows one saved-work notice (not two look-alikes) when there is code and other work', () => {
    render(
      <SessionEndedScreen
        savedCodeTaskCount={4}
        savedOtherTaskCount={6}
        onDownloadAllCode={vi.fn()}
        onContinueSolo={vi.fn()}
      />
    )
    expect(screen.getAllByText(/saved only on this device/i)).toHaveLength(1)
    expect(
      screen.getByText(/Download your 4 Python code tasks to keep a copy\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Your work in 6 other tasks can't be downloaded yet\./)
    ).toBeInTheDocument()
  })

  it('celebrates what the student did: tasks worked on and coding moments', () => {
    render(
      <SessionEndedScreen
        savedCodeTaskCount={2}
        savedOtherTaskCount={1}
        moments={[]}
        onContinueSolo={vi.fn()}
      />
    )
    const today = screen.getByRole('region', { name: 'What you did today' })
    expect(today).toHaveTextContent('Great work today!')
    expect(today).toHaveTextContent('You worked on 3 tasks.')
  })

  it('still says "Great work today!" when there is nothing to count', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.getByText('Great work today!')).toBeInTheDocument()
    expect(screen.queryByText(/You worked on/)).not.toBeInTheDocument()
  })

  it('shows neither notice when nothing was saved in either category', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.queryByText(/saved only on this device/i)).not.toBeInTheDocument()
  })

  it('always offers to go through the lesson again', () => {
    const onContinueSolo = vi.fn()
    render(<SessionEndedScreen onContinueSolo={onContinueSolo} />)

    fireEvent.click(screen.getByRole('button', { name: 'Go Through the Lesson Again' }))
    expect(onContinueSolo).toHaveBeenCalledOnce()
  })

  it('does not offer the solo challenge or playground when neither is available', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: /Try the Solo Challenge/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Playground/i })).not.toBeInTheDocument()
  })

  it('offers the linked solo challenge when one exists', () => {
    const onTrySoloChallenge = vi.fn()
    render(
      <SessionEndedScreen
        onContinueSolo={vi.fn()}
        soloCompanion={{ id: 'py-intro-solo', title: 'Python Challenge' }}
        onTrySoloChallenge={onTrySoloChallenge}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try the Solo Challenge' }))
    expect(onTrySoloChallenge).toHaveBeenCalledOnce()
  })

  it('offers the playground when one is available for the lesson type', () => {
    const onOpenPlayground = vi.fn()
    render(<SessionEndedScreen onContinueSolo={vi.fn()} onOpenPlayground={onOpenPlayground} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Playground' }))
    expect(onOpenPlayground).toHaveBeenCalledOnce()
  })

  it("shows the student's coding moments as a sticker sheet", () => {
    render(
      <SessionEndedScreen
        onContinueSolo={vi.fn()}
        moments={[
          {
            badgeId: 'bug_hunter',
            badge: { emoji: '🐛', title: 'Bug Hunter', blurb: 'Fixed it.' },
          },
        ]}
      />
    )
    const sheet = screen.getByRole('list', { name: 'My coding moments' })
    expect(sheet).toHaveTextContent('Bug Hunter')
    expect(sheet).toHaveTextContent('Fixed it.')
  })

  it('shows no moments section when the student has none', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.queryByText(/your coding moments/i)).not.toBeInTheDocument()
  })
})
