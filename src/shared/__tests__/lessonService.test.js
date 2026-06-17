import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockSetDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((firestore, name) => ({ firestore, name })),
  doc: vi.fn((firestore, collectionName, id) => ({ firestore, collectionName, id })),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
}))

vi.mock('../firebase', () => ({
  firestore: {},
}))

const { fetchLessonById, fetchLessonList, applyLessonOverride, publishLessonTasks } = await import('../lessonService')

describe('lessonService', () => {
  beforeEach(() => {
    mockGetDoc.mockReset()
    mockGetDocs.mockReset()
    mockSetDoc.mockReset()
  })

  it('loads a lesson from Firestore by id', async () => {
    mockGetDoc.mockResolvedValue({
      id: 'python-1-1',
      exists: () => true,
      data: () => ({ title: 'Python 1.1', type: 'python', tasks: [] }),
    })

    await expect(fetchLessonById('python-1-1')).resolves.toEqual({
      id: 'python-1-1',
      title: 'Python 1.1',
      type: 'python',
      tasks: [],
    })
  })

  it('returns null when Firestore has no matching lesson', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })

    await expect(fetchLessonById('missing')).resolves.toBeNull()
  })

  it('returns null when lessonId is falsy', async () => {
    await expect(fetchLessonById('')).resolves.toBeNull()
    await expect(fetchLessonById(null)).resolves.toBeNull()
  })

  it('sorts Firestore lesson lists by title then id', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'b', data: () => ({ title: 'Zoo' }) },
        { id: 'a', data: () => ({ title: 'Alpha' }) },
      ],
    })

    await expect(fetchLessonList()).resolves.toEqual([
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Zoo' },
    ])
  })
})

describe('applyLessonOverride', () => {
  it('swaps in the override tasks when present', () => {
    const lesson = { id: 'l1', title: 'Lesson', tasks: [{ id: 1 }] }
    const result = applyLessonOverride(lesson, [{ id: 1 }, { id: 2 }])
    expect(result).toEqual({ id: 'l1', title: 'Lesson', tasks: [{ id: 1 }, { id: 2 }] })
  })

  it('returns the lesson unchanged when there is no override', () => {
    const lesson = { id: 'l1', tasks: [{ id: 1 }] }
    expect(applyLessonOverride(lesson, null)).toBe(lesson)
    expect(applyLessonOverride(lesson, undefined)).toBe(lesson)
  })

  it('returns null/undefined lesson unchanged', () => {
    expect(applyLessonOverride(null, [{ id: 1 }])).toBeNull()
  })
})

describe('publishLessonTasks', () => {
  it('merge-writes only the tasks field to the lesson document', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    const tasks = [{ id: 1, title: 'Task' }]

    await publishLessonTasks('python-1-1', tasks)

    expect(mockSetDoc).toHaveBeenCalledWith(
      { firestore: {}, collectionName: 'lessons', id: 'python-1-1' },
      { tasks },
      { merge: true },
    )
  })
})
