import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLessonLoader } from '../useLessonLoader'

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}))

vi.mock('../../../shared/firebase', () => ({
  firestore: {},
}))

import { getDoc } from 'firebase/firestore'

const LESSON_PYTHON = {
  id: 'py-1',
  type: 'python',
  title: 'Intro to Python',
  tasks: [
    { id: 1, title: 'Task 1', taskType: 'coding' },
    { id: 2, title: 'Task 2', taskType: 'coding' },
  ],
}

function makeSnap(exists, data = null) {
  return { exists: () => exists, data: () => data }
}

describe('useLessonLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses lessonProp directly without hitting Firestore', async () => {
    const { result } = renderHook(() => useLessonLoader('py-1', LESSON_PYTHON, null))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.lesson).toEqual(LESSON_PYTHON)
    expect(getDoc).not.toHaveBeenCalled()
  })

  it('resolves firstTaskId from lessonProp tasks when initialTaskId is null', async () => {
    const { result } = renderHook(() => useLessonLoader('py-1', LESSON_PYTHON, null))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.firstTaskId).toBe(1)
  })

  it('uses the provided initialTaskId over the first task', async () => {
    const { result } = renderHook(() => useLessonLoader('py-1', LESSON_PYTHON, 2))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.firstTaskId).toBe(2)
  })

  it('fetches from Firestore when no lessonProp is given', async () => {
    getDoc.mockResolvedValue(makeSnap(true, LESSON_PYTHON))

    const { result } = renderHook(() => useLessonLoader('py-1', null, null))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.lesson).toEqual(LESSON_PYTHON)
    expect(getDoc).toHaveBeenCalledTimes(1)
  })

  it('leaves lesson null when Firestore document does not exist', async () => {
    getDoc.mockResolvedValue(makeSnap(false))

    const { result } = renderHook(() => useLessonLoader('missing-lesson', null, null))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.lesson).toBeNull()
  })

  it('leaves lesson null and clears loading when Firestore throws', async () => {
    getDoc.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useLessonLoader('py-1', null, null))

    await waitFor(() => expect(result.current.lessonLoading).toBe(false))

    expect(result.current.lesson).toBeNull()
  })

  it('starts with lessonLoading true before Firestore resolves', () => {
    getDoc.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useLessonLoader('py-1', null, null))

    expect(result.current.lessonLoading).toBe(true)
    expect(result.current.lesson).toBeNull()
  })

  it('re-fetches when lessonId changes', async () => {
    getDoc.mockResolvedValue(makeSnap(true, LESSON_PYTHON))

    const { result, rerender } = renderHook(
      ({ lessonId }) => useLessonLoader(lessonId, null, null),
      { initialProps: { lessonId: 'py-1' } }
    )

    await waitFor(() => expect(result.current.lesson).toBeTruthy())
    expect(getDoc).toHaveBeenCalledTimes(1)

    const LESSON_2 = { ...LESSON_PYTHON, id: 'py-2', title: 'Lesson 2' }
    getDoc.mockResolvedValue(makeSnap(true, LESSON_2))
    rerender({ lessonId: 'py-2' })

    await waitFor(() => expect(result.current.lesson?.title).toBe('Lesson 2'))
    expect(getDoc).toHaveBeenCalledTimes(2)
  })
})
