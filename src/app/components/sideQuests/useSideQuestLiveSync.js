import { useEffect, useRef } from 'react'
import { sideQuestUsesFiles, trimSideQuestOutput } from '../../../shared/sideQuests'

/**
 * Mirrors an open side-quest's work to the tutor (students/{id}/sideQuestCode, see
 * src/shared/sideQuests.js), following the activeStudentView rule (AGENTS.md):
 *   - on every Run: the code (or files), `lastRunAt`, and when the run ends its output, Turtle
 *     drawing, run status and `errorStreak` (Runs in a row that hit an error);
 *   - per keystroke and per output change only while `liveSync.watched` (the tutor has this
 *     student's StudentModal open), plus one flush when the tutor starts watching.
 * `liveSync` is null outside a real live lesson: then nothing is written.
 *
 * Returns `beginRun()`, which SideQuestWorkspace calls when the student presses Run.
 */
export function useSideQuestLiveSync({ liveSync, moduleType, cs, loaded }) {
  const usesFiles = sideQuestUsesFiles(moduleType)
  const liveSyncRef = useRef(liveSync)
  liveSyncRef.current = liveSync
  const csRef = useRef(cs)
  csRef.current = cs
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded

  const workPatch = () => {
    const current = csRef.current
    if (usesFiles) {
      return {
        files: Object.fromEntries(
          (current.files ?? [])
            .filter((file) => file && typeof file.name === 'string' && file.name)
            .map((file) => [file.name, String(file.content ?? '')])
        ),
      }
    }
    return { code: current.code ?? '' }
  }
  const runPatch = () => {
    const current = csRef.current
    return {
      output: trimSideQuestOutput(current.output),
      ...(current.turtleResult !== undefined ? { turtleResult: current.turtleResult ?? null } : {}),
    }
  }
  const write = (patch) => {
    if (!loadedRef.current) return
    liveSyncRef.current?.write?.(patch)
  }

  // Runs in a row that hit an error, and the run in progress.
  const streakRef = useRef(0)
  const runRef = useRef({ started: false, errored: false, streakBefore: 0 })

  const beginRun = () => {
    if (!liveSyncRef.current) return
    runRef.current = { started: true, errored: false, streakBefore: streakRef.current }
    // A files module (HTML) has no running phase: the Run is over at once, and a runtime error
    // arrives later (and puts the streak back).
    if (usesFiles) streakRef.current = 0
    write({
      ...workPatch(),
      lastRunAt: true,
      runStatus: usesFiles ? 'success' : 'running',
      ...(usesFiles ? { errorStreak: 0 } : {}),
    })
  }

  const hasError = cs.runStatus === 'error' || cs.htmlErrorLocation != null
  useEffect(() => {
    const run = runRef.current
    if (!hasError || !run.started || run.errored) return
    run.errored = true
    streakRef.current = run.streakBefore + 1
    write({ ...runPatch(), runStatus: 'error', errorStreak: streakRef.current })
  }, [hasError])

  // A Python/Turtle run ending: its output and drawing, and whether it broke the error streak.
  const wasRunningRef = useRef(false)
  useEffect(() => {
    const wasRunning = wasRunningRef.current
    wasRunningRef.current = !!cs.running
    if (!wasRunning || cs.running || !runRef.current.started) return
    if (!runRef.current.errored) streakRef.current = 0
    write({
      ...runPatch(),
      runStatus: runRef.current.errored ? 'error' : (cs.runStatus ?? 'success'),
      errorStreak: streakRef.current,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.running])

  // While the tutor watches: one flush when they start, then every change.
  const watched = !!liveSync?.watched
  useEffect(() => {
    if (!watched || !loaded) return
    write({ ...workPatch(), ...runPatch() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, loaded])

  useEffect(() => {
    if (!watched || !loaded) return
    write(workPatch())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.code, cs.files])

  useEffect(() => {
    if (!watched || !loaded) return
    write(runPatch())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.output, cs.turtleResult])

  return { beginRun }
}
