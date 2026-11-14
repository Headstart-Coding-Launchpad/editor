import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarkdownRenderer, InlineMarkdown } from '../markdown'
import {
  SCRATCH_BLOCK_CATALOG,
  SCRATCH_BLOCK_BY_OPCODE,
  SCRATCH_MARKDOWN_BLOCK_CATEGORIES,
  SCRATCH_TOOLBOX_GROUPS,
  scratchBlockBadgeIcon,
  scratchBlockDisplaySample,
} from '../scratchBlockCatalog'
import { looksLikeScratchBlocks } from '../markdown/scratchFence'
import { SCRATCH_BLOCK_DEFINITIONS } from '../../modules/scratch/scratch'

const MOCK_TOPICS = [
  {
    id: 'for-loop',
    title: 'For loops',
    types: ['python'],
    category: 'Loop',
    summary: 'Repeat code.',
    description: 'Runs a **block** with `python:print()` again.',
    syntax: 'Use `python:for i in range(3):`.',
    aliases: ['for loop'],
    related: [],
  },
]

vi.mock('../topicLibrary', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTopicLibrary: () => ({
      topics: MOCK_TOPICS,
      allTopics: MOCK_TOPICS,
      loading: false,
      error: null,
    }),
  }
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

  it('constrains markdown images without distorting them', () => {
    render(<MarkdownRenderer content="![Tall diagram](images/tall-diagram.png)" />)
    const image = screen.getByRole('img', { name: 'Tall diagram' })
    expect(image).toHaveStyle({
      maxWidth: '100%',
      maxHeight: 'min(420px, 60vh)',
      height: 'auto',
      objectFit: 'contain',
    })
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
    const content = ['| Name | Age |', '| ---- | --- |', '| Alice | 10 |', '| Bob | 12 |'].join(
      '\n'
    )
    render(<MarkdownRenderer content={content} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders a blockquote', () => {
    render(<MarkdownRenderer content="> A wise saying." />)
    expect(screen.getByText(/A wise saying\./i)).toBeInTheDocument()
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
    expect(Array.from(highlightedTokens).map((element) => element.textContent)).toEqual(
      expect.arrayContaining(['print()', 'for i in range(3):'])
    )
  })

  // In jsdom there is no Blockly drawing: a fence and an inline block show their own text as
  // plain monospace code, labelled with that text (the real-browser picture is in
  // RealScratchBlocks.test.jsx and the browser checks).
  it('shows a scratch fence as its own text, read out as one picture', () => {
    const code = 'when green flag clicked\nforever\n  move (10) steps\nend'
    const { container } = render(<MarkdownRenderer content={'```scratch\n' + code + '\n```'} />)
    const pre = container.querySelector('pre[data-scratch-text="true"]')
    expect(pre).toHaveTextContent('when green flag clicked')
    expect(pre.textContent).toBe(code)
    expect(pre).toHaveAttribute('role', 'img')
    expect(pre).toHaveAttribute('aria-label', 'when green flag clicked forever move (10) steps end')
    expect(pre).toHaveAttribute('data-scratch-stack', 'true')
    expect(pre.style.fontFamily).toMatch(/monospace/)
    expect(container.querySelector('button')).toBeNull()
  })

  it.each(['say [Hello!] for (2) seconds', 'if <> then else', 'distance to [mouse-pointer]'])(
    'keeps inline `scratch:%s` in its line of text',
    (block) => {
      const { container } = render(<MarkdownRenderer content={`Use \`scratch:${block}\` here.`} />)
      const code = container.querySelector('code[data-scratch-text="true"]')
      expect(code.textContent).toBe(block)
      expect(code).toHaveAttribute('aria-label', block)
      expect(code.closest('p')).toHaveTextContent(`Use ${block} here.`)
    }
  )

  it('does not take a bare variable name for a Scratch fence', () => {
    expect(looksLikeScratchBlocks('score')).toBe(false)
    expect(looksLikeScratchBlocks('set [score] to (0)')).toBe(true)
  })
})

