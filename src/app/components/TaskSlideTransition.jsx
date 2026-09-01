import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'

const TASK_TRANSITION_MS = 380

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
    <div className="task-slide-viewport" style={{ ...style, overflow: leavingRender ? 'hidden' : style?.overflow }}>
      {leavingRender && (
        <div
          key={`leaving-${leavingRender.key}`}
          className="task-slide-panel task-slide-panel--leaving"
          aria-hidden="true"
        >
          {leavingRender.children}
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
