import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarkdownRenderer, InlineMarkdown } from '../markdown'
import { SCRATCH_BLOCK_CATALOG, SCRATCH_BLOCK_BY_OPCODE, SCRATCH_MARKDOWN_BLOCK_CATEGORIES, SCRATCH_TOOLBOX_GROUPS } from '../scratchBlockCatalog'
import { looksLikeScratchBlocks } from '../markdown/ScratchBlocks'
import { SCRATCH_BLOCK_DEFINITIONS } from '../../modules/scratch/scratch'

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

  it('renders Scratch blocks with mouths and nested reporter/boolean shapes', () => {
    const content = [
      '```scratch',
      'when green flag clicked',
      'forever',
      '  repeat until <(score) > (10)>',
      '    change [score] by (1)',
      '  end',
      '  if <touching [edge]?> then',
      '    move (pick random (1) to (10)) steps',
      '  else',
      '    turn right (15) degrees',
      '  end',
      'end',
      '```',
    ].join('\n')
    const { container } = render(<MarkdownRenderer content={content} />)

    expect(container.querySelector('[data-scratch-opcode="event_whenflagclicked"][data-scratch-shape="hat"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-opcode="control_forever"][data-scratch-shape="c"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-opcode="control_if"][data-scratch-shape="c"][data-scratch-mouths="2"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-opcode="sensing_touchingobject"][data-scratch-shape="boolean"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-opcode="operator_gt"][data-scratch-shape="boolean"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-opcode="operator_random"][data-scratch-shape="reporter"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-stack="true"] svg path')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-unknown="true"]')).not.toBeInTheDocument()
  })

  it('renders inline Scratch reporter blocks with their own shape', () => {
    const { container } = render(<MarkdownRenderer content="Use `scratch:distance to [mouse-pointer]` here." />)
    expect(container.querySelector('[data-scratch-opcode="sensing_distanceto"][data-scratch-shape="reporter"]')).toBeInTheDocument()
  })

  it('treats variable names in set blocks as dropdown fields, not guessed reporter blocks', () => {
    const { container } = render(<MarkdownRenderer content={'```scratch\nset [score] to (0)\n```'} />)
    expect(container.querySelector('[data-scratch-opcode="data_setvariableto"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-slot="dropdown"]')).toHaveTextContent('score')
    expect(looksLikeScratchBlocks('score')).toBe(false)
  })

  it('renders Scratch event affordances like Blockly fields', () => {
    const content = [
      '```scratch',
      'when green flag clicked',
      'broadcast [message1]',
      '```',
    ].join('\n')
    const { container } = render(<MarkdownRenderer content={content} />)

    const flagBlock = container.querySelector('[data-scratch-opcode="event_whenflagclicked"]')
    expect(flagBlock.querySelector('[data-scratch-flag="true"]')).toBeInTheDocument()
    expect(flagBlock).not.toHaveTextContent('green flag')
    expect(container.querySelector('[data-scratch-opcode="event_broadcast"] [data-scratch-slot="dropdown"]')).toHaveAttribute('data-scratch-slot-tone', 'light')
  })

  it('keeps inline Scratch operator booleans tightly block-sized', () => {
    const { container } = render(<MarkdownRenderer content={'```scratch\nrepeat until <(1) = (2)>\nend\n```'} />)
    const operator = container.querySelector('[data-scratch-opcode="operator_equals"][data-scratch-shape="boolean"]')
    const valueSlots = operator.querySelectorAll('[data-scratch-slot="value"]')

    expect(Number.parseFloat(operator.style.width)).toBeGreaterThanOrEqual(150)
    expect(Number.parseFloat(operator.style.width)).toBeLessThanOrEqual(168)
    expect(valueSlots).toHaveLength(2)
    expect(valueSlots[0]).toHaveAttribute('data-scratch-slot-shadow', 'text')
    expect(Number.parseFloat(valueSlots[0].querySelector('[data-scratch-slot-field="true"]').style.minWidth)).toBeGreaterThanOrEqual(18)
  })

  it('keeps Scratch C-block mouths snug around nested stack blocks', () => {
    const content = [
      '```scratch',
      'repeat until <(1) = (2)>',
      '  broadcast [message1]',
      '  go to [random position]',
      'end',
      '```',
    ].join('\n')
    const { container } = render(<MarkdownRenderer content={content} />)
    const repeat = container.querySelector('[data-scratch-opcode="control_repeat_until"][data-scratch-shape="c"]')
    const mouthStack = repeat.querySelector('[data-scratch-mouth-stack="children"]')
    const cSvg = Array.from(repeat.children).find(child => child.tagName.toLowerCase() === 'svg')

    expect(Number.parseFloat(repeat.style.height)).toBeLessThanOrEqual(131)
    expect(Number.parseFloat(mouthStack.style.left)).toBe(14)
    expect(Array.from(cSvg.querySelectorAll('[data-scratch-c-path]')).map(path => path.dataset.scratchCPath)).toEqual([
      'shadow',
      'fill',
      'outer',
      'highlight',
    ])
  })

  it('snaps the next root block tightly after a Scratch C-block', () => {
    const content = [
      '```scratch',
      'repeat until <(1) = (2)>',
      '  broadcast [message1]',
      '  go to [random position]',
      'end',
      'move (10) steps',
      '```',
    ].join('\n')
    const { container } = render(<MarkdownRenderer content={content} />)
    const moveBlock = container.querySelector('[data-scratch-opcode="motion_movesteps"]')
    const moveRoot = moveBlock.parentElement

    expect(Number.parseFloat(moveRoot.style.marginTop)).toBe(-10)
  })
})

describe('Scratch markdown block catalog', () => {
  it('covers every Scratch runtime block definition', () => {
    const missing = Object.keys(SCRATCH_BLOCK_DEFINITIONS)
      .filter(opcode => !SCRATCH_BLOCK_BY_OPCODE[opcode])
    expect(missing).toEqual([])
  })

  it('covers every block exposed by the toolbox groups', () => {
    const missing = SCRATCH_TOOLBOX_GROUPS
      .flatMap(group => group.blocks.map(([opcode]) => opcode))
      .filter(opcode => !SCRATCH_BLOCK_BY_OPCODE[opcode])
    expect(missing).toEqual([])
  })

  it('keeps markdown toolbar samples recognizable as Scratch blocks', () => {
    const samples = SCRATCH_MARKDOWN_BLOCK_CATEGORIES.flatMap(category => category.blocks)
    expect(samples).toHaveLength(SCRATCH_BLOCK_CATALOG.length)
    for (const sample of samples) {
      expect(looksLikeScratchBlocks(sample)).toBe(true)
    }
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
