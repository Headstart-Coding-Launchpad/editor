import { describe, expect, it } from 'vitest'
import {
  anchorLineHints,
  chooseLineHints,
  getStageLineHints,
  getTaskLineHintSets,
  isLineHintSyntax,
  LINE_HINT_SYNTAXES,
  parseLineHints,
  stripLessonLineHints,
  stripLineHints,
  stripTaskLineHints,
} from '../lineHints.js'
import { getModuleDefinition, MODULE_TYPES } from '../../modules/definitions.js'

describe('line hint syntaxes', () => {
  it('knows the python and html marker syntaxes', () => {
    expect(LINE_HINT_SYNTAXES).toEqual(['python', 'html'])
    expect(isLineHintSyntax('python')).toBe(true)
    expect(isLineHintSyntax('html')).toBe(true)
    expect(isLineHintSyntax('scratch')).toBe(false)
    expect(isLineHintSyntax(null)).toBe(false)
  })

  it('is declared by the Python, Turtle and HTML modules only', () => {
    const declared = Object.fromEntries(
      MODULE_TYPES.map((type) => [type, getModuleDefinition(type).capabilities.lineHints ?? null])
    )
    expect(Object.fromEntries(Object.entries(declared).filter(([, syntax]) => syntax))).toEqual({
      python: 'python',
      turtle: 'python',
      html: 'html',
    })
  })
})

describe('parseLineHints (python)', () => {
  it('removes a marker and attaches its text to the next line', () => {
    const result = parseLineHints(
      '#> Change the colour here\ncolour = "red"\nprint(colour)',
      'python'
    )
    expect(result.code).toBe('colour = "red"\nprint(colour)')
    expect(result.hints).toEqual([
      { line: 1, text: 'Change the colour here', target: 'colour = "red"' },
    ])
    expect(result.trailingMarker).toBe(false)
  })

  it('ignores the indentation of the marker and of the target line', () => {
    const code = 'for i in range(3):\n    #> Print i here\n    print(i)'
    const result = parseLineHints(code, 'python')
    expect(result.code).toBe('for i in range(3):\n    print(i)')
    expect(result.hints).toEqual([{ line: 2, text: 'Print i here', target: 'print(i)' }])
  })

  it('stacks consecutive markers onto the same line, in order', () => {
    const result = parseLineHints('#> First\n#> Second\nx = 1', 'python')
    expect(result.code).toBe('x = 1')
    expect(result.hints.map((hint) => [hint.line, hint.text])).toEqual([
      [1, 'First'],
      [1, 'Second'],
    ])
  })

  it('gives a trailing marker a new empty last line and flags it', () => {
    const result = parseLineHints('x = 1\ny = 2\n#> Add a print here', 'python')
    expect(result.code).toBe('x = 1\ny = 2\n')
    expect(result.hints).toEqual([{ line: 3, text: 'Add a print here', target: '' }])
    expect(result.trailingMarker).toBe(true)
  })

  it('reuses the final newline for a trailing marker rather than adding a second one', () => {
    const result = parseLineHints('x = 1\n#> Hint\n', 'python')
    expect(result.code).toBe('x = 1\n')
    expect(result.hints).toEqual([{ line: 2, text: 'Hint', target: '' }])
    expect(result.trailingMarker).toBe(true)
  })

  it('keeps CRLF line endings when a trailing marker adds the last line', () => {
    const result = parseLineHints('x = 1\r\n#> Hint\r\n', 'python')
    expect(result.code).toBe('x = 1\r\n')
    expect(result.hints[0].line).toBe(2)
  })

  it('handles a hint on an empty line (the place to write code)', () => {
    const result = parseLineHints(
      'name = "Sam"\n#> Write your print here\n\nprint("bye")',
      'python'
    )
    expect(result.code).toBe('name = "Sam"\n\nprint("bye")')
    expect(result.hints).toEqual([{ line: 2, text: 'Write your print here', target: '' }])
  })

  it('leaves ordinary comments alone', () => {
    const code = '# a normal comment\nx = 1  #> not a marker line'
    const result = parseLineHints(code, 'python')
    expect(result.code).toBe(code)
    expect(result.hints).toEqual([])
  })

  it('returns code without markers unchanged, byte for byte (CRLF included)', () => {
    const code = 'x = 1\r\ny = 2\r\n'
    expect(parseLineHints(code, 'python').code).toBe(code)
  })

  it('keeps CRLF on the kept lines when markers are removed', () => {
    const result = parseLineHints('#> Hint\r\nx = 1\r\ny = 2', 'python')
    expect(result.code).toBe('x = 1\r\ny = 2')
    expect(result.hints[0]).toEqual({ line: 1, text: 'Hint', target: 'x = 1' })
  })

  it('strips an empty marker but adds no hint for it', () => {
    const result = parseLineHints('#>\nx = 1', 'python')
    expect(result.code).toBe('x = 1')
    expect(result.hints).toEqual([])
  })

  it('treats code that is only markers as one empty line', () => {
    const result = parseLineHints('#> Start here', 'python')
    expect(result.code).toBe('')
    expect(result.hints).toEqual([{ line: 1, text: 'Start here', target: '' }])
    expect(result.trailingMarker).toBe(true)
  })

  it('does nothing for an unsupported language or non-string code', () => {
    expect(parseLineHints('#> Hint\nx', 'scratch')).toEqual({
      code: '#> Hint\nx',
      hints: [],
      trailingMarker: false,
    })
    expect(parseLineHints(undefined, 'python').code).toBeUndefined()
  })

  it('does not treat HTML markers as Python markers', () => {
    expect(parseLineHints('<!--> Hint -->\nx = 1', 'python').hints).toEqual([])
  })
})

