import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((firestore, name) => ({ firestore, name })),
  doc: vi.fn((firestore, collectionName, id) => ({ firestore, collectionName, id })),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
}))

vi.mock('../firebase', () => ({
  firestore: {},
}))

const { fetchLessonById, fetchLessonList } = await import('../lessonService')

describe('lessonService', () => {
  beforeEach(() => {
    mockGetDoc.mockReset()
    mockGetDocs.mockReset()
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
