// Beat Maker's drum kit (docs/authoring/beats.md): kick, snare, closed hi-hat and clap, made in
// code with Web Audio. No sample files, nothing to license. Each voice works on a live
// AudioContext and on an OfflineAudioContext (the WAV render), so what students hear and what
// they save are the same sounds.

// One second of white noise per audio context, shared by the snare, hat and clap.
const noiseBuffers = new WeakMap()

function noiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate))
    buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

// A gain node that jumps to `peak` at `when` and dies away to silence over `decay` seconds.
function decayingGain(ctx, out, when, peak, decay) {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decay)
  gain.connect(out)
  return gain
}

function noise(ctx, when, duration) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  source.start(when)
  source.stop(when + duration + 0.02)
  return source
}

function filter(ctx, type, frequency, q = 1) {
  const node = ctx.createBiquadFilter()
  node.type = type
  node.frequency.value = frequency
  node.Q.value = q
  return node
}

// A deep, punchy kick: a sine that drops fast in pitch, with a tiny click on top.
function kick(ctx, out, when, level) {
  const body = ctx.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(160, when)
  body.frequency.exponentialRampToValueAtTime(48, when + 0.12)
  body.connect(decayingGain(ctx, out, when, 0.95 * level, 0.42))
  body.start(when)
  body.stop(when + 0.45)
  noise(ctx, when, 0.012)
    .connect(filter(ctx, 'highpass', 2500))
    .connect(decayingGain(ctx, out, when, 0.25 * level, 0.012))
}

// A snappy snare: bright noise for the rattle, a short tone for the drum's body.
function snare(ctx, out, when, level) {
  noise(ctx, when, 0.2)
    .connect(filter(ctx, 'highpass', 1200))
    .connect(decayingGain(ctx, out, when, 0.55 * level, 0.2))
  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(220, when)
  body.frequency.exponentialRampToValueAtTime(160, when + 0.08)
  body.connect(decayingGain(ctx, out, when, 0.4 * level, 0.1))
  body.start(when)
  body.stop(when + 0.12)
}

// A closed hi-hat: a very short tick of very high noise.
function hat(ctx, out, when, level) {
  noise(ctx, when, 0.06)
    .connect(filter(ctx, 'highpass', 7000))
    .connect(filter(ctx, 'peaking', 10000, 1.2))
    .connect(decayingGain(ctx, out, when, 0.3 * level, 0.05))
}

// A clap: three fast slaps of mid noise, then a short room tail.
function clap(ctx, out, when, level) {
  const band = filter(ctx, 'bandpass', 1400, 1.4)
  band.connect(out)
  for (const offset of [0, 0.011, 0.022]) {
    noise(ctx, when + offset, 0.012).connect(
      decayingGain(ctx, band, when + offset, 0.8 * level, 0.012)
    )
  }
  noise(ctx, when + 0.03, 0.16).connect(decayingGain(ctx, band, when + 0.03, 0.6 * level, 0.16))
}

const VOICES = { kick, snare, hat, clap }

/** Plays one drum hit on `ctx` at `when` (its clock), into `out`. X (accent) is louder. */
export function scheduleDrum(ctx, out, name, when, { accent = false } = {}) {
  const voice = VOICES[name]
  if (!voice) return
  voice(ctx, out, Math.max(0, when), accent ? 1 : 0.7)
}

/**
 * The kit's output chain on `ctx`: a gain (the student's volume) into a limiter, so a loud
 * stack of hits can't clip or blast. Returns `{ input, gain }`.
 */
export function createDrumOutput(ctx, volume) {
  const gain = ctx.createGain()
  gain.gain.value = volume
  const limiter = ctx.createDynamicsCompressor?.()
  if (limiter) {
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.15
    gain.connect(limiter)
    limiter.connect(ctx.destination)
  } else {
    gain.connect(ctx.destination)
  }
  return { input: gain, gain }
}