describe('parseLineHints (html)', () => {
  it('removes <!--> … --> marker lines and attaches them to the next line', () => {
    const code = '<body>\n  <!--> Add a heading here -->\n  <h1>Hi</h1>\n</body>'
    const result = parseLineHints(code, 'html')
    expect(result.code).toBe('<body>\n  <h1>Hi</h1>\n</body>')
    expect(result.hints).toEqual([{ line: 2, text: 'Add a heading here', target: '<h1>Hi</h1>' }])
  })

  it('leaves ordinary HTML comments alone', () => {
    const code = '<!-- a normal comment -->\n<p>Hi</p>'
    expect(parseLineHints(code, 'html')).toEqual({ code, hints: [], trailingMarker: false })
  })

  it('does not treat Python markers as HTML markers', () => {
    expect(parseLineHints('#> Hint\n<p></p>', 'html').hints).toEqual([])
  })
})

describe('stripLineHints', () => {
  it('returns only the stripped code', () => {
    expect(stripLineHints('#> Hint\nx = 1', 'python')).toBe('x = 1')
    expect(stripLineHints('<!--> Hint -->\n<p></p>', 'html')).toBe('<p></p>')
  })
})

describe('anchorLineHints', () => {
  const hints = [{ line: 2, text: 'Change me', target: 'colour = "red"' }]

  it('keeps a hint on its own line when that line still matches', () => {
    expect(anchorLineHints('x = 1\ncolour = "red"', hints)).toEqual([
      { line: 2, text: 'Change me' },
    ])
  })

  it('matches the target line ignoring indentation', () => {
    expect(anchorLineHints('x = 1\n    colour = "red"  ', hints)).toEqual([
      { line: 2, text: 'Change me' },
    ])
  })

  it('re-anchors to the one line with the same trimmed text when lines have moved', () => {
    expect(anchorLineHints('a\nb\nc\ncolour = "red"', hints)).toEqual([
      { line: 4, text: 'Change me' },
    ])
  })

  it('drops the hint when the target line is gone', () => {
    expect(anchorLineHints('x = 1\ncolour = "blue"', hints)).toEqual([])
  })

  it('drops the hint when several lines match and none is at its own line', () => {
    expect(anchorLineHints('colour = "red"\nx\ncolour = "red"', hints)).toEqual([])
  })

  it('accepts an array of lines', () => {
    expect(anchorLineHints(['x', 'colour = "red"'], hints)).toEqual([
      { line: 2, text: 'Change me' },
    ])
  })
})

describe('chooseLineHints', () => {
  const starter = [{ line: 1, text: 'Starter hint', target: 'x = 1' }]
  const stage = [
    { line: 1, text: 'Stage hint A', target: 'x = 1' },
    { line: 2, text: 'Stage hint B', target: 'y = 2' },
  ]

  it('picks the set with the most hints that anchor', () => {
    expect(chooseLineHints('x = 1\ny = 2', [starter, stage])).toEqual([
      { line: 1, text: 'Stage hint A' },
      { line: 2, text: 'Stage hint B' },
    ])
  })

  it('prefers the earlier set on a tie', () => {
    expect(chooseLineHints('x = 1', [starter, stage])).toEqual([{ line: 1, text: 'Starter hint' }])
  })

  it('returns [] when nothing anchors or there are no sets', () => {
    expect(chooseLineHints('z = 3', [starter, stage])).toEqual([])
    expect(chooseLineHints('x = 1', null)).toEqual([])
  })
})

