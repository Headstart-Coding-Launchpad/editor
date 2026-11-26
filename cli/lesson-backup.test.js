// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BACKUP_COLLECTIONS,
  checkBackupRoot,
  runLessonBackup,
  safeFileName,
  stableStringify,
  toBackupJson,
} from './lesson-backup.mjs'

// A fake Firestore holding docs as { data, updateTime }. Records every read; any write throws.
function fakeTs(seconds, nanoseconds = 0) {
  return { seconds, nanoseconds, toDate: () => new Date(seconds * 1000) }
}

function makeDb(initial = {}) {
  const store = new Map(
    Object.entries(initial).map(([c, docs]) => [c, new Map(Object.entries(docs))])
  )
  const calls = { selects: [], fullListReads: 0, docGets: [], writes: 0 }
  const failGets = new Set()
  const noWrite = () => {
    calls.writes += 1
    throw new Error('write attempted')
  }
  const docsOf = (name) => store.get(name) ?? new Map()
  const db = {
    collection(name) {
      const list = (fields) => ({
        get: async () => {
          if (fields == null) calls.fullListReads += 1
          const docs = [...docsOf(name)].map(([id, d]) => ({
            id,
            updateTime: d.updateTime,
            data: () =>
              fields
                ? Object.fromEntries(fields.filter((f) => f in d.data).map((f) => [f, d.data[f]]))
                : d.data,
          }))
          return { docs, size: docs.length }
        },
      })
      return {
        ...list(null),
        select: (...fields) => {
          calls.selects.push([name, fields])
          return list(fields)
        },
        add: noWrite,
        doc: (id) => ({
          get: async () => {
            calls.docGets.push(`${name}/${id}`)
            if (failGets.has(`${name}/${id}`)) throw new Error('network down')
            const d = docsOf(name).get(id)
            return { id, exists: !!d, updateTime: d?.updateTime, data: () => d?.data }
          },
          set: noWrite,
          update: noWrite,
          delete: noWrite,
          create: noWrite,
        }),
      }
    },
  }
  const put = (name, id, data, updateTime) => {
    if (!store.has(name)) store.set(name, new Map())
    store.get(name).set(id, { data, updateTime })
  }
  const remove = (name, id) => store.get(name)?.delete(id)
  return { db, calls, put, remove, failGets }
}

let out
beforeEach(async () => {
  out = await mkdtemp(join(tmpdir(), 'lesson-backup-'))
})
afterEach(async () => {
  await rm(out, { recursive: true, force: true })
})

const readIndex = async () => JSON.parse(await readFile(join(out, 'index.json'), 'utf8'))
const filesIn = async (...parts) => {
  const dir = join(out, ...parts)
  return existsSync(dir) ? (await readdir(dir)).sort() : []
}

function seed() {
  return makeDb({
    lessons: {
      L1: { data: { title: 'Lesson one', tasks: [{ id: 1 }] }, updateTime: fakeTs(100) },
      'L1-fork-tue': {
        data: { title: 'Fork', fork: { sourceLessonId: 'L1', classId: 'c1' } },
        updateTime: fakeTs(101),
      },
    },
    lessonLevels: { 'level-1': { data: { label: 'Level 1' }, updateTime: fakeTs(50) } },
    topicLibrary: { loops: { data: { name: 'Loops' }, updateTime: fakeTs(60) } },
    lessonTypeAssets: { scratch: { data: { assets: [] }, updateTime: fakeTs(70) } },
  })
}

