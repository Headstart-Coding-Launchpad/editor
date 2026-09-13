import { describe, expect, it } from 'vitest'
import {
  cloneFiles,
  cloneScratchState,
  decodeSessionFiles,
  getFileType,
  parseScratchState,
} from '../workspaceData'

describe('scratch state helpers', () => {
  it('parses JSON or preserves an existing project object', () => {
    const state = { blocks: { blocks: [] } }
    expect(parseScratchState(JSON.stringify(state))).toEqual(state)
    expect(parseScratchState(state)).toBe(state)
    expect(parseScratchState('{bad')).toBeNull()
  })

  it('clones a project so sandbox edits do not mutate its source', () => {
    const source = { blocks: { blocks: [{ id: 'one' }] } }
    const clone = cloneScratchState(source)
    clone.blocks.blocks[0].id = 'changed'
    expect(source.blocks.blocks[0].id).toBe('one')
  })
})

describe('HTML file helpers', () => {
  it('clones editor files without sharing file objects', () => {
    const source = [{ name: 'index.html', content: '<h1>Hi</h1>' }]
    const clone = cloneFiles(source)
    clone[0].content = ''
    expect(source[0].content).toContain('Hi')
  })

  it('decodes Firebase file maps while retaining caller-specific fallback types', () => {
    const decodeKey = (key) => key.replace('__dot__', '.')
    expect(decodeSessionFiles({ index__dot__html: 'a', README: 'b' }, decodeKey, 'html')).toEqual([
      { name: 'index.html', content: 'a', type: 'html' },
      { name: 'README', content: 'b', type: 'html' },
    ])
    expect(getFileType('script.js')).toBe('javascript')
  })

  it('recovers legacy file-object entries as editable text files', () => {
    const decodeKey = (key) => key.replace('__dot__', '.')
    expect(
      decodeSessionFiles(
        {
          0: { name: 'index.html', content: '<h1>Recovered</h1>', type: 'html' },
        },
        decodeKey,
        'html'
      )
    ).toEqual([{ name: 'index.html', content: '<h1>Recovered</h1>', type: 'html' }])
  })
})
