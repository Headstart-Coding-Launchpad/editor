import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCrossTabPresence } from '../useCrossTabPresence'

describe('useCrossTabPresence', () => {
  it('detects a peer tab already listening on the same lesson+student channel', async () => {
    const peer = new BroadcastChannel('headstart_presence_lesson-1_student-1')
    peer.onmessage = (event) => {
      if (event.data?.type === 'ping') peer.postMessage({ type: 'pong' })
    }

    const { result } = renderHook(() => useCrossTabPresence('lesson-1', 'student-1'))

    await waitFor(() => expect(result.current).toBe(true))
    peer.close()
  })

  it('detects a peer tab that opens after this one has already mounted', async () => {
    const { result } = renderHook(() => useCrossTabPresence('lesson-2', 'student-1'))
    expect(result.current).toBe(false)

    const peer = new BroadcastChannel('headstart_presence_lesson-2_student-1')
    peer.postMessage({ type: 'ping' })

    await waitFor(() => expect(result.current).toBe(true))
    peer.close()
  })

  it('does not react to a tab for a different student or lesson', async () => {
    const peer = new BroadcastChannel('headstart_presence_lesson-3_student-other')
    peer.onmessage = (event) => {
      if (event.data?.type === 'ping') peer.postMessage({ type: 'pong' })
    }

    const { result } = renderHook(() => useCrossTabPresence('lesson-3', 'student-1'))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current).toBe(false)
    peer.close()
  })

  it('stays false without a lessonId or anonymousId', async () => {
    const { result: noLesson } = renderHook(() => useCrossTabPresence(null, 'student-1'))
    const { result: noStudent } = renderHook(() => useCrossTabPresence('lesson-4', null))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(noLesson.current).toBe(false)
    expect(noStudent.current).toBe(false)
  })
})
