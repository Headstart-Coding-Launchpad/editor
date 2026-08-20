import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockSetDoc = vi.fn()
const mockDeleteDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((firestore, name) => ({ firestore, name })),
  doc: vi.fn((firestore, collectionName, id) => ({ firestore, collectionName, id })),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
}))

vi.mock('../firebase', () => ({
  firestore: {},
}))

const { fetchLessonById, fetchLessonList, applyLessonOverride, publishLesson, publishLessonTasks, deletePublishedLesson } = await import('../lessonService')

describe('lessonService', () => {
  beforeEach(() => {
    mockGetDoc.mockReset()
    mockGetDocs.mockReset()
    mockSetDoc.mockReset()
    mockDeleteDoc.mockReset()
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

describe('publishLesson', () => {
  it('writes an encoded full lesson document', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    const lesson = { id: 'scratch-1', type: 'scratch', tasks: [{ id: 1, starterBlocks: { a: 1 } }] }

    await publishLesson(lesson)

    expect(mockSetDoc).toHaveBeenCalledWith(
      { firestore: {}, collectionName: 'lessons', id: 'scratch-1' },
      expect.objectContaining({ id: 'scratch-1', type: 'scratch', tasks: expect.any(Array) }),
    )
  })

  it('rejects lessons without an id', async () => {
    mockSetDoc.mockClear()
    await expect(publishLesson({ type: 'python', tasks: [] })).rejects.toThrow('Lesson id is required')
    expect(mockSetDoc).not.toHaveBeenCalled()
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

describe('deletePublishedLesson', () => {
  it('deletes the lesson document by id', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    mockDeleteDoc.mockResolvedValue(undefined)

    await deletePublishedLesson('python-1-1')

    expect(mockDeleteDoc).toHaveBeenCalledWith(
      { firestore: {}, collectionName: 'lessons', id: 'python-1-1' },
    )
  })

  it('purges the sessionReports and feedback subcollections before deleting the lesson doc', async () => {
    // clearLessonRunData fires clearLessonChildCollection('sessionReports') and
    // ('feedback') via Promise.all — each calls getDocs synchronously in that
    // array order before either await resolves, so mockResolvedValueOnce chaining
    // reliably corresponds to sessionReports first, feedback second.
    const reportRef = { id: 'report-1' }
    const feedbackRef = { id: 'feedback-1' }
    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ ref: reportRef }] })
      .mockResolvedValueOnce({ docs: [{ ref: feedbackRef }] })
    mockDeleteDoc.mockResolvedValue(undefined)

    await deletePublishedLesson('python-1-1')

    expect(mockDeleteDoc).toHaveBeenCalledWith(reportRef)
    expect(mockDeleteDoc).toHaveBeenCalledWith(feedbackRef)
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      { firestore: {}, collectionName: 'lessons', id: 'python-1-1' },
    )
  })

  it('rejects empty lesson ids', async () => {
    mockDeleteDoc.mockClear()
    await expect(deletePublishedLesson('')).rejects.toThrow('Lesson id is required')
    expect(mockDeleteDoc).not.toHaveBeenCalled()
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
