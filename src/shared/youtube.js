// Shared YouTube URL parsing for the per-class recording widget. Kept dependency-free
// (only the built-in URL parser) so it can be imported from both Vite/browser code and
// the plain-Node CLI validator.

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    return VIDEO_ID_PATTERN.test(id) ? id : null
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null

  if (parsed.pathname === '/watch') {
    const id = parsed.searchParams.get('v')
    return id && VIDEO_ID_PATTERN.test(id) ? id : null
  }

  const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/)
  if (embedMatch) return VIDEO_ID_PATTERN.test(embedMatch[1]) ? embedMatch[1] : null

  const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/)
  if (shortsMatch) return VIDEO_ID_PATTERN.test(shortsMatch[1]) ? shortsMatch[1] : null

  return null
}

export function isValidRecordingUrl(url) {
  return extractYouTubeId(url) !== null
}

// youtube-nocookie.com defers tracking cookies until playback starts, and enablejsapi
// lets the widget pause/resume in place when a student hides/reopens the pop-out.
export function buildYouTubeEmbedSrc(videoId) {
  const params = new URLSearchParams({ enablejsapi: '1', rel: '0', modestbranding: '1' })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}
