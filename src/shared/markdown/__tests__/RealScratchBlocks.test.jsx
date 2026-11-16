import React from 'react'
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
    renderScratchFenceSvg: (code, opts) => stack.render(code, opts),
  }
})

import {
  EDIT_DEBOUNCE_MS,
  EXPLAINER_BLOCK_SCALE,
  LIVE_EDIT_WINDOW_MS,
  RETRY_DELAY_MS,
  RETRY_LIMIT,
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

it('shows the fence text as plain code, labelled like the picture, when Blockly cannot draw', async () => {
  stack.render.mockResolvedValue({ ok: false, problems: ['unknown block text'] })
  const { container } = render(<RealScratchBlocks code={CODE} />)
  await act(async () => {})
  const fallback = container.querySelector('[data-real-blocks="fallback"]')
  expect(fallback).toBeVisible()
  const text = fallback.querySelector('pre[data-scratch-text="true"]')
  expect(text.textContent).toBe(CODE)
  expect(text).toHaveAttribute('aria-label', CODE.replace(/\s+/g, ' ').trim())
  expect(fallback.querySelector('button, a, input, svg')).toBeNull()
})

it('draws an inline block in its line of text, or shows its text when it cannot', async () => {
  stack.render.mockResolvedValueOnce(DRAWN)
  const { container } = render(<MarkdownRenderer content="Use `scratch:if <> then else` here." />)
  await act(async () => {})
  // The two-mouth block is drawn from its one-mouth text with an else line.
  expect(stack.render.mock.calls[0][0]).toBe('if <> then\nelse')
  const picture = container.querySelector('span[data-real-blocks="blockly"]')
  expect(picture).toHaveAttribute('aria-label', 'if <> then else')
  expect(picture.closest('p')).toHaveTextContent('Use here.')

  stack.render.mockResolvedValueOnce({ ok: false, problems: ['x'] })
  const other = render(<MarkdownRenderer content="Use `scratch:fly to the moon` here." />)
  await act(async () => {})
  expect(other.container.querySelector('code[data-scratch-text="true"]').textContent).toBe(
    'fly to the moon'
  )
})

it('holds the space invisibly while Blockly loads, showing the fence text only if slow', async () => {
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

it('shows the fence text with no Blockly at all where there is no real browser', () => {
  stack.canDraw = false
  const { container } = render(<RealScratchBlocks code={CODE} />)
  expect(container.querySelector('[data-real-blocks]')).toBeNull()
  expect(container.querySelector('[data-scratch-text="true"]').textContent).toBe(CODE)
  expect(stack.render).not.toHaveBeenCalled()
})

it('is what a ```scratch fence in Markdown renders, with no switch in the URL', async () => {
  stack.render.mockResolvedValue(DRAWN)
  const { container } = render(<MarkdownRenderer content={'```scratch\n' + CODE + '\n```'} />)
  await act(async () => {})
  expect(container.querySelector('[data-real-blocks="blockly"]')).toBeInTheDocument()
  expect(stack.render.mock.calls[0][0]).toBe(CODE)
})

it('never paints the old picture under the new text when the fence changes', async () => {
  const NEXT = 'when green flag clicked\nmove (10) steps'
  stack.cache.set(CODE, DRAWN)
  stack.render.mockReturnValue(new Promise(() => {}))
  const { container, rerender } = render(<RealScratchBlocks code={CODE} />)
  // Every aria-label the picture held, including ones replaced within the same tick.
  const labels = []
  const observer = new MutationObserver((records) =>
    records.forEach((r) => labels.push(r.oldValue, r.target.getAttribute?.('aria-label')))
  )
  observer.observe(container, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['aria-label'],
  })
  rerender(<RealScratchBlocks code={NEXT} />)
  await act(async () => {})
  observer.disconnect()
  expect(labels).not.toContain('when green flag clicked move (10) steps')
  expect(container.querySelector('[data-real-blocks="blockly"]')).toBeNull()
})

it('waits for typing to pause before drawing an edited fence', async () => {
  vi.useFakeTimers()
  try {
    stack.render.mockResolvedValue(DRAWN)
    const { rerender } = render(<RealScratchBlocks code={CODE} />)
    expect(stack.render).toHaveBeenCalledTimes(1)
    // The first change draws at once; the keys typed straight after wait for a pause.
    for (const n of [1, 2, 3]) rerender(<RealScratchBlocks code={`${CODE}\nmove (${n}) steps`} />)
    expect(stack.render).toHaveBeenCalledTimes(2)
    await act(async () => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS + 10))
    expect(stack.render).toHaveBeenCalledTimes(3)
    expect(stack.render.mock.calls[2][0]).toBe(`${CODE}\nmove (3) steps`)
  } finally {
    vi.useRealTimers()
  }
})

it('tells the renderer when a fence is no longer wanted', async () => {
  stack.render.mockReturnValue(new Promise(() => {}))
  const { unmount } = render(<RealScratchBlocks code={CODE} />)
  const { signal } = stack.render.mock.calls[0][1]
  expect(signal.aborted).toBe(false)
  unmount()
  expect(signal.aborted).toBe(true)
})

it('tries again (a bounded number of times) after a render that may differ next time', async () => {
  vi.useFakeTimers()
  try {
    stack.render
      .mockResolvedValueOnce({ ok: false, problems: ['chunk failed'], retry: true })
      .mockResolvedValueOnce(DRAWN)
    const { container } = render(<RealScratchBlocks code={CODE} />)
    await act(async () => {})
    // The fence text shows meanwhile.
    expect(container.querySelector('[data-real-blocks="fallback"]')).toBeVisible()
    await act(async () => vi.advanceTimersByTime(RETRY_DELAY_MS + 10))
    expect(stack.render).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-real-blocks="blockly"]')).toBeInTheDocument()

    stack.render.mockReset()
    stack.render.mockResolvedValue({ ok: false, problems: ['chunk failed'], retry: true })
    render(<RealScratchBlocks code={`${CODE}\nnext costume`} />)
    for (let i = 0; i < 6; i++) await act(async () => vi.advanceTimersByTime(RETRY_DELAY_MS + 10))
    expect(stack.render).toHaveBeenCalledTimes(1 + RETRY_LIMIT)
  } finally {
    vi.useRealTimers()
  }
})

