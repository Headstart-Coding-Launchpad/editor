// Links from Admin into the Lesson Builder, always in a new tab.
// load: a lesson id to open (Edit in Builder, a fresh fork); advanced: show hand-building tools.
export function makeBuilderUrl({ load, advanced = false } = {}) {
  const params = new URLSearchParams()
  if (load) params.set('load', load)
  if (advanced) params.set('advanced', '1')
  const query = params.toString()
  return `${window.location.origin}${window.location.pathname}#/builder${query ? `?${query}` : ''}`
}

export function openBuilder(options) {
  window.open(makeBuilderUrl(options), '_blank', 'noopener,noreferrer')
}
