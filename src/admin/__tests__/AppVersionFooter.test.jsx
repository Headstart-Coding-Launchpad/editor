import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppVersionFooter from '../AppVersionFooter.jsx'
import { RELEASE_NOTES } from '../releaseNotes'
import pkg from '../../../package.json'

const INFO = {
  version: '1.0',
  build: 985,
  commit: '7a69ce2',
  builtAt: '2026-09-29T14:30:00.000Z',
}

describe('AppVersionFooter', () => {
  it('shows the version label and toggles the release notes', () => {
    render(<AppVersionFooter buildInfo={INFO} />)
    const toggle = screen.getByRole('button', {
      name: 'LaunchPad v1.0.985 · 7a69ce2 · built 29 Sep 2026',
    })
    expect(screen.queryByRole('region', { name: "What's new" })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: "What's new" })).toBeInTheDocument()
    expect(screen.getByText(RELEASE_NOTES[0].title)).toBeInTheDocument()
  })
})

describe('RELEASE_NOTES', () => {
  it('has a newest entry matching MAJOR.MINOR in package.json', () => {
    const [major, minor] = pkg.version.split('.')
    expect(RELEASE_NOTES[0].version).toBe(`${major}.${minor}`)
  })

  it('lists each version once, newest first', () => {
    const versions = RELEASE_NOTES.map((r) => r.version)
    expect(new Set(versions).size).toBe(versions.length)
    const sorted = [...versions].sort((a, b) => {
      const [aMaj, aMin] = a.split('.').map(Number)
      const [bMaj, bMin] = b.split('.').map(Number)
      return bMaj - aMaj || bMin - aMin
    })
    expect(versions).toEqual(sorted)
  })
})
