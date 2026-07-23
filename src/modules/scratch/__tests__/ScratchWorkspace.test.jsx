import { describe, expect, it } from 'vitest'
import { getSelectableScratchSprites, isSpriteStudentEditable, wrapScratchBubbleText } from '../ScratchWorkspace'

describe('ScratchWorkspace student-editable sprite helpers', () => {
  it('treats sprites as student-editable by default', () => {
    expect(isSpriteStudentEditable({ id: 'sprite1' })).toBe(true)
    expect(isSpriteStudentEditable({ id: 'sprite2', studentEditable: true })).toBe(true)
  })

  it('filters locked sprites only when student editability is respected', () => {
    const sprites = [
      { id: 'sprite1', name: 'Editable' },
      { id: 'sprite2', name: 'Locked', studentEditable: false },
    ]

    expect(getSelectableScratchSprites(sprites, false)).toEqual(sprites)
    expect(getSelectableScratchSprites(sprites, true)).toEqual([sprites[0]])
  })
})

describe('wrapScratchBubbleText', () => {
  const ctx = { measureText: value => ({ width: value.length * 10 }) }

  it('wraps speech text instead of letting it overflow a capped bubble', () => {
    expect(wrapScratchBubbleText(ctx, 'Why was the cat sitting on the computer?', 120))
      .toEqual(['Why was the', 'cat sitting', 'on the', 'computer?'])
  })

  it('splits an unbroken long value to keep it inside the bubble', () => {
    expect(wrapScratchBubbleText(ctx, 'abcdefghijkl', 40))
      .toEqual(['abcd', 'efgh', 'ijkl'])
  })
})
