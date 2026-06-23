import { describe, expect, it } from 'vitest'
import { getSelectableScratchSprites, isSpriteStudentEditable } from '../ScratchWorkspace'

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
