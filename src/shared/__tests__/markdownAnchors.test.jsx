import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownRenderer } from '../markdown'
import { rehypeMarkdownAnchors } from '../markdown/anchors'

vi.mock('../topicLibrary', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTopicLibrary: () => ({ topics: [], allTopics: [], loading: false, error: null }),
  }
})

function anchors(container) {
  return Array.from(container.querySelectorAll('[data-md-anchor]')).map((el) => [
    el.tagName.toLowerCase(),
    el.getAttribute('data-md-anchor'),
  ])
}

describe('Markdown content anchors (data-md-anchor)', () => {
  it('names each block and its paragraphs, headings, list items, images and quotes', () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          '# Title',
          '',
          'First paragraph',
          '',
          '- one',
          '- two',
          '  - nested',
          '',
          '![A cat](cat.png)',
          '',
          '> a note',
        ].join('\n')}
      />
    )
    expect(anchors(container)).toEqual([
      ['div', 'b0'],
      ['h1', 'b0.h0'],
      ['p', 'b0.p0'],
      ['li', 'b0.li0'],
      ['li', 'b0.li1'],
      ['li', 'b0.li2'],
      ['p', 'b0.p1'],
      ['img', 'b0.img0'],
      ['blockquote', 'b0.q0'],
      ['p', 'b0.p2'],
    ])
  })

  it('gives tables their own block, with a header row and numbered body rows', () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          'Before',
          '',
          '| A | B |',
          '| --- | --- |',
          '| 1 | 2 |',
          '| 3 | 4 |',
          '',
          'After',
        ].join('\n')}
      />
    )
    expect(anchors(container)).toEqual([
      ['div', 'b0'],
      ['p', 'b0.p0'],
      ['div', 'b1'],
      ['tr', 'b1.th'],
      ['tr', 'b1.tr0'],
      ['tr', 'b1.tr1'],
      // The paragraph after the table starts its own block's numbering.
      ['div', 'b2'],
      ['p', 'b2.p0'],
    ])
    expect(container.querySelector('[data-md-anchor="b2.p0"]')).toHaveTextContent('After')
  })

  it('renders the same anchors for the same content every time (every screen agrees)', () => {
    const content = '## Steps\n\n1. Open\n2. Run\n\nDone'
    const first = anchors(render(<MarkdownRenderer content={content} />).container)
    const second = anchors(render(<MarkdownRenderer content={content} textScale={1.4} />).container)
    expect(second).toEqual(first)
  })

  it('the rehype plugin uses the given block prefix', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'p', properties: {}, children: [] },
        { type: 'element', tagName: 'h2', properties: {}, children: [] },
      ],
    }
    rehypeMarkdownAnchors({ prefix: 'b3' })(tree)
    expect(tree.children.map((node) => node.properties.dataMdAnchor)).toEqual(['b3.p0', 'b3.h0'])
  })
})
