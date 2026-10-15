import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResultPane from '../ResultPane.jsx'
import { useResultPane, useRunFinishedToken } from '../useResultPane.js'

const PANES = [
  { id: 'picture', content: <div>the picture</div> },
  { id: 'tags', content: <div>the tags</div> },
  { id: 'console', content: <div>the console</div> },
]

describe('ResultPane', () => {
  it('shows one tab per pane, with ARIA tabs and labelled panels', () => {
    render(<ResultPane panes={PANES} active="tags" onSelect={() => {}} idPrefix="t" />)
    expect(screen.getByRole('tablist', { name: 'Result panes' })).toBeInTheDocument()
    const tags = screen.getByRole('tab', { name: 'Tags' })
    expect(tags).toHaveAttribute('aria-selected', 'true')
    expect(tags).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Picture' })).toHaveAttribute('tabindex', '-1')
    const panel = screen.getByRole('tabpanel', { name: 'Tags' })
    expect(panel).toHaveTextContent('the tags')
    expect(tags).toHaveAttribute('aria-controls', panel.id)
  })

  it('keeps every pane mounted and hides the inactive ones', () => {
    render(<ResultPane panes={PANES} active="console" onSelect={() => {}} />)
    expect(screen.getByText('the console')).toBeVisible()
    expect(screen.getByText('the picture')).toBeInTheDocument()
    expect(screen.getByText('the picture')).not.toBeVisible()
    expect(screen.getByText('the tags')).not.toBeVisible()
  })

  it('switches tabs by click and with the arrow keys', () => {
    const onSelect = vi.fn()
    render(<ResultPane panes={PANES} active="picture" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Console' }))
    expect(onSelect).toHaveBeenLastCalledWith('console')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Picture' }), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith('tags')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Picture' }), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith('console')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Picture' }), { key: 'End' })
    expect(onSelect).toHaveBeenLastCalledWith('console')
  })

  it('stacks the Picture and Tags under one tab', () => {
    render(<ResultPane panes={PANES} active="tags" onSelect={() => {}} stacked />)
    expect(screen.getByRole('tab', { name: 'Picture + Tags' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.queryByRole('tab', { name: 'Tags' })).toBeNull()
    expect(screen.getByText('the picture')).toBeVisible()
    expect(screen.getByText('the tags')).toBeVisible()
    expect(screen.getByText('the console')).not.toBeVisible()
  })

  it("shows the Console's badge in its tab and its accessible name", () => {
    render(
      <ResultPane
        panes={PANES}
        active="picture"
        onSelect={() => {}}
        badges={{ console: { text: '3', label: '3 new lines in the Console', tone: 'info' } }}
      />
    )
    const tab = screen.getByRole('tab', { name: 'Console, 3 new lines in the Console' })
    expect(tab).toHaveTextContent('Console3')
  })

  it('announces updates politely', () => {
    render(
      <ResultPane
        panes={PANES}
        active="picture"
        onSelect={() => {}}
        announcement="Picture updated"
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Picture updated')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('is a plain labelled region with no tabs when there is one pane', () => {
    render(<ResultPane panes={[PANES[2]]} active="console" onSelect={() => {}} />)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('region', { name: 'Console' })).toHaveTextContent('the console')
  })
})

describe('useRunFinishedToken', () => {
  it('counts a run when running goes from true to false', () => {
    const { result, rerender } = renderHook((props) => useRunFinishedToken(props), {
      initialProps: { running: false },
    })
    expect(result.current).toBe(0)
    rerender({ running: true })
    expect(result.current).toBe(0)
    rerender({ running: false })
    expect(result.current).toBe(1)
  })

  it("counts a Go Live viewer's new result key, but not the first one", () => {
    const { result, rerender } = renderHook((props) => useRunFinishedToken(props), {
      initialProps: { liveKey: 'success' },
    })
    expect(result.current).toBe(0)
    rerender({ liveKey: null })
    rerender({ liveKey: 'error' })
    expect(result.current).toBe(1)
  })
})

describe('useResultPane', () => {
  const base = {
    task: { id: 1 },
    available: ['picture', 'tags', 'console'],
    tabbed: true,
    tagsMode: 'predict',
    runToken: 0,
    output: '',
  }

  it('opens on Tags in predict mode and keeps it until a Run', () => {
    const { result, rerender } = renderHook((props) => useResultPane(props), {
      initialProps: base,
    })
    expect(result.current.active).toBe('tags')
    rerender({ ...base, output: '' })
    expect(result.current.active).toBe('tags')
  })

  it('switches to the stacked Picture after a Run that drew, and badges the hidden Console', () => {
    const { result, rerender } = renderHook((props) => useResultPane(props), {
      initialProps: base,
    })
    rerender({ ...base, runToken: 1, drew: true, output: 'a\nb\n' })
    expect(result.current.active).toBe('picture')
    expect(result.current.stacked).toBe(true)
    expect(result.current.badges.console).toMatchObject({ text: '2' })
    expect(result.current.announcement).toBe('Picture and Tags updated. 2 new lines in the Console')
    // Opening the Console clears its badge.
    act(() => result.current.select('console'))
    expect(result.current.active).toBe('console')
    expect(result.current.badges.console).toBeUndefined()
  })

  it('shows an error marker until the Console is opened', () => {
    const props = { ...base, tagsMode: null, available: ['picture', 'console'] }
    const { result, rerender } = renderHook((p) => useResultPane(p), { initialProps: props })
    act(() => result.current.select('picture'))
    rerender({ ...props, runToken: 1, drew: true, error: true, output: 'Traceback\n' })
    expect(result.current.active).toBe('picture')
    expect(result.current.badges.console).toMatchObject({ text: '!', tone: 'error' })
  })

  it('goes to the Console after a failed run that drew nothing', () => {
    const { result, rerender } = renderHook((props) => useResultPane(props), {
      initialProps: base,
    })
    rerender({ ...base, runToken: 1, error: true, output: 'Traceback\n' })
    expect(result.current.active).toBe('console')
  })

  it("uses the author's firstPane, and starts again on a new task", () => {
    const task = { id: 1, layout: { firstPane: 'console' } }
    const { result, rerender } = renderHook((props) => useResultPane(props), {
      initialProps: { ...base, task },
    })
    expect(result.current.active).toBe('console')
    act(() => result.current.select('picture'))
    rerender({ ...base, task: { id: 2 } })
    expect(result.current.active).toBe('tags')
  })

  it('shows the stacked Picture and Tags when slow-mo starts', () => {
    const props = { ...base, tagsMode: 'view' }
    const { result, rerender } = renderHook((p) => useResultPane(p), { initialProps: props })
    act(() => result.current.select('console'))
    rerender({ ...props, slowMo: true })
    expect(result.current.active).toBe('picture')
    expect(result.current.stacked).toBe(true)
  })

  it('never badges or announces when everything is side by side', () => {
    const props = { ...base, tabbed: false }
    const { result, rerender } = renderHook((p) => useResultPane(p), { initialProps: props })
    rerender({ ...props, runToken: 1, drew: true, output: 'x\n' })
    expect(result.current.badges).toEqual({})
    expect(result.current.announcement).toBe('')
  })
})
