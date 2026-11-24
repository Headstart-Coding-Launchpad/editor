// Marked-line code blocks (docs/authoring/markdown-renderer.md, "Line numbers and marked
// lines"): ```python {lines=3} draws a numbered block with line 3 marked.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarkdownRenderer } from '../markdown'
import { parseCodeLinesMeta, findCodeLineProblems } from '../markdown/codeLines'

vi.mock('../topicLibrary', async (importOriginal) => ({
  ...(await importOriginal()),
  useTopicLibrary: () => ({ topics: [], allTopics: [], loading: false, error: null }),
}))

const PROGRAM = [
  'name = input("Your name? ")',
  'score = 0',
  'for i in range(3):',
  '    score = score + 10',
  'print(name, score)',
].join('\n')
const fence = (info, code = PROGRAM) => `Look at this program.\n\n\`\`\`${info}\n${code}\n\`\`\``

function renderBlock(info, props = {}) {
  const { container } = render(<MarkdownRenderer content={fence(info)} {...props} />)
  const rows = [...container.querySelectorAll('pre [data-line]')]
  const marked = rows.filter((row) => row.hasAttribute('data-marked'))
  return { container, pre: container.querySelector('pre'), rows, marked }
}

describe('Fun moment: the marked line stands out in the question', () => {
  it('numbers every line and marks line 3 with a band, an arrow and words, not colour only', () => {
    const { pre, rows, marked } = renderBlock('python {lines=3}')
    expect(rows.map((row) => row.getAttribute('data-line'))).toEqual(['1', '2', '3', '4', '5'])
    expect(marked.map((row) => row.getAttribute('data-line'))).toEqual(['3'])
    expect(marked[0]).toHaveClass('md-code-lines__row--marked')
    expect(marked[0]).toHaveTextContent('for i in range(3):')
    // Screen readers hear which line is marked; the words sit outside the code.
    expect(pre).toHaveAccessibleDescription('Line 3 is marked.')
    // Still syntax coloured.
    expect(marked[0].querySelector('.hljs-keyword')).toHaveTextContent('for')
  })

  it('copies as the plain program: no numbers, arrows or marks in the text', () => {
    const { pre } = renderBlock('python {lines=3}')
    expect(pre.textContent.replace(/\n$/, '')).toBe(PROGRAM)
  })

  it('marks ranges and several lines', () => {
    const { marked, pre } = renderBlock('python {lines=1,3-4}')
    expect(marked.map((row) => row.getAttribute('data-line'))).toEqual(['1', '3', '4'])
    expect(pre).toHaveAccessibleDescription('Lines 1, 3 and 4 are marked.')
  })

  it('ignores marks past the end of the block', () => {
    const { rows, marked } = renderBlock('python {lines=3,9}')
    expect(rows).toHaveLength(5)
    expect(marked.map((row) => row.getAttribute('data-line'))).toEqual(['3'])
  })

  it('numbers without marks with {numbered}', () => {
    const { rows, marked, pre } = renderBlock('python {numbered}')
    expect(rows).toHaveLength(5)
    expect(marked).toHaveLength(0)
    expect(pre).not.toHaveAttribute('aria-describedby')
  })

  it('works on a fence with no language and on a dark answer card', () => {
    expect(renderBlock('{lines=2}').marked).toHaveLength(1)
    expect(renderBlock('python {lines=2}', { inheritColor: true }).marked).toHaveLength(1)
  })

  it('leaves plain fences exactly as before', () => {
    const { rows, pre } = renderBlock('python')
    expect(rows).toHaveLength(0)
    expect(pre.querySelector('code')).toHaveClass('language-python')
    expect(pre.textContent.replace(/\n$/, '')).toBe(PROGRAM)
  })
})

describe('parseCodeLinesMeta', () => {
  it('reads lines, ranges and numbered', () => {
    expect(parseCodeLinesMeta('{lines=3,5-6}')).toEqual({ numbered: true, marks: [3, 5, 6] })
    expect(parseCodeLinesMeta('{numbered}')).toEqual({ numbered: true, marks: [] })
    expect(parseCodeLinesMeta('{ numbered lines=2 }')).toEqual({ numbered: true, marks: [2] })
  })

  it('is null for no attribute or nothing it knows', () => {
    expect(parseCodeLinesMeta('')).toBeNull()
    expect(parseCodeLinesMeta(undefined)).toBeNull()
    expect(parseCodeLinesMeta('{colour=red}')).toBeNull()
  })
})

describe('findCodeLineProblems', () => {
  it('is quiet for good and plain fences', () => {
    expect(findCodeLineProblems(fence('python {lines=3}'))).toEqual([])
    expect(findCodeLineProblems(fence('python') + '\n\n' + fence('{numbered}'))).toEqual([])
  })

  it('warns about unknown words and marks past the end', () => {
    expect(findCodeLineProblems(fence('python {lines=3 colour=red}'))).toEqual([
      { number: 1, problem: 'unknown-option', detail: 'colour=red' },
    ])
    expect(findCodeLineProblems('x\n\n```\nplain\n```\n' + fence('python {lines=2,7-8}'))).toEqual(
      [{ number: 2, problem: 'out-of-range', detail: '7, 8 (the block has 5 lines)' }]
    )
    expect(findCodeLineProblems(fence('python {lines=two}'))).toEqual([
      { number: 1, problem: 'unknown-option', detail: 'lines=two' },
    ])
  })
})
