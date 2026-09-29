/* global __APP_BUILD_INFO__ */

// Build metadata injected by vite.config.js (see scripts/build-info.mjs). Absent under
// Vitest, which uses its own config, so callers get null and show a dev label.
export function getAppBuildInfo() {
  return typeof __APP_BUILD_INFO__ !== 'undefined' ? __APP_BUILD_INFO__ : null
}

export function formatVersionNumber(info) {
  if (!info?.version) return 'dev'
  return info.build != null ? `${info.version}.${info.build}` : info.version
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Formatted by hand: toLocaleDateString's month abbreviations vary by ICU version ("Sep"/"Sept").
export function formatBuildDate(iso) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

// "LaunchPad v1.0.985 · 7a69ce2 · built 29 Sep 2026"
export function formatAppVersion(info) {
  const parts = [`LaunchPad v${formatVersionNumber(info)}`]
  if (info?.commit) parts.push(info.commit)
  const built = formatBuildDate(info?.builtAt)
  if (built) parts.push(`built ${built}`)
  return parts.join(' · ')
}
