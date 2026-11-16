// @vitest-environment node
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installFirestoreLog, logFirestoreRead } from './firestore-log.mjs'

const snapOf = (...datas) => ({ docs: datas.map((d) => ({ data: () => d })) })

describe('firestore read log', () => {
  afterEach(() => delete process.env.HSC_FIRESTORE_LOG)

  it('appends one line with path, doc count and byte total, never contents', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'fslog-')), 'sub', 'calls.log')
    process.env.HSC_FIRESTORE_LOG = file
    logFirestoreRead('lessons', snapOf({ a: 'secretvalue' }, { b: 1 }))
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(1)
    const [time, , path, count, bytes] = lines[0].split('\t')
    expect(Number.isNaN(Date.parse(time))).toBe(false)
    expect([path, count, bytes]).toEqual(['lessons', '2', String(19 + 7)])
    expect(lines[0]).not.toContain('secretvalue')
  })

  it('swallows write failures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fslog-'))
    process.env.HSC_FIRESTORE_LOG = dir // a directory: append fails
    expect(() => logFirestoreRead('lessons', snapOf({ a: 1 }))).not.toThrow()
  })

  it('wraps doc and query get without changing the result', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'fslog-')), 'c.log')
    process.env.HSC_FIRESTORE_LOG = file
    class Query {
      async get() {
        return snapOf({ x: 1 })
      }
    }
    class Collection extends Query {
      path = 'lessons'
    }
    class Doc {
      path = 'lessons/a'
      async get() {
        return { exists: true, data: () => ({ y: 22 }) }
      }
    }
    installFirestoreLog({ doc: () => new Doc(), collection: () => new Collection() })
    const docSnap = await new Doc().get()
    expect(docSnap.data()).toEqual({ y: 22 })
    expect((await new Collection().get()).docs).toHaveLength(1)
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines.map((l) => l.split('\t').slice(2))).toEqual([
      ['lessons/a', '1', '8'],
      ['lessons', '1', '7'],
    ])
    expect(existsSync(file)).toBe(true)
  })
})
