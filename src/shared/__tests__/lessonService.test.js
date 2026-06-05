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
    vi.unstubAllGlobals()
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

  it('falls back to static lesson JSON when Firestore errors', async () => {
    mockGetDoc.mockRejectedValue(new Error('unavailable'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'python-1-1', title: 'Static lesson', type: 'python', tasks: [] }),
    }))

    await expect(fetchLessonById('python-1-1')).resolves.toMatchObject({
      id: 'python-1-1',
      title: 'Static lesson',
    })
    expect(fetch).toHaveBeenCalledWith('/lessons/python-1-1.json')
  })

  it('falls back to static lesson JSON when Firestore does not resolve in time', async () => {
    mockGetDoc.mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'Timed fallback', type: 'python', tasks: [] }),
    }))

    await expect(fetchLessonById('python-1-1', { timeoutMs: 1 })).resolves.toMatchObject({
      id: 'python-1-1',
      title: 'Timed fallback',
    })
  })

  it('returns null when neither Firestore nor static JSON has the lesson', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchLessonById('missing')).resolves.toBeNull()
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