it('sizes the picture whatever order the root attributes come in, keeping its own style', () => {
  stack.cache.set(CODE, {
    ...DRAWN,
    svg: '<svg style="background:red" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400"><path/></svg>',
  })
  const { container } = render(<RealScratchBlocks code={CODE} />)
  const svg = container.querySelector('[data-real-blocks="blockly"] svg')
  expect(svg.getAttribute('width')).toBe(String(Math.round(400 * EXPLAINER_BLOCK_SCALE)))
  expect(svg.getAttribute('height')).toBe(String(Math.round(200 * EXPLAINER_BLOCK_SCALE)))
  expect(svg.getAttribute('style')).toMatch(/max-width:\s*100%/)
  expect(svg.getAttribute('aria-hidden')).toBe('true')
})

it('falls back to the fence text when the SVG cannot be sized', () => {
  stack.cache.set(CODE, { ...DRAWN, svg: '<svg width="400" height="200"><path></svg>' })
  const { container } = render(<RealScratchBlocks code={CODE} />)
  expect(container.querySelector('[data-real-blocks="blockly"]')).toBeNull()
  expect(container.querySelector('[data-real-blocks="fallback"]')).toBeVisible()
})

it('draws a reused fence at once when its text changes long after the last change', async () => {
  vi.useFakeTimers()
  try {
    stack.render.mockReturnValue(new Promise(() => {}))
    const { container, rerender } = render(<RealScratchBlocks code={CODE} />)
    act(() => vi.advanceTimersByTime(LIVE_EDIT_WINDOW_MS + 500))
    rerender(<RealScratchBlocks code={`${CODE}\nmove (5) steps`} />)
    // Not a live edit (the same component shown for another task): no debounce, no flicker.
    expect(stack.render).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-real-blocks="pending"]').style.visibility).toBe('hidden')
  } finally {
    vi.useRealTimers()
  }
})

it('shows the fence text straight away while an edited fence waits to be drawn', () => {
  stack.render.mockReturnValue(new Promise(() => {}))
  const { container, rerender } = render(<RealScratchBlocks code={CODE} />)
  rerender(<RealScratchBlocks code={`${CODE}\nmove (5) steps`} />)
  rerender(<RealScratchBlocks code={`${CODE}\nmove (50) steps`} />)
  const pending = container.querySelector('[data-real-blocks="pending"]')
  expect(pending.style.visibility).toBe('')
  expect(pending).not.toHaveAttribute('aria-hidden')
})

it('strips anything active from the SVG before it is put on the page', async () => {
  stack.render.mockResolvedValue({
    ...DRAWN,
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="200" onload="alert(1)">' +
      '<script>alert(2)</script><foreignObject><div>x</div></foreignObject>' +
      '<a href="javascript:alert(3)"><path onclick="alert(4)" class="blocklyPath"/></a>' +
      '<image xlink:href="javascript:alert(5)"/><image href="data:image/svg+xml;base64,AA=="/>' +
      '<use href="#hsc-sb-0"/></svg>',
  })
  const { container } = render(<RealScratchBlocks code={CODE} />)
  await act(async () => {})
  const real = container.querySelector('[data-real-blocks="blockly"]')
  const html = real.innerHTML
  expect(html).not.toMatch(/<script|foreignObject|javascript:|\son\w+=/i)
  expect(real.querySelector('path.blocklyPath')).not.toBeNull()
  expect(html).toContain('data:image/svg+xml;base64,AA==')
  expect(html).toMatch(/href="#hsc-sb-/)
})

it('works out a live edit without writing to a ref during render (StrictMode)', async () => {
  vi.useFakeTimers()
  try {
    stack.render.mockReturnValue(new Promise(() => {}))
    const { rerender } = render(
      <React.StrictMode>
        <RealScratchBlocks code={CODE} />
      </React.StrictMode>
    )
    rerender(
      <React.StrictMode>
        <RealScratchBlocks code={`${CODE}\nmove (5) steps`} />
      </React.StrictMode>
    )
    const first = stack.render.mock.calls.length
    rerender(
      <React.StrictMode>
        <RealScratchBlocks code={`${CODE}\nmove (50) steps`} />
      </React.StrictMode>
    )
    // Typed straight after: debounced, not drawn at once, even with renders run twice.
    expect(stack.render.mock.calls.length).toBe(first)
    await act(async () => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS + 10))
    expect(stack.render.mock.calls.length).toBeGreaterThan(first)
  } finally {
    vi.useRealTimers()
  }
})

it('draws a fence whose text changes once just after it shows at once, with no text flash', () => {
  // Task text arriving just after the explainer mounts is not someone typing.
  stack.render.mockReturnValue(new Promise(() => {}))
  const { container, rerender } = render(<RealScratchBlocks code={CODE} />)
  rerender(<RealScratchBlocks code={`${CODE}\nmove (5) steps`} />)
  expect(stack.render).toHaveBeenCalledTimes(2)
  const pending = container.querySelector('[data-real-blocks="pending"]')
  expect(pending.style.visibility).toBe('hidden')
})
