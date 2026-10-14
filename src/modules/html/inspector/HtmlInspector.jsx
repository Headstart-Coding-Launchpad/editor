// The HTML Inspector on the preview (task field `inspector`, ./config.js). Drawn by the parent
// page over the iframe — nothing is ever added to the student's page, so html_* checks and the
// page itself never see it. The preview iframe is same-origin (IframePreview's sandbox keeps
// allow-same-origin), so the parent reads the page's layout and stylesheets directly.
//
// useHtmlInspector returns the Inspect toggle (for the preview header) and the layer (overlay +
// panel, ./InspectorLayer.jsx) to place over the iframe. With `live` set it follows that state
// read-only (a Go Live viewer following the tutor); otherwise it reports its state through
// `onLiveChange` and each use through `onUse('open' | 'select')`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_INSPECTOR_PROPERTY, normalizeInspectorLiveState } from './config'
import { isInspectable, resolveSelector, selectorPathFor } from './selectorPath'
import InspectorLayer from './InspectorLayer'

export function useHtmlInspector({
  iframeRef,
  src,
  visible = true,
  config = null,
  live,
  onLiveChange,
  onUse,
}) {
  const enabled = !!config?.enabled
  const following = live !== undefined
  const [localOn, setLocalOn] = useState(() => !!config?.open)
  const [localPath, setLocalPath] = useState(null)
  const [localProperty, setLocalProperty] = useState(DEFAULT_INSPECTOR_PROPERTY)
  const [hoverEl, setHoverEl] = useState(null)
  const [docVersion, setDocVersion] = useState(0)
  const [tick, setTick] = useState(0)
  const focusAppliedRef = useRef(null)

  const on = following ? !!live?.on : localOn
  const selectedPath = following ? (live?.selector ?? null) : localPath
  const property = following ? (live?.property ?? DEFAULT_INSPECTOR_PROPERTY) : localProperty

  // A new task (config) resets to its own starting state.
  const configKey = enabled ? `${config.open}|${config.focus ?? ''}|${config.show.join(',')}` : ''
  useEffect(() => {
    setLocalOn(!!config?.open)
    setLocalPath(null)
    setHoverEl(null)
    focusAppliedRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey])

  // Follow the iframe's document: a Run rebuilds it, and its scroll/resize moves everything.
  useEffect(() => {
    if (!enabled) return undefined
    const frame = iframeRef?.current
    if (!frame) return undefined
    let win = null
    const bump = () => setTick((t) => t + 1)
    function attach() {
      win?.removeEventListener?.('scroll', bump)
      win?.removeEventListener?.('resize', bump)
      win = frame.contentWindow
      win?.addEventListener?.('scroll', bump, { passive: true })
      win?.addEventListener?.('resize', bump)
      setHoverEl(null)
      setDocVersion((v) => v + 1)
    }
    frame.addEventListener('load', attach)
    attach()
    return () => {
      frame.removeEventListener('load', attach)
      win?.removeEventListener?.('scroll', bump)
      win?.removeEventListener?.('resize', bump)
    }
  }, [enabled, iframeRef, src])

  const doc = enabled ? (iframeRef?.current?.contentDocument ?? null) : null

  // The task's `focus` pre-selects an element once per page load, unless one is already chosen.
  useEffect(() => {
    if (!enabled || following || !config.focus || !doc) return
    const key = `${src}|${docVersion}`
    if (focusAppliedRef.current === key) return
    focusAppliedRef.current = key
    setLocalPath((current) => {
      if (current && resolveSelector(doc, current)) return current
      const el = resolveSelector(doc, config.focus)
      return el ? selectorPathFor(el) : current
    })
  }, [enabled, following, config?.focus, doc, docVersion, src])

  const selectedEl = useMemo(
    () => (doc && selectedPath ? resolveSelector(doc, selectedPath) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, selectedPath, docVersion]
  )

  // Leader: report the state for Go Live (explicit null when off and nothing selected).
  const lastSentRef = useRef(undefined)
  useEffect(() => {
    if (!enabled || following || !onLiveChange) return
    const state = normalizeInspectorLiveState({ on, selector: selectedPath, property })
    const key = JSON.stringify(state)
    if (lastSentRef.current === key) return
    lastSentRef.current = key
    onLiveChange(state)
  }, [enabled, following, onLiveChange, on, selectedPath, property])

  // Clear the class's copy when this inspector goes away (task change, unmount).
  const onLiveChangeRef = useRef(onLiveChange)
  onLiveChangeRef.current = onLiveChange
  useEffect(() => {
    if (!enabled || following) return undefined
    return () => {
      if (lastSentRef.current !== undefined && lastSentRef.current !== 'null') {
        onLiveChangeRef.current?.(null)
      }
      lastSentRef.current = undefined
    }
  }, [enabled, following, configKey])

  const toggle = useCallback(() => {
    if (following) return
    const next = !localOn
    setLocalOn(next)
    if (next) onUse?.('open')
    else setHoverEl(null)
  }, [following, localOn, onUse])

  const select = useCallback(
    (el) => {
      if (following || !isInspectable(el)) return
      const path = selectorPathFor(el)
      if (!path) return
      setLocalPath(path)
      onUse?.('select')
    },
    [following, onUse]
  )

  if (!enabled) return { button: null, layer: null }

  const button = (
    <button
      type="button"
      className={`ui-tab${on ? ' is-active' : ''}`}
      style={on ? { ...s.toggle, ...s.toggleOn } : s.toggle}
      onClick={toggle}
      aria-pressed={on}
      disabled={following}
      title={
        following
          ? 'Your tutor is using the Inspector'
          : 'Inspect the page: point at a part to see its boxes'
      }
    >
      <span aria-hidden="true">🔍</span> Inspect
    </button>
  )

  const layer =
    visible && on ? (
      <InspectorLayer
        key={`${src}`}
        doc={doc}
        frame={iframeRef?.current ?? null}
        config={config}
        on={on}
        following={following}
        hoverEl={hoverEl}
        setHoverEl={setHoverEl}
        selectedEl={selectedEl}
        onSelect={select}
        onClear={() => !following && setLocalPath(null)}
        property={property}
        onPropertyChange={(next) => !following && setLocalProperty(next)}
        tick={tick}
      />
    ) : null

  return { button, layer }
}

const s = {
  toggle: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.04em',
    padding: '9px 10px 7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
  },
  toggleOn: { color: '#fff', borderBottom: '2px solid #fff' },
}
