// Scratch sounds: a built-in synth library (generated with Web Audio, no files) plus audio
// files (an `audio` asset path, resolved like costume images). Sounds belong to a sprite —
// `sprite.sounds: [{ name, synth } | { name, audio }]` — and a sprite with no `sounds` list
// gets DEFAULT_SPRITE_SOUNDS, the four tones every sprite had before sounds were per-sprite,
// so older lessons keep their `start sound` blocks working unchanged. A block stores the
// sound's *name*; playback looks the name up in the running sprite's own list.

// Each synth is one or more layers: a `tone` (oscillator, optionally gliding from `freq` to
// `to`) or a `noise` burst (optionally through a filter). `start`/`duration` are seconds.
// pop/meow/click/chime reproduce the original four tones exactly.
export const SYNTH_SOUNDS = [
  { id: 'pop', name: 'pop', layers: [{ kind: 'tone', wave: 'sine', freq: 660, duration: 0.18 }] },
  {
    id: 'meow',
    name: 'meow',
    layers: [{ kind: 'tone', wave: 'sawtooth', freq: 440, to: 260, duration: 0.42 }],
  },
  {
    id: 'click',
    name: 'click',
    layers: [{ kind: 'tone', wave: 'square', freq: 880, duration: 0.08 }],
  },
  {
    id: 'chime',
    name: 'chime',
    layers: [{ kind: 'tone', wave: 'triangle', freq: 1046, duration: 0.35 }],
  },
  {
    id: 'boing',
    name: 'boing',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 180, to: 520, duration: 0.18 },
      { kind: 'tone', wave: 'sine', freq: 520, to: 260, start: 0.18, duration: 0.22 },
    ],
  },
  {
    id: 'laser',
    name: 'laser',
    layers: [{ kind: 'tone', wave: 'square', freq: 1400, to: 180, duration: 0.3, volume: 0.1 }],
  },
  {
    id: 'coin',
    name: 'coin',
    layers: [
      { kind: 'tone', wave: 'square', freq: 988, duration: 0.08, volume: 0.1 },
      { kind: 'tone', wave: 'square', freq: 1319, start: 0.08, duration: 0.3, volume: 0.1 },
    ],
  },
  {
    id: 'jump',
    name: 'jump',
    layers: [{ kind: 'tone', wave: 'square', freq: 300, to: 750, duration: 0.22, volume: 0.1 }],
  },
  {
    id: 'power-up',
    name: 'power up',
    layers: [523, 659, 784, 1047].map((freq, i) => ({
      kind: 'tone',
      wave: 'triangle',
      freq,
      start: i * 0.09,
      duration: 0.12,
    })),
  },
  {
    id: 'game-over',
    name: 'game over',
    layers: [392, 330, 262, 196].map((freq, i) => ({
      kind: 'tone',
      wave: 'triangle',
      freq,
      start: i * 0.18,
      duration: 0.24,
    })),
  },
  {
    id: 'beep',
    name: 'beep',
    layers: [{ kind: 'tone', wave: 'sine', freq: 1000, duration: 0.2 }],
  },
  {
    id: 'buzzer',
    name: 'buzzer',
    layers: [{ kind: 'tone', wave: 'sawtooth', freq: 110, duration: 0.5, volume: 0.12 }],
  },
  {
    id: 'bell',
    name: 'bell',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 1568, duration: 1.1 },
      { kind: 'tone', wave: 'sine', freq: 3136, duration: 0.6, volume: 0.05 },
    ],
  },
  {
    id: 'drum',
    name: 'drum',
    layers: [
      { kind: 'tone', wave: 'sine', freq: 140, to: 45, duration: 0.3, volume: 0.3 },
      { kind: 'noise', duration: 0.05, volume: 0.08 },
    ],
  },
  {
    id: 'snare',
    name: 'snare',
    layers: [
      { kind: 'noise', duration: 0.18, volume: 0.18, filter: { type: 'highpass', freq: 1500 } },
      { kind: 'tone', wave: 'triangle', freq: 220, duration: 0.08, volume: 0.1 },
    ],
  },
  {
    id: 'whoosh',
    name: 'whoosh',
    layers: [
      {
        kind: 'noise',
        duration: 0.6,
        volume: 0.2,
        filter: { type: 'bandpass', freq: 400, to: 3000 },
      },
    ],
  },
  {
    id: 'splash',
    name: 'splash',
    layers: [
      {
        kind: 'noise',
        duration: 0.8,
        volume: 0.2,
        filter: { type: 'lowpass', freq: 4000, to: 500 },
      },
    ],
  },
  {
    id: 'zap',
    name: 'zap',
    layers: [
      { kind: 'tone', wave: 'sawtooth', freq: 2200, to: 90, duration: 0.15, volume: 0.1 },
      { kind: 'noise', duration: 0.1, volume: 0.06 },
    ],
  },
]

