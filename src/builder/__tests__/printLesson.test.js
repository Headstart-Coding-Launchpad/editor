import { describe, expect, it } from 'vitest'
import { buildPrintHtml } from '../printLesson'

function lesson(type, task) {
  return {
    id: `${type}-lesson`,
    title: `${type} lesson`,
    type,
    tasks: [task],
  }
}

describe('buildPrintHtml', () => {
  it('prints filesystem task state and stages', () => {
    const html = buildPrintHtml(lesson('filesystem', {
      id: 1,
      title: 'Organise files',
      starterFs: {
        '/': { type: 'dir' },
        '/Projects/': { type: 'dir' },
        '/Projects/notes.txt': { type: 'file', content: 'hello <script>alert(1)</script>' },
        '/Projects/image.png': { type: 'file', src: 'assets/image.png' },
      },
      completeFs: { '/': { type: 'dir' }, '/done.txt': { type: 'file', content: 'done' } },
      carryFsFrom: 3,
      codeStages: [{ label: 'Hint folder', fs: { '/': { type: 'dir' }, '/hint/': { type: 'dir' }, '/hint/todo.txt': { type: 'file', content: 'try this next' } } }],
    }))

    expect(html).toContain('Type: <strong>Filesystem</strong>')
    expect(html).toContain('Starter Filesystem')
    expect(html).toContain('<th>Path</th><th>Type</th><th>Content snippet</th>')
    expect(html).toContain('/Projects/notes.txt')
    expect(html).toContain('hello &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('assets/image.png')
    expect(html).toContain('Complete Filesystem')
    expect(html).toContain('/done.txt')
    expect(html).toContain('Filesystem Stages (1)')
    expect(html).toContain('/hint/todo.txt')
    expect(html).toContain('Carry Filesystem From')
    expect(html).not.toContain('"content":')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('prints electronics task state, parts, and MicroPython starter code', () => {
    const starterCircuit = {
      board: { type: 'half-breadboard', rows: 18, cols: 30 },
      components: [
        { id: 'bat1', type: 'battery', label: 'Main <battery>', pins: ['positive', 'negative'], position: { row: 1, col: 1 }, props: { voltage: 5 } },
        { id: 'led1', type: 'led', label: 'Status LED', pins: ['anode', 'cathode'], position: { row: 4, col: 8 }, props: { color: 'red' } },
        { id: 'mcu1', type: 'microcontroller', label: 'Pico', pins: ['3V3', 'GND', 'GP0'], position: { row: 9, col: 2 }, props: { code: 'print("<pin>")' } },
      ],
      wires: [
        { id: 'wire2', from: 'led1.cathode', to: 'bat1.negative', color: '#111827' },
        { id: 'wire1', from: 'bat1.positive', to: 'led1.anode', color: '#ef4444' },
      ],
    }
    const html = buildPrintHtml(lesson('electronics', {
      id: 1,
      title: 'Light an LED',
      availableComponents: ['battery', 'led'],
      microcontroller: { enabled: true, boardType: 'pico', starterCode: 'print("hi")' },
      starterCircuit,
      completeCircuit: { components: [{ id: 'led1', type: 'led' }], wires: [] },
      carryCircuitFrom: 2,
      codeStages: [{ label: 'Add LED', circuit: { components: [{ id: 'led2', type: 'led', pins: ['anode', 'cathode'] }], wires: [{ id: 'wire3', from: 'led2.anode', to: 'bat1.positive' }] } }],
    }))

    expect(html).toContain('Type: <strong>Electronics</strong>')
    expect(html).toContain('Available Parts')
    expect(html).toContain('<code>battery</code>')
    expect(html).toContain('<code>led</code>')
    expect(html).toContain('MicroPython Starter Code')
    expect(html).toContain('print(&quot;hi&quot;)')
    expect(html).toContain('Starter Circuit')
    expect(html).toContain('Board: half-breadboard, 18 rows x 30 cols')
    expect(html).toContain('<th>ID</th><th>Type</th><th>Label</th><th>Pins</th><th>Position</th><th>Properties</th>')
    expect(html).toContain('Main &lt;battery&gt;')
    expect(html).toContain('voltage: 5')
    expect(html).toContain('<th>ID</th><th>From</th><th>To</th><th>Colour</th>')
    expect(html).toContain('bat1.positive')
    expect(html).toContain('print(&quot;&lt;pin&gt;&quot;)')
    expect(html).toContain('Complete Circuit')
    expect(html).toContain('Circuit Stages (1)')
    expect(html).toContain('wire3')
    expect(html).toContain('Carry Circuit From')
    expect(html).not.toContain('"components":')
    expect(html).not.toContain('Main <battery>')
  })
})