describe('stripTaskLineHints', () => {
  it('strips starter code and code stages and records their hint sets, starter first', () => {
    const task = {
      id: 1,
      starterCode: 'legacy = 1',
      codeStages: [
        { label: 'Support', role: 'support', code: '#> Support hint\nb = 2' },
        { label: 'Starter', role: 'starter', code: '#> Starter hint\na = 1' },
      ],
    }
    const result = stripTaskLineHints(task, 'python')
    expect(result).not.toBe(task)
    expect(result.codeStages.map((stage) => stage.code)).toEqual(['b = 2', 'a = 1'])
    expect(result.starterCode).toBe('legacy = 1')
    expect(result.lineHintSets).toEqual([
      {
        source: 'starter',
        stageIndex: 1,
        file: null,
        hints: [{ line: 1, text: 'Starter hint', target: 'a = 1' }],
      },
      {
        source: 'stage',
        stageIndex: 0,
        file: null,
        hints: [{ line: 1, text: 'Support hint', target: 'b = 2' }],
      },
    ])
    expect(task.codeStages[0].code).toBe('#> Support hint\nb = 2')
  })

  it('strips HTML files per file', () => {
    const task = {
      id: 1,
      starterFiles: [
        { name: 'index.html', type: 'html', content: '<!--> Heading -->\n<h1></h1>' },
        { name: 'style.css', type: 'css', content: 'h1 {}' },
      ],
    }
    const result = stripTaskLineHints(task, 'html')
    expect(result.starterFiles[0]).toEqual({
      name: 'index.html',
      type: 'html',
      content: '<h1></h1>',
    })
    expect(result.starterFiles[1]).toBe(task.starterFiles[1])
    expect(getTaskLineHintSets(result, 'index.html')).toEqual([
      [{ line: 1, text: 'Heading', target: '<h1></h1>' }],
    ])
    expect(getTaskLineHintSets(result, 'style.css')).toEqual([])
    expect(getTaskLineHintSets(result)).toEqual([])
  })

  it('strips the legacy complete code and exposes its hints as the complete stage', () => {
    const result = stripTaskLineHints(
      { id: 1, starterCode: '#> Start\nx = 1', completeCode: '#> Done\nx = 2' },
      'python'
    )
    expect(result.completeCode).toBe('x = 2')
    expect(getStageLineHints(result, 'complete')).toEqual([
      { line: 1, text: 'Done', target: 'x = 2' },
    ])
    expect(getStageLineHints(result, 0)).toEqual([])
  })

  it('returns the same task when it has no markers, and is safe to run twice', () => {
    const plain = { id: 1, starterCode: 'x = 1' }
    expect(stripTaskLineHints(plain, 'python')).toBe(plain)

    const once = stripTaskLineHints({ id: 1, starterCode: '#> Hint\nx = 1' }, 'python')
    const twice = stripTaskLineHints(once, 'python')
    expect(twice).toBe(once)
    expect(getTaskLineHintSets(twice)).toHaveLength(1)
  })

  it('does not add undefined fields the task did not have', () => {
    const result = stripTaskLineHints({ id: 1, codeStages: [{ code: '#> H\nx' }] }, 'python')
    expect(Object.keys(result).sort()).toEqual(['codeStages', 'id', 'lineHintSets'])
  })

  it('leaves the task untouched without a marker syntax', () => {
    const task = { id: 1, starterCode: '#> Hint\nx = 1' }
    expect(stripTaskLineHints(task, null)).toBe(task)
    expect(stripTaskLineHints(task, 'arcade')).toBe(task)
  })
})

describe('stripLessonLineHints', () => {
  it('strips each task with the syntax it is given, including subtasks', () => {
    const lesson = {
      id: 'l',
      type: 'composed',
      tasks: [
        { id: 1, moduleType: 'python', starterCode: '#> Py\nx = 1' },
        {
          type: 'group',
          title: 'G',
          subtasks: [
            {
              id: 2,
              moduleType: 'html',
              starterFiles: [{ name: 'index.html', content: '<!--> Html -->\n<p></p>' }],
            },
          ],
        },
        { id: 3, moduleType: 'scratch', starterCode: '#> left alone' },
        { id: 4, taskType: 'information', explainer: '#> not code' },
      ],
    }
    const syntaxByType = { python: 'python', html: 'html' }
    const result = stripLessonLineHints(lesson, (task) => syntaxByType[task.moduleType] ?? null)
    expect(result.tasks[0].starterCode).toBe('x = 1')
    expect(result.tasks[1].subtasks[0].starterFiles[0].content).toBe('<p></p>')
    expect(result.tasks[2]).toBe(lesson.tasks[2])
    expect(result.tasks[3]).toBe(lesson.tasks[3])
    expect(lesson.tasks[0].starterCode).toBe('#> Py\nx = 1')
  })

  it("strips the lesson's sandbox starter", () => {
    const result = stripLessonLineHints(
      { type: 'python', sandboxStarter: '#> Play\nx = 1', tasks: [] },
      () => 'python',
      'python'
    )
    expect(result.sandboxStarter).toBe('x = 1')
    const html = stripLessonLineHints(
      { type: 'html', sandboxStarterFiles: [{ name: 'a.html', content: '<!--> Hi -->\n<p>' }] },
      () => null,
      'html'
    )
    expect(html.sandboxStarterFiles[0].content).toBe('<p>')
  })

  it('returns the same lesson when nothing has markers', () => {
    const lesson = { type: 'python', tasks: [{ id: 1, starterCode: 'x = 1' }] }
    expect(stripLessonLineHints(lesson, () => 'python')).toBe(lesson)
    expect(stripLessonLineHints(null, () => 'python')).toBeNull()
  })
})
