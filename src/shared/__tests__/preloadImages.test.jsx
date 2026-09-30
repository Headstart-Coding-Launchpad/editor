import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectTaskImageUrls,
  markdownImageUrls,
  preloadImages,
  resetPreloadedImages,
  usePreloadNeighbourImages,
} from '../preloadImages'

const origin = window.location.origin

describe('markdownImageUrls', () => {
  it('finds image URLs, with or without a title or angle brackets', () => {
    const text = [
      'Intro ![cat](https://cdn.test/cat.png) text',
      '![](<https://cdn.test/dog.png> "A dog")',
      "![bird](https://cdn.test/bird.png 'title')",
      '[not an image](https://cdn.test/link.png)',
    ].join('\n')
    expect(markdownImageUrls(text)).toEqual([
      'https://cdn.test/cat.png',
      'https://cdn.test/dog.png',
      'https://cdn.test/bird.png',
    ])
  })

  it('returns nothing for text without images', () => {
    expect(markdownImageUrls('plain')).toEqual([])
    expect(markdownImageUrls(undefined)).toEqual([])
  })
})

describe('collectTaskImageUrls', () => {
  it('collects Markdown images from the explainer, recap column and description', () => {
    const task = {
      explainer: '![a](https://cdn.test/a.png)',
      leftContent: '![b](https://cdn.test/b.png)',
      description: '![a again](https://cdn.test/a.png)',
    }
    expect(collectTaskImageUrls(task, {})).toEqual([
      'https://cdn.test/a.png',
      'https://cdn.test/b.png',
    ])
  })

  it('resolves relative Markdown images against the page', () => {
    const [url] = collectTaskImageUrls({ explainer: '![x](/img/x.png)' }, {})
    expect(url).toBe(`${origin}/img/x.png`)
  })

  it('collects Scratch costumes and backdrops from the lesson assets path, skipping emoji', () => {
    const task = {
      sprites: [
        { name: 'Cat', costumes: [{ image: 'cat1.png' }, { emoji: '🐱' }] },
        { name: 'Ball', emoji: '⚽' },
      ],
      backdrops: [{ image: 'https://cdn.test/sky.png' }, { name: 'plain' }],
    }
    const urls = collectTaskImageUrls(task, { assetsPath: '/lessons/space' })
    expect(urls).toHaveLength(2)
    expect(urls[0]).toMatch(/lessons\/space\/cat1\.png$/)
    expect(urls[1]).toBe('https://cdn.test/sky.png')
  })

  it('skips data URLs and a missing task', () => {
    expect(collectTaskImageUrls({ explainer: '![x](data:image/png;base64,AAA)' }, {})).toEqual([])
    expect(collectTaskImageUrls(null, {})).toEqual([])
  })
})

describe('preloading', () => {
  let created

  beforeEach(() => {
    created = []
    resetPreloadedImages()
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          created.push(this)
        }
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('requests each URL once per page load', () => {
    preloadImages(['https://cdn.test/a.png', 'https://cdn.test/a.png'])
    preloadImages(['https://cdn.test/a.png', 'https://cdn.test/b.png'])
    expect(created.map((img) => img.src)).toEqual([
      'https://cdn.test/a.png',
      'https://cdn.test/b.png',
    ])
  })

  it('preloads the tasks either side once idle, not the current one', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const flatTasks = [
      { id: 1, explainer: '![p](https://cdn.test/prev.png)' },
      { id: 2, explainer: '![c](https://cdn.test/current.png)' },
      { id: 3, explainer: '![n](https://cdn.test/next.png)' },
    ]
    renderHook(() => usePreloadNeighbourImages({ tasks: flatTasks }, flatTasks, 1))
    expect(created).toHaveLength(0)
    vi.runAllTimers()
    expect(created.map((img) => img.src)).toEqual([
      'https://cdn.test/next.png',
      'https://cdn.test/prev.png',
    ])
  })

  it('does nothing without a lesson or when the task is not found', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const flatTasks = [{ id: 1, explainer: '![x](https://cdn.test/x.png)' }]
    renderHook(() => usePreloadNeighbourImages(null, flatTasks, 0))
    renderHook(() => usePreloadNeighbourImages({ tasks: flatTasks }, flatTasks, -1))
    vi.runAllTimers()
    expect(created).toHaveLength(0)
  })
})
