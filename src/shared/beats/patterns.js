// Beat Maker (docs/authoring/beats.md): the `beats` Python module's calls, checked and turned
// into Stage commands. Pure.
//
// A pattern is a string with one character per step: x for a hit, . for a rest (X is a louder
// hit). A list of strings is joined into one pattern, so ["x...", "x.x."] is 8 steps. play()
// records one command, kept in the run's Stage command list (src/shared/stage/) so it reaches the
// tutor, Go Live, slow-mo and Export work the way a drawing does:
//
//   { type: 'beat', tempo: 100, length: 16, rows: [{ name: 'kick', steps: 'x...x...' }, ...] }
//
// `length` is the longest row; a shorter row repeats until the longest one ends. stop() records
// { type: 'beat_stop' }. Each play() in a run is one part; the parts play one after another (a
// verse, then a chorus), and stop() drops the parts before it.

/** The instruments, in play()'s positional order. */
export const BEAT_INSTRUMENTS = Object.freeze(['kick', 'snare', 'hat', 'clap'])

export const BEAT_TEMPO_MIN = 40
export const BEAT_TEMPO_MAX = 240
export const BEAT_TEMPO_DEFAULT = 100
/** The most steps one pattern can have (four bars of 16). */
export const MAX_BEAT_STEPS = 64
/** The most play() calls one run can make. */
export const MAX_BEAT_PARTS = 32

// Friendly spellings a student might reach for.
const INSTRUMENT_ALIASES = Object.freeze({
  kicks: 'kick',
  snares: 'snare',
  hats: 'hat',
  hihat: 'hat',
  hi_hat: 'hat',
  claps: 'clap',
})

const PATTERN_EXAMPLE = '"x...x...x...x..."'
const STEP_CHARACTERS = /^[xX.]+$/

class BeatArgError extends Error {
  constructor(kind, message) {
    super(message)
    this.kind = kind
  }
}

const typeError = (message) => new BeatArgError('TypeError', message)
const valueError = (message) => new BeatArgError('ValueError', message)

function given(value) {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'number') return `the number ${value}`
  if (typeof value === 'string') {
    const clipped = value.length > 20 ? `${value.slice(0, 20)}…` : value
    return `the text "${clipped}"`
  }
  if (Array.isArray(value)) return 'a list'
  if (value && typeof value === 'object' && typeof value.__hs_type__ === 'string') {
    return `a ${value.__hs_type__}`
  }
  return 'something else'
}

function ordinal(n) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

function describeCharacter(char) {
  if (char === ' ') return 'a space'
  if (char === '\t') return 'a tab'
  return `"${char}"`
}

/**
 * One instrument's pattern (a string, or a list of strings joined) → its steps string, or null
 * when it is None (no row). Throws a BeatArgError in plain words.
 */
export function readPattern(instrument, value) {
  if (value === null || value === undefined) return null
  let steps
  if (typeof value === 'string') {
    steps = value
  } else if (Array.isArray(value)) {
    const notText = value.find((item) => typeof item !== 'string')
    if (notText !== undefined) {
      throw typeError(
        `play(): the ${instrument} list should hold patterns in quotes, like ["x...", "x.x."], not ${given(notText)}`
      )
    }
    steps = value.join('')
  } else {
    throw typeError(
      `play(): the ${instrument} pattern should be in quotes, like ${PATTERN_EXAMPLE}, not ${given(value)}`
    )
  }
  if (steps.length === 0) {
    throw valueError(
      `play(): the ${instrument} pattern is empty. Give it at least one step, like "x..."`
    )
  }
  if (!STEP_CHARACTERS.test(steps)) {
    const at = [...steps].findIndex((char) => !/[xX.]/.test(char))
    const char = [...steps][at]
    throw valueError(
      `play(): the ${instrument} pattern has ${describeCharacter(char)} as its ${ordinal(at + 1)} character. Use x for a hit and . for a rest`
    )
  }
  if (steps.length > MAX_BEAT_STEPS) {
    throw valueError(
      `play(): the ${instrument} pattern has ${steps.length} steps. The most is ${MAX_BEAT_STEPS}`
    )
  }
  return steps
}

