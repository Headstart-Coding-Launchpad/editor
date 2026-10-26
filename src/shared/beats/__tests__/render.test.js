import { describe, expect, it } from 'vitest'
import { readBeatSong, validateBeatCall } from '../patterns.js'
import { renderBeatWav } from '../render.js'

// Just enough of an OfflineAudioContext to record what the drum kit schedules.
function param() {
  return {
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  }
}

function node(extra = {}) {
  return {
    connect(target) {
      return target
    },
    disconnect() {},
    ...extra,
  }
}

function makeOffline() {
  const made = []
  class FakeOffline {
    constructor(channels, length, sampleRate) {
      this.channels = channels
      this.length = length
      this.sampleRate = sampleRate
      this.destination = node()
      this.starts = []
      made.push(this)
    }
    createGain() {
      return node({ gain: param() })
    }
    createDynamicsCompressor() {
      return node({
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      })
    }
    createBiquadFilter() {
      return node({ frequency: param(), Q: param(), type: '' })
    }
    createOscillator() {
      const starts = this.starts
      return node({
        frequency: param(),
        type: '',
        start: (when) => starts.push(['osc', when]),
        stop() {},
      })
    }
    createBuffer(channels, length) {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }
    createBufferSource() {
      const starts = this.starts
      return node({ buffer: null, start: (when) => starts.push(['noise', when]), stop() {} })
    }
    async startRendering() {
      const data = new Float32Array(this.length).fill(0.25)
      return { getChannelData: () => data }
    }
  }
  return { FakeOffline, made }
}

describe('renderBeatWav', () => {
  const song = readBeatSong([validateBeatCall('play', ['x...', '..x.'], { tempo: 100 }).command])

  it('renders the beat offline, loops and all, to a mono 16-bit WAV', async () => {
    const { FakeOffline, made } = makeOffline()
    const bytes = await renderBeatWav(song, { loops: 2, sampleRate: 8000, Offline: FakeOffline })
    const ctx = made[0]
    // Two loops of 0.6 s, plus half a second for the last hit to ring out.
    expect(ctx.length).toBe(Math.ceil((0.6 * 2 + 0.5) * 8000))
    expect(ctx.channels).toBe(1)
    // The kick (a tone + a click) at 0 and 0.6, the snare (noise + a tone) at 0.3 and 0.9.
    const kickTones = ctx.starts.filter(([kind, when]) => kind === 'osc' && [0, 0.6].includes(when))
    expect(kickTones).toHaveLength(2)
    expect(ctx.starts.some(([, when]) => Math.abs(when - 0.9) < 1e-9)).toBe(true)
    const text = String.fromCharCode(...bytes.slice(0, 4), ...bytes.slice(8, 12))
    expect(text).toBe('RIFFWAVE')
    expect(bytes.length).toBe(44 + ctx.length * 2)
  })

  it('is null without an OfflineAudioContext or without a beat', async () => {
    expect(await renderBeatWav(song, { Offline: null })).toBeNull()
    const { FakeOffline } = makeOffline()
    expect(await renderBeatWav(null, { Offline: FakeOffline })).toBeNull()
  })
})
