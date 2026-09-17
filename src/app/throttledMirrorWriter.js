// Throttles a stream of "latest value" writes (e.g. a running program's
// output mirrored to a watching teacher) to at most one per `intervalMs`,
// with BOTH a leading and a trailing edge: the first value in a quiet period
// is written straight away, and whatever arrived during the cooldown is
// written once it ends. A leading-edge-only throttle silently drops the tail
// of a burst, leaving the mirror stale until the next unrelated write.
export function createThrottledMirrorWriter({
  write,
  intervalMs = 200,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let lastWriteAt = -Infinity
  let pending
  let hasPending = false
  let timer = null

  function writeNow(value) {
    lastWriteAt = now()
    hasPending = false
    pending = undefined
    write(value)
  }

  function clearPendingTimer() {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  return {
    push(value) {
      const elapsed = now() - lastWriteAt
      if (elapsed >= intervalMs && timer === null) {
        writeNow(value)
        return
      }
      pending = value
      hasPending = true
      if (timer === null) {
        timer = setTimer(
          () => {
            timer = null
            if (hasPending) writeNow(pending)
          },
          Math.max(intervalMs - elapsed, 0)
        )
      }
    },
    // Writes any value still waiting on the cooldown immediately.
    flush() {
      clearPendingTimer()
      if (hasPending) writeNow(pending)
    },
    // Drops any waiting value — for callers that are about to write the
    // final state themselves (possibly bundled with other fields).
    cancel() {
      clearPendingTimer()
      hasPending = false
      pending = undefined
    },
    // Records an out-of-band write of the latest value so the throttle
    // window restarts from it.
    markWritten() {
      clearPendingTimer()
      hasPending = false
      pending = undefined
      lastWriteAt = now()
    },
  }
}
