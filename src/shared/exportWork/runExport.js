// Runs an "Export work" (ExportWorkDialog): asks each item's module exporter for its code files
// and pictures, then hands back one download — the file itself when there is only one, else a
// .zip of everything. Problems become notes for the tutor; one failing task never stops the rest.
import { resolveAssetsPath } from '../assetPaths'
import { exportFileStem } from './naming.js'
import { buildZip } from './zip.js'

const MIME = {
  py: 'text/x-python',
  html: 'text/html',
  json: 'application/json',
  png: 'image/png',
  zip: 'application/zip',
  sb3: 'application/x.scratch.sb3',
}

export function mimeForName(name) {
  const ext = String(name).split('.').pop().toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

/** The ctx an exporter gets for one item (see ./exporters.js). */
export function exportContext(item, { date, displayName, includeName, options = {} }, index = 0) {
  return {
    stem: exportFileStem({
      title: item.task?.title,
      date,
      displayName,
      includeName,
      fallback: `task-${index + 1}`,
    }),
    assetsPath: resolveAssetsPath(item.taskLesson?.assetsPath) || '',
    includeLaunchPadCopy: true,
    options,
  }
}

/**
 * Builds every file for `items`. `options`: { code, pictures, htmlSingleFile }.
 * Returns { files, notes, download: { name, data, mime } | null }.
 */
export async function runExport({
  items,
  options = {},
  includeName = false,
  displayName = '',
  bundleTitle = '',
  date = new Date(),
  onProgress = null,
}) {
  const files = []
  const notes = []
  for (const [index, item] of (items ?? []).entries()) {
    const ctx = exportContext(item, { date, displayName, includeName, options }, index)
    const label = item.task?.title || `Task ${index + 1}`
    onProgress?.(label)
    if (options.code !== false) {
      try {
        const result = await item.exporter.buildFiles(item, ctx)
        files.push(...(result?.files ?? []))
        notes.push(...(result?.notes ?? []))
      } catch (error) {
        notes.push(`${label}: couldn't make the code files (${error.message}).`)
      }
    }
    if (options.pictures !== false && typeof item.exporter.buildPictures === 'function') {
      try {
        const result = await item.exporter.buildPictures(item, ctx)
        files.push(...(result?.files ?? []))
        notes.push(...(result?.notes ?? []))
      } catch (error) {
        notes.push(`${label}: couldn't make the pictures (${error.message}).`)
      }
    }
  }
  if (!files.length) return { files, notes, download: null }
  if (files.length === 1) {
    const [file] = files
    return { files, notes, download: { ...file, mime: mimeForName(file.name) } }
  }
  const stem = exportFileStem({
    title: bundleTitle,
    date,
    displayName,
    includeName,
    fallback: 'work',
  })
  const zip = await buildZip(files)
  return { files, notes, download: { name: `${stem}.zip`, data: zip, mime: MIME.zip } }
}
