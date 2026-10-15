// Debounced preview re-runs while a value is scrubbed (./scrubConfig.js "liveRerun").
//
// request(job) waits `delayMs` for the value to settle, then runs it. While a run is still
// going a new one never starts (Chromebooks stay responsive): the latest request waits and runs
// when the current one ends, and requests in between are skipped. A request the same as the
// last one run (`isSame`, by default ===) is skipped too. settle() resolves once nothing is running or waiting.

export const SCRUB_PREVIEW_DELAY_MS = 200

export function createPreviewScheduler({
  run,
  isSame = (a, b) => a === b,
  delayMs = SCRUB_PREVIEW_DELAY_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer = null
  let pending = null
  let running = null
  let lastRan = null
  let waiters = []

  function notifyIfIdle() {
    if (running || pending != null || timer != null) return
    const resolve = waiters
    waiters = []
    resolve.forEach((fn) => fn())
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
    running = Promise.resolve()
      .then(() => run(job))
      .catch(() => {})
      .then(() => {
        running = null
        if (pending != null) start()
        else notifyIfIdle()
      })
  }

  return {
    request(job) {
      pending = job
      if (timer != null) clearTimer(timer)
      timer = setTimer(start, delayMs)
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
