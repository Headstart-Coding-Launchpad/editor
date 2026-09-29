import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SupportStagePanel, { stageToText } from '../SupportStagePanel'

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
