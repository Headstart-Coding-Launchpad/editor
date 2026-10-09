// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildPrintHtml } from '../printLesson'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  MULTIPLE_CHOICE_TASK,
  legacyActivityLesson,
} from '../../test/fixtures/legacyActivityTasks'

function lesson(type, task) {
  return {
    id: `${type}-lesson`,
    title: `${type} lesson`,
    type,
    tasks: [task],
  }
}

describe('buildPrintHtml', () => {
  it('prints code for tasks in a composed lesson using each task module type', () => {
    const html = buildPrintHtml({
      id: 'mixed',
      title: 'Mixed',
      type: 'composed',
      tasks: [
        { id: 1, moduleType: 'python', title: 'Print', starterCode: 'print("py")' },
        { id: 2, moduleType: 'turtle', title: 'Draw', starterCode: 'turtle.forward(10)' },
      ],
    })

    expect(html).toContain('Type: <strong>Python + Python Turtle</strong>')
    expect(html).toContain('print(&quot;py&quot;)')
    expect(html).toContain('turtle.forward(10)')
  })

  it('prints filesystem task state and stages', () => {
    const html = buildPrintHtml(
      lesson('filesystem', {
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
        codeStages: [
          {
            label: 'Hint folder',
            fs: {
              '/': { type: 'dir' },
              '/hint/': { type: 'dir' },
              '/hint/todo.txt': { type: 'file', content: 'try this next' },
            },
          },
        ],
      })
    )

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
        {
          id: 'bat1',
          type: 'battery',
          label: 'Main <battery>',
          pins: ['positive', 'negative'],
          position: { row: 1, col: 1 },
          props: { voltage: 5 },
        },
        {
          id: 'led1',
          type: 'led',
          label: 'Status LED',
          pins: ['anode', 'cathode'],
          position: { row: 4, col: 8 },
          props: { color: 'red' },
        },
        {
          id: 'mcu1',
          type: 'microcontroller',
          label: 'Pico',
          pins: ['3V3', 'GND', 'GP0'],
          position: { row: 9, col: 2 },
          props: { code: 'print("<pin>")' },
        },
      ],
      wires: [
        { id: 'wire2', from: 'led1.cathode', to: 'bat1.negative', color: '#111827' },
        { id: 'wire1', from: 'bat1.positive', to: 'led1.anode', color: '#ef4444' },
      ],
    }
    const html = buildPrintHtml(
      lesson('electronics', {
        id: 1,
        title: 'Light an LED',
        availableComponents: ['battery', 'led'],
        microcontroller: { enabled: true, boardType: 'pico', starterCode: 'print("hi")' },
        starterCircuit,
        completeCircuit: { components: [{ id: 'led1', type: 'led' }], wires: [] },
        carryCircuitFrom: 2,
        codeStages: [
          {
            label: 'Add LED',
            circuit: {
              components: [{ id: 'led2', type: 'led', pins: ['anode', 'cathode'] }],
              wires: [{ id: 'wire3', from: 'led2.anode', to: 'bat1.positive' }],
            },
          },
        ],
      })
    )

    expect(html).toContain('Type: <strong>Electronics</strong>')
    expect(html).toContain('Available Parts')
    expect(html).toContain('<code>battery</code>')
    expect(html).toContain('<code>led</code>')
    expect(html).toContain('MicroPython Starter Code')
    expect(html).toContain('print(&quot;hi&quot;)')
    expect(html).toContain('Starter Circuit')
    expect(html).toContain('Board: half-breadboard, 18 rows x 30 cols')
    expect(html).toContain(
      '<th>ID</th><th>Type</th><th>Label</th><th>Pins</th><th>Position</th><th>Properties</th>'
    )
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

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// the printed section for each quiz sub-type and code_arrange task. Pinned
// as-is, including the gaps: code_arrange prints no lines/tiles/files, and a
// multiple-choice quiz that omits quizType prints no options table.
describe('characterisation: buildPrintHtml for legacy quiz + code_arrange tasks', () => {
  function taskSections(html) {
    return html.match(/<section class="task">[\s\S]*?<\/section>/g)
  }

  it('prints each fixture task section', () => {
    const names = Object.keys(ALL_LEGACY_ACTIVITY_TASKS)
    const sections = taskSections(
      buildPrintHtml(legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS)))
    )
    expect(sections).toHaveLength(names.length)
    expect(Object.fromEntries(names.map((name, i) => [name, sections[i]]))).toMatchInlineSnapshot(`
      {
        "code_arrange_html": "<section class="task"><h3 class="task-title"><span class="task-num">9</span> Arrange a heading and paragraph</h3><div class="badges"><span class="badge badge-type">code_arrange</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>Build the page by arranging the lines.</p></div></div><div class="field"><div class="field-label">Check</div><div class="check-item"><strong>html_element</strong> — selector: <code>h1</code> — operator: exists</div></div></section>",
        "code_arrange_python": "<section class="task"><h3 class="task-title"><span class="task-num">8</span> Print the first five even numbers</h3><div class="badges"><span class="badge badge-type">code_arrange</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>Arrange the lines to print 0 2 4 6 8.</p></div></div><div class="field"><div class="field-label">Check</div><div class="check-item"><strong>output</strong> — value: <code>0
      2
      4
      6
      8</code> — operator: equals</div></div></section>",
        "confidence": "<section class="task"><h3 class="task-title"><span class="task-num">7</span> How confident are you?</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">confidence</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>Rate how confident you feel about print().</p></div></div></section>",
        "fill_blank_drag": "<section class="task"><h3 class="task-title"><span class="task-num">3</span> Fill the gaps (drag)</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">fill_blank</span></div><div class="field"><div class="field-label">Text</div><div class="field-value">Use ___ to show text and ___ to ask a question.</div></div><div class="field"><div class="field-label">Blanks</div><table class="data-table"><tr><th>ID</th><th>Answer</th></tr><tr><td>b1</td><td>print</td></tr><tr><td>b2</td><td>input</td></tr></table></div><div class="field"><div class="field-label">Distractors</div><table class="data-table"><tr><th>ID</th><th>Text</th></tr><tr><td>d1</td><td>len</td></tr></table></div></section>",
        "fill_blank_type": "<section class="task"><h3 class="task-title"><span class="task-num">4</span> Fill the gap (typed)</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">fill_blank</span></div><div class="field"><div class="field-label">Text</div><div class="field-value">A ___ repeats code.</div></div><div class="field"><div class="field-label">Blanks</div><table class="data-table"><tr><th>ID</th><th>Answer</th></tr><tr><td>t1</td><td>Loop</td></tr></table></div></section>",
        "match": "<section class="task"><h3 class="task-title"><span class="task-num">2</span> Match each function</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">match</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>Match each function to what it does.</p></div></div><div class="field"><div class="field-label">Pairs</div><table class="data-table"><tr><th>Prompt</th><th>Answer</th></tr><tr><td>print()</td><td>Shows text</td></tr><tr><td>input()</td><td>Asks a question</td></tr><tr><td>len()</td><td>Counts items</td></tr></table></div></section>",
        "multiple_choice": "<section class="task"><h3 class="task-title"><span class="task-num">1</span> Pick the output function</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">multiple_choice</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>Which function shows text on the screen?</p></div></div><div class="field"><div class="field-label">Options</div><table class="data-table"><tr><th>ID</th><th>Text</th><th>Feedback</th></tr><tr><td>a</td><td>print()</td><td>Yes - print shows text.</td></tr><tr><td>b</td><td>input()</td><td>input() asks the user a question.</td></tr><tr><td>c</td><td>len()</td><td></td></tr></table></div><div class="field"><div class="field-label">Check</div><div class="check-item"><strong>answer_equals</strong> — value: <code>a</code></div></div></section>",
        "short_answer": "<section class="task"><h3 class="task-title"><span class="task-num">5</span> Explain print</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">short_answer</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>What does print() do?</p></div></div><div class="field"><div class="field-label">Check</div><div class="check-item"><strong>answer_contains</strong> — value: <code>text</code></div></div></section>",
        "short_answer_open": "<section class="task"><h3 class="task-title"><span class="task-num">6</span> Reflect</h3><div class="badges"><span class="badge badge-type">quiz</span><span class="badge">short_answer</span></div><div class="field"><div class="field-label">Explainer</div><div class="field-value markdown"><p>What did you learn today?</p></div></div></section>",
      }
    `)
  })

  it('prints no options for a multiple-choice quiz that relies on the default quizType', () => {
    const { quizType: _omit, ...task } = MULTIPLE_CHOICE_TASK
    const [section] = taskSections(buildPrintHtml(legacyActivityLesson([task])))
    expect(section).not.toContain('Options')
    expect(section).toContain('<strong>answer_equals</strong>')
  })

  it('prints a Scratch check that accepts one of several opcodes', () => {
    const html = buildPrintHtml(
      lesson('scratch', {
        id: 1,
        title: 'Turn either way',
        check: {
          type: 'block_used',
          opcode: ['motion_turnright', { opcode: 'motion_turnleft', fieldValues: { DEGREES: 90 } }],
        },
      })
    )
    expect(html).toContain(
      'opcode: any of <code>motion_turnright</code>, <code>motion_turnleft</code>'
    )
    expect(html).not.toContain('[object Object]')
  })
})
