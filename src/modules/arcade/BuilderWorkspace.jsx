import { useMemo, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { CodeWorkspaceTabs, StageMetadataEditor } from '../../builder/components/task-editor/TaskEditorFields'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { resolveAssetFileUrl, resolveAssetsPath } from '../../shared/assetPaths'
import ArcadePreview from './ArcadePreview'
import ArcadeDesignStudio from './ArcadeDesignStudio'
import { designForCodeTab, generatedArcadeAssets, generatedArcadeTilemaps, updateDesignForCodeTab } from './design'

export default function BuilderWorkspace({ task, lesson, onUpdate, codeTab, codeStages, activePythonCode, handleCodeTabChange, handleAddStage, handleRemoveStage, resetToStarterBtn }) {
  const [runId, setRunId] = useState(0)
  const [previewCode, setPreviewCode] = useState('')
  const [previewRunning, setPreviewRunning] = useState(false)
  const { storageAssets } = useLessonStorageAssets(lesson?.id, lesson?.storageAssets ?? [])
  const { typeStorageAssets } = useTypeAssets('arcade')
  const previewDesign = useMemo(() => designForCodeTab(task, codeTab), [task, codeTab])
  const previewAssets = useMemo(() => {
    const staticAssets = (lesson?.assets ?? []).map(name => ({ name, url: resolveAssetFileUrl(resolveAssetsPath(lesson.assetsPath ?? ''), name) }))
    const generated = generatedArcadeAssets(previewDesign)
    return [...staticAssets, ...storageAssets, ...typeStorageAssets, ...generated]
  }, [lesson, storageAssets, previewDesign, typeStorageAssets])
  const previewTilemaps = useMemo(() => generatedArcadeTilemaps(previewDesign), [previewDesign])
  const complete = codeTab === 'complete'
  const match = codeTab.match(/^stage_(\d+)$/)
  const stageIndex = match ? Number(match[1]) : null
  const stage = stageIndex == null ? null : codeStages[stageIndex]
  function updateStage(updates) { onUpdate({ ...task, codeStages: (task.codeStages ?? []).map((item, index) => index === stageIndex ? { ...item, ...updates } : item) }) }
  function change(code) {
    setPreviewRunning(false)
    if (complete) onUpdate({ ...task, completeCode: code })
    else if (stageIndex != null) updateStage({ code })
    else onUpdate({ ...task, starterCode: code })
  }
  function updateDesign(design) {
    setPreviewRunning(false)
    onUpdate(updateDesignForCodeTab(task, codeTab, design))
  }
  const externalAssets = previewAssets.filter(asset => !asset.generated)
  return <div style={s.wrap}>
    <div className="te-code-workspace-stack" style={{ minHeight: 300 }}>
      <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} stages={codeStages} onAddStage={handleAddStage} onRemoveStage={handleRemoveStage} rightAction={resetToStarterBtn} />
      {stage && <div style={s.stage}><input className="te-input" value={stage.label ?? ''} onChange={event => updateStage({ label: event.target.value })} placeholder={`Stage ${stageIndex + 1}`} /><StageMetadataEditor stage={stage} showRevealable onChange={next => updateStage(next)} /></div>}
      <CodeEditor value={activePythonCode} language="python" onChange={change} style={{ flex: 1, minHeight: 260, borderRadius: '0 0 8px 8px' }} />
    </div>
    <div style={s.preview}><div style={s.previewHeader}><strong>Game preview</strong><button className={previewRunning ? 'btn-danger' : 'btn-primary'} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { if (previewRunning) setPreviewRunning(false); else { setPreviewCode(activePythonCode); setPreviewRunning(true); setRunId(id => id + 1) } }}>{previewRunning ? 'Stop' : 'Run game'}</button></div><ArcadePreview code={previewCode} assets={previewAssets} tilemaps={previewTilemaps} runId={runId} running={previewRunning} /></div>
    <div style={s.design}>
      <label style={s.toolsLabel}>Student design tools <select value={task.arcadeTools ?? 'none'} onChange={event => onUpdate({ ...task, arcadeTools: event.target.value })}><option value="none">None</option><option value="sprites">Sprites only</option><option value="tilemaps">Tilemaps only</option><option value="both">Sprites and tilemaps</option></select></label>
      <ArcadeDesignStudio task={null} design={designForCodeTab(task, codeTab)} onChange={updateDesign} availableAssets={externalAssets} layout="builder" />
    </div>
  </div>
}
const s = { wrap: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, .8fr)', gap: 10, minHeight: 360 }, stage: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff' }, preview: { display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }, previewHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--colour-primary)', background: '#f8fafc' }, design: { gridColumn: '1 / -1', minWidth: 0 }, toolsLabel: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: '#475569' } }
