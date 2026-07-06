import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarkdownRenderer, InlineMarkdown } from '../markdown'

const MOCK_TOPICS = [{
  id: 'for-loop',
  title: 'For loops',
  types: ['python'],
  category: 'Loop',
  summary: 'Repeat code.',
  description: 'Runs a **block** with `python:print()` again.',
  syntax: 'Use `python:for i in range(3):`.',
  aliases: ['for loop'],
  related: [],
}]

vi.mock('../topicLibrary', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useTopicLibrary: () => ({ topics: MOCK_TOPICS, allTopics: MOCK_TOPICS, loading: false, error: null }) }
})

describe('MarkdownRenderer', () => {
  it('renders without crashing on an empty string', () => {
    render(<MarkdownRenderer content="" />)
  })

  it('renders without crashing when content is undefined', () => {
    render(<MarkdownRenderer />)
  })

  it('renders a heading from markdown text', () => {
    render(<MarkdownRenderer content="# Hello World" />)
    expect(screen.getByRole('heading', { level: 1, name: /Hello World/i })).toBeInTheDocument()
  })

  it('renders an h2 heading', () => {
    render(<MarkdownRenderer content="## Section Title" />)
    expect(screen.getByRole('heading', { level: 2, name: /Section Title/i })).toBeInTheDocument()
  })

  it('renders plain paragraph text', () => {
    render(<MarkdownRenderer content="This is a paragraph." />)
    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument()
  })

  it('renders bold text inside a paragraph', () => {
    render(<MarkdownRenderer content="This is **important**." />)
    const bold = screen.getByText('important')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders italic text', () => {
    render(<MarkdownRenderer content="This is _emphasised_ text." />)
    const em = screen.getByText('emphasised')
    expect(em.tagName).toBe('EM')
  })

  it('renders a code block (fenced triple-backtick)', () => {
    const content = '```\nprint("hello")\n```'
    render(<MarkdownRenderer content={content} />)
    expect(screen.getByText(/print\("hello"\)/)).toBeInTheDocument()
  })

  it('renders an inline code snippet', () => {
    render(<MarkdownRenderer content="Use `my_variable` here." />)
    expect(screen.getByText('my_variable')).toBeInTheDocument()
  })

  it('renders a bulleted list', () => {
    render(<MarkdownRenderer content={'- Alpha\n- Beta\n- Gamma'} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('renders an ordered list', () => {
    render(<MarkdownRenderer content={'1. First\n2. Second\n3. Third'} />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('renders a table', () => {
    const content = [
      '| Name | Age |',
      '| ---- | --- |',
      '| Alice | 10 |',
      '| Bob | 12 |',
    ].join('\n')
    render(<MarkdownRenderer content={content} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders a blockquote', () => {
    render(<MarkdownRenderer content="> A wise saying." />)
    expect(screen.getByText(/A wise saying\./i)).toBeInTheDocument()
  })

  it('uses the optional title prop without crashing', () => {
    render(<MarkdownRenderer content="Some text." title="My Title" />)
    expect(screen.getByText('Some text.')).toBeInTheDocument()
  })

  it('applies the textScale prop without crashing', () => {
    render(<MarkdownRenderer content="Scaled text." textScale={1.5} />)
    expect(screen.getByText('Scaled text.')).toBeInTheDocument()
  })

  it('allows text selection by default', () => {
    const { container } = render(<MarkdownRenderer content="Selectable text." />)
    expect(container.firstChild).not.toHaveStyle({ userSelect: 'none' })
  })

  it('disables selection and blocks copy/cut/drag when disableCopy is set', () => {
    const { container } = render(<MarkdownRenderer content="Protected text." disableCopy />)
    const wrapper = container.firstChild
    expect(wrapper).toHaveStyle({ userSelect: 'none' })

    const copyEvent = createEvent.copy(wrapper)
    fireEvent(wrapper, copyEvent)
    expect(copyEvent.defaultPrevented).toBe(true)

    const cutEvent = createEvent.cut(wrapper)
    fireEvent(wrapper, cutEvent)
    expect(cutEvent.defaultPrevented).toBe(true)

    const dragEvent = createEvent.dragStart(wrapper)
    fireEvent(wrapper, dragEvent)
    expect(dragEvent.defaultPrevented).toBe(true)

    const contextMenuEvent = createEvent.contextMenu(wrapper)
    fireEvent(wrapper, contextMenuEvent)
    expect(contextMenuEvent.defaultPrevented).toBe(true)
  })

  it('opens a linked topic from its hover preview', async () => {
    render(<MarkdownRenderer content="Try [[for-loop]]." topicType="python" />)
    const topicLink = await screen.findByRole('button', { name: 'For loops' })
    fireEvent.mouseEnter(topicLink)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Repeat code.')
    expect(tooltip).toHaveStyle({ position: 'fixed', zIndex: '1200' })
    expect(tooltip.parentElement).toBe(document.body)
    expect(topicLink.parentElement).not.toContainElement(tooltip)
    fireEvent.click(screen.getAllByRole('button', { name: 'For loops' })[1])
    expect(screen.getByRole('dialog', { name: 'Topic library' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument()
    expect(screen.getByText('block').tagName).toBe('STRONG')
    const highlightedTokens = document.querySelectorAll('.language-python')
    expect(Array.from(highlightedTokens).map(element => element.textContent)).toEqual(expect.arrayContaining([
      'print()',
      'for i in range(3):',
    ]))
  })
})

describe('InlineMarkdown', () => {
  it('renders without crashing on an empty string', () => {
    render(<InlineMarkdown content="" />)
  })

  it('renders plain text content', () => {
    render(<InlineMarkdown content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    render(<InlineMarkdown content="This is **bold** text." />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('renders italic text', () => {
    render(<InlineMarkdown content="This is _italic_ text." />)
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('renders inline code', () => {
    render(<InlineMarkdown content="Use `len()` here." />)
    expect(screen.getByText('len()')).toBeInTheDocument()
  })

  it('renders without crashing when content is undefined', () => {
    render(<InlineMarkdown content={undefined} />)
  })

  it('renders topic references in inline markdown fields', async () => {
    render(<InlineMarkdown content="Choose [[for-loop]]." topicType="python" />)
    expect(await screen.findByRole('button', { name: 'For loops' })).toBeInTheDocument()
  })

  it('renders bare operator symbols instead of treating them as list/blockquote markers', () => {
    const cases = ['-', '+', '*', '>', '>=', '- 1', 'n - 1', '1.', '# ']
    for (const content of cases) {
      const { container } = render(<InlineMarkdown content={content} />)
      expect(container.textContent.trim()).toBe(content.trim())
    }
  })
})
