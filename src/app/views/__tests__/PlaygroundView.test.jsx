import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundView from '../PlaygroundView'

let playgroundType = 'python'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ type: playgroundType }),
}))

vi.mock('../StudentView', () => ({
  default: ({ lesson }) => <output data-testid="lesson">{JSON.stringify(lesson)}</output>,
}))

function renderPlayground(type) {
  playgroundType = type
  render(<PlaygroundView />)
  return JSON.parse(screen.getByTestId('lesson').textContent)
}

describe('PlaygroundView', () => {
  beforeEach(() => {
    playgroundType = 'python'
  })

  it.each(['python', 'arcade', 'electronics'])('does not seed an explainer for the %s playground', type => {
    const lesson = renderPlayground(type)

    expect(lesson.tasks[0]).not.toHaveProperty('explainer')
  })

  it('enables sprite and tilemap editing in the Arcade playground', () => {
    const lesson = renderPlayground('arcade')

    expect(lesson.tasks[0].arcadeTools).toBe('both')
  })

  it('uses an app-only persistence namespace and never lesson assets', () => {
    const lesson = renderPlayground('python')

    expect(lesson).toMatchObject({ id: '__playground__python', isPlayground: true })
  })
})
