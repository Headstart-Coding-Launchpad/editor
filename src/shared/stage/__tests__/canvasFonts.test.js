// Request #85: emoji on the Stage draw in Noto Color Emoji on every device, in stamp() and text().
import { describe, expect, it } from 'vitest'
import { drawStage } from '../canvas.js'

function recordingContext() {
  const fonts = []
  const ctx = new Proxy(
    { canvas: { width: 400, height: 400 } },
    {
      get(target, key) {
        if (key in target) return target[key]
        return () => {}
      },
      set(target, key, value) {
        if (key === 'font') fonts.push(value)
        target[key] = value
        return true
      },
    }
  )
  return { ctx, fonts }
}

describe('Stage emoji font', () => {
  it('stamps in Noto Color Emoji first', () => {
    const { ctx, fonts } = recordingContext()
    drawStage(ctx, [{ type: 'stamp', emoji: '🚀', x: 200, y: 200, size: 32 }])
    expect(fonts.at(-1)).toMatch(/^32px "Noto Color Emoji"/)
  })

  it('lets emoji in text() fall through to Noto, not the system emoji font', () => {
    const { ctx, fonts } = recordingContext()
    drawStage(ctx, [{ type: 'text', text: 'Go 🚀', x: 200, y: 200, size: 16, colour: '#000000' }])
    const font = fonts.at(-1)
    expect(font).toContain('"Noto Color Emoji"')
    expect(font).not.toContain('Segoe UI Emoji')
  })
})
