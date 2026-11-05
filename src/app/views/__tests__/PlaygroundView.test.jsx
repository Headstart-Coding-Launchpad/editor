import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundView from '../PlaygroundView'

let playgroundType = 'python'
let playgroundSearch = ''

vi.mock('react-router-dom', () => ({
  useParams: () => ({ type: playgroundType }),
  useSearchParams: () => [new URLSearchParams(playgroundSearch)],
  useNavigate: () => vi.fn(),
  Navigate: ({ to, replace }) => (
    <a data-testid="redirect" data-replace={String(replace)} href={to} />
  ),
}))

vi.mock('../../components/PlaygroundKitChooser', () => ({
  default: () => <div data-testid="chooser" />,
}))

vi.mock('../StudentView', () => ({
  default: ({ lesson }) => <output data-testid="lesson">{JSON.stringify(lesson)}</output>,
}))

function renderPlayground(type, search = type === 'python' ? 'kit=blank' : '') {
  playgroundType = type
  playgroundSearch = search
  render(<PlaygroundView />)
  return JSON.parse(screen.getByTestId('lesson').textContent)
}

describe('PlaygroundView', () => {
  beforeEach(() => {
    playgroundType = 'python'
  })

  it.each(['python', 'turtle', 'arcade', 'electronics', 'scratch'])(
    'does not seed an explainer for the %s playground',
    (type) => {
      const lesson = renderPlayground(type)

      expect(lesson.tasks[0]).not.toHaveProperty('explainer')
    }
  )

  it('opens a Turtle playground whose first Run draws a filled square', () => {
    const lesson = renderPlayground('turtle')

    expect(lesson).toMatchObject({ id: '__playground__turtle', isPlayground: true, type: 'turtle' })
    expect(lesson.tasks[0].starterCode).toMatch(/^import turtle\n/)
    expect(lesson.tasks[0].starterCode).toContain('turtle.begin_fill()')
  })

  it('starts the Arcade playground (Game kit) with a player the arrow keys move', () => {
    const task = renderPlayground('arcade').tasks[0]

    expect(task.starterCode).toContain('Sprite("player.png"')
    expect(task.starterCode).toContain('keys.horizontal')
    expect(task.arcadeDesign.sprites[0]).toMatchObject({ name: 'player.png', width: 8, height: 8 })
    expect(task.arcadeDesign.sprites[0].frames[0]).toHaveLength(64)
  })

  it.each([
    ['picture', 'load_image("pixel_fox")'],
    ['beats', 'from beats import *'],
    ['charts', 'plt.show()'],
  ])('opens the %s kit with its own starter and lesson id', (kit, snippet) => {
    const lesson = renderPlayground('python', `kit=${kit}`)

    expect(lesson.id).toBe(`__playground__python:${kit}`)
    expect(lesson.type).toBe('python')
    expect(lesson.tasks[0].starterCode).toContain(snippet)
  })

  it('keeps the Blank page kit on the original playground id, so earlier work still opens', () => {
    const lesson = renderPlayground('python', 'kit=blank')

    expect(lesson.id).toBe('__playground__python')
    expect(lesson.tasks[0].starterCode).toBe('')
  })

  it('enables sprite and tilemap editing in the Arcade playground', () => {
    const lesson = renderPlayground('arcade')

    expect(lesson.tasks[0].arcadeTools).toBe('both')
  })

  it('starts the Scratch playground with a blank workspace', () => {
    const lesson = renderPlayground('scratch')

    expect(lesson.tasks[0].starterBlocks).toBeNull()
    expect(lesson).toMatchObject({
      id: '__playground__scratch',
      isPlayground: true,
      type: 'scratch',
    })
  })

  it('lets students add extra sprites in the Scratch playground', () => {
    const lesson = renderPlayground('scratch')

    expect(lesson.tasks[0].allowAddSprite).toBe(true)
  })

  it('lets students remove any sprite, including default ones, in the Scratch playground', () => {
    const lesson = renderPlayground('scratch')

    expect(lesson.tasks[0].allowRemoveSprite).toBe(true)
    expect(lesson.tasks[0].allowRemoveStarterSprites).toBe(true)
  })

  it('uses an app-only persistence namespace and never lesson assets', () => {
    const lesson = renderPlayground('python')

    expect(lesson).toMatchObject({ id: '__playground__python', isPlayground: true })
  })

  it.each([
    ['turtle', '/playground/turtle'],
    ['game', '/playground/arcade'],
  ])("sends ?kit=%s to that kit's own playground", (kit, path) => {
    playgroundType = 'python'
    playgroundSearch = `kit=${kit}`
    render(<PlaygroundView />)

    const redirect = screen.getByTestId('redirect')
    expect(redirect).toHaveAttribute('href', path)
    expect(redirect).toHaveAttribute('data-replace', 'true')
    expect(screen.queryByTestId('chooser')).not.toBeInTheDocument()
  })

  it('shows the kit chooser for an unknown ?kit= id', () => {
    playgroundType = 'python'
    playgroundSearch = 'kit=nope'
    render(<PlaygroundView />)

    expect(screen.getByTestId('chooser')).toBeInTheDocument()
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument()
  })
})
