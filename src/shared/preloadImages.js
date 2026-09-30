import { useEffect } from 'react'
import { resolveAssetFileUrl, resolveAssetsPath } from './assetPaths'
import { getEffectiveLessonForTask } from './composedLesson'

/**
 * Background image preloading, so moving to the next or previous task doesn't show its images
 * popping in after the slide. URLs are built exactly as the task screen builds them (Markdown
 * as authored; Scratch costumes and backdrops via resolveAssetFileUrl), so the browser cache
 * serves the real load.
 */

// Markdown fields a task screen renders with images: the explainer (quizzes and activities show
// theirs too), an information task's recap column, an activity's description.
const MARKDOWN_FIELDS = ['explainer', 'leftContent', 'description']

// `![alt](url)` and `![alt](<url> "title")`; the URL is the first token inside the brackets.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g

/** Image URLs in Markdown text, as authored. */
export function markdownImageUrls(text) {
  if (typeof text !== 'string' || !text.includes('![')) return []
  return [...text.matchAll(MARKDOWN_IMAGE)].map((match) => match[1])
}

function absoluteUrl(src) {
  if (!src || /^(data|blob):/i.test(src)) return null
  try {
    return new URL(src, window.location.href).href
  } catch {
    return null
  }
}

/**
 * Every image URL the task screen loads for `task`: Markdown images in its explainer and
 * content, and its Scratch costumes and backdrops (emoji and vector sprites have none).
 * `lesson` is the task's effective lesson (composed lessons: `getEffectiveLessonForTask`).
 */
export function collectTaskImageUrls(task, lesson) {
  if (!task) return []
  const urls = new Set()
  const add = (url) => {
    const absolute = absoluteUrl(url)
    if (absolute) urls.add(absolute)
  }

  for (const field of MARKDOWN_FIELDS) markdownImageUrls(task[field]).forEach(add)

  const assetsPath = resolveAssetsPath(lesson?.assetsPath) || undefined
  const addAsset = (path) => {
    if (path) add(resolveAssetFileUrl(assetsPath, path))
  }
  for (const sprite of Array.isArray(task.sprites) ? task.sprites : []) {
    for (const costume of sprite?.costumes ?? []) addAsset(costume?.image)
  }
  for (const backdrop of Array.isArray(task.backdrops) ? task.backdrops : []) {
    addAsset(backdrop?.image)
  }

  return [...urls]
}

// Requested this page load, so a URL is fetched once however often it's asked for.
const requested = new Set()

/** Fetch each URL in the background at low priority, once per page load. */
export function preloadImages(urls) {
  if (typeof Image === 'undefined') return
  for (const url of urls) {
    if (!url || requested.has(url)) continue
    requested.add(url)
    const img = new Image()
    img.decoding = 'async'
    if ('fetchPriority' in img) img.fetchPriority = 'low'
    img.src = url
  }
}

/** Forget what was requested (tests). */
export function resetPreloadedImages() {
  requested.clear()
}

function whenIdle(callback) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 2000 })
    return () => window.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(callback, 300)
  return () => window.clearTimeout(id)
}

/**
 * Once the browser is idle after arriving on `flatTasks[index]`, preloads the images of the
 * tasks either side of it. `lesson` is the whole lesson; each neighbour's own effective lesson is
 * worked out here, so composed lessons get the right assets path.
 */
export function usePreloadNeighbourImages(lesson, flatTasks, index) {
  const previousTask = index > 0 ? flatTasks?.[index - 1] : null
  const nextTask = index >= 0 ? flatTasks?.[index + 1] : null

  useEffect(() => {
    if (!lesson || (!previousTask && !nextTask)) return undefined
    return whenIdle(() => {
      for (const task of [nextTask, previousTask]) {
        if (!task) continue
        preloadImages(collectTaskImageUrls(task, getEffectiveLessonForTask(lesson, task)))
      }
    })
  }, [lesson, previousTask, nextTask])
}
