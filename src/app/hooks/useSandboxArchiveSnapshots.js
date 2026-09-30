import { useEffect, useRef } from 'react'
import { decodeFileKey } from '../../shared/fileKeys'

/** Each student's current `lastRunAt` (anonymousId → time), the baseline a visit starts from. */
export function lastRunTimes(students) {
  return Object.fromEntries(
    Object.entries(students ?? {}).map(([anonymousId, student]) => [
      anonymousId,
      student?.lastRunAt ?? null,
    ])
  )
}

/**
 * The students whose sandbox work should be archived now: each student whose `lastRunAt` has
 * changed since `seen`, with the work their run wrote (`currentCode`, or `currentFiles` decoded
 * to a filename → content map). Pure. Compares run times only with each other, never with the
 * teacher's clock, so clock skew between devices can't hide a run.
 */
export function pendingSandboxSnapshots(students, { seen = {} } = {}) {
  return Object.entries(students ?? {}).flatMap(([anonymousId, student]) => {
    const at = student?.lastRunAt
    if (at == null || (seen[anonymousId] ?? null) === at) return []
    const files = student.currentFiles
    const hasFiles = !!files && typeof files === 'object' && Object.keys(files).length > 0
    const code = typeof student.currentCode === 'string' ? student.currentCode : null
    if (!hasFiles && !code) return []
    return [
      {
        anonymousId,
        at,
        ...(hasFiles
          ? {
              files: Object.fromEntries(
                Object.entries(files).map(([key, content]) => [decodeFileKey(key), content])
              ),
            }
          : { code }),
      },
    ]
  })
}

/**
 * Teacher side of the sandbox archive: while the class is in the teacher sandbox, copies each
 * student's latest sandbox work into `sessionArchive` whenever one of their sandbox runs updates
 * it (a new `lastRunAt`). The students write nothing new and there is no timer: the copy comes
 * from the `currentCode` / `currentFiles` every sandbox run already writes. A visit starts from
 * the run times already there (a run from before the sandbox is not sandbox work); a teacher
 * reload mid-visit does the same, so work already archived is not copied again.
 */
export function useSandboxArchiveSnapshots({ session, archiveSandboxStudentSnapshot }) {
  const seenRef = useRef({})
  const visitRef = useRef(null)
  const enteredAt =
    session?.state === 'sandbox' && session?.sandboxEnteredAt != null
      ? session.sandboxEnteredAt
      : null
  const students = session?.students

  useEffect(() => {
    if (visitRef.current !== enteredAt) {
      visitRef.current = enteredAt
      seenRef.current = lastRunTimes(students)
      return
    }
    if (enteredAt == null) return
    for (const snapshot of pendingSandboxSnapshots(students, { seen: seenRef.current })) {
      seenRef.current[snapshot.anonymousId] = snapshot.at
      const { anonymousId, ...work } = snapshot
      archiveSandboxStudentSnapshot?.(anonymousId, work)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredAt, students])
}
