import { describe, expect, it } from 'vitest'
import { getModuleDefinition } from '../../../modules/definitions.js'
import {
  activeRosterMatches,
  buildRosterWorkDoc,
  extractRosterWork,
  hashRosterWork,
  makeRosterMatch,
  makeRosterWorkId,
  normaliseRosterName,
  readRosterWorkDoc,
  resolveSessionClass,
  resolveSourceIds,
  rosterWorkPath,
  splitIntoChunks,
  summariseRosterStatus,
} from '../rosterModel.js'

describe('normaliseRosterName', () => {
  it('trims and single-spaces a first name and initial', () => {
    expect(normaliseRosterName('  Jamie   B. ')).toBe('Jamie B.')
  })

  it('rejects empty and over-long names', () => {
    expect(normaliseRosterName('   ')).toBe('')
    expect(normaliseRosterName(null)).toBe('')
    expect(normaliseRosterName('x'.repeat(31))).toBe('')
    expect(normaliseRosterName('x'.repeat(30))).toBe('x'.repeat(30))
  })
})

describe('resolveSessionClass', () => {
  it("uses a class fork's own class, whatever the session says", () => {
    const lesson = { id: 'py-1-maple', fork: { classId: 'maple', sourceLessonId: 'py-1' } }
    expect(resolveSessionClass(lesson, { classId: 'oak', classChosenAt: 1 })).toEqual({
      classId: 'maple',
      source: 'fork',
    })
  })

  it("uses the tutor's pick on a stock lesson", () => {
    expect(resolveSessionClass({ id: 'py-1' }, { classId: 'oak', classChosenAt: 1 })).toEqual({
      classId: 'oak',
      source: 'session',
    })
  })

  it('tells "No class" apart from not chosen yet', () => {
    expect(resolveSessionClass({ id: 'py-1' }, { classChosenAt: 1 })).toEqual({
      classId: null,
      source: 'none',
    })
    expect(resolveSessionClass({ id: 'py-1' }, {})).toEqual({ classId: null, source: 'unset' })
    expect(resolveSessionClass(null, null)).toEqual({ classId: null, source: 'unset' })
  })
})

describe('resolveSourceIds and makeRosterWorkId', () => {
  it('keys a stock lesson by its own ids', () => {
    expect(resolveSourceIds({ id: 'py-1' }, 'py-1', 3)).toEqual({
      sourceLessonId: 'py-1',
      sourceTaskId: 3,
    })
  })

  it("keys a fork by the stock lesson and the task link's source task", () => {
    const lesson = {
      id: 'py-1-maple',
      fork: {
        sourceLessonId: 'py-1',
        classId: 'maple',
        taskLinks: [
          { taskId: 1, sourceTaskId: 1, relation: 'copied' },
          { taskId: 2, sourceTaskId: 5, relation: 'copied' },
        ],
      },
    }
    expect(resolveSourceIds(lesson, 'py-1-maple', 2)).toEqual({
      sourceLessonId: 'py-1',
      sourceTaskId: 5,
    })
    // RTDB keys arrive as strings.
    expect(resolveSourceIds(lesson, 'py-1-maple', '2').sourceTaskId).toBe(5)
    // A task with no link keeps its own id.
    expect(resolveSourceIds(lesson, 'py-1-maple', 9).sourceTaskId).toBe(9)
  })

  it('builds {sourceLessonId}__{sourceTaskId}, refusing reserved or empty ids', () => {
    expect(makeRosterWorkId('py-1', 3)).toBe('py-1__3')
    expect(makeRosterWorkId('a/b', 'c/d')).toBe('a_b__c_d')
    expect(makeRosterWorkId('__x', '_')).toBeNull()
    expect(makeRosterWorkId('', 1)).toBeNull()
    expect(makeRosterWorkId('py-1', null)).toBeNull()
    expect(rosterWorkPath('maple', 'r1', 'py-1__3')).toBe('classes/maple/roster/r1/work/py-1__3')
  })
})

describe('matches', () => {
  it('makes a match record', () => {
    expect(makeRosterMatch('r1', 't1', 5)).toEqual({
      rosterId: 'r1',
      matchedAt: 5,
      matchedBy: 't1',
    })
    expect(() => makeRosterMatch('', 't1')).toThrow()
  })

  it('drops matches whose roster entry has gone', () => {
    const roster = [{ id: 'r1', displayName: 'Jamie B.' }]
    expect(activeRosterMatches({ a: { rosterId: 'r1' }, b: { rosterId: 'gone' } }, roster)).toEqual(
      { a: 'r1' }
    )
  })

  it('summarises names and unmatched students only when the session has a class', () => {
    const roster = [{ id: 'r1', displayName: 'Jamie B.' }]
    const students = [{ anonymousId: 'a' }, { anonymousId: 'b' }]
    const matches = { a: { rosterId: 'r1' } }
    const status = summariseRosterStatus({ students, matches, roster, classId: 'maple' })
    expect(status.hasRoster).toBe(true)
    expect(status.namesByStudent).toEqual({ a: 'Jamie B.' })
    expect(status.unmatchedIds).toEqual(['b'])
    expect(
      summariseRosterStatus({ students, matches, roster, classId: null }).unmatchedIds
    ).toEqual([])
  })
})

