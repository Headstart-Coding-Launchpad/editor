import { useEffect, useMemo, useRef, useState } from 'react'
import { buildArcadeIframeSrc } from './runtime'
import OutputPanel from '../../app/components/OutputPanel'

export default function ArcadePreview({ code, assets, tilemaps, runId, running = false, width, height, onError, style }) {
  const frameRef = useRef(null)
  const [runStatus, setRunStatus] = useState(null)
  const [consoleLines, setConsoleLines] = useState([])
  const srcDoc = useMemo(
    () => buildArcadeIframeSrc({ code, assets, tilemaps, width, height }),
    [code, assets, tilemaps, runId, width, height],
  )

  useEffect(() => {
    function receive(event) {
      if (event.source !== frameRef.current?.contentWindow || !event.data?.headstartArcade) return
      if (event.data.type === 'console') {
        setConsoleLines(lines => [...lines, { kind: event.data.kind ?? 'stdout', text: event.data.text ?? '' }].slice(-50))
        return
      }
      if (event.data.type === 'ready') {
        setRunStatus('success')
        return
      }
      if (event.data.type === 'error') {
        const error = event.data.message ?? 'The game could not start.'
        setRunStatus('error')
        setConsoleLines(lines => [...lines, { kind: 'stderr', text: `${error}\n` }].slice(-50))
        onError?.(error)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [onError])

  useEffect(() => {
    setRunStatus(null)
    setConsoleLines([])
  }, [runId])

  // The game's own canvas.focus() call (fired once it's ready, inside runtime.js's
  // hsArcadeReady) only moves focus within the iframe's own document — it can't shift
  // the browser's actual focused frame from cross-origin script without a user gesture
  // (browsers block iframes from stealing focus this way). Focusing the <iframe> element
  // itself is a same-origin, parent-side operation with no such restriction, and it runs
  // synchronously off the Run click's render, so it stays within that gesture and makes
  // this frame the focused one — canvas.focus() inside it then just moves focus within an
  // already-focused frame, which is unrestricted, so arrow keys work without a manual click.
  useEffect(() => {
    if (running) frameRef.current?.focus()
  }, [running, runId])

  const output = consoleLines.map(line => line.text).join('')

  return (
    <div style={{ ...s.preview, ...style }}>
      <div style={s.gameArea}>
        {running ? (
          <iframe
            ref={frameRef}
            key={runId}
            title="Arcade game"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            style={s.frame}
          />
        ) : (
          <div style={s.idle}>
            <strong>Ready to play</strong>
            <span>Run game to start your Arcade Kit project.</span>
          </div>
        )}
      </div>
      <OutputPanel title="Console" output={output} runStatus={runStatus} running={running && runStatus !== 'error'} openOnRun={false} openOnOutput collapsible defaultCollapsed />
    </div>
  )
}

const s = {
  preview: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, background: '#0f172a' },
  gameArea: { display: 'flex', flex: '1 1 auto', minHeight: 300, overflow: 'hidden' },
  frame: { border: 0, width: '100%', height: '100%', flex: 1, background: '#0f172a' },
  idle: { display: 'flex', flex: 1, minHeight: 300, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, color: '#cbd5e1', background: '#0f172a', fontFamily: 'var(--font-body)', fontSize: 14, textAlign: 'center' },
}
