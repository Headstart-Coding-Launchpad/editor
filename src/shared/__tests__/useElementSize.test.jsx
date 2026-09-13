import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import { useElementSize } from '../useElementSize'

// Stubs ResizeObserver so the test can trigger callbacks manually and inspect which
// instance is observing what — mirrors the pattern used in QuizTask.test.jsx for the
// same reason (jsdom's own ResizeObserver never actually fires callbacks). Tracks every
// constructed instance, since a re-subscribe creates a new one.
function stubResizeObserver() {
  const original = globalThis.ResizeObserver
  const instances = []
  globalThis.ResizeObserver = class {
    constructor(cb) {
      this.cb = cb
      this.disconnected = false
      instances.push(this)
    }
    observe(node) {
      this.node = node
    }
    disconnect() {
      this.disconnected = true
    }
  }
  return {
    instances,
    fire: (instance, contentRect) => instance.cb([{ contentRect }]),
    restore: () => {
      globalThis.ResizeObserver = original
    },
  }
}

function Probe({ onSize }) {
  const [ref, size] = useElementSize()
  onSize(size)
  return <div ref={ref} />
}

describe('useElementSize', () => {
  let observer
  afterEach(() => observer?.restore())

  it('starts at zero before any measurement', () => {
    observer = stubResizeObserver()
    const sizes = []
    render(<Probe onSize={(s) => sizes.push(s)} />)
    expect(sizes[0]).toEqual({ width: 0, height: 0 })
  })

  it('updates to the observed content-box size', () => {
    observer = stubResizeObserver()
    const sizes = []
    render(<Probe onSize={(s) => sizes.push(s)} />)

    act(() => observer.fire(observer.instances[0], { width: 640, height: 480 }))

    expect(sizes.at(-1)).toEqual({ width: 640, height: 480 })
  })

  // Regression test: TaskSlideTransition.jsx keys its child wrapper by task, swapping
  // in a brand-new DOM node on every task change without the *owning* component (which
  // holds this hook's state) remounting. A plain `useRef` + mount-only `useEffect(...,
  // [])` would keep watching the old, now-detached node forever, freezing the reported
  // size at whatever it was on the very first task.
  it('re-subscribes when the DOM node is swapped for a new one without the owning component remounting', () => {
    observer = stubResizeObserver()
    const sizes = []
    function KeyedProbe({ nodeKey }) {
      const [ref, size] = useElementSize()
      sizes.push(size)
      return <div key={nodeKey} ref={ref} />
    }

    const { rerender } = render(<KeyedProbe nodeKey="task-1" />)
    expect(observer.instances).toHaveLength(1)
    act(() => observer.fire(observer.instances[0], { width: 500, height: 400 }))
    expect(sizes.at(-1)).toEqual({ width: 500, height: 400 })

    // Same owning component instance, but a different key on the ref'd element —
    // React tears down the old DOM node and mounts a fresh one at this position.
    rerender(<KeyedProbe nodeKey="task-2" />)

    expect(observer.instances).toHaveLength(2)
    expect(observer.instances[0].disconnected).toBe(true)

    act(() => observer.fire(observer.instances[1], { width: 300, height: 200 }))
    expect(sizes.at(-1)).toEqual({ width: 300, height: 200 })
  })
})
