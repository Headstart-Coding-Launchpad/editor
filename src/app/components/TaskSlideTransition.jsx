import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from 'react'
import { MOTION_MS } from '../../shared/motion'

// Matches the `--motion-slow` duration of the task-slide keyframes in index.css.
export const TASK_TRANSITION_MS = MOTION_MS.slow

// The leaving panel re-renders the previous task's element tree in a new position, so React
// remounts it — with that task's stale props and callbacks. Stateful workspaces read this to
// stay a purely visual snapshot (e.g. a Scratch workspace re-evaluating the previous task's
// after_block_placed checks on mount would otherwise report "passed" onto the new task).
const TaskSlideLeavingContext = createContext(false)

export function useIsLeavingTaskSlide() {
  return useContext(TaskSlideLeavingContext)
}

function isOrder(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * 'backward' when moving to an earlier task (both orders known and the new one is lower),
 * otherwise 'forward' — including an unknown order (the personal sandbox) or the same one
 * (a phase change on the same task).
 */
export function getTaskSlideDirection(previousOrder, nextOrder) {
  return isOrder(previousOrder) && isOrder(nextOrder) && nextOrder < previousOrder
    ? 'backward'
    : 'forward'
}

/**
 * Slides the new task in when `transitionKey` changes, with the previous task sliding out.
 * `order` is the task's position in the lesson (its flat index): moving forward, the new task
 * enters from the right and the old one leaves to the left; moving back, the reverse.
 */
export default function TaskSlideTransition({ transitionKey, order, children, style }) {
  const previousRenderRef = useRef({ key: transitionKey, order, children })
  const [leavingRender, setLeavingRender] = useState(null)
  const [direction, setDirection] = useState('forward')
  // The entering panel travels in from off to one side, so the viewport clips while it's
  // sliding: on mount as well as on every task change.
  const [sliding, setSliding] = useState(true)

  // Decided during the render that changes the key, so the new panel never paints with the
  // previous move's direction. The class then stays fixed for the panel's life: changing it
  // after the animation ends would restart it.
  const keyChanged = previousRenderRef.current.key !== transitionKey
  const activeDirection = keyChanged
    ? getTaskSlideDirection(previousRenderRef.current.order, order)
    : direction

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSliding(false), TASK_TRANSITION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useLayoutEffect(() => {
    if (previousRenderRef.current.key === transitionKey) return undefined

    const nextDirection = getTaskSlideDirection(previousRenderRef.current.order, order)
    setDirection(nextDirection)
    setLeavingRender({ ...previousRenderRef.current, direction: nextDirection })
    setSliding(true)
    previousRenderRef.current = { key: transitionKey, order, children }

    const timeoutId = window.setTimeout(() => {
      setLeavingRender(null)
      setSliding(false)
    }, TASK_TRANSITION_MS)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey])

  useEffect(() => {
    if (!leavingRender && previousRenderRef.current.key === transitionKey) {
      previousRenderRef.current = { key: transitionKey, order, children }
    }
  }, [transitionKey, order, children, leavingRender])

  const clip = sliding || !!leavingRender || keyChanged

  return (
    <div
      className="task-slide-viewport"
      style={{ ...style, overflow: clip ? 'hidden' : style?.overflow }}
    >
      {leavingRender && (
        <div
          key={`leaving-${leavingRender.key}`}
          className={`task-slide-panel task-slide-panel--leaving task-slide-panel--${leavingRender.direction}`}
          aria-hidden="true"
        >
          <TaskSlideLeavingContext.Provider value={true}>
            {leavingRender.children}
          </TaskSlideLeavingContext.Provider>
        </div>
      )}
      <div
        key={`entering-${transitionKey}`}
        className={`task-slide-panel task-slide-panel--entering task-slide-panel--${activeDirection}`}
      >
        {children}
      </div>
    </div>
  )
}
