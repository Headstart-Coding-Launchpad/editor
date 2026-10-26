// @vitest-environment node
// The worker's Image Lab bridge: pictures fetched before a run, load_image() answering at once,
// the synchronous fallback, snapshot() of the run so far and colour names.
import { describe, expect, it, vi } from 'vitest'
import { IMAGE_BYTES } from '../../../shared/stage/imageLibrary.js'
import { createStageRecorder } from '../../../shared/stage/commands.js'
import { createStagePictureBridge } from '../stagePictureBridge.js'

// A stored picture: every pixel the same colour.
function solid([r, g, b]) {
  const bytes = new Uint8Array(IMAGE_BYTES)
  for (let i = 0; i < bytes.length; i += 3) bytes.set([r, g, b], i)
  return bytes
}

const call = (args, kwargs = {}) => JSON.stringify({ args, kwargs })

describe('createStagePictureBridge', () => {
  it('fetches the pictures a program names before it runs, from the base path', async () => {
    const fetchBytes = vi.fn(async () => solid([255, 136, 0]))
    const fetchSync = vi.fn(() => null)
    const bridge = createStagePictureBridge({ base: '/editor/', fetchBytes, fetchSync })
    await bridge.prepare('fox = load_image("fox")\nsky = load_image("nebula", size=64)')
    expect(fetchBytes.mock.calls.map(([url]) => url).sort()).toEqual([
      '/editor/image-lab/fox.rgb',
      '/editor/image-lab/nebula.rgb',
    ])
    expect(bridge.cached('fox')).toBe(true)
    const answer = bridge.image(call(['fox']))
    expect(answer.startsWith('ok|')).toBe(true)
    expect(answer.slice(3)).toBe('ff8800'.repeat(32 * 32))
    expect(bridge.image(call(['nebula'], { size: 64 })).slice(3)).toHaveLength(64 * 64 * 6)
    expect(fetchSync).not.toHaveBeenCalled()
    // Fetched once for the worker's life.
    await bridge.prepare('fox = load_image("fox")')
    expect(fetchBytes).toHaveBeenCalledTimes(2)
  })

  it('fetches nothing for a program without load_image()', async () => {
    const fetchBytes = vi.fn(async () => solid([0, 0, 0]))
    const bridge = createStagePictureBridge({ fetchBytes })
    await bridge.prepare('print("fox")')
    expect(fetchBytes).not.toHaveBeenCalled()
  })

  it('fetches a name the scan missed there and then (synchronously)', () => {
    const fetchSync = vi.fn(() => solid([0, 0, 255]))
    const bridge = createStagePictureBridge({ fetchSync })
    expect(bridge.image(call(['moon'], { size: 8 }))).toBe(`ok|${'0000ff'.repeat(64)}`)
    expect(fetchSync).toHaveBeenCalledWith('/image-lab/moon.rgb')
  })

  it("says plainly when a picture can't be downloaded, or isn't a picture", async () => {
    const fetchBytes = vi.fn(async () => {
      throw new Error('offline')
    })
    // A dev server answers a missing file with the app's page.
    const fetchSync = vi.fn(() => new TextEncoder().encode('<!doctype html>'))
    const bridge = createStagePictureBridge({ fetchBytes, fetchSync })
    await bridge.prepare('load_image("fox")')
    expect(bridge.image(call(['fox']))).toBe(
      "RuntimeError|load_image(): the picture 'fox' couldn't be downloaded. Check the internet connection and press Run again"
    )
  })

  it('passes on a wrong name or size as the error to raise', () => {
    const bridge = createStagePictureBridge({ fetchSync: () => null })
    expect(bridge.image(call(['foxx']))).toBe(
      "ValueError|load_image(): there's no picture called 'foxx' — did you mean 'fox'?"
    )
    expect(bridge.image(call(['fox'], { size: 12 }))).toMatch(
      /^ValueError\|load_image\(\): size can be 8, 16, 32 or 64/
    )
    expect(bridge.image('not json')).toMatch(/^ValueError\|load_image\(\)/)
  })

  it('snapshots the current run’s drawing', () => {
    let recorder = createStageRecorder()
    const bridge = createStagePictureBridge({ getCommands: () => recorder.commands })
    recorder.call('background', ['red'])
    expect(bridge.snapshot(call([], { size: 2 }))).toBe(`ok|${'ff0000'.repeat(4)}`)
    recorder = createStageRecorder()
    expect(bridge.snapshot(call([]))).toBe(`ok|${'ffffff'.repeat(32 * 32)}`)
    expect(bridge.snapshot(call([], { size: 500 }))).toMatch(/^ValueError\|snapshot\(\): size/)
  })

  it('reads colour names for red(), green() and blue()', () => {
    const bridge = createStagePictureBridge()
    expect(bridge.colour('red', call(['orange']))).toBe('ok|#ffa500')
    expect(bridge.colour('green', call(['blu']))).toMatch(
      /^ValueError\|green\(\): 'blu' isn't a colour I know/
    )
  })
})
