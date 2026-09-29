import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SupportStagePanel, { stageHintsByLine, stageToText } from '../SupportStagePanel'

describe('SupportStagePanel line hints', () => {
  it('shows each hint as faded text after its line', () => {
    render(
      <SupportStagePanel
        stage={{ label: 'Support', code: 'x = 1\ncolour = "red"' }}
        lessonType="python"
        revealed
        lineHintsFor={(file) => (file == null ? [{ line: 2, text: 'Change the colour' }] : [])}
      />
    )
    expect(screen.getByText('Change the colour')).toHaveAttribute('title', 'Change the colour')
    const code = screen.getByLabelText('Support stage reference').querySelector('code')
    expect(code.textContent).toBe('x = 1\ncolour = "red"Change the colour')
  })

  it('places an HTML file hint after its file header in a files stage', () => {
    const stage = {
      label: 'Support',
      files: [
        { name: 'index.html', content: '<h1>Hi</h1>' },
        { name: 'style.css', content: 'h1 {\n}' },
      ],
    }
    const byLine = stageHintsByLine(stage, 'html', (file) =>
      file === 'style.css' ? [{ line: 2, text: 'Close it' }] : []
    )
    // Lines: /* index.html */, <h1>Hi</h1>, '', /* style.css */, h1 {, }
    expect(stageToText(stage, 'html').split('\n')[5]).toBe('}')
    expect([...byLine.entries()]).toEqual([[5, 'Close it']])
  })
})

describe('SupportStagePanel', () => {
  it('does not show its reference content until its parent marks the stage revealed', () => {
    render(
      <SupportStagePanel
        stage={{ label: 'With a name', code: 'name = "Ada"' }}
        lessonType="python"
        revealed={false}
      />
    )

    expect(screen.queryByText('name = "Ada"')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show reference/i })).not.toBeInTheDocument()
  })

  it('shows revealed code and blocks copy-like browser actions', () => {
    render(
      <SupportStagePanel
        stage={{ label: 'With a name', code: 'name = "Ada"' }}
        lessonType="python"
        revealed
      />
    )

    const panel = screen.getByLabelText('With a name stage reference')
    expect(panel.querySelector('code')?.textContent).toBe('name = "Ada"')

    const copyEvent = createEvent.copy(panel)
    const cutEvent = createEvent.cut(panel)
    const dragEvent = createEvent.dragStart(panel)
    const contextEvent = createEvent.contextMenu(panel)

    fireEvent(panel, copyEvent)
    fireEvent(panel, cutEvent)
    fireEvent(panel, dragEvent)
    fireEvent(panel, contextEvent)

    expect(copyEvent.defaultPrevented).toBe(true)
    expect(cutEvent.defaultPrevented).toBe(true)
    expect(dragEvent.defaultPrevented).toBe(true)
    expect(contextEvent.defaultPrevented).toBe(true)
  })
})

describe('stageToText', () => {
  it('reads each module by its state kind', () => {
    expect(stageToText({ code: 'forward(50)' }, 'turtle')).toBe('forward(50)')
    expect(stageToText({ code: 'x = 1' }, 'electronics')).toBe('x = 1')
    expect(stageToText({ files: [{ name: 'index.html', content: '<p>' }] }, 'html')).toBe(
      '/* index.html */\n<p>'
    )
    expect(stageToText({ fs: { '/': { type: 'dir' } } }, 'filesystem')).toContain('"type": "dir"')
    expect(stageToText({ desktop: { windows: [] } }, 'desktop')).toContain('"windows": []')
    expect(stageToText({ markdown: 'blocks' }, 'scratch')).toBe('blocks')
    expect(stageToText({ code: 'x' }, 'unknown-type')).toBe('')
    expect(stageToText(null, 'python')).toBe('')
  })
})
