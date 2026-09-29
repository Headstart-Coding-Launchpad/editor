// Lesson fixtures for the useStudentCodeState characterization suite (one per module
// type, plus a composed lesson). Every task has distinct starter / stage / complete
// content so a test can tell exactly which source the hook loaded or saved.
//
// Shape conventions shared by all code-module fixtures:
//   t1  — starter content, a check with a hint, codeStages [support, complete]
//   t2  — carries from t1 via the module's carry field
//   t3  — no carry, no check (only where a test needs it)
import { LESSON_ID } from '../studentCodeStateHarness'

// ── Arcade designs ────────────────────────────────────────────────────────────

/** Raw authored arcade design with one 1x1 sprite (id/name distinguish sources). */
export function arcadeDesign(id) {
  return { sprites: [{ id, name: id, width: 1, height: 1, frames: [['red']] }], maps: [] }
}

/** What cloneArcadeDesign(arcadeDesign(id)) produces. */
export function normalisedArcadeDesign(id) {
  return {
    version: 1,
    sprites: [{ id, name: `${id}.png`, width: 1, height: 1, frames: [['#ff004d']] }],
    maps: [],
  }
}

export const EMPTY_ARCADE_DESIGN = { version: 1, sprites: [], maps: [] }

// ── Python / Turtle ───────────────────────────────────────────────────────────

function codeLesson(type, extra = {}) {
  return {
    id: LESSON_ID,
    type,
    title: `${type} lesson`,
    sandboxStarter: '# sandbox starter',
    tasks: [
      {
        id: 't1',
        title: 'Task 1',
        starterCode: 'print("start")',
        completeCode: 'print("hi")',
        check: { type: 'output_contains', value: 'hi', hint: 'Print hi' },
        codeStages: [
          { label: 'Support A', role: 'support', code: '# stage 0' },
          { label: 'Answer', role: 'complete', code: 'print("hi")  # complete stage' },
        ],
      },
      { id: 't2', title: 'Task 2', starterCode: '# t2 starter', carryCodeFrom: 't1' },
      { id: 't3', title: 'Task 3', starterCode: '# t3 starter' },
    ],
    ...extra,
  }
}

export const pythonLesson = (extra) => codeLesson('python', extra)
export const turtleLesson = (extra) => codeLesson('turtle', extra)

// ── Arcade ────────────────────────────────────────────────────────────────────

export const arcadeLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'arcade',
  title: 'arcade lesson',
  sandboxStarter: '# arcade sandbox',
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      starterCode: 'player = 1',
      completeCode: 'player = 2',
      arcadeDesign: arcadeDesign('starter'),
      completeArcadeDesign: arcadeDesign('complete'),
      check: { type: 'code_contains', value: 'jump', hint: 'Make the player jump' },
      codeStages: [
        {
          label: 'Support A',
          role: 'support',
          code: '# arcade stage 0',
          arcadeDesign: arcadeDesign('stage0'),
        },
      ],
    },
    { id: 't2', title: 'Task 2', starterCode: '# arcade t2', carryCodeFrom: 't1' },
  ],
  ...extra,
})

// ── Electronics ───────────────────────────────────────────────────────────────

export const EMPTY_CIRCUIT_JSON =
  '{"version":1,"board":{"type":"half-breadboard","rows":18,"cols":30},"components":[],"wires":[],"controls":{},"microcontroller":{"enabled":false,"boardType":null,"code":""}}'

export const circuitWith = (id) => ({
  components: [{ id, type: 'battery', x: 1, y: 1 }],
  wires: [],
})

/** serializeCircuit(circuitWith(id)). */
export const circuitJson = (id) =>
  `{"version":1,"board":{"type":"half-breadboard","rows":18,"cols":30},"components":[{"id":"${id}","type":"battery","x":1,"y":1}],"wires":[],"controls":{},"microcontroller":{"enabled":false,"boardType":null,"code":""}}`

export const electronicsLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'electronics',
  title: 'electronics lesson',
  sandboxStarterCircuit: circuitWith('sandbox'),
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      starterCircuit: circuitWith('starter'),
      completeCircuit: circuitWith('complete'),
      codeStages: [{ label: 'Support A', role: 'support', circuit: circuitWith('stage0') }],
    },
    { id: 't2', title: 'Task 2', starterCircuit: circuitWith('t2'), carryCircuitFrom: 't1' },
  ],
  ...extra,
})

// ── HTML ──────────────────────────────────────────────────────────────────────

export const htmlFile = (content, name = 'index.html', type = 'html') => ({ name, type, content })