describe('extractRosterWork', () => {
  const python = getModuleDefinition('python')
  const html = getModuleDefinition('html')
  const scratch = getModuleDefinition('scratch')
  const filesystem = getModuleDefinition('filesystem')

  it('reads code from the run or a submission', () => {
    expect(extractRosterWork(python, { student: { currentCode: 'print(1)' } })).toEqual({
      kind: 'code',
      code: 'print(1)',
    })
    expect(extractRosterWork(python, { submission: 'print(2)' })).toEqual({
      kind: 'code',
      code: 'print(2)',
    })
    expect(extractRosterWork(python, { student: { currentCode: '' } })).toBeNull()
  })

  it('reads HTML files with decoded names, from the run or a submission', () => {
    expect(
      extractRosterWork(html, { student: { currentFiles: { index__dot__html: '<p>' } } })
    ).toEqual({ kind: 'files', files: [{ name: 'index.html', content: '<p>' }] })
    expect(extractRosterWork(html, { submission: JSON.stringify({ 'style.css': 'p{}' }) })).toEqual(
      { kind: 'files', files: [{ name: 'style.css', content: 'p{}' }] }
    )
  })

  it('parses Scratch state from currentCode or a submission', () => {
    const state = { cat: { blocks: { blocks: [] } }, __meta__: { addedSprites: [] } }
    expect(extractRosterWork(scratch, { student: { currentCode: JSON.stringify(state) } })).toEqual(
      { kind: 'blocks', scratchState: state }
    )
    expect(extractRosterWork(scratch, { submission: 'not json' })).toBeNull()
  })

  it('saves nothing for a module without rosterWork', () => {
    expect(extractRosterWork(filesystem, { submission: '{}' })).toBeNull()
  })
})

describe('hashRosterWork', () => {
  it('is equal for equal work and differs for changed work or kind', () => {
    const a = { kind: 'code', code: 'print(1)' }
    expect(hashRosterWork(a)).toBe(hashRosterWork({ ...a }))
    expect(hashRosterWork(a)).not.toBe(hashRosterWork({ kind: 'code', code: 'print(2)' }))
    expect(hashRosterWork(a)).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('splitting large work', () => {
  it('splits text into pieces that join back, never inside a surrogate pair', () => {
    const text = 'ab😀cd😀e'
    const chunks = splitIntoChunks(text, 3)
    expect(chunks.join('')).toBe(text)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(3)
      expect(/[\uD800-\uDBFF]$/.test(chunk)).toBe(false)
    }
    expect(splitIntoChunks('')).toEqual([])
  })

  const meta = {
    moduleType: 'scratch',
    sessionLessonId: 'sc-1-maple',
    taskId: 2,
    sourceLessonId: 'sc-1',
    sourceTaskId: 2,
    origin: 'run',
  }

  it('keeps small work inline (Scratch state as a JSON string)', () => {
    const work = { kind: 'blocks', scratchState: { cat: { blocks: { blocks: [[1, 2]] } } } }
    const { doc, chunks } = buildRosterWorkDoc(work, meta)
    expect(chunks).toEqual([])
    expect(doc.chunkCount).toBe(0)
    expect(typeof doc.scratchState).toBe('string')
    expect(doc.hash).toBe(hashRosterWork(work))
    expect(readRosterWorkDoc(doc)).toMatchObject({ ...work, sourceLessonId: 'sc-1', origin: 'run' })
  })

  it('moves large work into chunks, each document well under 1 MiB, and reads it back', () => {
    const big = { kind: 'code', code: 'x'.repeat(1000) }
    const { doc, chunks } = buildRosterWorkDoc(big, meta, { inlineMax: 100, chunkSize: 300 })
    expect(doc.code).toBeUndefined()
    expect(doc.chunkCount).toBe(chunks.length)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 300)).toBe(true)
    expect(readRosterWorkDoc(doc, chunks)).toMatchObject(big)
    // Missing chunks: nothing usable rather than broken work.
    expect(readRosterWorkDoc(doc, chunks.slice(1))).toBeNull()
  })

  it('chunks a realistic large Scratch project under the default limits', () => {
    const sprites = {}
    for (let i = 0; i < 40; i++) {
      sprites[`sprite${i}`] = {
        blocks: { blocks: [{ type: 'x', fields: { T: 'y'.repeat(20_000) } }] },
      }
    }
    const work = { kind: 'blocks', scratchState: sprites }
    const { doc, chunks } = buildRosterWorkDoc(work, meta)
    expect(JSON.stringify(doc).length).toBeLessThan(300_000)
    for (const chunk of chunks) expect(new TextEncoder().encode(chunk).length).toBeLessThan(900_000)
    expect(readRosterWorkDoc(doc, chunks).scratchState).toEqual(sprites)
  })
})
