// Bounded in-memory log of normalised input events for one activity attempt. It is never
// persisted or synced; callers derive a summary (summary.js) for checks and live view.
// Pure: the DOM binding lives in useInputRecorder.

export const DEFAULT_MAX_EVENTS = 500

export function createInputRecorder({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  let buffer = []
  return {
    record(event) {
      buffer.push(event)
      if (buffer.length > maxEvents) buffer = buffer.slice(buffer.length - maxEvents)
    },
    events() {
      return buffer.slice()
    },
    reset() {
      buffer = []
    },
    get size() {
      return buffer.length
    },
  }
}