/** play()'s tempo → beats per minute (rounded to 0.1). Throws a BeatArgError. */
export function readTempo(value) {
  if (value === null || value === undefined) return BEAT_TEMPO_DEFAULT
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    const hint =
      typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value) ? ' (try int())' : ''
    throw typeError(`play(): tempo should be a number, like tempo=100, not ${given(value)}${hint}`)
  }
  if (value < BEAT_TEMPO_MIN || value > BEAT_TEMPO_MAX) {
    throw valueError(
      `play(): tempo goes from ${BEAT_TEMPO_MIN} (slow) to ${BEAT_TEMPO_MAX} (very fast), not ${value}`
    )
  }
  return Math.round(value * 10) / 10
}

function instrumentFor(keyword) {
  const name = String(keyword).toLowerCase()
  if (BEAT_INSTRUMENTS.includes(name)) return name
  return INSTRUMENT_ALIASES[name] ?? null
}

function buildPlay(args, kwargs) {
  const patterns = {}
  if (args.length > BEAT_INSTRUMENTS.length) {
    const extra = args[BEAT_INSTRUMENTS.length]
    throw typeError(
      typeof extra === 'number'
        ? `play(): to set the speed, give it a name: tempo=${extra}`
        : `play() takes up to ${BEAT_INSTRUMENTS.length} patterns, in the order kick, snare, hat, clap`
    )
  }
  args.forEach((value, i) => {
    // play(kick, 120): a number after the first pattern is almost always a tempo.
    if (i > 0 && typeof value === 'number') {
      throw typeError(
        `play(): ${value} isn't a pattern. To set the speed, give it a name: tempo=${value}`
      )
    }
    patterns[BEAT_INSTRUMENTS[i]] = value
  })
  let tempoValue
  for (const [key, value] of Object.entries(kwargs)) {
    if (key === 'tempo') {
      tempoValue = value
      continue
    }
    const instrument = instrumentFor(key)
    if (!instrument) {
      throw typeError(
        `play() has no instrument called "${key}". Use kick, snare, hat or clap (and tempo=)`
      )
    }
    if (instrument in patterns) throw typeError(`play() got the ${instrument} pattern twice`)
    patterns[instrument] = value
  }
  const tempo = readTempo(tempoValue)
  const rows = []
  for (const name of BEAT_INSTRUMENTS) {
    if (!(name in patterns)) continue
    const steps = readPattern(name, patterns[name])
    if (steps !== null) rows.push({ name, steps })
  }
  if (rows.length === 0) {
    throw valueError(`play() needs at least one pattern, like play(${PATTERN_EXAMPLE})`)
  }
  const length = Math.max(...rows.map((row) => row.steps.length))
  return { type: 'beat', tempo, length, rows }
}

/**
 * One `beats` call ('play' | 'stop') → `{ command }`, or `{ error: { kind, message } }` where
 * kind is the Python exception to raise. `args` / `kwargs` are as the bridge's JSON carries them
 * (None → null; values JSON can't carry arrive as { __hs_type__ }).
 */
export function validateBeatCall(name, args, kwargs = {}) {
  const list = Array.isArray(args) ? args : []
  const named = kwargs && typeof kwargs === 'object' && !Array.isArray(kwargs) ? kwargs : {}
  try {
    if (name === 'play') return { command: buildPlay(list, named) }
    if (name === 'stop') {
      if (list.length > 0 || Object.keys(named).length > 0) {
        throw typeError('stop() takes nothing in its brackets: just stop()')
      }
      return { command: { type: 'beat_stop' } }
    }
    throw typeError(`beats has no ${name}()`)
  } catch (err) {
    if (err instanceof BeatArgError) return { error: { kind: err.kind, message: err.message } }
    throw err
  }
}