const SYNTH_BY_ID = new Map(SYNTH_SOUNDS.map((s) => [s.id, s]))

export function getSynthSound(id) {
  return SYNTH_BY_ID.get(id) ?? null
}

export const DEFAULT_SPRITE_SOUNDS = ['pop', 'meow', 'click', 'chime'].map((id) => ({
  name: id,
  synth: id,
}))

// A sprite's sound list: its authored `sounds`, or the four default tones when it has none.
export function resolveSpriteSounds(sprite) {
  return Array.isArray(sprite?.sounds) && sprite.sounds.length > 0
    ? sprite.sounds
    : DEFAULT_SPRITE_SOUNDS
}

// Normalises the admin `defaultSounds` library (lessonTypeAssets/scratch) the same way the
// sprite/backdrop presets are: entries need an id, a name and an audio path.
export function normalizeSoundPresets(data) {
  if (!Array.isArray(data)) return []
  return data.filter(
    (preset) =>
      preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      preset.name.trim() !== '' &&
      typeof preset.audio === 'string' &&
      preset.audio.trim() !== ''
  )
}

// Name not already used in `items` (by `name`), suffixing " 2", " 3", … when it is.
export function uniqueItemName(name, items) {
  const used = new Set((items ?? []).map((item) => item.name))
  if (!used.has(name)) return name
  let n = 2
  while (used.has(`${name} ${n}`)) n += 1
  return `${name} ${n}`
}

export function synthDuration(synth) {
  return Math.max(0, ...(synth?.layers ?? []).map((l) => (l.start ?? 0) + l.duration))
}

// ── Playback ─────────────────────────────────────────────────────────────────

let audioContext = null
let activeNodes = []
const audioBufferCache = new Map() // url → Promise<AudioBuffer | null>

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  audioContext ??= new Ctor()
  if (audioContext.state === 'suspended') audioContext.resume?.().catch?.(() => {})
  return audioContext
}

function trackNode(node) {
  activeNodes.push(node)
  return new Promise((resolve) => {
    node.onended = () => {
      activeNodes = activeNodes.filter((item) => item !== node)
      resolve()
    }
  })
}

function envelope(ctx, gain, start, duration, volume) {
  gain.gain.setValueAtTime(0.001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.02, duration / 2))
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
}

function playLayer(ctx, layer, t0) {
  const start = t0 + (layer.start ?? 0)
  const volume = layer.volume ?? 0.16
  const gain = ctx.createGain()
  envelope(ctx, gain, start, layer.duration, volume)
  let source
  if (layer.kind === 'noise') {
    const length = Math.max(1, Math.floor(ctx.sampleRate * layer.duration))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    source = ctx.createBufferSource()
    source.buffer = buffer
    if (layer.filter) {
      const filter = ctx.createBiquadFilter()
      filter.type = layer.filter.type
      filter.frequency.setValueAtTime(layer.filter.freq, start)
      if (layer.filter.to)
        filter.frequency.exponentialRampToValueAtTime(layer.filter.to, start + layer.duration)
      source.connect(filter).connect(gain)
    } else {
      source.connect(gain)
    }
  } else {
    source = ctx.createOscillator()
    source.type = layer.wave ?? 'sine'
    source.frequency.setValueAtTime(layer.freq, start)
    if (layer.to) source.frequency.exponentialRampToValueAtTime(layer.to, start + layer.duration)
    source.connect(gain)
  }
  gain.connect(ctx.destination)
  source.start(start)
  source.stop(start + layer.duration + 0.03)
  return trackNode(source)
}

