import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WindowManager from '../WindowManager.jsx'
import { makeDefaultDesktop } from '../desktopState.js'

// jsdom has no ResizeObserver; this one reports a fixed desktop size as soon as it observes.
function stubResizeObserver(width, height) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
      }
      observe() {
        this.callback([{ contentRect: { width, height } }])
      }
      disconnect() {}
    }
  )
}

const apps = { fileManager: { title: 'File Manager', icon: '🗂️', render: () => <div /> } }

describe('WindowManager desktop size', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stamps the measured desktop size on changes made through the windows', () => {
    stubResizeObserver(812.4, 590.6)
    const onStateChange = vi.fn()
    render(
      <WindowManager
        state={makeDefaultDesktop(['fileManager'])}
        onStateChange={onStateChange}
        apps={apps}
      />
    )
    // Measuring alone writes nothing.
    expect(onStateChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onStateChange.mock.calls[0][0].viewport).toEqual({ width: 812, height: 591 })
  })

  it('passes app changes through with the desktop size too', () => {
    stubResizeObserver(900, 600)
    const onStateChange = vi.fn()
    const appsWithButton = {
      fileManager: {
        title: 'File Manager',
        icon: '🗂️',
        render: ({ state, onStateChange: change }) => (
          <button onClick={() => change({ ...state, lastSearchQuery: 'x' })}>App action</button>
        ),
      },
    }
    render(
      <WindowManager
        state={makeDefaultDesktop(['fileManager'])}
        onStateChange={onStateChange}
        apps={appsWithButton}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'App action' }))
    expect(onStateChange.mock.calls[0][0]).toMatchObject({
      lastSearchQuery: 'x',
      viewport: { width: 900, height: 600 },
    })
  })

  it('a read-only view writes nothing', () => {
    stubResizeObserver(800, 600)
    const onStateChange = vi.fn()
    render(
      <WindowManager
        state={makeDefaultDesktop(['fileManager'])}
        onStateChange={onStateChange}
        apps={apps}
        disabled
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(onStateChange).not.toHaveBeenCalled()
  })
})
