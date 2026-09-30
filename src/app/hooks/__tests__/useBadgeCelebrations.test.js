import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const audio = vi.hoisted(() => ({ playBadgeChime: vi.fn() }))
vi.mock('../../nudgeAlert', () => ({ playBadgeChime: audio.playBadgeChime }))

import useBadgeCelebrations from '../useBadgeCelebrations'

const award = (overrides = {}) => ({
  status: 'awarded',
  source: 'manual',
  reason: null,
  taskId: 1,
  announce: true,
  bulkId: null,
  decidedAt: 100,
  ...overrides,
})
const STUDENTS = { me: { displayName: 'Me' }, sam: { displayName: 'Sam' } }

function renderCelebrations(initial = {}) {
  return renderHook((props) => useBadgeCelebrations(props), {
    initialProps: {
      ready: true,
      enabled: true,
      decisions: {},
      viewerId: 'me',
      students: STUDENTS,
      soundsOff: false,
      ...initial,
    },
  })
}

afterEach(() => audio.playBadgeChime.mockReset())

describe('useBadgeCelebrations', () => {
  it('does not replay awards already stored when the session loaded, but lists them', () => {
    const { result } = renderCelebrations({
      decisions: { me: { bug_hunter: award() }, sam: { code_fixer: award() } },
    })
    expect(result.current.card).toBeNull()
    expect(result.current.toast).toBeNull()
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
    expect(result.current.moments.map((m) => m.badgeId)).toEqual(['bug_hunter'])
  })

  it("celebrates the viewer's new award with a card and a chime, and no toast", () => {
    const { result, rerender } = renderCelebrations()
    rerender({
      ready: true,
      enabled: true,
      viewerId: 'me',
      students: STUDENTS,
      decisions: { me: { bug_hunter: award({ decidedAt: 200 }) } },
    })
    expect(result.current.card).toMatchObject({ studentId: 'me', badgeId: 'bug_hunter' })
    expect(result.current.toast).toBeNull()
    expect(audio.playBadgeChime).toHaveBeenCalledTimes(1)
  })

  it("shows a classmate's new award as a toast only", () => {
    const { result, rerender } = renderCelebrations()
    rerender({
      ready: true,
      enabled: true,
      viewerId: 'me',
      students: STUDENTS,
      decisions: { sam: { bug_hunter: award({ decidedAt: 200 }) } },
    })
    expect(result.current.card).toBeNull()
    expect(result.current.toast).toMatchObject({ badgeId: 'bug_hunter', names: ['Sam'] })
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('queues several cards and plays through them one at a time', () => {
    const { result, rerender } = renderCelebrations()
    rerender({
      ready: true,
      enabled: true,
      viewerId: 'me',
      students: STUDENTS,
      decisions: {
        me: { bug_hunter: award({ decidedAt: 200 }), code_fixer: award({ decidedAt: 201 }) },
      },
    })
    expect(result.current.card.badgeId).toBe('bug_hunter')
    act(() => result.current.cardDone())
    expect(result.current.card.badgeId).toBe('code_fixer')
    expect(audio.playBadgeChime).toHaveBeenCalledTimes(2)
    act(() => result.current.cardDone())
    expect(result.current.card).toBeNull()
  })

  it('skips the chime when the tutor turned sounds off or the student muted', () => {
    const { result, rerender } = renderCelebrations({ soundsOff: true })
    const base = { ready: true, enabled: true, viewerId: 'me', students: STUDENTS }
    rerender({
      ...base,
      soundsOff: true,
      decisions: { me: { bug_hunter: award({ decidedAt: 1 }) } },
    })
    expect(result.current.card).not.toBeNull()
    expect(audio.playBadgeChime).not.toHaveBeenCalled()

    act(() => result.current.cardDone())
    act(() => result.current.setMuted(true))
    rerender({
      ...base,
      soundsOff: false,
      decisions: {
        me: { bug_hunter: award({ decidedAt: 1 }), code_fixer: award({ decidedAt: 2 }) },
      },
    })
    expect(result.current.card.badgeId).toBe('code_fixer')
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('removes a revoked badge from the moments silently', () => {
    const { result, rerender } = renderCelebrations({
      decisions: { me: { bug_hunter: award() } },
    })
    expect(result.current.moments).toHaveLength(1)
    rerender({
      ready: true,
      enabled: true,
      viewerId: 'me',
      students: STUDENTS,
      decisions: { me: { bug_hunter: award({ status: 'revoked' }) } },
    })
    expect(result.current.moments).toEqual([])
    expect(result.current.card).toBeNull()
    expect(result.current.toast).toBeNull()
  })

  it('gives the presentation window (no viewer) toasts but never a card', () => {
    const { result, rerender } = renderCelebrations({ viewerId: null })
    rerender({
      ready: true,
      enabled: true,
      viewerId: null,
      students: STUDENTS,
      decisions: { me: { bug_hunter: award({ decidedAt: 5 }) } },
    })
    expect(result.current.card).toBeNull()
    expect(result.current.toast).toMatchObject({ names: ['Me'] })
    expect(result.current.moments).toEqual([])
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('marks awards seen while disabled, so they are not replayed later', () => {
    const decisions = { me: { bug_hunter: award({ decidedAt: 5 }) } }
    const { result, rerender } = renderCelebrations({ enabled: false })
    rerender({ ready: true, enabled: false, viewerId: 'me', students: STUDENTS, decisions })
    rerender({ ready: true, enabled: true, viewerId: 'me', students: STUDENTS, decisions })
    expect(result.current.card).toBeNull()
  })

  it('merges a bulk award into one toast and counts the recipients', () => {
    const { result, rerender } = renderCelebrations()
    const bulk = (decidedAt) => award({ bulkId: 'bulk-1', decidedAt })
    rerender({
      ready: true,
      enabled: true,
      viewerId: 'viewer',
      students: STUDENTS,
      decisions: { me: { keyboard_wizard: bulk(1) }, sam: { keyboard_wizard: bulk(2) } },
    })
    expect(result.current.toast.recipientIds).toEqual(['me', 'sam'])
    act(() => result.current.toastDone())
    expect(result.current.toast).toBeNull()
  })
})
