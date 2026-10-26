// "Save my beat" (docs/authoring/beats.md): a song rendered offline to a WAV file, with the same
// drum voices and timing the student hears, played as many times through as on the page. The
// WAV encoder is Scratch export's (src/modules/scratch/export/wav.js).

import { encodeWav } from '../../modules/scratch/export/wav.js'
import { createDrumOutput, scheduleDrum } from './drums.js'
import { DEFAULT_BEAT_VOLUME, MAX_BEAT_GAIN } from './beatSoundSettings.js'
import { buildTimeline, eventAt, loopCountFor } from './timing.js'

export const BEAT_WAV_SAMPLE_RATE = 44100
// Room after the last step for its hit to ring out.
const TAIL_SECONDS = 0.5

function OfflineContextClass() {
  if (typeof window === 'undefined') return null
  return window.OfflineAudioContext || window.webkitOfflineAudioContext || null
}

/**
 * A song → WAV bytes (Uint8Array, mono 16-bit), or null when there is nothing to render or the
 * browser has no OfflineAudioContext. Saved at a fixed comfortable level, not the student's
 * volume slider. `Offline` is for tests.
 */
export async function renderBeatWav(
  song,
  { loops, sampleRate = BEAT_WAV_SAMPLE_RATE, Offline = OfflineContextClass() } = {}
) {
  const timeline = buildTimeline(song)
  const count = loops ?? loopCountFor(timeline.period)
  if (!Offline || !timeline.events.length || !count) return null
  const seconds = timeline.period * count + TAIL_SECONDS
  const ctx = new Offline(1, Math.ceil(seconds * sampleRate), sampleRate)
  const output = createDrumOutput(ctx, DEFAULT_BEAT_VOLUME * MAX_BEAT_GAIN)
  const total = timeline.events.length * count
  for (let k = 0; k < total; k++) {
    const { time, event } = eventAt(timeline, k)
    for (const hit of event.hits) scheduleDrum(ctx, output.input, hit.name, time, hit)
  }
  const buffer = await ctx.startRendering()
  return encodeWav(buffer.getChannelData(0), sampleRate)
}

/** Downloads WAV bytes as a file (the student's "Save my beat" button). */
export function downloadWav(bytes, filename = 'my-beat.wav') {
  const blob = new Blob([bytes], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
