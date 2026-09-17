import { useEffect, useRef } from 'react'

// Runs `run` once for each pending teacher remote "Run" request token
// (cs.remoteRunToken, see useStudentCodeState's remoteRunPushedAt effect).
// Each module workspace passes the same function its own Run button calls,
// so a remote run behaves exactly like the student pressing Run. The token is
// then acknowledged (`onHandled`, normally cs.acknowledgeRemoteRun) back to
// null, so a workspace that mounts later — after a task switch or layout
// change — never replays a request that was already handled.
export function useRemoteRunTrigger(token, run, { enabled = true, onHandled } = {}) {
  const handledTokenRef = useRef(null)
  const runRef = useRef(run)
  runRef.current = run
  const onHandledRef = useRef(onHandled)
  onHandledRef.current = onHandled

  useEffect(() => {
    if (token == null || handledTokenRef.current === token) return
    handledTokenRef.current = token
    if (enabled) runRef.current?.()
    onHandledRef.current?.(token)
  }, [token, enabled])
}
