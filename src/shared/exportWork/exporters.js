// The module side of "Export work". A module opts in from its UI half (index.js) with
//
//   exportWork: () => import('./exportWork.js')
//
// a lazy loader (so export code, fflate and canvas helpers stay out of the main bundle) whose
// default export is the module's exporter:
//
//   readLive(student, task) → work | null       the current task's live mirror (StudentModal)
//   readSubmission(submission, task) → work | null   a logged attempt's submission string
//   buildFiles(item, ctx) → Promise<{ files, notes }>      code files ({ name, data })
//   buildPictures(item, ctx) → Promise<{ files, notes }>   optional: PNG pictures
//   sharePayload(item, ctx) → payload | null    the frozen snapshot a share link stores
//   ShareView                                   the read-only viewer for `/share/:id`
//
// `item` is { task, taskLesson, moduleType, work, source } (see ./collect.js) and `ctx` is
// { stem, assetsPath, includeLaunchPadCopy }: `stem` starts every file name (./naming.js). New
// modules (e.g. the Python Stage) plug pictures in by adding `buildPictures`.
import { getLessonModule } from '../../modules/registry'

/** Whether a module type declares the export hook. */
export function hasExporter(type) {
  return typeof getLessonModule(type)?.exportWork === 'function'
}

const cache = new Map()

/** Loads a module's exporter (cached), or null when the module has none. */
export async function loadExporter(type) {
  const loader = getLessonModule(type)?.exportWork
  if (typeof loader !== 'function') return null
  if (!cache.has(type)) {
    cache.set(
      type,
      loader().then((mod) => mod?.default ?? null)
    )
  }
  return cache.get(type)
}

/** Loads the exporters for a set of module types: `{ type: exporter }`. */
export async function loadExporters(types) {
  const unique = [...new Set(types)]
  const loaded = await Promise.all(unique.map((type) => loadExporter(type)))
  return Object.fromEntries(unique.map((type, index) => [type, loaded[index]]))
}
