import { useEffect, useRef } from 'react'
import PythonEditor from '../python/PythonEditor'
import SplitPane from '../../shared/SplitPane'
import { drawTurtleCommands, sizeCanvasToDisplay } from './draw.js'

// `student` is only present when this renders inside StudentModal (a teacher
// inspecting one student) — `student.currentTurtleResult` is synced there by
// writeStudentTurtleResult after every run (see useStudentCodeState.js). In the
// Builder's authoring/preview context (TeacherEditorPanel.jsx) there's no student
// and no run result, so the canvas is simply blank — there's nothing to show yet.
export default function TeacherLiveView({ displayState, student, readOnly, onChange, onActivity }) {
  const canvasRef = useRef(null)
  const turtleResult = student?.currentTurtleResult ?? null
  const commands = turtleResult?.commands ?? []
  const background = turtleResult?.state?.background ?? '#ffffff'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function redraw() {
      sizeCanvasToDisplay(canvas)
      const ctx = canvas.getContext('2d')
      // jsdom (unit tests) has no real canvas 2D context and returns null.
      if (ctx) drawTurtleCommands(ctx, commands, { background })
    }
    redraw()
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [commands, background])

  const editor = (
    <div style={s.editor}>
      <PythonEditor
        code={displayState ?? ''}
        readOnly={readOnly}
        onChange={onChange}
        onActivity={onActivity}
        pyodideStatus="ready"
      />
    </div>
  )

  const canvas = (
    <div style={s.canvasWrap}>
      <canvas ref={canvasRef} style={s.canvas} />
    </div>
  )

  return <SplitPane style={s.wrap} defaultSplit={50} left={editor} right={canvas} />
}

const s = {
  wrap: { flex: '1 1 auto', minHeight: 0, height: '100%' },
  editor: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  canvasWrap: {
    display: 'flex',
    height: '100%',
    minHeight: 150,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvas: { width: '100%', height: '100%', display: 'block' },
}
