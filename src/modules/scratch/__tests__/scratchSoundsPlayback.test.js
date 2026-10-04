import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Fresh module per test: playback keeps a module-level AudioContext, buffer cache and
// media-element fallback set.
async function loadModule() {
  vi.resetModules()
  return import('../scratchSounds.js')
}

class FakeAudioContext {
  state = 'running'
  destination = {}
  currentTime = 0
  decodeAudioData = vi.fn(async () => ({ duration: 1 }))
  createBufferSource() {
    const node = {
      connect: vi.fn(),
      start: vi.fn(() => queueMicrotask(() => node.onended?.())),
      stop: vi.fn(),
    }
    return node
  }
}

class FakeAudio {
  static instances = []
  constructor(src) {
    this.src = src
    this.pause = vi.fn()
    this.play = vi.fn(() => Promise.resolve())
    FakeAudio.instances.push(this)
  }
}

describe('playScratchSound audio files', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    vi.stubGlobal('AudioContext', FakeAudioContext)
    window.AudioContext = FakeAudioContext
    vi.stubGlobal('Audio', FakeAudio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.AudioContext
  })

  it('plays a fetched file through Web Audio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
    )
    const { playScratchSound } = await loadModule()
    await playScratchSound({ url: 'https://cdn.test/bark.mp3' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it('falls back to an <audio> element when fetch is blocked (no CORS), then skips fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const { playScratchSound } = await loadModule()

    const first = playScratchSound({ url: 'https://cdn.test/bark.mp3' })
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    const audio = FakeAudio.instances[0]
    expect(audio.src).toBe('https://cdn.test/bark.mp3')
    expect(audio.play).toHaveBeenCalled()
    audio.onended()
    await first

    const second = playScratchSound({ url: 'https://cdn.test/bark.mp3' })
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2))
    FakeAudio.instances[1].onended()
    await second
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stopAllScratchSounds ends a fallback sound so "play until done" finishes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const { playScratchSound, stopAllScratchSounds } = await loadModule()
    const playing = playScratchSound({ url: 'https://cdn.test/roar.mp3' })
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    stopAllScratchSounds()
    await playing
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled()
  })

  it('resolves when the fallback element errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const { playScratchSound } = await loadModule()
    const playing = playScratchSound({ url: 'https://cdn.test/missing.mp3' })
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    FakeAudio.instances[0].onerror()
    await expect(playing).resolves.toBeUndefined()
  })
})