describe('lessons backup', () => {
  it('first run copies every lesson (forks too) and its companion docs, field-limited list first', async () => {
    const fake = seed()
    const result = await runLessonBackup({ db: fake.db, out })

    expect(fake.calls.writes).toBe(0)
    expect(fake.calls.fullListReads).toBe(0)
    expect(fake.calls.selects.map(([c, f]) => [c, f.length])).toEqual(
      BACKUP_COLLECTIONS.map((c) => [c, 0])
    )
    expect(result.saved).toBe(5)
    expect(result.reads).toEqual({ list: 5, fetch: 5, total: 10 })
    expect(await filesIn('lessons', 'L1')).toHaveLength(1)
    expect(await filesIn('lessons', 'L1-fork-tue')).toHaveLength(1)

    const index = await readIndex()
    expect(Object.keys(index.docs.lessons).sort()).toEqual(['L1', 'L1-fork-tue'])
    const [version] = index.docs.lessons.L1.versions
    const saved = JSON.parse(await readFile(join(out, version.file), 'utf8'))
    expect(saved).toMatchObject({ collection: 'lessons', id: 'L1', data: { title: 'Lesson one' } })
    expect(saved.hash).toBe(version.hash)
  })

  it('an unchanged night reads only the list and writes no new version', async () => {
    const fake = seed()
    await runLessonBackup({ db: fake.db, out })
    fake.calls.docGets.length = 0
    const result = await runLessonBackup({ db: fake.db, out })
    expect(fake.calls.docGets).toEqual([])
    expect(result.saved).toBe(0)
    expect(result.reads).toEqual({ list: 5, fetch: 0, total: 5 })
    expect(await filesIn('lessons', 'L1')).toHaveLength(1)
  })

  it('a changed lesson gets a new version and the earlier one is kept untouched', async () => {
    const fake = seed()
    await runLessonBackup({ db: fake.db, out })
    const [first] = await filesIn('lessons', 'L1')
    const firstText = await readFile(join(out, 'lessons', 'L1', first), 'utf8')

    fake.put('lessons', 'L1', { title: 'Lesson one v2', tasks: [{ id: 1 }] }, fakeTs(200))
    fake.calls.docGets.length = 0
    const result = await runLessonBackup({ db: fake.db, out })

    expect(fake.calls.docGets).toEqual(['lessons/L1'])
    expect(result.saved).toBe(1)
    const files = await filesIn('lessons', 'L1')
    expect(files).toHaveLength(2)
    expect(await readFile(join(out, 'lessons', 'L1', first), 'utf8')).toBe(firstText)
    const index = await readIndex()
    expect(index.docs.lessons.L1.versions).toHaveLength(2)
  })

  it('a touched but identical lesson is fetched and not saved again', async () => {
    const fake = seed()
    await runLessonBackup({ db: fake.db, out })
    fake.put('lessons', 'L1', { tasks: [{ id: 1 }], title: 'Lesson one' }, fakeTs(300))
    const result = await runLessonBackup({ db: fake.db, out })
    expect(result.reads.fetch).toBe(1)
    expect(result.saved).toBe(0)
    expect(await filesIn('lessons', 'L1')).toHaveLength(1)
    // The new update time is remembered so the next night does not fetch it again.
    fake.calls.docGets.length = 0
    await runLessonBackup({ db: fake.db, out })
    expect(fake.calls.docGets).toEqual([])
  })

  it('a deleted lesson is marked deleted and its copies are kept', async () => {
    const fake = seed()
    await runLessonBackup({ db: fake.db, out })
    fake.remove('lessons', 'L1')
    const result = await runLessonBackup({ db: fake.db, out })
    expect(result.markedDeleted).toBe(1)
    const index = await readIndex()
    expect(index.docs.lessons.L1.deletedAt).toBeTruthy()
    expect(await filesIn('lessons', 'L1')).toHaveLength(1)
  })

  it('keeps going past a failed fetch, saves the index, then fails with a clear message', async () => {
    const fake = seed()
    fake.failGets.add('lessons/L1')
    await expect(runLessonBackup({ db: fake.db, out })).rejects.toThrow(/lessons\/L1.*network down/)
    const index = await readIndex()
    expect(index.docs.lessons.L1).toBeUndefined()
    expect(index.docs.lessons['L1-fork-tue'].versions).toHaveLength(1)
    // The next run picks it up.
    fake.failGets.clear()
    const result = await runLessonBackup({ db: fake.db, out })
    expect(result.saved).toBe(1)
  })

  it('refuses to run over an unreadable index rather than replacing it', async () => {
    const fake = seed()
    await writeFile(join(out, 'index.json'), '{ not json')
    await expect(runLessonBackup({ db: fake.db, out })).rejects.toThrow(/index\.json/)
    expect(await readFile(join(out, 'index.json'), 'utf8')).toBe('{ not json')
    expect(fake.calls.selects).toEqual([])
  })

  it('after an interrupted run, an existing version file is reused, never overwritten', async () => {
    const fake = seed()
    await runLessonBackup({ db: fake.db, out })
    const index = await readIndex()
    const file = join(out, index.docs.lessons.L1.versions[0].file)
    await writeFile(file, 'sentinel')
    // Lose the index (as if the run stopped before it was written) and leave a stray temp file.
    await rm(join(out, 'index.json'))
    await mkdir(join(out, 'lessons', 'L1'), { recursive: true })
    await writeFile(join(out, 'lessons', 'L1', 'x.json.tmp-1'), 'partial')
    await runLessonBackup({ db: fake.db, out })
    expect(await readFile(file, 'utf8')).toBe('sentinel')
    expect((await readIndex()).docs.lessons.L1.versions).toHaveLength(1)
  })

  it('stops before reading anything when the backup drive is missing', () => {
    expect(() => checkBackupRoot('D:\\LaunchPad-backups\\lessons', () => false)).toThrow(
      /D:\\ .*not found/
    )
    expect(() => checkBackupRoot('D:\\LaunchPad-backups\\lessons', () => true)).not.toThrow()
  })
})

describe('backup JSON', () => {
  it('tags Firestore timestamps, references and bytes so they can be restored', () => {
    const json = toBackupJson({
      at: fakeTs(5, 7),
      ref: { path: 'lessons/L1', firestore: {}, id: 'L1' },
      raw: Buffer.from('hi'),
      list: [fakeTs(1)],
    })
    expect(json).toEqual({
      at: { __firestore: 'timestamp', seconds: 5, nanoseconds: 7 },
      ref: { __firestore: 'reference', path: 'lessons/L1' },
      raw: { __firestore: 'bytes', base64: 'aGk=' },
      list: [{ __firestore: 'timestamp', seconds: 1, nanoseconds: 0 }],
    })
  })

  it('stable stringify ignores key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 })
    )
  })

  it('makes Windows-safe folder names from any doc id', () => {
    expect(safeFileName('lesson-1_a.b')).toBe('lesson-1_a.b')
    expect(safeFileName('a:b*c?')).toBe('a%3Ab%2Ac%3F')
    expect(safeFileName('con')).toBe('%63on')
    expect(safeFileName('end.')).toBe('end%2E')
  })
})