/**
 * Records one `beats` call on a Stage recorder (createStageRecorder in
 * src/shared/stage/commands.js, whose `commands` list it appends to). Returns '' or
 * 'Kind|message' for Python to raise.
 */
export function recordBeatCall(recorder, name, args, kwargs = {}, { maxCommands = Infinity } = {}) {
  const { command, error } = validateBeatCall(String(name), args, kwargs)
  if (error) return `${error.kind}|${error.message}`
  const commands = recorder.commands
  if (command.type === 'beat') {
    const parts = commands.filter((item) => item?.type === 'beat').length
    if (parts >= MAX_BEAT_PARTS) {
      return `RuntimeError|play() was called more than ${MAX_BEAT_PARTS} times in one run. Is a loop calling it over and over?`
    }
  }
  if (commands.length >= maxCommands) {
    return 'RuntimeError|The stage is full: too many drawing commands and beats in one run'
  }
  commands.push(command)
  return ''
}

function listOf(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
  }
  return []
}

// A recorded or synced beat command → a clean part, or null when it isn't a usable beat.
function readPart(command) {
  const rows = listOf(command.rows)
    .filter(
      (row) =>
        row &&
        BEAT_INSTRUMENTS.includes(row.name) &&
        typeof row.steps === 'string' &&
        STEP_CHARACTERS.test(row.steps) &&
        row.steps.length <= MAX_BEAT_STEPS
    )
    .map((row) => ({ name: row.name, steps: row.steps }))
  if (rows.length === 0) return null
  const tempo = Number(command.tempo)
  return {
    tempo:
      Number.isFinite(tempo) && tempo >= BEAT_TEMPO_MIN && tempo <= BEAT_TEMPO_MAX
        ? tempo
        : BEAT_TEMPO_DEFAULT,
    length: Math.max(...rows.map((row) => row.steps.length)),
    rows,
  }
}

/** Whether a Stage command belongs to Beat Maker (the canvas draws nothing for it). */
export function isBeatCommand(command) {
  return command?.type === 'beat' || command?.type === 'beat_stop'
}

/**
 * A run's Stage commands → its song `{ parts, autoPlay }`, or null when the code played no beat.
 * `parts` are the play() calls after the last stop(); when stop() came last, they are the parts
 * it stopped, shown but not played on their own (`autoPlay: false`).
 */
export function readBeatSong(commands) {
  let parts = []
  let stopped = null
  for (const command of Array.isArray(commands) ? commands : []) {
    if (command?.type === 'beat') {
      const part = readPart(command)
      if (part) parts.push(part)
    } else if (command?.type === 'beat_stop') {
      if (parts.length > 0) stopped = parts
      parts = []
    }
  }
  if (parts.length > 0) return { parts, autoPlay: true }
  if (stopped) return { parts: stopped, autoPlay: false }
  return null
}

/** Whether a step character is a hit, and whether it is a loud one. */
export function stepHit(steps, index) {
  const char = steps[index % steps.length]
  return { hit: char === 'x' || char === 'X', accent: char === 'X' }
}

function stepList(steps, length) {
  const hits = []
  for (let i = 0; i < length; i++) if (stepHit(steps, i).hit) hits.push(i)
  return hits
}

/** A song in words, for screen readers and the tutor: what plays on which steps. */
export function describeBeatSong(song) {
  if (!song?.parts?.length) return 'No beat.'
  const partWords = song.parts.map((part, i) => {
    const rows = part.rows.map((row) => {
      const hits = stepList(row.steps, part.length)
      return hits.length === 0
        ? `${row.name}: no hits`
        : `${row.name} on step${hits.length === 1 ? '' : 's'} ${hits.join(', ')}`
    })
    const head = song.parts.length > 1 ? `Part ${i + 1}: ` : ''
    return `${head}${part.length} steps at ${part.tempo} beats a minute; ${rows.join('; ')}.`
  })
  return `Beat grid, steps counted from 0. ${partWords.join(' ')}`
}