describe('Scratch markdown block catalog', () => {
  it('covers every Scratch runtime block definition', () => {
    const missing = Object.keys(SCRATCH_BLOCK_DEFINITIONS).filter(
      (opcode) => !SCRATCH_BLOCK_BY_OPCODE[opcode]
    )
    expect(missing).toEqual([])
  })

  it('covers every block exposed by the toolbox groups', () => {
    const missing = SCRATCH_TOOLBOX_GROUPS.flatMap((group) =>
      group.blocks.map(([opcode]) => opcode)
    ).filter((opcode) => !SCRATCH_BLOCK_BY_OPCODE[opcode])
    expect(missing).toEqual([])
  })

  it('keeps markdown toolbar samples recognizable as Scratch blocks', () => {
    const samples = SCRATCH_MARKDOWN_BLOCK_CATEGORIES.flatMap((category) => category.blocks)
    expect(samples).toHaveLength(SCRATCH_BLOCK_CATALOG.length)
    for (const sample of samples) {
      expect(looksLikeScratchBlocks(sample)).toBe(true)
    }
  })

  it('keeps plain and icon-prefixed Scratch samples recognizable', () => {
    for (const block of SCRATCH_BLOCK_CATALOG) {
      expect(block.icon).toEqual(expect.any(String))
      expect(block.icon.length).toBeGreaterThan(0)
      expect(looksLikeScratchBlocks(block.sample)).toBe(true)
      expect(looksLikeScratchBlocks(scratchBlockDisplaySample(block))).toBe(true)
    }
  })

  it('uses single-purpose badge icons for multi-icon Scratch blocks', () => {
    expect(scratchBlockBadgeIcon('event_broadcastandwait')).toBe('⏳')
    expect(scratchBlockBadgeIcon('looks_hide')).toBe('🚫')
    expect(scratchBlockBadgeIcon('sound_playuntildone')).toBe('▶️')
    expect(scratchBlockBadgeIcon('control_repeat_until')).toBe('⏱️')
    expect(scratchBlockBadgeIcon('sensing_resettimer')).toBe('🔄')
    expect(scratchBlockBadgeIcon('data_hidevariable')).toBe('🚫')
  })

  it('exposes icon-prefixed toolbox labels', () => {
    for (const [opcode, label] of SCRATCH_TOOLBOX_GROUPS.flatMap((group) => group.blocks)) {
      expect(label).toBe(
        `${SCRATCH_BLOCK_BY_OPCODE[opcode].icon} ${SCRATCH_BLOCK_BY_OPCODE[opcode].label}`
      )
    }
  })

  it('keeps Blockly icon fields aligned with shifted message placeholders', () => {
    for (const [opcode, definition] of Object.entries(SCRATCH_BLOCK_DEFINITIONS)) {
      const context = { jsonInit: vi.fn() }
      definition.init.call(context)
      const config = context.jsonInit.mock.calls[0]?.[0]
      const message = config?.message0 ?? ''
      const placeholders = Array.from(String(message).matchAll(/%(\d+)/g), (match) =>
        Number(match[1])
      )
      const maxPlaceholder = Math.max(0, ...placeholders)

      expect(config?.args0 ?? []).toHaveLength(maxPlaceholder)
      if (SCRATCH_BLOCK_BY_OPCODE[opcode]?.icon) {
        expect(config.args0[0]).toMatchObject({ type: 'field_image', width: 56, height: 56 })
        expect(config.message0).toMatch(/^%1 /)
      }
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

  it('preserves line breaks inside inline code', () => {
    const { container } = render(<InlineMarkdown content={'Output: `line one\nline two`'} />)
    const code = container.querySelector('code')

    expect(code.textContent).toBe('line one\nline two')
    expect(code).toHaveStyle({ display: 'inline-block', whiteSpace: 'pre-wrap', textAlign: 'left' })
  })

  it('trims outer blank lines from fenced code in inline contexts', () => {
    const { container } = render(<InlineMarkdown content={'```\nline one\nline two\n```'} />)
    const code = container.querySelector('code')

    expect(code.textContent).toBe('line one\nline two')
    expect(code.textContent.startsWith('\n')).toBe(false)
    expect(code).toHaveStyle({ display: 'inline-block', textAlign: 'left' })
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

describe('MarkdownRenderer animateLists', () => {
  function items(container) {
    return Array.from(container.querySelectorAll('li'))
  }

  it('slides list items in one after another, numbering each list from 0', () => {
    const { container } = render(
      <MarkdownRenderer content={'- one\n- two\n- three\n\n1. first\n2. second'} animateLists />
    )
    const all = items(container)
    expect(all).toHaveLength(5)
    all.forEach((li) => expect(li).toHaveClass('motion-slide-in', 'motion-stagger'))
    expect(all.map((li) => li.style.getPropertyValue('--motion-i'))).toEqual([
      '0',
      '1',
      '2',
      '0',
      '1',
    ])
  })

  it('numbers the same content the same way on every render', () => {
    const content = '- one\n- two'
    const first = render(<MarkdownRenderer content={content} animateLists />)
    const firstIndexes = items(first.container).map((li) => li.style.getPropertyValue('--motion-i'))
    first.unmount()
    const second = render(<MarkdownRenderer content={content} animateLists />)
    expect(items(second.container).map((li) => li.style.getPropertyValue('--motion-i'))).toEqual(
      firstIndexes
    )
  })

  it('leaves lists still by default (hints, topic cards, Builder previews)', () => {
    const { container } = render(<MarkdownRenderer content={'- one\n- two'} />)
    items(container).forEach((li) => {
      expect(li).not.toHaveClass('motion-slide-in')
      expect(li.style.getPropertyValue('--motion-i')).toBe('')
    })
  })
})

describe('MarkdownRenderer "See example" fences', () => {
  const content = [
    'Add an else.',
    '',
    '```example python label="Show me one"',
    'The same shape with **weather**.',
    '---',
    'weather = "sunny"',
    'if weather == "rainy":',
    '    print("Wellies!")',
    '```',
  ].join('\n')

  it('renders a button instead of the code, and opens a labelled dialog with it', () => {
    const onExampleOpen = vi.fn()
    render(<MarkdownRenderer content={content} onExampleOpen={onExampleOpen} />)
    expect(screen.queryByText(/Wellies/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show me one/ }))
    const dialog = screen.getByRole('dialog', { name: 'Show me one' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.textContent).toContain('print("Wellies!")')
    expect(dialog.querySelector('code.language-python')).not.toBeNull()
    expect(dialog.querySelector('strong')?.textContent).toBe('weather')
    expect(onExampleOpen).toHaveBeenCalledWith(0, expect.objectContaining({ language: 'python' }))
  })

  it('closes on Escape and on the close button', () => {
    render(<MarkdownRenderer content={content} />)
    fireEvent.click(screen.getByRole('button', { name: /Show me one/ }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show me one/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps Tab focus inside the dialog', () => {
    render(<MarkdownRenderer content={content} />)
    fireEvent.click(screen.getByRole('button', { name: /Show me one/ }))
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    const tab = createEvent.keyDown(close, { key: 'Tab' })
    fireEvent(close, tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)
  })

  it('still renders ordinary code fences inline', () => {
    render(<MarkdownRenderer content={'```python\nprint(1)\n```'} />)
    expect(screen.queryByRole('button', { name: /example/i })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps a code fence readable when the text colour is inherited (selected quiz card)', () => {
    const { container } = render(
      <div style={{ color: '#ffffff' }}>
        <MarkdownRenderer content={'```\nNameError\n```'} inheritColor />
      </div>
    )
    // The fence has a light background, so it must not inherit the card's white text.
    expect(container.querySelector('pre').style.color).toBe('rgb(31, 41, 55)')
  })
})
