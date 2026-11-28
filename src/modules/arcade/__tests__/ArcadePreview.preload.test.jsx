import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Opening an Arcade task fetches Pyodide's boot files once, so the game frame's first Play
// finds them in the browser's HTTP cache (measured in headless Chromium, 28 Nov 2026).
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

async function freshPreview() {
  vi.resetModules()
  return (await import('../ArcadePreview.jsx')).default
}

describe('ArcadePreview preloads Python', () => {
  let fetchSpy
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(0)))
  })
  afterEach(() => fetchSpy.mockRestore())

  it('does not download anything just by loading the Arcade module', async () => {
    vi.resetModules()
    await import('../index.js')
    await import('../runtime.js')
    expect(fetchSpy).not.toHaveBeenCalled()
  }, 30000)

  it('fetches the Pyodide boot files once when an Arcade task opens, before Play', async () => {
    const ArcadePreview = await freshPreview()
    const first = render(<ArcadePreview code="game.run()" runId={0} running={false} />)
    const urls = fetchSpy.mock.calls.map(([url]) => String(url))
    expect(urls.sort()).toEqual(
      [
        'pyodide.mjs',
        'pyodide.asm.js',
        'pyodide.asm.wasm',
        'python_stdlib.zip',
        'pyodide-lock.json',
      ]
        .map((file) => PYODIDE + file)
        .sort()
    )
    first.unmount()
    // Another task, the builder preview, or Play itself: nothing is fetched again.
    const second = render(<ArcadePreview code="game.run()" runId={1} running />)
    second.rerender(<ArcadePreview code="game.run()" runId={2} running />)
    expect(fetchSpy).toHaveBeenCalledTimes(5)
  })

  it('stays silent when the download fails, and Play still opens the game', async () => {
    fetchSpy.mockRejectedValue(new TypeError('offline'))
    const ArcadePreview = await freshPreview()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const view = render(<ArcadePreview code="game.run()" runId={0} running={false} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    view.rerender(<ArcadePreview code="game.run()" runId={1} running />)
    expect(view.getByTitle('Arcade game')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})
