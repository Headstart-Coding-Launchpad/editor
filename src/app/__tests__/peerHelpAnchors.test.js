import { describe, expect, it } from 'vitest'
import {
  describeItem,
  findAnchor,
  peerHelpAnchors,
  peerHelpCapability,
  supportsPeerHelp,
} from '../peerHelpAnchors'

describe('peer help capability', () => {
  it('is declared by the code and Scratch modules only', () => {
    expect(peerHelpCapability('python')).toEqual({ anchors: 'lines', hints: 'python' })
    expect(peerHelpCapability('turtle')).toEqual({ anchors: 'lines', hints: 'python' })
    expect(peerHelpCapability('html')).toEqual({ anchors: 'lines', hints: 'html' })
    expect(peerHelpCapability('scratch')).toEqual({ anchors: 'scripts', hints: 'blocks' })
    for (const type of ['electronics', 'filesystem', 'desktop', 'arcade', 'nope']) {
      expect(supportsPeerHelp(type)).toBe(false)
    }
  })
})

describe('peerHelpAnchors', () => {
  it('lists code lines, named by file for HTML', () => {
    const python = peerHelpAnchors({ code: 'a = 1\nprint(a)' }, 'python', null)
    expect(python.map((a) => [a.label, a.text, a.editable])).toEqual([
      ['Line 1', 'a = 1', true],
      ['Line 2', 'print(a)', true],
    ])
    const html = peerHelpAnchors(
      { files: { 'index.html': '<p>' }, activeFile: 'index.html' },
      'html',
      null
    )
    expect(html[0]).toMatchObject({ file: 'index.html', line: 1, label: 'index.html · line 1' })
    expect(findAnchor(html, 'index.html', 1)?.text).toBe('<p>')
  })

  it('lists Scratch scripts per sprite, never editable', () => {
    const project = {
      blocks: {
        blocks: [
          { type: 'event_whenflagclicked', next: { block: { type: 'motion_movesteps' } } },
          { type: 'event_whenkeypressed' },
        ],
      },
    }
    const anchors = peerHelpAnchors({ code: JSON.stringify(project) }, 'scratch', {
      sprites: [{ id: 'cat', name: 'Cat' }],
    })
    expect(anchors.map((a) => [a.label, a.text, a.editable])).toEqual([
      ['Cat · script 1', 'when green flag clicked (2 blocks)', false],
      ['Cat · script 2', 'when key pressed (1 block)', false],
    ])
  })

  it('has nothing to anchor for unsupported types or no snapshot', () => {
    expect(peerHelpAnchors({ code: 'x' }, 'electronics', null)).toEqual([])
    expect(peerHelpAnchors(null, 'python', null)).toEqual([])
  })

  it('describes items in words, resolving hints by the module’s list', () => {
    expect(describeItem({ kind: 'mark', verdict: 'down' }, 'python')).toBe('👎 Look again')
    expect(describeItem({ kind: 'hint', hintId: 'py-indent' }, 'turtle')).toBe(
      '↔️ Check the spaces at the start'
    )
    expect(
      describeItem({ kind: 'hint', hintId: 'lesson-0' }, 'python', { peerHints: ['Use a loop'] })
    ).toBe('💡 Use a loop')
  })
})
