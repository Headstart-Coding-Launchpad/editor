import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useVideoCallPrompt, { VIDEO_CALL_PROMPT_STALE_MS } from '../useVideoCallPrompt'

const NOW = 1_000_000_000
const LINK = 'https://zoom.us/j/123'

function renderPrompt(initial = {}) {
  const base = {
    ready: true,
    enabled: true,
    phase: 'lesson',
    link: LINK,
    studentPushedAt: null,
    broadcastAt: null,
    now: () => NOW,
    ...initial,
  }
  const hook = renderHook((props) => useVideoCallPrompt(props), { initialProps: base })
  return {
    ...hook,
    update(next) {
      Object.assign(base, next)
      hook.rerender({ ...base })
    },
  }
}

describe('useVideoCallPrompt', () => {
  it('does not replay pushes already set when the session loaded', () => {
    const { result } = renderPrompt({ studentPushedAt: NOW - 1000, broadcastAt: NOW - 500 })
    expect(result.current.videoCallPromptVisible).toBe(false)
  })

  it('shows on a new per-student push', () => {
    const { result, update } = renderPrompt({ studentPushedAt: NOW - 1000 })
    update({ studentPushedAt: NOW })
    expect(result.current.videoCallPromptVisible).toBe(true)
  })

  it('shows on a new class-wide broadcast, even without a student record', () => {
    const { result, update } = renderPrompt({ phase: 'name-entry' })
    update({ broadcastAt: NOW })
    expect(result.current.videoCallPromptVisible).toBe(true)
  })

  it('waits for the session before taking the baseline', () => {
    const { result, update } = renderPrompt({ ready: false, broadcastAt: null })
    // The session arrives already carrying an old broadcast: that is the baseline.
    update({ ready: true, broadcastAt: NOW - 1000 })
    expect(result.current.videoCallPromptVisible).toBe(false)
    update({ broadcastAt: NOW })
    expect(result.current.videoCallPromptVisible).toBe(true)
  })

  it('stays hidden without a link', () => {
    const { result, update } = renderPrompt({ link: null })
    update({ broadcastAt: NOW })
    expect(result.current.videoCallPromptVisible).toBe(false)
  })

  it('ignores a push that is too old to be meant for this student', () => {
    const { result, update } = renderPrompt()
    update({ studentPushedAt: NOW - VIDEO_CALL_PROMPT_STALE_MS - 1 })
    expect(result.current.videoCallPromptVisible).toBe(false)
  })

  it('consumes a push that lands while disabled, so it does not pop up later', () => {
    const { result, update } = renderPrompt({ enabled: false, phase: 'choice' })
    update({ broadcastAt: NOW })
    update({ enabled: true, phase: 'waiting' })
    expect(result.current.videoCallPromptVisible).toBe(false)
  })

  it('dismisses until the next push', () => {
    const { result, update } = renderPrompt()
    update({ broadcastAt: NOW })
    act(() => result.current.dismissVideoCallPrompt())
    expect(result.current.videoCallPromptVisible).toBe(false)
    update({ broadcastAt: NOW + 1 })
    expect(result.current.videoCallPromptVisible).toBe(true)
  })

  it('clears a waiting-room prompt when the lesson starts, and does not bring it back', () => {
    const { result, update } = renderPrompt({ phase: 'waiting' })
    update({ broadcastAt: NOW })
    expect(result.current.videoCallPromptVisible).toBe(true)

    update({ phase: 'lesson' })
    expect(result.current.videoCallPromptVisible).toBe(false)

    // Returning to the same phase later doesn't revive the old prompt.
    update({ phase: 'waiting' })
    expect(result.current.videoCallPromptVisible).toBe(false)
  })

  it('a push after the phase change shows in the new phase', () => {
    const { result, update } = renderPrompt({ phase: 'name-entry' })
    update({ broadcastAt: NOW })
    update({ phase: 'waiting' })
    expect(result.current.videoCallPromptVisible).toBe(false)
    update({ studentPushedAt: NOW + 5 })
    expect(result.current.videoCallPromptVisible).toBe(true)
  })
})
