import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXAMPLE_LABEL,
  findExampleFenceProblems,
  hasExampleFence,
  isExampleInfo,
  parseExampleBody,
  parseExampleInfo,
  parseMarkdownBlocks,
  splitExampleFences,
} from '../markdown/exampleFence.js'
import { validateLessonCore } from '../lessonValidation.js'

const WEATHER = [
  'Add an else so any other sport gets a message too.',
  '',
  '```example python label="See an example"',
  "Here's the same Check → Do → Otherwise shape with different weather.",
  '---',
  'weather = "sunny"',
  'if weather == "rainy":',
  '    print("Grab your wellies!")',
  'else:',
  '    print("Sunglasses on!")',
  '```',
  '',
  'Then press Run.',
].join('\n')

describe('parseExampleInfo', () => {
  it('reads the language and a quoted label', () => {
    expect(parseExampleInfo('example python label="Show me"')).toEqual({
      language: 'python',
      label: 'Show me',
      unknownLanguage: null,
      extra: [],
    })
    expect(parseExampleInfo("example label='Peek' html").label).toBe('Peek')
    expect(parseExampleInfo("example label='Peek' html").language).toBe('html')
  })

  it('defaults to plain code and the default label', () => {
    expect(parseExampleInfo('example')).toEqual({
      language: 'text',
      label: DEFAULT_EXAMPLE_LABEL,
      unknownLanguage: null,
      extra: [],
    })
    expect(parseExampleInfo('example python label=""').label).toBe(DEFAULT_EXAMPLE_LABEL)
  })

  it('accepts aliases and flags unknown languages and stray words', () => {
    expect(parseExampleInfo('example javascript').language).toBe('js')
    expect(parseExampleInfo('example ruby')).toMatchObject({
      language: 'text',
      unknownLanguage: 'ruby',
    })
    expect(parseExampleInfo('example python label=Show me').extra).toEqual(['label=Show', 'me'])
  })

  it('caps the label at 40 characters', () => {
    expect(parseExampleInfo(`example label="${'x'.repeat(60)}"`).label).toHaveLength(40)
  })
})

describe('isExampleInfo / hasExampleFence', () => {
  it('matches only an info string whose first word is example', () => {
    expect(isExampleInfo('example python')).toBe(true)
    expect(isExampleInfo('Example')).toBe(true)
    expect(isExampleInfo('python example')).toBe(false)
    expect(isExampleInfo('examples')).toBe(false)
    expect(hasExampleFence(WEATHER)).toBe(true)
    expect(hasExampleFence('```python\nprint(1)\n```')).toBe(false)
  })
})

describe('parseExampleBody', () => {
  it('splits the intro from the code at the first --- line', () => {
    expect(parseExampleBody('Intro **here**.\n---\n\nx = 1\n  y = 2\n\n')).toEqual({
      intro: 'Intro **here**.',
      code: 'x = 1\n  y = 2',
    })
  })

  it('treats a body with no --- line as all code, and keeps later --- lines', () => {
    expect(parseExampleBody('x = 1')).toEqual({ intro: '', code: 'x = 1' })
    expect(parseExampleBody('---\na\n---\nb')).toEqual({ intro: '', code: 'a\n---\nb' })
  })
})

