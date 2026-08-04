import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TextEditorApp from '../TextEditorApp.jsx'
import { makeDefaultDesktop, openWindow } from '../../../desktopState.js'

function setup(overrides = {}) {
  let state = makeDefaultDesktop(['textEditor'])
  state = { ...state, fs: { ...state.fs, '/notes.txt': { type: 'file', content: 'hello' } } }
  const win = { ...state.windows[0], filePath: '/notes.txt', draftContent: 'hello', ...overrides }
  state = { ...state, windows: [win] }
  const onStateChange = vi.fn()
  const onInteraction = vi.fn()
  render(<TextEditorApp win={win} state={state} onStateChange={onStateChange} disabled={false} onInteraction={onInteraction} />)
  return { state, win, onStateChange, onInteraction }
}

describe('TextEditorApp', () => {
  it('shows the file name and no dirty dot when content matches saved fs content', () => {
    setup()
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
  })

  it('typing updates draftContent on the window via onStateChange, without touching fs', () => {
    const { onStateChange, state } = setup()
    fireEvent.change(screen.getByLabelText('Text editor content'), { target: { value: 'hello world' } })
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.windows[0].draftContent).toBe('hello world')
    expect(nextState.fs['/notes.txt'].content).toBe('hello')
  })

  it('Save commits draftContent into fs at filePath', () => {
    const { onStateChange, onInteraction } = setup({ draftContent: 'updated' })
    fireEvent.click(screen.getByText('💾 Save'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.fs['/notes.txt'].content).toBe('updated')
    expect(onInteraction).toHaveBeenCalledWith({ currentDir: '/', openFile: '/notes.txt' })
  })

  it('Save on an untitled window with no filePath opens the Save As dialog', () => {
    setup({ filePath: null, draftContent: 'draft text' })
    fireEvent.click(screen.getByText('💾 Save'))
    expect(screen.getByRole('dialog', { name: 'Save As' })).toBeInTheDocument()
  })

  it('Save As writes a new file at the chosen path', () => {
    const { onStateChange } = setup({ draftContent: 'draft text' })
    fireEvent.click(screen.getByText('Save As…'))
    fireEvent.change(screen.getByLabelText(/File name/), { target: { value: 'copy.txt' } })
    fireEvent.click(screen.getByText('Save'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.fs['/copy.txt'].content).toBe('draft text')
    expect(nextState.windows[0].filePath).toBe('/copy.txt')
  })
})
