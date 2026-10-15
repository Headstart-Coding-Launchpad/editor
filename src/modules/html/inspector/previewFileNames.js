// Blob URL → the student's file name, for every file of recent preview builds (the entry page
// included; recorded by ../iframe.js buildIframeSrc), so the HTML Inspector can name a
// stylesheet "style.css" rather than a blob URL. Bounded, in memory only.
const names = new Map()
const MAX_NAMES = 300

export function rememberPreviewFileName(url, name) {
  if (!url) return
  names.delete(url)
  names.set(url, name)
  while (names.size > MAX_NAMES) names.delete(names.keys().next().value)
}

/** The student's file name behind a preview Blob URL, or null. */
export function fileNameForPreviewUrl(url) {
  return names.get(url) ?? null
}
