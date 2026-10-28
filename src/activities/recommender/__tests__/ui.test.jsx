import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecommenderStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Recommender StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove touch behaviour: check that in a real browser too.

const TASK = definition.defaultTask({ id: 1 })

function renderView(options = {}) {
  return renderActivityUi(RecommenderStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

describe('Recommender UI', () => {
  it('starts with every item, a default feed of 4 and no bubble meter', () => {
    renderView()
    expect(screen.getAllByRole('button', { name: /^Like / })).toHaveLength(12)
    expect(screen.getByTestId('recommender-feed').children).toHaveLength(4)
    expect(screen.getByText(/Rated 0 of 6/)).toBeInTheDocument()
    expect(screen.queryByTestId('recommender-bubble')).not.toBeInTheDocument()
  })

  it('rates 👍 / 👎 and takes a rating back with a second tap', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Like Football' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dislike Cats' }))
    expect(state().ratings).toEqual({ football: 1, cat: -1 })
    fireEvent.click(screen.getByRole('button', { name: 'Like Football' }))
    expect(state().ratings).toEqual({ cat: -1 })
    expect(screen.getByRole('button', { name: 'Dislike Cats' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('changes the feed when a rating changes, and drops rated items from it', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Like Football' }))
    const feed = screen.getByTestId('recommender-feed')
    expect(feed).not.toHaveTextContent('Football')
    expect(feed).toHaveTextContent('Tennis')
  })

  it('shows the bubble meter once something is rated, with the nudge', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Like Football' }))
    const meter = screen.getByTestId('recommender-bubble')
    expect(meter).toHaveTextContent(/Your feed has \d of 4 kinds/)
    expect(meter).toHaveTextContent('Like something different to break out.')
  })

  it('opens Why? with the names of the raters and marks it in the state', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Like Football' }))
    fireEvent.click(screen.getByRole('button', { name: 'Like Swimming' }))
    expect(state().why).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Why Tennis?' }))
    expect(state().why).toBe(true)
    expect(screen.getByTestId('recommender-because')).toHaveTextContent(
      /Because .+, who liked what you liked, liked this\./
    )
  })

  it('hides Why? and the meter when the task turns them off', () => {
    const task = { ...TASK, showWhy: false, bubble: false }
    renderView({ task, initialState: { v: 1, ratings: { football: 1 }, why: false } })
    expect(screen.queryByRole('button', { name: /^Why / })).not.toBeInTheDocument()
    expect(screen.queryByTestId('recommender-bubble')).not.toBeInTheDocument()
  })

  it('reaches done once 6 are rated and Why? was opened', () => {
    renderView()
    for (const name of ['Football', 'Swimming', 'Tennis', 'Cats', 'Dogs', 'Frogs']) {
      fireEvent.click(screen.getByRole('button', { name: `Like ${name}` }))
    }
    expect(screen.getByText(/Rated 6 of 6 · now tap Why\?/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^Why / })[0])
    expect(screen.getByText(/done!/)).toBeInTheDocument()
  })

  it('is read-only for a tutor: shows the ratings and the feed, no rating buttons work', () => {
    const state = { v: 1, ratings: { football: 1, cat: -1 }, why: false }
    renderView({ readOnly: true, initialState: state })
    expect(screen.getByRole('button', { name: 'Like Football' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Like Football' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('recommender-feed').children.length).toBeGreaterThan(0)
    expect(screen.getByTestId('recommender-bubble')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
  })
})