export const htmlLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'html',
  title: 'html lesson',
  sandboxStarterFiles: [htmlFile('<p>sandbox</p>')],
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      entryFile: 'index.html',
      starterFiles: [htmlFile('<p>start</p>'), htmlFile('p {}', 'style.css', 'css')],
      completeFiles: [htmlFile('<h1>done</h1>'), htmlFile('h1 {}', 'style.css', 'css')],
      check: { type: 'code_contains', value: '<h1>', hint: 'Add a heading' },
      codeStages: [
        {
          label: 'Support A',
          role: 'support',
          files: [htmlFile('<p>stage 0</p>'), htmlFile('/* stage 0 */', 'style.css', 'css')],
        },
      ],
    },
    {
      id: 't2',
      title: 'Task 2',
      entryFile: 'index.html',
      starterFiles: [htmlFile('<p>t2</p>'), htmlFile('t2 {}', 'style.css', 'css')],
      carryCodeFrom: 't1',
    },
  ],
  ...extra,
})

// ── Scratch ───────────────────────────────────────────────────────────────────

export const scratchBlocks = (label) => ({ cat: { blocks: { [label]: { opcode: label } } } })

export const scratchLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'scratch',
  title: 'scratch lesson',
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      starterBlocks: scratchBlocks('starter'),
      completeBlocks: scratchBlocks('complete'),
      check: [{ type: 'sprite_moved', hint: 'Move the cat' }],
      codeStages: [{ label: 'Support A', role: 'support', blocks: scratchBlocks('stage0') }],
    },
    { id: 't2', title: 'Task 2', carryBlocksFrom: 't1' },
  ],
  ...extra,
})

// ── Filesystem ────────────────────────────────────────────────────────────────

export const fsWith = (...files) => ({
  '/': { type: 'dir' },
  ...Object.fromEntries(files.map((f) => [`/${f}`, { type: 'file', content: f }])),
})

export const filesystemLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'filesystem',
  title: 'filesystem lesson',
  sandboxStarterFs: fsWith('sandbox.txt'),
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      starterFs: fsWith('start.txt'),
      completeFs: fsWith('start.txt', 'done.txt'),
      startsInDir: '/docs',
      check: { type: 'fs_path', path: '/done.txt', itemType: 'file', hint: 'Create done.txt' },
      codeStages: [{ label: 'Support A', role: 'support', fs: fsWith('stage0.txt') }],
    },
    { id: 't2', title: 'Task 2', starterFs: fsWith('t2.txt'), carryFsFrom: 't1' },
    { id: 't3', title: 'Task 3', starterFs: fsWith('t3.txt') },
  ],
  ...extra,
})

// ── Desktop ───────────────────────────────────────────────────────────────────

/** A partial desktop as authors write it; normaliseDesktop fills the rest. */
export const desktopWith = (...files) => ({ fs: fsWith(...files), windows: [] })

/** normaliseDesktop(desktopWith(...files)). */
export const normalisedDesktopWith = (...files) => ({
  fs: fsWith(...files),
  recycleBin: [],
  windows: [],
  browserVisited: [],
  lastSearchQuery: null,
})

export const desktopLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'desktop',
  title: 'desktop lesson',
  sandboxStarterDesktop: desktopWith('sandbox.txt'),
  tasks: [
    {
      id: 't1',
      title: 'Task 1',
      availableApps: ['fileManager'],
      starterDesktop: desktopWith('start.txt'),
      completeDesktop: desktopWith('start.txt', 'done.txt'),
      check: { type: 'fs_path', path: '/done.txt', itemType: 'file', hint: 'Create done.txt' },
      codeStages: [{ label: 'Support A', role: 'support', desktop: desktopWith('stage0.txt') }],
    },
    { id: 't2', title: 'Task 2', starterDesktop: desktopWith('t2.txt'), carryDesktopFrom: 't1' },
  ],
  ...extra,
})

// ── Composed ──────────────────────────────────────────────────────────────────

export const composedLesson = (extra = {}) => ({
  id: LESSON_ID,
  type: 'composed',
  title: 'composed lesson',
  tasks: [
    { id: 'c1', title: 'Python 1', moduleType: 'python', starterCode: 'x = 1' },
    { id: 'c2', title: 'Files', moduleType: 'filesystem', starterFs: fsWith('c2.txt') },
    {
      id: 'c3',
      title: 'Python 2',
      moduleType: 'python',
      starterCode: '# c3 starter',
      carryCodeFrom: 'c1',
    },
  ],
  ...extra,
})
