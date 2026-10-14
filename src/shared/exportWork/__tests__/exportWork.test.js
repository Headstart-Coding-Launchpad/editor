import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { md5 } from '../../md5.js'
import {
  exportDateStamp,
  exportFileStem,
  firstNameForFile,
  slugifyTitle,
  uniqueFileName,
} from '../naming.js'
import { buildZip, toZipEntries } from '../zip.js'
import {
  MAX_SHARE_PAYLOAD_BYTES,
  SHARE_TTL_MS,
  checkSharePayload,
  isShareLive,
  parseSharePayload,
  randomShareId,
  shareDaysLeft,
  shareExpiryMs,
  shareStatus,
  shareTitle,
  shareUrl,
} from '../shareLink.js'
import { collectExportItems, latestSubmission } from '../collect.js'
import { inlineHtmlFiles } from '../../../modules/html/inlineHtml.js'
import { encodeWav } from '../../../modules/scratch/export/wav.js'

describe('md5', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe(
      '9e107d9d372bb6826bd81d3542a419d6'
    )
    expect(
      md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890')
    ).toBe('57edf4a22be3c955ac49da2e2107b67a')
  })

  it('hashes bytes and UTF-8 text the same way', () => {
    expect(md5(new TextEncoder().encode('abc'))).toBe(md5('abc'))
    expect(md5('é')).toBe(md5(new Uint8Array([0xc3, 0xa9])))
  })
})

