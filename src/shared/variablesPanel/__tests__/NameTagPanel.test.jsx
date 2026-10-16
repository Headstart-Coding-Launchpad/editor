import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NameTagPanel from '../NameTagPanel.jsx'
import TaskVariablesPanel from '../TaskVariablesPanel.jsx'
import NameTagCardStrip from '../NameTagCardStrip.jsx'
import { compactVariablesForSync } from '../variablesPanel.js'

const int = (v) => ({ t: 'int', v })
const str = (v) => ({ t: 'str', v })
const runOf = (entries, extra = {}) => ({
  taskId: 1,
  status: 'success',
  at: 'end',
  snapshots: [{ vars: entries.map(([n, v]) => ({ n, v })), scope: null }],
  index: 0,
  changed: [],
  ...extra,
})
const view = { mode: 'view', at: 'end', hide: [], predict: [], target: {} }

describe('NameTagPanel', () => {
  it('asks for a Run before there is anything to show', () => {
    render(<NameTagPanel config={view} />)
    expect(screen.getByRole('status').textContent).toContain('Press Run')
  })

  it('draws a tag per variable with type labels and screen-reader text', () => {
    render(
      <NameTagPanel
        config={view}
        run={runOf(
          [
            ['score', int(10)],
            ['name', str('5')],
            ['bag', { t: 'list', items: [str('key'), str('map')], len: 2 }],
          ],
          { changed: ['score'] }
        )}
      />
    )
    expect(screen.getByLabelText('score: number 10 (changed since the last run)')).toBeTruthy()
    expect(screen.getByLabelText('name: text "5"')).toBeTruthy()
    expect(screen.getByText('"5"')).toBeTruthy()
    expect(screen.getByText('changed')).toBeTruthy()
    // List tiles carry their index.
    expect(screen.getByText('"map"').parentElement.textContent).toBe('"map"1')
  })

  it('cuts long text with a Show all control', () => {
    render(<NameTagPanel config={view} run={runOf([['long', str('x'.repeat(80))]])} />)
    const button = screen.getByRole('button', { name: 'Show all' })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe(
      'true'
    )
  })

  it('takes predictions before Run and marks them after, in words as well as colour', () => {
    const onPredictionChange = vi.fn()
    const config = { ...view, mode: 'predict', predict: ['score', 'lives'] }
    const { rerender } = render(
      <NameTagPanel
        config={config}
        predictions={{ values: { score: '' }, results: null }}
        onPredictionChange={onPredictionChange}
      />
    )
    fireEvent.change(screen.getByLabelText('score'), { target: { value: '10' } })
    expect(onPredictionChange).toHaveBeenCalledWith('score', '10')
    rerender(
      <NameTagPanel
        config={config}
        run={runOf([
          ['score', int(10)],
          ['lives', int(2)],
        ])}
        predictions={{
          values: { score: '10', lives: '3' },
          results: { score: true, lives: false },
        }}
        onPredictionChange={onPredictionChange}
      />
    )
    expect(screen.getByText('✓ Right', { exact: false })).toBeTruthy()
    expect(screen.getByText('✗ Not quite', { exact: false })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 2 predictions right')
  })

  it('shows targets, including names not made yet', () => {
    const config = { ...view, mode: 'target', target: { score: 10, bag: ['key'] } }
    render(<NameTagPanel config={config} run={runOf([['score', int(10)]])} />)
    expect(screen.getByText('✓ On target')).toBeTruthy()
    expect(screen.getByText('not made yet')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 2 on target')
  })
})

describe('TaskVariablesPanel', () => {
  it('renders nothing for a task without showVariables', () => {
    const { container } = render(<TaskVariablesPanel task={{ id: 1 }} panel={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a synced copy read-only, for the same task only', () => {
    const task = { id: 1, showVariables: { mode: 'predict', predict: ['score'] } }
    const synced = compactVariablesForSync(null, {
      taskId: 1,
      values: { score: '7' },
      results: null,
    })
    render(<TaskVariablesPanel task={task} synced={synced} audience="tutor" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('7')).toBeTruthy()
  })
})

describe('NameTagPanel visuals', () => {
  const list = (items, extra = {}) => ({ t: 'list', items, len: items.length, ...extra })
  const palette = list([str('red'), str('orange'), str('gold')])

  it('draws a list of colours as swatches with index, text and screen-reader words', () => {
    const { container } = render(<NameTagPanel config={view} run={runOf([['palette', palette]])} />)
    expect(container.querySelectorAll('.ntp-swatch')).toHaveLength(3)
    expect(screen.getByText('palette, item 0: red')).toBeTruthy()
    expect(screen.getByText('"gold"')).toBeTruthy()
    const indexes = [...container.querySelectorAll('.ntp-swatch .ntp-index')].map(
      (node) => node.textContent
    )
    expect(indexes).toEqual(['0', '1', '2'])
  })

  it('keeps mixed text and numbers as tiles, so "5" and 5 read differently', () => {
    const { container } = render(
      <NameTagPanel config={view} run={runOf([['nums', list([int(5), str('5')])]])} />
    )
    expect(container.querySelector('.ntp-bars')).toBeNull()
    expect(screen.getByText('"5"')).toBeTruthy()
  })

  it('shows the exact Python value one tap away', () => {
    render(<NameTagPanel config={view} run={runOf([['palette', palette]])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show value' }))
    expect(screen.getByText('["red", "orange", "gold"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide value' }).getAttribute('aria-expanded')).toBe(
      'true'
    )
  })

  it('draws numbers as bars labelled with their values', () => {
    const { container } = render(
      <NameTagPanel config={view} run={runOf([['scores', list([int(4), int(8)])]])} />
    )
    const bars = container.querySelectorAll('.ntp-bar')
    expect(bars).toHaveLength(2)
    expect(bars[0].style.width).toBe('50%')
    expect(screen.getByText('scores, item 1: 8')).toBeTruthy()
  })

  it('keeps plain tiles with visuals: false', () => {
    const { container } = render(
      <NameTagPanel config={{ ...view, visuals: false }} run={runOf([['palette', palette]])} />
    )
    expect(container.querySelector('.ntp-swatch')).toBeNull()
    expect(container.querySelectorAll('.ntp-tile')).toHaveLength(3)
  })

  it('draws a 2D list of colours as a picture with a summary', () => {
    const art = list([list([str('red'), str('white')]), list([str('white'), str('white')])])
    const { container } = render(<NameTagPanel config={view} run={runOf([['art', art]])} />)
    expect(container.querySelectorAll('.ntp-pixel')).toHaveLength(4)
    expect(
      screen.getByRole('img', { name: 'art: 2 by 2 picture, 2 colours: red 1, white 3' })
    ).toBeTruthy()
  })

  it('shows a list grid() drew as its size by default, and palette numbers as a table', () => {
    const pixels = list([list([int(0), int(8)]), list([int(8), int(0)])], { g: 1 })
    const { rerender, container } = render(
      <NameTagPanel config={view} run={runOf([['pixels', pixels]])} />
    )
    expect(screen.getByText('list, 2 × 2, drawn on the Stage')).toBeTruthy()
    expect(container.querySelector('.ntp-picture')).toBeNull()
    rerender(
      <NameTagPanel config={{ ...view, stageLists: 'picture' }} run={runOf([['pixels', pixels]])} />
    )
    expect(container.querySelector('.ntp-picture')).toBeNull()
    expect(container.querySelectorAll('.ntp-table tbody td')).toHaveLength(4)
    expect(
      container
        .querySelector('.ntp-tag')
        .getAttribute('aria-label')
        .startsWith('pixels: 2 by 2 table. pixels, row 1: 0, 8. pixels, row 2: 8, 0')
    ).toBe(true)
  })

  it('wraps a flat list grid() drew with width= at that width, indexes running on', () => {
    const pixels = list([...Array(8).fill(str('red')), str('white'), str('white')], { g: 1, gw: 8 })
    const { container } = render(<NameTagPanel config={view} run={runOf([['pixels', pixels]])} />)
    const grid = container.querySelector('.ntp-wrapped')
    expect(grid.style.getPropertyValue('--ntp-wrap')).toBe('8')
    const tiles = grid.querySelectorAll('.ntp-tile')
    expect(tiles).toHaveLength(10)
    expect(tiles[9].querySelector('.ntp-index').textContent).toBe('9')
    expect(screen.getByText('pixels, item 9 (row 2, column 2): white')).toBeTruthy()
    expect(container.querySelector('.ntp-tag').getAttribute('aria-label')).toBe(
      'pixels: list of 10, 8 to a row'
    )
  })

  it('shows palette numbers drawn with width= as number tiles, not bars', () => {
    const pixels = list([int(0), int(1), int(1), int(0)], { g: 1, gw: 2 })
    const { container } = render(<NameTagPanel config={view} run={runOf([['pixels', pixels]])} />)
    expect(container.querySelector('.ntp-bars')).toBeNull()
    expect(container.querySelector('.ntp-wrapped--numbers')).toBeTruthy()
    expect(container.querySelector('.ntp-swatch-chip')).toBeNull()
  })

  it('marks the item that changed since the last run', () => {
    const { container } = render(
      <NameTagPanel
        config={view}
        run={runOf([['palette', palette]], {
          changed: ['palette'],
          changedItems: { palette: ['1'] },
        })}
      />
    )
    const swatches = container.querySelectorAll('.ntp-swatch')
    expect(swatches[1].classList.contains('is-item-changed')).toBe(true)
    expect(swatches[0].classList.contains('is-item-changed')).toBe(false)
    expect(screen.getByText('palette, item 1: orange, changed')).toBeTruthy()
  })

  it('draws a dict as cards with swatches for colour values', () => {
    const theme = {
      t: 'dict',
      len: 2,
      items: [
        { k: str('sky'), v: str('blue') },
        { k: str('name'), v: str('Sam') },
      ],
    }
    const { container } = render(<NameTagPanel config={view} run={runOf([['theme', theme]])} />)
    expect(container.querySelectorAll('.ntp-card')).toHaveLength(2)
    expect(container.querySelectorAll('.ntp-card .ntp-swatch-chip')).toHaveLength(1)
    expect(screen.getByText('theme, "sky": "blue" (blue)')).toBeTruthy()
  })

  it('draws target values with the same visuals', () => {
    const config = { ...view, mode: 'target', target: { palette: ['red', 'orange'] } }
    render(<NameTagPanel config={config} />)
    expect(screen.getByText('palette target, item 0: red')).toBeTruthy()
  })

  it('shows the real value with its visual after a predict-mode Run', () => {
    const config = { ...view, mode: 'predict', predict: ['palette'] }
    render(
      <NameTagPanel
        config={config}
        run={runOf([['palette', palette]])}
        predictions={{ values: { palette: '["red"]' }, results: { palette: false } }}
        readOnly
      />
    )
    expect(screen.getByText('✗ Not quite', { exact: false })).toBeTruthy()
    expect(screen.getByText('palette, item 2: gold')).toBeTruthy()
  })
})

describe('NameTagCardStrip', () => {
  it('shows small swatch thumbnails on the tutor card after a Run', () => {
    const task = { id: 1, showVariables: { mode: 'view' } }
    const run = runOf([['palette', { t: 'list', len: 2, items: [str('red'), str('blue')] }]])
    const { container } = render(
      <NameTagCardStrip task={task} synced={compactVariablesForSync(run, null)} />
    )
    expect(container.querySelectorAll('.ntp-thumb-chip')).toHaveLength(2)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('palette')
  })

  it('shows nothing with visuals off or for another task', () => {
    const run = runOf([['palette', { t: 'list', len: 1, items: [str('red')] }]])
    const synced = compactVariablesForSync(run, null)
    const off = render(
      <NameTagCardStrip task={{ id: 1, showVariables: { visuals: false } }} synced={synced} />
    )
    expect(off.container.innerHTML).toBe('')
    const other = render(<NameTagCardStrip task={{ id: 2, showVariables: {} }} synced={synced} />)
    expect(other.container.innerHTML).toBe('')
  })
})

describe('NameTagPanel linked tags (P6-19)', () => {
  const predict = { mode: 'predict', at: 'end', hide: [], predict: ['small'], target: {} }
  const links = [{ name: 'small', number: 1, colour: '#0b63c4' }]

  it('gives a linked tag its colour and number, and reports hover and focus', () => {
    const onLinkActive = vi.fn()
    const { container } = render(
      <NameTagPanel
        config={predict}
        predictions={{ values: {}, results: null }}
        onPredictionChange={() => {}}
        links={links}
        onLinkActive={onLinkActive}
      />
    )
    const tag = container.querySelector('.ntp-tag.has-link')
    expect(tag).not.toBeNull()
    expect(tag.style.getPropertyValue('--ntp-link')).toBe('#0b63c4')
    expect(tag.querySelector('.ntp-link-number').textContent).toBe('1')
    expect(screen.getByLabelText(/small, marked 1 in the code/)).toBeTruthy()
    fireEvent.mouseEnter(tag)
    expect(onLinkActive).toHaveBeenLastCalledWith('small')
    fireEvent.mouseLeave(tag)
    expect(onLinkActive).toHaveBeenLastCalledWith(null)
    fireEvent.focus(tag.querySelector('input'))
    expect(onLinkActive).toHaveBeenLastCalledWith('small')
  })

  it('marks the active link and leaves unlinked tags plain', () => {
    const { container } = render(
      <NameTagPanel
        config={view}
        run={runOf([
          ['small', int(1)],
          ['other', int(2)],
        ])}
        links={links}
        activeLink="small"
      />
    )
    expect(container.querySelectorAll('.ntp-tag.has-link')).toHaveLength(1)
    expect(container.querySelector('.ntp-tag.is-link-active')).not.toBeNull()
  })
})
