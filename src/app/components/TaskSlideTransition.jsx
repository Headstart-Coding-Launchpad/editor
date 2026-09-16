import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from 'react'

const TASK_TRANSITION_MS = 380

// The leaving panel re-renders the previous task's element tree in a new position, so React
// remounts it — with that task's stale props and callbacks. Stateful workspaces read this to
// stay a purely visual snapshot (e.g. a Scratch workspace re-evaluating the previous task's
// after_block_placed checks on mount would otherwise report "passed" onto the new task).
const TaskSlideLeavingContext = createContext(false)

export function useIsLeavingTaskSlide() {
  return useContext(TaskSlideLeavingContext)
}

export default function TaskSlideTransition({ transitionKey, children, style }) {
  const previousRenderRef = useRef({ key: transitionKey, children })
  const [leavingRender, setLeavingRender] = useState(null)

  useLayoutEffect(() => {
    if (previousRenderRef.current.key === transitionKey) return undefined

    setLeavingRender(previousRenderRef.current)
    previousRenderRef.current = { key: transitionKey, children }

    const timeoutId = window.setTimeout(() => {
      setLeavingRender(null)
    }, TASK_TRANSITION_MS)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey])

  useEffect(() => {
    if (!leavingRender && previousRenderRef.current.key === transitionKey) {
      previousRenderRef.current = { key: transitionKey, children }
    }
  }, [transitionKey, children, leavingRender])

  return (
    <div
      className="task-slide-viewport"
      style={{ ...style, overflow: leavingRender ? 'hidden' : style?.overflow }}
    >
      {leavingRender && (
        <div
          key={`leaving-${leavingRender.key}`}
          className="task-slide-panel task-slide-panel--leaving"
          aria-hidden="true"
        >
          <TaskSlideLeavingContext.Provider value={true}>
            {leavingRender.children}
          </TaskSlideLeavingContext.Provider>
        </div>
      )}
      <div
        key={`entering-${transitionKey}`}
        className="task-slide-panel task-slide-panel--entering"
      >
        {children}
      </div>
    </div>
  )
}
