import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LessonMetaPanel from '../LessonMetaPanel'

const lessonAssets = vi.fn((_id, type) => [`${type}-asset.png`])

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
}))
vi.mock('../../../shared/firebase', () => ({ firestore: {} }))
vi.mock('../../../shared/useAssets', () => ({
  useAssets: () => ({ lessonAssets, loading: false }),
}))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], refresh: () => {} }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ role: 'teacher' }) }))
vi.mock('../LessonTopicSummary', () => ({ default: () => null }))

describe('LessonMetaPanel asset auto-population', () => {
  it('asks for every module type of a composed lesson and merges the results', () => {
    const lesson = {
      id: 'k3f9x2qp7a',
      type: 'composed',
      title: 'Mixed',
      description: '',
      assetsPath: '/assets/k3f9x2qp7a/',
      tasks: [
        { id: 1, moduleType: 'python', title: 'Py' },
        { id: 2, moduleType: 'scratch', title: 'Sc' },
      ],
    }
    let current = lesson
    const onUpdate = vi.fn((updater) => {
      current = typeof updater === 'function' ? updater(current) : updater
    })
    render(<LessonMetaPanel lesson={lesson} onUpdate={onUpdate} />)

    expect(lessonAssets).toHaveBeenCalledWith('k3f9x2qp7a', 'python')
    expect(lessonAssets).toHaveBeenCalledWith('k3f9x2qp7a', 'scratch')
    expect(lessonAssets).not.toHaveBeenCalledWith('k3f9x2qp7a', 'composed')
    expect(current.assets).toEqual(['python-asset.png', 'scratch-asset.png'])
  })
})
