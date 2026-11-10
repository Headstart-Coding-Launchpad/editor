import { act, render } from '@testing-library/react'

const stack = vi.hoisted(() => ({
  canDraw: true,
  cache: new Map(),
  render: vi.fn(),
}))

vi.mock('../blocklyStack.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    canDrawRealBlocks: () => stack.canDraw,
    peekScratchFenceSvg: (code) => stack.cache.get(code),
    renderScratchFenceSvg: (code) => stack.render(code),
  }
})

import {
  EXPLAINER_BLOCK_SCALE,
  RealScratchBlocks,
  SHOW_FALLBACK_AFTER_MS,
} from '../RealScratchBlocks'
import { MarkdownRenderer } from '../../markdown'

const CODE = 'when green flag clicked\nforever\n  next costume\nend'
const DRAWN = {
  ok: true,
  width: 400,
  height: 200,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><defs><filter id="hsc-sb-0"/></defs><path class="blocklyPath" style="filter:url(#hsc-sb-0)"/></svg>',
}

beforeEach(() => {
  stack.canDraw = true
  stack.cache.clear()
  stack.render.mockReset()
})

it('draws the Blockly SVG at the calm block size, shrinking to fit its column', async () => {
  stack.render.mockResolvedValue(DRAWN)
  const { container } = render(<RealScratchBlocks code={CODE} />)
  await act(async () => {})
  const real = container.querySelector('[data-real-blocks="blockly"]')
  expect(real).toHaveAttribute('role', 'img')
  expect(real).toHaveAttribute('aria-label', 'when green flag clicked forever next costume end')
  expect(real.style.width).toBe(`${Math.round(400 * EXPLAINER_BLOCK_SCALE)}px`)
  expect(real.style.maxWidth).toBe('100%')
  const svg = real.querySelector('svg')
  expect(svg.getAttribute('width')).toBe(String(Math.round(400 * EXPLAINER_BLOCK_SCALE)))
  expect(svg.getAttribute('style')).toMatch(/max-width:\s*100%/)
  // No controls: a calm picture only.
  expect(real.querySelector('button, a, input')).toBeNull()
})

it('keeps the Markdown drawing for a fence Blockly cannot draw', async () => {
  stack.render.mockResolvedValue({ ok: false, problems: ['unknown block text'] })
  const { container } = render(<RealScratchBlocks code={CODE} />)
  await act(async () => {})
  const fallback = container.querySelector('[data-real-blocks="fallback"]')
  expect(fallback).toBeVisible()
  expect(fallback.querySelector('[data-scratch-opcode="control_forever"]')).toBeInTheDocument()
})

it('holds the space invisibly while Blockly loads, showing the Markdown drawing only if slow', async () => {
  vi.useFakeTimers()
  try {
    stack.render.mockReturnValue(new Promise(() => {}))
    const { container } = render(<RealScratchBlocks code={CODE} />)
    const pending = container.querySelector('[data-real-blocks="pending"]')
    expect(pending.style.visibility).toBe('hidden')
    expect(pending).toHaveAttribute('aria-hidden', 'true')
    act(() => vi.advanceTimersByTime(SHOW_FALLBACK_AFTER_MS + 10))
    expect(container.querySelector('[data-real-blocks="pending"]').style.visibility).toBe('')
  } finally {
    vi.useRealTimers()
  }
})

it('shows a cached picture on the first paint, with no pending state', () => {
  stack.cache.set(CODE, DRAWN)
  const { container } = render(<RealScratchBlocks code={CODE} />)
  expect(container.querySelector('[data-real-blocks="blockly"]')).toBeInTheDocument()
  expect(container.querySelector('[data-real-blocks="pending"]')).toBeNull()
  expect(stack.render).not.toHaveBeenCalled()
})

it('gives each copy of the same picture its own ids', () => {
  stack.cache.set(CODE, DRAWN)
  const { container } = render(
    <>
      <RealScratchBlocks code={CODE} />
      <RealScratchBlocks code={CODE} />
    </>
  )
  const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
  expect(ids).toHaveLength(2)
  expect(new Set(ids).size).toBe(2)
  container.querySelectorAll('[data-real-blocks="blockly"]').forEach((el) => {
    const id = el.querySelector('filter').id
    expect(el.querySelector('path').getAttribute('style')).toContain(`url(#${id})`)
  })
})

it('uses the Markdown drawing with no Blockly at all where there is no real browser', () => {
  stack.canDraw = false
  const { container } = render(<RealScratchBlocks code={CODE} />)
  expect(container.querySelector('[data-real-blocks]')).toBeNull()
  expect(container.querySelector('[data-scratch-opcode="control_forever"]')).toBeInTheDocument()
  expect(stack.render).not.toHaveBeenCalled()
})

it('is what a ```scratch fence in Markdown renders, with no switch in the URL', async () => {
  stack.render.mockResolvedValue(DRAWN)
  const { container } = render(<MarkdownRenderer content={'```scratch\n' + CODE + '\n```'} />)
  await act(async () => {})
  expect(container.querySelector('[data-real-blocks="blockly"]')).toBeInTheDocument()
  expect(stack.render).toHaveBeenCalledWith(CODE)
})
