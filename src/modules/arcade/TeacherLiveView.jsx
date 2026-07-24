import PythonEditor from '../python/PythonEditor'
import ArcadeDesignStudio from './ArcadeDesignStudio'
import { designForCodeTab } from './design'

export default function TeacherLiveView({ task, student, displayState, readOnly, onChange, onActivity }) {
  const design = student?.currentArcadeDesign ?? designForCodeTab(task, 'starter')
  return <div style={s.wrap}>
    <div style={s.editor}><PythonEditor code={displayState ?? ''} readOnly={readOnly} onChange={onChange} onActivity={onActivity} pyodideStatus="ready" /></div>
    <details style={s.design} open><summary>Student game art &amp; map</summary><ArcadeDesignStudio task={null} design={design} readOnly title="Current student design" layout="builder" /></details>
  </div>
}

const s = { wrap: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }, editor: { flex: '1 1 220px', minHeight: 0 }, design: { flex: '0 1 auto', overflow: 'auto', borderTop: '1px solid #e2e8f0', padding: 8, fontFamily: 'var(--font-body)', fontSize: 12 } }
