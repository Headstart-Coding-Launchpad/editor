// Share links made for every student when the tutor ends a live session (request #77): one
// name-hidden, read-only link per student who has work, for their last code task with work,
// using the same snapshot as Export work's share (#59, ./shareService.js). The links are saved
// in the session report (`shareLinks`), listed on the report screen and read back by
// `lessons share-links` in the CLI. Nothing is sent anywhere.
import { collectExportItems, exportableTasks } from './collect.js'
import { exportContext } from './runExport.js'
import { studentShareKey } from './shareLink.js'

// End Session waits for the links at most this long, then goes on without the rest.
export const SESSION_SHARE_TIMEOUT_MS = 15000

/** Every student the session knows of: the live roster and anyone with a logged attempt. */
export function sessionStudents(session) {
  const roster = session?.students ?? {}
  const ids = new Set([...Object.keys(roster), ...Object.keys(session?.attemptLog ?? {})])
  return [...ids].map((anonymousId) => ({ ...(roster[anonymousId] ?? {}), anonymousId }))
}

/**
 * Makes the links. `getExporter(type)` is a loaded exporter, `create(args)` is createShareLink
 * and `urlFor(id)` the public URL. Returns one entry per link made, in roster order:
 * `{ studentKey, kind, taskId, taskTitle, shareId, url, expiresAt }`, or `{ studentKey, error }`
 * when a student's work couldn't be shared (too big, or the write failed).
 */
export async function makeSessionShareLinks({
  lesson,
  session,
  uid,
  hasExporter,
  getExporter,
  create,
  urlFor,
}) {
  const candidates = exportableTasks(lesson, session, hasExporter)
  if (!candidates.length || !uid) return []
  const jobs = sessionStudents(session).map(async (student) => {
    const items = collectExportItems({ candidates, session, student, getExporter })
    // The last task in lesson order with work: where the student got to.
    const item = items.at(-1)
    if (!item) return null
    const studentKey = studentShareKey(student.anonymousId)
    try {
      const ctx = exportContext(item, { date: new Date(), displayName: '', includeName: false })
      const payload = item.exporter.sharePayload?.(item, ctx)
      if (payload == null) return null
      const created = await create({
        kind: item.moduleType,
        title: item.task.title,
        payload,
        uid,
      })
      if (!created.ok) return { studentKey, error: created.message }
      return {
        studentKey,
        kind: item.moduleType,
        taskId: item.task.id,
        taskTitle: item.task.title ?? null,
        shareId: created.id,
        url: urlFor(created.id),
        expiresAt: created.expiresAtMs,
      }
    } catch (error) {
      return { studentKey, error: error?.message ?? String(error) }
    }
  })
  return (await Promise.all(jobs)).filter(Boolean)
}

/** Resolves to `fallback` if `promise` takes longer than `ms`. */
export function withTimeout(promise, ms, fallback) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms)
    }),
  ])
}