describe('export file names', () => {
  const date = new Date(2026, 9, 14)

  it('uses the task title and the date, never the name by default', () => {
    expect(exportFileStem({ title: 'Loops & Lists!', date, displayName: 'Jamie' })).toBe(
      'Loops-Lists_2026-10-14'
    )
  })

  it('adds the first name only when asked', () => {
    expect(
      exportFileStem({ title: 'Loops', date, displayName: 'Jamie-2 Smith', includeName: true })
    ).toBe('Jamie_Loops_2026-10-14')
    expect(firstNameForFile('  Zoë ')).toBe('Zoe')
  })

  it('falls back for an untitled task and trims long titles', () => {
    expect(exportFileStem({ title: '🐢🐢', date, fallback: 'task-3' })).toBe('task-3_2026-10-14')
    expect(slugifyTitle('a'.repeat(100))).toHaveLength(60)
    expect(exportDateStamp(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('never repeats a name in one export', () => {
    const used = new Set()
    expect(uniqueFileName('a.png', used)).toBe('a.png')
    expect(uniqueFileName('a.png', used)).toBe('a (2).png')
    expect(uniqueFileName('a.png', used)).toBe('a (3).png')
    expect(uniqueFileName('README', used)).toBe('README')
  })
})

describe('zip assembly', () => {
  it('keeps paths relative and safe, and renames repeats', () => {
    const entries = toZipEntries([
      { name: '/site/index.html', data: '<p>hi</p>' },
      { name: '../evil.txt', data: 'x' },
      { name: 'site\\index.html', data: 'second' },
      { name: '', data: 'skipped' },
    ])
    expect(Object.keys(entries)).toEqual(['site/index.html', 'evil.txt', 'site/index (2).html'])
    expect(entries['site/index.html']).toBeInstanceOf(Uint8Array)
  })

  it('builds a zip fflate can read back', async () => {
    const zip = await buildZip([
      { name: 'project.json', data: '{"targets":[]}' },
      { name: 'a.png', data: new Uint8Array([1, 2, 3]) },
    ])
    const files = unzipSync(zip)
    expect(strFromU8(files['project.json'])).toBe('{"targets":[]}')
    expect([...files['a.png']]).toEqual([1, 2, 3])
  })
})

describe('share links', () => {
  it('expires 30 days after creation', () => {
    expect(SHARE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
    expect(shareExpiryMs(1000)).toBe(1000 + SHARE_TTL_MS)
  })

  it('accepts a payload under the limit and refuses a bigger one kindly', () => {
    const ok = checkSharePayload({ code: 'print(1)' })
    expect(ok).toMatchObject({ ok: true, serialized: '{"code":"print(1)"}' })
    const big = checkSharePayload({ code: 'x'.repeat(MAX_SHARE_PAYLOAD_BYTES) })
    expect(big.ok).toBe(false)
    expect(big.message).toMatch(/too big for a share link/)
    // Multi-byte characters count as bytes, not characters.
    const emoji = checkSharePayload({ code: '🐢'.repeat(MAX_SHARE_PAYLOAD_BYTES / 4) })
    expect(emoji.ok).toBe(false)
  })

  it('knows when a link is live, expired or revoked', () => {
    const now = 1_000_000
    const live = { revoked: false, expiresAt: { toMillis: () => now + 2.5 * 86400000 } }
    expect(isShareLive(live, now)).toBe(true)
    expect(shareStatus(live, now)).toBe('live')
    expect(shareDaysLeft(live, now)).toBe(2)
    expect(shareStatus({ ...live, revoked: true }, now)).toBe('revoked')
    expect(shareStatus({ revoked: false, expiresAt: now - 1 }, now)).toBe('expired')
    expect(isShareLive(null, now)).toBe(false)
  })

  it('makes unguessable ids, plain titles and hash-router URLs', () => {
    const id = randomShareId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(randomShareId()).not.toBe(id)
    expect(shareTitle('  ')).toBe('Student work')
    expect(shareTitle('x'.repeat(300))).toHaveLength(200)
    expect(shareUrl('abc', { origin: 'https://example.org', base: '/hsc/' })).toBe(
      'https://example.org/hsc/#/share/abc'
    )
    expect(parseSharePayload('{"a":1}')).toEqual({ a: 1 })
    expect(parseSharePayload('{oops')).toBeNull()
  })
})

describe('collecting work', () => {
  const session = {
    currentTaskId: 2,
    attemptLog: {
      s1: {
        1: {
          a: { submission: 'print(1)', loggedAt: 10, attemptNumber: 1 },
          b: { submission: 'print(2)', loggedAt: 20, attemptNumber: 2 },
          c: { submission: 'print(3)', loggedAt: 30, attemptNumber: 0, auto: 'leave' },
        },
        2: { a: { submission: 'old', loggedAt: 5, attemptNumber: 1 } },
      },
    },
  }

  it('takes the latest logged work, including the auto-check made on leave', () => {
    expect(latestSubmission(session, 's1', 1).submission).toBe('print(3)')
    expect(latestSubmission(session, 's1', 1, { realOnly: true }).submission).toBe('print(2)')
    expect(latestSubmission(session, 's1', 3)).toBeNull()
  })

  it('prefers live work on the current task and submissions elsewhere', () => {
    const exporter = {
      readLive: (student) => (student.currentCode ? { code: student.currentCode } : null),
      readSubmission: (submission) => ({ code: submission }),
    }
    const candidates = [1, 2, 3].map((id) => ({
      task: { id, title: `T${id}` },
      taskLesson: {},
      moduleType: 'python',
    }))
    const items = collectExportItems({
      candidates,
      session,
      student: { anonymousId: 's1', currentCode: 'live!' },
      getExporter: () => exporter,
    })
    expect(items.map((i) => [i.task.id, i.work.code, i.source])).toEqual([
      [1, 'print(3)', 'submission'],
      [2, 'live!', 'live'],
    ])
  })
})

describe('HTML single file', () => {
  it('inlines the project stylesheet and scripts into the entry page', () => {
    const html = inlineHtmlFiles(
      [
        {
          name: 'index.html',
          content:
            '<link rel="stylesheet" href="style.css"><link rel="icon" href="x.png"><script src="./app.js" defer></script><script src="https://cdn.example/lib.js"></script>',
        },
        { name: 'style.css', content: 'p { color: red }' },
        { name: 'app.js', content: 'if (a </script> b) {}' },
      ],
      'index.html'
    )
    expect(html).toContain('<style>\np { color: red }\n</style>')
    expect(html).toContain('<link rel="icon" href="x.png">')
    expect(html).toContain('<script defer>\nif (a <\\/script> b) {}\n</script>')
    expect(html).toContain('<script src="https://cdn.example/lib.js"></script>')
  })

  it('returns null without a page', () => {
    expect(inlineHtmlFiles([{ name: 'a.css', content: '' }], 'index.html')).toBeNull()
  })
})

describe('WAV encoding', () => {
  it('writes a 16-bit mono PCM header and samples', () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1]), 22050)
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(view.getUint32(24, true)).toBe(22050)
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getInt16(46, true)).toBe(0x7fff)
    expect(view.getInt16(48, true)).toBe(-0x8000)
    expect(bytes.length).toBe(50)
  })
})
