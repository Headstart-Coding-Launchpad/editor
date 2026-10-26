import { useCallback, useSyncExternalStore } from 'react'

// Beat Maker's sound controls (docs/authoring/beats.md): mute and volume, one device-wide
// setting each, remembered in localStorage like the other device settings
// (src/app/soundSettings.js). Muted is stored as '1' (absent when sound is on); volume as a
// number 0-1 (absent means DEFAULT_BEAT_VOLUME). The kit's loudest output is capped at
// MAX_BEAT_GAIN whatever the slider says. localStorage may throw (private mode, blocked
// storage), so every access is best-effort and falls back to memory.

export const BEATS_MUTED_KEY = 'headstart_beats_muted'
export const BEATS_VOLUME_KEY = 'headstart_beats_volume'
export const DEFAULT_BEAT_VOLUME = 0.6
/** The volume cap: the slider's top maps to this gain. */
export const MAX_BEAT_GAIN = 0.7

const listeners = new Set()
const memory = { muted: false, volume: DEFAULT_BEAT_VOLUME }

function clampVolume(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : DEFAULT_BEAT_VOLUME
}

export function readBeatsMuted() {
  try {
    return window.localStorage.getItem(BEATS_MUTED_KEY) === '1'
  } catch {
    return memory.muted
  }
}

export function readBeatsVolume() {
  try {
    const raw = window.localStorage.getItem(BEATS_VOLUME_KEY)
    return raw === null ? DEFAULT_BEAT_VOLUME : clampVolume(raw)
  } catch {
    return memory.volume
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function setBeatsMuted(muted) {
  memory.muted = !!muted
  try {
    if (memory.muted) window.localStorage.setItem(BEATS_MUTED_KEY, '1')
    else window.localStorage.removeItem(BEATS_MUTED_KEY)
  } catch {
    // Storage unavailable: memory keeps the choice for this page.
  }
  notify()
}

export function setBeatsVolume(volume) {
  memory.volume = clampVolume(volume)
  try {
    window.localStorage.setItem(BEATS_VOLUME_KEY, String(memory.volume))
  } catch {
    // Storage unavailable: memory keeps the choice for this page.
  }
  notify()
}

/** The gain the kit plays at: 0 when muted, else the volume under the cap. */
export function beatGain({ muted, volume }) {
  return muted ? 0 : clampVolume(volume) * MAX_BEAT_GAIN
}

export function subscribeBeatSound(listener) {
  listeners.add(listener)
  function onStorage(event) {
    if (event.key === BEATS_MUTED_KEY || event.key === BEATS_VOLUME_KEY || event.key === null) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** `{ muted, volume, setMuted, setVolume }`, in sync across consumers and tabs. */
export function useBeatSound() {
  const muted = useSyncExternalStore(subscribeBeatSound, readBeatsMuted, () => false)
  const volume = useSyncExternalStore(
    subscribeBeatSound,
    readBeatsVolume,
    () => DEFAULT_BEAT_VOLUME
  )
  const setMuted = useCallback((next) => setBeatsMuted(next), [])
  const setVolume = useCallback((next) => setBeatsVolume(next), [])
  return { muted, volume, setMuted, setVolume }
}
