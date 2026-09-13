import { describe, expect, it } from 'vitest'
import { resolveAssetFileUrl, resolveAssetsPath } from '../assetPaths'

describe('resolveAssetsPath', () => {
  it('returns no URL for an unset lesson asset path', () => {
    expect(resolveAssetsPath('', { baseUrl: '/editor/', origin: 'https://classroom.test' })).toBe(
      ''
    )
  })

  it('preserves separators while URL-encoding path segments', () => {
    expect(
      resolveAssetsPath('/assets/my lesson/icon #1.png/', {
        baseUrl: '/editor/',
        origin: 'https://classroom.test',
      })
    ).toBe('https://classroom.test/editor/assets/my%20lesson/icon%20%231.png/')
  })
})

describe('resolveAssetFileUrl', () => {
  it('uses the lesson asset folder for relative files', () => {
    expect(
      resolveAssetFileUrl('https://classroom.test/editor/assets/lesson', 'sprites/cat.png')
    ).toBe('https://classroom.test/editor/assets/lesson/sprites/cat.png')
  })

  it('resolves public root-relative files independently of a lesson asset folder', () => {
    expect(
      resolveAssetFileUrl('', '/assets/shared/cat.png', {
        baseUrl: '/editor/',
        origin: 'https://classroom.test',
      })
    ).toBe('https://classroom.test/editor/assets/shared/cat.png')
  })

  it('keeps external costume URLs intact', () => {
    expect(resolveAssetFileUrl('', 'https://images.test/cat.png')).toBe(
      'https://images.test/cat.png'
    )
  })
})
