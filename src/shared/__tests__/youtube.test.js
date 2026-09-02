import { describe, it, expect } from 'vitest'
import { extractYouTubeId, isValidRecordingUrl, buildYouTubeEmbedSrc } from '../youtube'

describe('extractYouTubeId', () => {
  it('parses a youtu.be short link', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses a standard watch link with extra query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ')
  })

  it('parses an embed link', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses a youtube-nocookie embed link', () => {
    expect(extractYouTubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses a shorts link', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('rejects a non-YouTube host', () => {
    expect(extractYouTubeId('https://drive.google.com/file/d/dQw4w9WgXcQ/view')).toBeNull()
  })

  it('rejects a javascript: URL', () => {
    expect(extractYouTubeId('javascript:alert(1)')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(extractYouTubeId('not a url')).toBeNull()
    expect(extractYouTubeId('')).toBeNull()
    expect(extractYouTubeId(null)).toBeNull()
    expect(extractYouTubeId(undefined)).toBeNull()
  })

  it('rejects a watch link missing the v param', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?list=abc')).toBeNull()
  })
})

describe('isValidRecordingUrl', () => {
  it('mirrors extractYouTubeId', () => {
    expect(isValidRecordingUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isValidRecordingUrl('https://example.com/video')).toBe(false)
  })
})

describe('buildYouTubeEmbedSrc', () => {
  it('builds a youtube-nocookie embed URL with the JS API enabled', () => {
    const src = buildYouTubeEmbedSrc('dQw4w9WgXcQ')
    expect(src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0&modestbranding=1')
  })
})
