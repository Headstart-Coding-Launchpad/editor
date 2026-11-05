// Fun moment (sketch "LaunchPad playground kit chooser", 2026-11-05, section 5): one tap on a kit
// and the editor already holds code that does something on the first Run. The Python playground
// opens on a "Pick a kit" chooser with 5 controls (4 kit cards + a Blank page button); Picture Lab loads the
// pixel fox; Turtle goes to its own playground; Help topics is in every playground but Scratch.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundView from '../PlaygroundView'

vi.mock('../../../shared/firebase', () => ({ firestore: {}, db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(() =>
    Promise.resolve({
      docs: [
        {
          id: 'for-loops',
          data: () => ({ title: 'For loops', types: ['python', 'turtle'], summary: 'Repeat' }),
        },
      ],
    })
  ),
}))

// The real StudentView needs Pyodide and Firebase; the playground's own job is the lesson it
// builds and the controls it hands to the top bar.
vi.mock('../StudentView', () => ({
  default: ({ lesson, playgroundControls }) => (
    <div>
      <pre data-testid="editor">{lesson.tasks[0].starterCode}</pre>
      <output data-testid="lesson-id">{lesson.id}</output>
      <div data-testid="top-bar">{playgroundControls}</div>
    </div>
  ),
}))

function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname + location.search}</output>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/playground/:type"
          element={
            <>
              <PlaygroundView />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Fun moment: pick a kit and the first Run already does something', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens on a chooser with exactly 5 controls: 4 kit cards and a Blank page button', () => {
    renderAt('/playground/python')

    const chooser = screen.getByRole('region', { name: /pick a kit/i })
    const buttons = within(chooser).getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('data-kit'))).toEqual([
      'turtle',
      'game',
      'picture',
      'beats',
      'blank',
    ])
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('tapping Picture Lab opens the editor holding the pixel fox, with Help topics', async () => {
    const user = userEvent.setup()
    renderAt('/playground/python')

    await user.click(screen.getByRole('button', { name: /picture lab/i }))

    expect(screen.getByTestId('editor').textContent).toContain('load_image("pixel_fox")')
    expect(screen.getByTestId('where').textContent).toBe('/playground/python?kit=picture')
    const topBar = screen.getByTestId('top-bar')
    expect(within(topBar).getByRole('button', { name: /help topics/i })).toBeInTheDocument()
    expect(within(topBar).getByRole('button', { name: /switch kit/i })).toBeInTheDocument()
  })

  it('tapping Turtle lands on the Turtle playground with import turtle', async () => {
    const user = userEvent.setup()
    renderAt('/playground/python')

    await user.click(screen.getByRole('button', { name: /turtle/i }))

    expect(screen.getByTestId('where').textContent).toBe('/playground/turtle')
    expect(screen.getByTestId('editor').textContent).toContain('import turtle')
    expect(
      within(screen.getByTestId('top-bar')).getByRole('button', { name: /help topics/i })
    ).toBeInTheDocument()
  })

  it('Switch kit goes back to the chooser with the last kit marked Carry on', async () => {
    const user = userEvent.setup()
    renderAt('/playground/python')

    await user.click(screen.getByRole('button', { name: /beats/i }))
    expect(screen.getByTestId('lesson-id').textContent).toBe('__playground__python:beats')
    await user.click(screen.getByRole('button', { name: /switch kit/i }))

    expect(screen.getByTestId('where').textContent).toBe('/playground/python')
    const beats = screen.getByRole('button', { name: /beats/i })
    expect(beats).toHaveTextContent(/carry on/i)
    expect(screen.getByRole('button', { name: /picture lab/i })).not.toHaveTextContent(/carry on/i)
  })

  it('the Blank page button is visible with no click and opens the blank editor', async () => {
    const user = userEvent.setup()
    renderAt('/playground/python')

    const blank = screen.getByRole('button', { name: /blank page/i })
    expect(blank).toBeVisible()
    expect(screen.queryByRole('button', { name: /more kits/i })).not.toBeInTheDocument()
    await user.click(blank)

    expect(screen.getByTestId('where').textContent).toBe('/playground/python?kit=blank')
    expect(screen.getByTestId('lesson-id').textContent).toBe('__playground__python')
    expect(screen.getByTestId('editor').textContent).toBe('')
  })

  it('a Blank page student sees Carry on on the Blank page button', () => {
    localStorage.setItem('headstart_playground_last_kit', 'blank')
    renderAt('/playground/python')

    expect(screen.getByRole('button', { name: /blank page/i })).toHaveTextContent(/carry on/i)
  })

  it('an old ?kit=charts link just shows the chooser', () => {
    renderAt('/playground/python?kit=charts')

    expect(screen.getByRole('region', { name: /pick a kit/i })).toBeInTheDocument()
  })

  it('Scratch has no Help topics', () => {
    renderAt('/playground/scratch')

    expect(screen.queryByRole('button', { name: /help topics/i })).not.toBeInTheDocument()
  })
})