function playSynth(ctx, synth) {
  const t0 = ctx.currentTime
  return Promise.all(synth.layers.map((layer) => playLayer(ctx, layer, t0))).then(() => {})
}

function loadAudioBuffer(ctx, url) {
  if (!audioBufferCache.has(url)) {
    const pending = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => {
        audioBufferCache.delete(url) // allow a retry after a transient failure
        return null
      })
    audioBufferCache.set(url, pending)
  }
  return audioBufferCache.get(url)
}

// Starts loading an audio file so the first `start sound` doesn't wait on the network.
export function preloadSoundUrl(url) {
  const ctx = getAudioContext()
  if (ctx && url) loadAudioBuffer(ctx, url)
}

/**
 * Plays one sound entry and resolves when it finishes (or straight away if it can't play).
 * `sound` is `{ synth }` or `{ url }` (an `audio` path already resolved to a URL by the
 * caller); a bare synth id string is accepted too.
 */
export async function playScratchSound(sound) {
  const ctx = getAudioContext()
  if (!ctx || !sound) return
  const entry = typeof sound === 'string' ? { synth: sound } : sound
  try {
    if (entry.url) {
      const buffer = await loadAudioBuffer(ctx, entry.url)
      if (!buffer) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
      await trackNode(source)
      return
    }
    const synth = getSynthSound(entry.synth) ?? getSynthSound('pop')
    await playSynth(ctx, synth)
  } catch {
    // Audio is best-effort: a blocked AudioContext or bad file must never stop a script.
  }
}

export function stopAllScratchSounds() {
  for (const node of activeNodes) {
    try {
      node.stop()
    } catch {}
  }
  activeNodes = []
}

// ── Validation (Builder + CLI, via the Scratch definition's validateTask) ─────

const SOUND_TASK_FLAGS = ['showCostumesTab', 'showSoundsTab', 'allowAddCostume', 'allowAddSound']

export function validateScratchSoundsAndTabs(task, n, errors, warnings) {
  for (const flag of SOUND_TASK_FLAGS) {
    if (task[flag] != null && typeof task[flag] !== 'boolean')
      errors.push(`Task ${n} ${flag} must be true or false`)
  }
  if (task.allowAddCostume && !task.showCostumesTab)
    warnings.push(`Task ${n} allowAddCostume has no effect without showCostumesTab`)
  if (task.allowAddSound && !task.showSoundsTab)
    warnings.push(`Task ${n} allowAddSound has no effect without showSoundsTab`)

  for (const sprite of Array.isArray(task.sprites) ? task.sprites : []) {
    if (sprite?.sounds == null) continue
    const label = `Task ${n} sprite "${sprite.name ?? sprite.id ?? '?'}"`
    if (!Array.isArray(sprite.sounds)) {
      errors.push(`${label} sounds must be a list`)
      continue
    }
    const names = new Set()
    for (const sound of sprite.sounds) {
      const name = typeof sound?.name === 'string' ? sound.name.trim() : ''
      if (!name) {
        errors.push(`${label} has a sound with no name`)
        continue
      }
      if (names.has(name)) errors.push(`${label} has two sounds named "${name}"`)
      names.add(name)
      const hasSynth = typeof sound.synth === 'string' && sound.synth !== ''
      const hasAudio = typeof sound.audio === 'string' && sound.audio !== ''
      if (hasSynth === hasAudio)
        errors.push(`${label} sound "${name}" needs exactly one of synth or audio`)
      else if (hasSynth && !getSynthSound(sound.synth))
        errors.push(
          `${label} sound "${name}" uses unknown synth "${sound.synth}" (known: ${SYNTH_SOUNDS.map((s) => s.id).join(', ')})`
        )
    }
  }
}
