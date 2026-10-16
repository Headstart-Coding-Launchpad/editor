// Preview re-runs while a value is scrubbed (./scrubConfig.js "liveRerun").
//
// A THROTTLE, not a debounce (P6-25): while a value keeps moving, the latest request runs at
// most once every `delayMs` (counted from when the last run started), so the picture keeps up
// with a drag instead of waiting for it to pause. (It used to restart a `delayMs` wait on every
// request, so a drag that never paused for that long never redrew until it stopped.) The first
// request after a quiet spell runs at once. While a run is still going a new one never starts
// (Chromebooks stay responsive): the latest request waits and runs when the current one ends (no
// sooner than `delayMs` after it started), and requests in between are skipped. A request the
// same as the last one run (`isSame`, by default ===) is skipped too. settle() resolves once
// nothing is running or waiting.

export const SCRUB_PREVIEW_DELAY_MS = 200

export function createPreviewScheduler({
  run,
  isSame = (a, b) => a === b,
  delayMs = SCRUB_PREVIEW_DELAY_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => Date.now(),
}) {
  let timer = null
  let pending = null
  let running = null
  let lastRan = null
  let lastStartedAt = -Infinity
  let waiters = []

  function notifyIfIdle() {
    if (running || pending != null || timer != null) return
    const resolve = waiters
    waiters = []
    resolve.forEach((fn) => fn())
  }

  // Starts the waiting request as soon as the throttle allows (no-op while a run or a timer is
  // already going: the run's end, or the timer, picks up the latest request).
  function schedule() {
    if (timer != null || running || pending == null) return
    const wait = Math.max(0, delayMs - (now() - lastStartedAt))
    timer = setTimer(start, wait)
  }

  function start() {
    timer = null
    if (running || pending == null) {
      notifyIfIdle()
      return
    }
    const job = pending
    pending = null
    if (lastRan != null && isSame(job, lastRan)) {
      notifyIfIdle()
      return
    }
    lastRan = job
    lastStartedAt = now()
    running = Promise.resolve()
      .then(() => run(job))
      .catch(() => {})
      .then(() => {
        running = null
        if (pending != null) schedule()
        else notifyIfIdle()
      })
  }

  return {
    request(job) {
      pending = job
      schedule()
    },
    /** Drops a waiting request (a running one finishes). */
    cancel() {
      if (timer != null) clearTimer(timer)
      timer = null
      pending = null
      notifyIfIdle()
    },
    /** Forgets the last code run, so the same code runs again on the next request. */
    reset() {
      lastRan = null
    },
    busy() {
      return !!running || pending != null || timer != null
    },
    /** Resolves when no preview is running or waiting (a waiting one is dropped first). */
    settle() {
      this.cancel()
      if (!running) return Promise.resolve()
      return new Promise((resolve) => waiters.push(resolve))
    },
  }
}
