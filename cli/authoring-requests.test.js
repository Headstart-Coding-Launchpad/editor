// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseAuthoringRequest, readAuthoringRequests } from './authoring-requests.mjs'

describe('authoring requests', () => {
  it('parses the template header, ignoring comments and the body', () => {
    const markdown = [
      '# Keyboard edit_text mode',
      '',
      '- **Status:** planned            <!-- open | planned | shipped | declined -->',
      '- **Kind:** activity mode',
      '- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-29',
      '- **Lessons blocked:** none yet',
      '',
      '## Need',
      '',
      '- **Status:** shipped',
    ].join('\r\n')
    expect(parseAuthoringRequest('docs/x.md', markdown)).toEqual({
      file: 'docs/x.md',
      title: 'Keyboard edit_text mode',
      status: 'planned',
      kind: 'activity mode',
      requestedBy: 'Lesson Gen Agent (approved by Ryan), 2026-09-29',
      lessonsBlocked: 'none yet',
    })
  })

  it('reads every request file except the README, sorted by name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'requests-'))
    fs.writeFileSync(path.join(dir, 'README.md'), '# Authoring Requests\n')
    fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\n- **Status:** open\n- **Kind:** bug\n')
    fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\n- **Status:** shipped\n- **Kind:** docs\n')
    expect(readAuthoringRequests(dir).map((r) => [r.file, r.title, r.status, r.kind])).toEqual([
      ['docs/authoring/authoring-requests/a.md', 'A', 'shipped', 'docs'],
      ['docs/authoring/authoring-requests/b.md', 'B', 'open', 'bug'],
    ])
    expect(readAuthoringRequests(path.join(dir, 'missing'))).toEqual([])
  })

  it('reads the real folder', () => {
    const requests = readAuthoringRequests()
    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      expect(request.title).not.toBe('')
      expect(['open', 'planned', 'shipped', 'declined']).toContain(request.status)
    }
  })
})
