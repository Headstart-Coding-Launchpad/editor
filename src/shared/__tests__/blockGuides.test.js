// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'
import {
  BLOCK_GUIDE_COLOURS,
  blockGuideColour,
  buildBlockGuideDecorations,
  findPythonBlocks,
  taskShowsBlocks,
} from '../blockGuides'

const blocks = (code, opts) =>
  findPythonBlocks(code.split('\n'), opts).map(({ header, from, to, column, level }) => ({
    header,
    from,
    to,
    column,
    level,
  }))

describe('findPythonBlocks', () => {
  it('finds nested blocks and where each one ends', () => {
    const code = [
      'guess = 15',
      'if guess < 20:',
      '    print("Too low")',
      '    if mode == "warmer":',
      '        print("Heating up!")',
      'print("Round over")',
    ].join('\n')
    expect(blocks(code)).toEqual([
      { header: 2, from: 3, to: 5, column: 0, level: 0 },
      { header: 4, from: 5, to: 5, column: 4, level: 1 },
    ])
  })

  it('gives elif/else their own block at the same level as the if', () => {
    const code = ['if a:', '    x()', 'elif b:', '    y()', 'else:', '    z()'].join('\n')
    expect(blocks(code).map((b) => [b.header, b.from, b.to, b.level])).toEqual([
      [1, 2, 2, 0],
      [3, 4, 4, 0],
      [5, 6, 6, 0],
    ])
  })

  it('draws no bracket when the body is not indented', () => {
    expect(blocks('if a:\nprint(1)')).toEqual([])
    expect(blocks('if a:')).toEqual([])
  })

  it('keeps blank lines and comments inside a block, but not trailing ones', () => {
    const code = ['for i in range(3):', '    a()', '', '    # note', '    b()', '', '# end', 'c()']
    expect(blocks(code.join('\n'))).toEqual([{ header: 1, from: 2, to: 5, column: 0, level: 0 }])
  })

  it('ignores colons inside strings, comments, brackets and one-line blocks', () => {
    const code = [
      'x = "a:"',
      'y = 1  # see:',
      'd = {',
      '  "k":',
      '    1}',
      'if a: print(1)',
      's = text[1:]',
    ].join('\n')
    expect(blocks(code)).toEqual([])
  })

  it('treats a header split over lines as one header', () => {
    const code = ['if (a and', '        b):', '    go()', 'done()'].join('\n')
    expect(blocks(code)).toEqual([{ header: 2, from: 3, to: 3, column: 0, level: 0 }])
  })

  it('does not end a block at continuation lines or inside a triple-quoted string', () => {
    const code = ['def f():', '    s = """', 'not code:', '"""', '    return s', 'f()'].join('\n')
    expect(blocks(code)).toEqual([{ header: 1, from: 2, to: 5, column: 0, level: 0 }])
  })

  it('expands tabs to tab stops', () => {
    expect(blocks('if a:\n\tb()', { tabSize: 4 })).toEqual([
      { header: 1, from: 2, to: 2, column: 0, level: 0 },
    ])
  })

  it('reports the colon position on the header line', () => {
    expect(findPythonBlocks(['while True:  # loop', '    go()'])[0].colon).toBe(10)
  })
})

describe('block guide colours', () => {
  it('cycles through the palette by level', () => {
    expect(blockGuideColour(0)).toBe(BLOCK_GUIDE_COLOURS[0])
    expect(blockGuideColour(BLOCK_GUIDE_COLOURS.length)).toBe(BLOCK_GUIDE_COLOURS[0])
    expect(blockGuideColour(1)).not.toBe(blockGuideColour(0))
  })
})

describe('taskShowsBlocks', () => {
  it('is on unless the task sets showBlocks: false', () => {
    expect(taskShowsBlocks(undefined)).toBe(true)
    expect(taskShowsBlocks({})).toBe(true)
    expect(taskShowsBlocks({ showBlocks: true })).toBe(true)
    expect(taskShowsBlocks({ showBlocks: false })).toBe(false)
  })
})

describe('buildBlockGuideDecorations', () => {
  it('marks each header colon and adds a bracket to every line in the block', () => {
    const state = EditorState.create({
      doc: 'if a:\n    b()\n    c()\nd()',
      extensions: [EditorState.tabSize.of(4), indentUnit.of('    ')],
    })
    const found = []
    buildBlockGuideDecorations(state).between(0, state.doc.length, (from, to, deco) => {
      found.push({ line: state.doc.lineAt(from).number, cls: deco.spec.class, mark: from !== to })
    })
    expect(found).toEqual([
      { line: 1, cls: 'cm-blockColon', mark: true },
      { line: 2, cls: 'cm-blockGuides', mark: false },
      { line: 3, cls: 'cm-blockGuides', mark: false },
    ])
  })
})
