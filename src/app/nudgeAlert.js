// Browser attention effects for a teacher "nudge" (see useNudgeAlert). Each
// helper is best-effort: a browser that blocks audio, lacks the Notification
// API or has no favicon link simply skips that effect.

export const NUDGE_TITLE = '👋 Your teacher needs you!'
export const NUDGE_NOTIFICATIONS_DISMISSED_KEY = 'headstart_nudge_notifications_dismissed'

const NUDGE_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#f59e0b"/><text x="50" y="68" font-size="56" text-anchor="middle">👋</text></svg>'
  )

// Alternates the tab title (and favicon) between the page's own and the nudge
// ones until the returned stop() is called, which restores both.
export function startTitleFlash({ doc = document, text = NUDGE_TITLE, intervalMs = 1000 } = {}) {
  const originalTitle = doc.title
  const iconLink = doc.querySelector('link[rel~="icon"]')
  const originalIcon = iconLink?.getAttribute('href') ?? null
  let showingNudge = false

  const toggle = () => {
    showingNudge = !showingNudge
    doc.title = showingNudge ? text : originalTitle
    if (iconLink) iconLink.setAttribute('href', showingNudge ? NUDGE_FAVICON : originalIcon)
  }
  toggle()
  const timer = setInterval(toggle, intervalMs)

  return function stop() {
    clearInterval(timer)
    doc.title = originalTitle
    if (iconLink && originalIcon != null) iconLink.setAttribute('href', originalIcon)
  }
}

// Short chimes synthesised with Web Audio, so no sound asset is needed. `nudge` is bright
// enough to call a student back; `badge` (a live badge celebration) is a softer, lower-gain
// pair that shouldn't startle a class of screens; `complete` (a task's checks passing) is a
// quick rising C5-E5-G5 arpeggio, about 400ms, at a similarly gentle gain.
export const CHIME_PRESETS = Object.freeze({
  nudge: Object.freeze({ notes: [880, 1320], gain: 0.25, spacing: 0.18, decay: 0.35 }),
  badge: Object.freeze({ notes: [659.25, 987.77], gain: 0.06, spacing: 0.14, decay: 0.5 }),
  complete: Object.freeze({
    notes: [523.25, 659.25, 783.99],
    gain: 0.07,
    spacing: 0.09,
    decay: 0.24,
  }),
})

// Browsers may keep audio suspended until the student has interacted with the page; that
// failure is silent.
export function playChime({ notes, gain: peak, spacing, decay } = CHIME_PRESETS.nudge) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * spacing
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + decay)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + decay + 0.05)
    })
    setTimeout(() => ctx.close?.().catch?.(() => {}), 1000 + notes.length * spacing * 1000)
  } catch {
    // Audio unavailable or blocked; the visual cue still shows.
  }
}

export function playNudgeChime() {
  playChime(CHIME_PRESETS.nudge)
}

export function playBadgeChime() {
  playChime(CHIME_PRESETS.badge)
}

export function playCompleteChime() {
  playChime(CHIME_PRESETS.complete)
}

export function canShowNudgeNotification() {
  return typeof window !== 'undefined' && 'Notification' in window
}

// Only fires when the student has already granted permission; never prompts.
export function showNudgeNotification({ body = 'Please come back to your lesson.' } = {}) {
  if (!canShowNudgeNotification() || window.Notification.permission !== 'granted') return
  try {
    const notification = new window.Notification(NUDGE_TITLE, { body, tag: 'headstart-nudge' })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
