import { describe, expect, it } from 'vitest'
import {
  applyPeerEdit,
  buildPeerHelpAudit,
  editsFromWire,
  findPeerHint,
  getPeerHints,
  hasPassedCurrentTask,
  notOkAlerts,
  pendingReviewItems,
  peerHelpRolesByStudent,
  snapshotLine,
  snapshotLineFiles,
  validatePeerEdit,
  visiblePeerHelpOffers,
} from '../peerHelp'

describe('peer hints', () => {
  it('puts the lesson author hints first, then the language list, then the common list', () => {
    const hints = getPeerHints('python', { peerHints: ['Did you use a loop?', '  '] })
    expect(hints[0]).toEqual({ id: 'lesson-0', text: 'Did you use a loop?' })
    expect(hints.some((h) => h.id === 'py-indent')).toBe(true)
    expect(hints.at(-1).id).toBe('looks-good')
    expect(hints.filter((h) => h.id.startsWith('lesson-'))).toHaveLength(1)
  })

  it('finds hints by id within a hint list', () => {
    expect(findPeerHint('py-colon', 'python', null)?.text).toMatch(/colon/)
    expect(findPeerHint('html-close', 'python', null)).toBeNull()
    expect(findPeerHint('sc-loop', 'blocks', null)?.text).toMatch(/loop/)
  })
})

describe('visiblePeerHelpOffers', () => {
  const session = {
    currentTaskId: 2,
    students: { me: { checkPassed: true }, other: { checkPassed: false } },
    peerHelpOffers: {
      r1: { taskId: 2, offeredAt: 10 },
      r2: { taskId: 1, offeredAt: 5 },
      r3: { taskId: 2, offeredAt: 20, claimedAt: 21 },
      r4: { taskId: 2, offeredAt: 30, endedAt: 31 },
      mine: { taskId: 2, offeredAt: 1 },
    },
  }

  it('shows only open, unclaimed offers on the current task, not the student’s own', () => {
    const offers = visiblePeerHelpOffers({ session, identityId: 'me', ownRequestId: 'mine' })
    expect(offers.map((o) => o.requestId)).toEqual(['r1'])
  })

  it('shows nothing to a student who has not passed, is switched off, or while paused', () => {
    expect(visiblePeerHelpOffers({ session, identityId: 'other' })).toEqual([])
    expect(
      visiblePeerHelpOffers({
        session: { ...session, peerHelperOff: { me: true } },
        identityId: 'me',
      })
    ).toEqual([])
    expect(
      visiblePeerHelpOffers({
        session: { ...session, peerHelpSettings: { pausedAt: 1 } },
        identityId: 'me',
      })
    ).toEqual([])
  })

  it('counts a teacher pass and respects a teacher fail', () => {
    expect(hasPassedCurrentTask({ checkOverridePassed: true })).toBe(true)
    expect(hasPassedCurrentTask({ checkPassed: true, checkOverridePassed: false })).toBe(false)
  })
})

describe('snapshot lines', () => {
  it('splits single-code snapshots into one unnamed file', () => {
    const snap = { code: 'a\nb' }
    expect(snapshotLineFiles(snap)).toEqual([{ name: '', lines: ['a', 'b'] }])
    expect(snapshotLine(snap, '', 2)).toBe('b')
  })

  it('lists HTML files with the active file first', () => {
    const snap = { files: { 'style.css': 'x', 'index.html': '<p>' }, activeFile: 'index.html' }
    expect(snapshotLineFiles(snap).map((f) => f.name)).toEqual(['index.html', 'style.css'])
    expect(snapshotLine(snap, 'style.css', 1)).toBe('x')
  })
})