describe('splitExampleFences', () => {
  it('splits Markdown around an example and numbers examples from 0', () => {
    const segments = splitExampleFences(`${WEATHER}\n\n~~~example\nprint(2)\n~~~`)
    expect(segments.map((segment) => segment.type)).toEqual([
      'markdown',
      'example',
      'markdown',
      'example',
    ])
    expect(segments[0].content).toContain('Add an else')
    expect(segments[1]).toMatchObject({
      index: 0,
      language: 'python',
      label: 'See an example',
      intro: "Here's the same Check → Do → Otherwise shape with different weather.",
      closed: true,
    })
    expect(segments[1].code.split('\n')).toHaveLength(5)
    expect(segments[1].code).toContain('    print("Grab your wellies!")')
    expect(segments[2].content).toContain('Then press Run.')
    expect(segments[3]).toMatchObject({ index: 1, language: 'text', code: 'print(2)' })
  })

  it('leaves an example fence shown inside a longer fence alone', () => {
    const content = '````\n```example python\nx = 1\n```\n````'
    expect(splitExampleFences(content)).toEqual([{ type: 'markdown', content }])
  })

  it('leaves other fences, and their contents, as Markdown', () => {
    const content = '```python\n```example\n```\nafter'
    const segments = splitExampleFences(content)
    expect(segments.every((segment) => segment.type === 'markdown')).toBe(true)
  })

  it('strips the opening fence indentation and runs an unclosed fence to the end', () => {
    const [example] = splitExampleFences('  ```example\n  a\n    b')
    expect(example).toMatchObject({ code: 'a\n  b', closed: false })
  })

  it('normalises Windows line endings', () => {
    const [example] = splitExampleFences('```example python\r\nintro\r\n---\r\nx = 1\r\n```')
    expect(example).toMatchObject({ intro: 'intro', code: 'x = 1' })
  })
})

describe('parseMarkdownBlocks', () => {
  it('keeps tables working either side of an example', () => {
    const blocks = parseMarkdownBlocks(
      '| a | b |\n|---|---|\n| 1 | 2 |\n\n```example\nx\n```\n\n| c | d |\n|---|---|\n| 3 | 4 |'
    )
    expect(blocks.map((block) => block.type)).toEqual(['table', 'example', 'table'])
  })

  it('is the plain table parse when there is no example', () => {
    expect(parseMarkdownBlocks('hello')).toEqual([{ type: 'markdown', content: 'hello' }])
  })
})

describe('findExampleFenceProblems', () => {
  it('finds nothing wrong with a well-written example', () => {
    expect(findExampleFenceProblems(WEATHER)).toEqual([])
    expect(findExampleFenceProblems('no fences')).toEqual([])
  })

  it('reports empty, unknown-language, stray words and unclosed fences', () => {
    expect(findExampleFenceProblems('```example python\nIntro\n---\n```')).toEqual([
      { number: 1, problem: 'empty' },
    ])
    expect(findExampleFenceProblems('```example ruby\nx\n```')).toEqual([
      { number: 1, problem: 'unknown-language', detail: 'ruby' },
    ])
    expect(findExampleFenceProblems('```example python label=Peek\nx\n```')).toEqual([
      { number: 1, problem: 'unknown-option', detail: 'label=Peek' },
    ])
    expect(findExampleFenceProblems('```example\nx')).toEqual([{ number: 1, problem: 'unclosed' }])
  })

  it('reports more than ten examples', () => {
    const many = Array.from({ length: 11 }, () => '```example\nx\n```').join('\n\n')
    expect(findExampleFenceProblems(many)).toEqual([{ number: 11, problem: 'too-many' }])
  })
})

describe('lesson validation', () => {
  const lesson = (explainer) => ({
    id: 'ex',
    type: 'python',
    title: 'Examples',
    tasks: [
      {
        id: 1,
        title: 'Any other sport?',
        explainer,
        starterCode: 'sport = "golf"',
        check: { type: 'code_contains', value: 'else' },
      },
    ],
  })

  it('accepts a good example fence with no warning about it', () => {
    const { errors, warnings } = validateLessonCore(lesson(WEATHER))
    expect(errors).toEqual([])
    expect(warnings.filter((w) => w.includes('example'))).toEqual([])
  })

  it('warns about a broken example fence, never errors', () => {
    const { errors, warnings } = validateLessonCore(
      lesson('```example ruby oops\n```\n\n```example\nx')
    )
    expect(errors).toEqual([])
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Task 1 explainer example 1 has no code',
        'Task 1 explainer example 1 language "ruby" is not one of: python, html, css, js, scratch, text',
        'Task 1 explainer example 1 has unrecognised words after its language: oops',
        'Task 1 explainer example 2 has no closing fence',
      ])
    )
  })
})
