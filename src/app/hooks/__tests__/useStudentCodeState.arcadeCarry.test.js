// Arcade's drawn sprites and painted tilemaps travel with carryCodeFrom (Ryan, 28 Nov: "Yes
// arcade carry"). The fun moment: a child draws their hero in task 1, moves to task 2, presses
// Play and their own hero is in the game, with task 2's new art beside it.
import { describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actSync,
  makeSession,
  readStored,
  renderStudentCodeState,
  taskKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import { ARCADE_COLOURS } from '../../../modules/arcade/design'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

const sprite = (name, colour, id = `id-${name}`) => ({
  id,
  name,
  width: 1,
  height: 1,
  frames: [[colour]],
})
const map = (name, row, id = `map-${name}`) => ({ id, name, columns: 4, rows: [row] })
const design = (sprites, maps = []) => ({ sprites, maps })

// t1: the child draws the hero and paints the level. t2 carries t1's code and adds a coin.
// t3 carries from t2 (a chain); t4 does not carry at all.
const lesson = () => ({
  id: 'lesson-1',
  type: 'arcade',
  title: 'carry',
  tasks: [
    {
      id: 't1',
      title: 'Draw your hero',
      starterCode: 'hero = Sprite("hero.png")',
      arcadeDesign: design([sprite('hero.png', 'white')], [map('level', '....')]),
      arcadeTools: 'both',
    },
    {
      id: 't2',
      title: 'Collect coins',
      starterCode: '# t2 starter',
      carryCodeFrom: 't1',
      arcadeDesign: design([sprite('hero.png', 'white'), sprite('coin.png', 'yellow')]),
      arcadeTools: 'both',
    },
    { id: 't3', title: 'Chain', starterCode: '# t3', carryCodeFrom: 't2' },
    {
      id: 't4',
      title: 'Fresh',
      starterCode: '# t4',
      arcadeDesign: design([sprite('boss.png', 'red')]),
    },
  ],
})

const hex = (name) => ARCADE_COLOURS[name]
const colourOf = (d, name) => d?.sprites.find((s) => s.name === name)?.frames[0][0] ?? null
const names = (d) => d.sprites.map((s) => s.name)

function goToTask(h, taskId) {
  actSync(() => h.result.current.saveCurrentWork())
  actSync(() => h.result.current.resetForTaskChange())
  h.update({ currentTaskId: taskId })
}

function draw(h, spriteName, colour) {
  const current = h.result.current.arcadeDesign
  actSync(() =>
    h.result.current.handleArcadeDesignChange({
      ...current,
      sprites: current.sprites.map((s) =>
        s.name === spriteName ? { ...s, frames: [[colour]] } : s
      ),
    })
  )
}

function paint(h, mapName, row) {
  const current = h.result.current.arcadeDesign
  actSync(() =>
    h.result.current.handleArcadeDesignChange({
      ...current,
      maps: current.maps.map((m) => (m.name === mapName ? { ...m, rows: [row] } : m)),
    })
  )
}

describe('Arcade carry: the child’s art travels with carryCodeFrom', () => {
  it('fun moment: the hero drawn in task 1 is in task 2’s game, beside task 2’s new coin', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    paint(h, 'level', 'AA..')
    goToTask(h, 't2')
    const d = h.result.current.arcadeDesign
    expect(h.result.current.code).toBe('hero = Sprite("hero.png")')
    expect(colourOf(d, 'hero.png')).toBe(hex('blue'))
    expect(colourOf(d, 'coin.png')).toBe(hex('yellow'))
    // The level the carried code names comes too, though task 2 has no tilemap of its own.
    expect(d.maps.map((m) => [m.name, m.rows[0]])).toEqual([['level', 'AA..']])
  })

  it('a change the child makes in task 2 wins over the carry and survives leaving', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't2')
    draw(h, 'hero.png', 'green')
    draw(h, 'coin.png', 'orange')
    goToTask(h, 't1')
    goToTask(h, 't2')
    const d = h.result.current.arcadeDesign
    expect(colourOf(d, 'hero.png')).toBe(hex('green'))
    expect(colourOf(d, 'coin.png')).toBe(hex('orange'))
  })

  it('opening task 2 before drawing does not stop the later drawing arriving', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    goToTask(h, 't2')
    goToTask(h, 't1')
    draw(h, 'hero.png', 'pink')
    goToTask(h, 't2')
    expect(colourOf(h.result.current.arcadeDesign, 'hero.png')).toBe(hex('pink'))
    expect(colourOf(h.result.current.arcadeDesign, 'coin.png')).toBe(hex('yellow'))
  })

  it('task 2’s authored art wins over an untouched copy of task 1’s starter', () => {
    const l = lesson()
    l.tasks[1].arcadeDesign = design([sprite('hero.png', 'peach')])
    const h = renderStudentCodeState({ lesson: l, currentTaskId: 't1' })
    goToTask(h, 't2')
    expect(colourOf(h.result.current.arcadeDesign, 'hero.png')).toBe(hex('peach'))
  })

  it('a sprite drawn only in task 2 is never lost when the carry changes', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    goToTask(h, 't2')
    const current = h.result.current.arcadeDesign
    actSync(() =>
      h.result.current.handleArcadeDesignChange({
        ...current,
        sprites: [...current.sprites, sprite('pet.png', 'brown', 'id-pet')],
      })
    )
    goToTask(h, 't1')
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't2')
    const d = h.result.current.arcadeDesign
    expect(colourOf(d, 'pet.png')).toBe(hex('brown'))
    expect(colourOf(d, 'hero.png')).toBe(hex('blue'))
    expect(readStored(taskKey('t2')).arcadeDesign.sprites.map((s) => s.name)).toContain('pet.png')
  })

  it('follows the code’s fallback: a skipped task in the chain carries from the one before', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    // Straight to t3 (t2 never opened, so it has no save): t3 carries t1's code and art.
    goToTask(h, 't3')
    expect(h.result.current.code).toBe('hero = Sprite("hero.png")')
    expect(colourOf(h.result.current.arcadeDesign, 'hero.png')).toBe(hex('blue'))
  })

  it('a task without carryCodeFrom keeps exactly its own design or starter', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't4')
    expect(names(h.result.current.arcadeDesign)).toEqual(['boss.png'])
  })

  it('in solo, a reload restores the own code with the merged art', () => {
    writeStored(taskKey('t1'), {
      code: 'hero = 1',
      arcadeDesign: design([sprite('hero.png', 'blue')], [map('level', 'B...')]),
    })
    writeStored(taskKey('t2'), {
      code: 'hero = 2',
      arcadeDesign: design([sprite('hero.png', 'white'), sprite('coin.png', 'red')]),
    })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't2', phase: 'solo' })
    const d = h.result.current.arcadeDesign
    expect(h.result.current.code).toBe('hero = 2')
    expect(colourOf(d, 'hero.png')).toBe(hex('blue'))
    expect(colourOf(d, 'coin.png')).toBe(hex('red'))
    expect(d.maps.map((m) => m.name)).toEqual(['level'])
  })

  it('carries in a teacher presentation too (the in-memory store)', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
    })
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't2')
    expect(colourOf(h.result.current.arcadeDesign, 'hero.png')).toBe(hex('blue'))
    expect(localStorage.getItem(taskKey('t2'))).toBe(null)
  })

  it('a watching tutor is sent the carried art when the task loads', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    draw(h, 'hero.png', 'blue')
    h.writers.writeStudentArcadeDesign.mockClear()
    goToTask(h, 't2')
    const sent = h.writers.writeStudentArcadeDesign.mock.calls.at(-1)
    expect(sent[0]).toBe(ANON)
    expect(colourOf(sent[1], 'hero.png')).toBe(hex('blue'))
  })

  it('the tutor is not sent the art on load when not watching', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't2')
    expect(h.writers.writeStudentArcadeDesign).not.toHaveBeenCalled()
  })

  it('a tutor who starts watching is sent the art the child has now', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    draw(h, 'hero.png', 'blue')
    goToTask(h, 't2')
    h.updateSession({ activeStudentView: ANON })
    const sent = h.writers.writeStudentArcadeDesign.mock.calls.at(-1)
    expect(colourOf(sent[1], 'hero.png')).toBe(hex('blue'))
  })
})