describe('validatePeerEdit', () => {
  const ok = { downLines: [2, 5], lineCount: 6 }

  it('allows small changes on 👎 lines, or a line inserted next to one', () => {
    expect(validatePeerEdit({ ...ok, edits: [{ line: 2, op: 'replace', text: 'x' }] })).toBeNull()
    expect(validatePeerEdit({ ...ok, edits: [{ line: 4, op: 'insert', text: 'x' }] })).toBeNull()
    expect(validatePeerEdit({ ...ok, edits: [{ line: 5, op: 'insert', text: 'x' }] })).toBeNull()
  })

  it('refuses lines that were not marked 👎', () => {
    expect(validatePeerEdit({ ...ok, edits: [{ line: 3, op: 'replace', text: 'x' }] })).toMatch(
      /marked/
    )
  })

  it('refuses more than three lines, multi-line text and repeated lines', () => {
    const four = [1, 2, 3, 4].map(() => ({ line: 2, op: 'insert', text: 'x' }))
    expect(validatePeerEdit({ ...ok, edits: four })).toMatch(/at most 3/)
    expect(validatePeerEdit({ ...ok, edits: [{ line: 2, op: 'replace', text: 'a\nb' }] })).toMatch(
      /One line/
    )
    expect(
      validatePeerEdit({
        ...ok,
        edits: [
          { line: 2, op: 'replace', text: 'a' },
          { line: 2, op: 'replace', text: 'b' },
        ],
      })
    ).toMatch(/once/)
    expect(validatePeerEdit({ ...ok, edits: [] })).toMatch(/at least/)
  })
})

describe('applyPeerEdit', () => {
  it('applies replacements and inserts against the lines the helper saw', () => {
    const edits = [
      { line: 1, op: 'replace', text: 'if x:', before: 'if x' },
      { line: 1, op: 'insert', text: '    print(x)', before: 'if x' },
    ]
    expect(applyPeerEdit('if x\nend', edits)).toBe('if x:\n    print(x)\nend')
  })

  it('refuses when the student has changed the line since', () => {
    expect(
      applyPeerEdit('if y\nend', [{ line: 1, op: 'replace', text: 'z', before: 'if x' }])
    ).toBeNull()
  })

  it('reads Firebase-stored edit lists', () => {
    expect(editsFromWire({ 1: 'b', 0: 'a' })).toEqual(['a', 'b'])
    expect(editsFromWire(null)).toEqual([])
  })
})

describe('teacher queues and the audit', () => {
  const peerHelp = {
    r1: {
      stuckId: 's',
      helperId: 'h',
      snapshot: { taskId: 2 },
      state: { endedAt: 50, endedBy: 'stuck', notOkAt: 50 },
      inbox: { i1: { kind: 'mark', line: 2, verdict: 'down', createdAt: 3, response: 'not_ok' } },
      review: {
        i2: { kind: 'note', text: 'try a colon', status: 'pending', createdAt: 4 },
        i3: {
          kind: 'note',
          text: 'xxx',
          status: 'blocked',
          blockedReason: 'language',
          createdAt: 5,
        },
      },
    },
  }

  it('lists pending items and unseen Not OK alerts', () => {
    expect(pendingReviewItems(peerHelp).map((i) => i.itemId)).toEqual(['i2'])
    expect(notOkAlerts(peerHelp).map((a) => a.requestId)).toEqual(['r1'])
    expect(notOkAlerts({ r1: { state: { notOkAt: 1, notOkSeenAt: 2 } } })).toEqual([])
  })

  it('keeps every item, with names, in the audit', () => {
    const [entry] = buildPeerHelpAudit({
      peerHelp,
      offers: { r1: { offeredAt: 1, claimedAt: 2 } },
      students: { s: { displayName: 'Sam' }, h: { displayName: 'Hal' } },
    })
    expect(entry).toMatchObject({
      stuck: 'Sam',
      helper: 'Hal',
      endedBy: 'stuck',
      notOkAt: 50,
      taskId: 2,
    })
    expect(entry.delivered[0]).toMatchObject({ kind: 'mark', response: 'not_ok' })
    expect(entry.reviewed.map((i) => i.status)).toEqual(['pending', 'blocked'])
  })
})

describe('peerHelpRolesByStudent', () => {
  it('labels who asked, who is offered, being helped and helping', () => {
    const roles = peerHelpRolesByStudent({
      requests: {
        a: { requestId: 'r1' },
        b: { requestId: 'r2' },
        c: { requestId: 'r3' },
        d: { requestId: 'r4' },
      },
      peerHelp: {
        r1: { stuckId: 'a' },
        r2: { stuckId: 'b' },
        r3: { stuckId: 'c', helperId: 'h' },
        r4: { stuckId: 'd', state: { endedAt: 1 } },
      },
      offers: { r2: { offeredAt: 1 }, r3: { offeredAt: 1, claimedAt: 2 } },
    })
    expect(roles).toEqual({ a: 'asked', b: 'offered', c: 'being_helped', h: 'helping' })
  })
})
