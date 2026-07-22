import SplitPane from '../../../shared/SplitPane'
import { CodeEditor } from '../../../shared/CodeEditor'
import AssetBrowser from '../../../shared/AssetBrowser'
import { resolveAssetsPath } from '../../../shared/assetPaths'
import { useTypeAssets } from '../../../shared/useTypeAssets'
import IframePreview from '../../../app/components/IframePreview'
import { CollapseTabButton } from '../../../app/components/CollapsiblePanelControls'
import FileManager from '../FileManager'
import { Field, CodeWorkspaceTabs, StageMetadataEditor } from './TaskEditorFields'
import TaskCheckResults from './TaskCheckResults'

export default function HtmlTaskWorkspace({
  task, lesson, onUpdate,
  codeTab, codeStages,
  selectedFile, selectedCompleteFile, setSelectedFile, setSelectedCompleteFile,
  running, htmlPreviewOpen, setHtmlPreviewOpen,
  iframeSrc, iframeRef, checkResults, incorrectCheckResults,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
  handleRun, handleTestChecks, resetToStarterBtn,
}) {
  const isCompleteTab = codeTab === 'complete'
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null
  const activeFiles = isCompleteTab
    ? (task.completeFiles ?? [])
    : isStageTab
    ? (activeStage?.files ?? [])
    : (task.starterFiles ?? [])
  const activeSelectedFile = isCompleteTab ? selectedCompleteFile : selectedFile
  const activeEntryFile = isCompleteTab
    ? (task.completeEntryFile ?? task.entryFile ?? 'index.html')
    : isStageTab
    ? (activeStage?.entryFile ?? task.entryFile ?? 'index.html')
    : (task.entryFile ?? 'index.html')

  const { typeStorageAssets } = useTypeAssets(lesson.type)
  const lessonStorageAssets = lesson.storageAssets ?? []
  const sharedAssetNames = lesson.sharedAssetNames ?? null
  const includedTypeAssets = sharedAssetNames !== null
    ? typeStorageAssets.filter(a => sharedAssetNames.includes(a.name))
    : typeStorageAssets
  const allStorageAssets = [
    ...lessonStorageAssets,
    ...includedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function updateStage(idx, updates) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? { ...s, ...updates } : s)
    onUpdate({ ...task, codeStages: updated })
  }

  function replaceStage(idx, nextStage) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? nextStage : s)
    onUpdate({ ...task, codeStages: updated })
  }

  return (
    <>
      <div className="te-code-workspace-stack">
        <CodeWorkspaceTabs
          activeTab={codeTab}
          onChange={handleCodeTabChange}
          stages={codeStages}
          onAddStage={handleAddStage}
          onRemoveStage={handleRemoveStage}
          rightAction={
            <>
              {resetToStarterBtn}
              <button
                type="button"
                className="btn-primary"
                onClick={task.interactionMode === 'submit' ? handleTestChecks : handleRun}
                disabled={task.interactionMode === 'submit' ? !task.check : running}
                style={{ padding: '7px 18px', fontSize: 13 }}
              >
                {task.interactionMode === 'submit' ? 'Test checks' : running ? 'Running...' : 'Run'}
              </button>
            </>
          }
        />
        {isStageTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #e5e7eb', borderTop: 0, borderBottom: 0, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
            <input
              className="te-input"
              style={{ width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
              value={activeStage?.label ?? ''}
              onChange={e => updateStage(activeStageIndex, { label: e.target.value })}
              placeholder={`Stage ${activeStageIndex + 1}`}
            />
            <StageMetadataEditor
              stage={activeStage}
              showRevealable
              onChange={nextStage => replaceStage(activeStageIndex, nextStage)}
            />
          </div>
        )}

        {isCompleteTab && task.check && (
          <div style={{ padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 0, fontSize: '0.8rem', color: '#1d4ed8', fontFamily: 'var(--font-body)' }}>
            Complete tab active — click Run to verify this solution passes all checks.
          </div>
        )}
        <div className="te-html-split">
          <SplitPane
            defaultSplit={34}
            style={{ flex: 1, minHeight: 0 }}
            left={
              <div className="te-html-left">
                <FileManager
                  files={activeFiles}
                  entryFile={activeEntryFile}
                  selectedFile={activeSelectedFile}
                  onSelectFile={isCompleteTab ? setSelectedCompleteFile : setSelectedFile}
                  onAddFile={f => {
                    if (isCompleteTab) {
                      set('completeFiles', [...(task.completeFiles ?? []), f])
                      setSelectedCompleteFile(f.name)
                    } else if (isStageTab) {
                      updateStage(activeStageIndex, { files: [...(activeStage?.files ?? []), f] })
                      setSelectedFile(f.name)
                    } else {
                      set('starterFiles', [...(task.starterFiles ?? []), f])
                      setSelectedFile(f.name)
                    }
                  }}
                  onSetFiles={(newFiles, newEntry) => {
                    if (isCompleteTab) {
                      onUpdate({ ...task, completeFiles: newFiles, completeEntryFile: newEntry })
                      setSelectedCompleteFile(newFiles[0]?.name ?? '')
                    } else if (isStageTab) {
                      updateStage(activeStageIndex, { files: newFiles, entryFile: newEntry })
                      setSelectedFile(newFiles[0]?.name ?? '')
                    } else {
                      onUpdate({ ...task, starterFiles: newFiles, entryFile: newEntry })
                      setSelectedFile(newFiles[0]?.name ?? '')
                    }
                  }}
                  onDeleteFile={name => {
                    const current = isCompleteTab ? (task.completeFiles ?? []) : isStageTab ? (activeStage?.files ?? []) : (task.starterFiles ?? [])
                    const next = current.filter(f => f.name !== name)
                    if (isCompleteTab) {
                      set('completeFiles', next)
                      setSelectedCompleteFile(next[0]?.name ?? '')
                    } else if (isStageTab) {
                      updateStage(activeStageIndex, { files: next })
                      setSelectedFile(next[0]?.name ?? '')
                    } else {
                      set('starterFiles', next)
                      setSelectedFile(next[0]?.name ?? '')
                    }
                  }}
                  onChangeType={(name, type) => {
                    if (isCompleteTab) set('completeFiles', (task.completeFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                    else if (isStageTab) updateStage(activeStageIndex, { files: (activeStage?.files ?? []).map(f => f.name === name ? { ...f, type } : f) })
                    else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                  }}
                  onChangeEntryFile={name => {
                    if (isCompleteTab) set('completeEntryFile', name)
                    else if (isStageTab) updateStage(activeStageIndex, { entryFile: name })
                    else set('entryFile', name)
                  }}
                  attachedTop
                />
              </div>
            }
            right={
              task.interactionMode !== 'submit' && htmlPreviewOpen ? (
                <div className="te-builder-preview-pane">
                  <IframePreview
                    src={iframeSrc}
                    iframeRef={iframeRef}
                    fill
                    leadingActions={
                      <CollapseTabButton
                        onClick={() => setHtmlPreviewOpen(false)}
                        direction="right"
                        title="Collapse Preview"
                        ariaLabel="Collapse Preview"
                      />
                    }
                  />
                  <TaskCheckResults checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
                </div>
              ) : (
                <div className="te-html-editor-with-rail">
                  <div className="te-html-editor-pane">
                    {activeSelectedFile ? (
                      <CodeEditor
                        key={`${codeTab}-${activeSelectedFile}`}
                        value={activeFiles.find(f => f.name === activeSelectedFile)?.content ?? ''}
                        language={activeFiles.find(f => f.name === activeSelectedFile)?.type ?? 'html'}
                        onChange={v => {
                          if (isCompleteTab) set('completeFiles', (task.completeFiles ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                          else if (isStageTab) updateStage(activeStageIndex, { files: (activeStage?.files ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f) })
                          else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                        }}
                        style={{ width: '100%', minWidth: 0, flex: '1 1 auto', borderRadius: '0 0 8px 8px' }}
                      />
                    ) : (
                      <div className="te-no-file">Select or add a file to edit.</div>
                    )}
                  </div>
                  {task.interactionMode !== 'submit' && (
                    <button
                      type="button"
                      className="te-preview-rail"
                      onClick={() => setHtmlPreviewOpen(true)}
                      title="Show Preview"
                      aria-label="Show Preview"
                    >
                      <span className="te-preview-rail__icon">{'<'}</span>
                      <span className="te-preview-rail__label">Preview</span>
                    </button>
                  )}
                </div>
              )
            }
          />
        </div>
      </div>

      <div style={task.interactionMode === 'submit' ? { marginTop: 8 } : { display: 'none' }}>
        <TaskCheckResults checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
      </div>

      {((lesson.assetsPath && lesson.assets?.length > 0) || allStorageAssets.length > 0) && (
        <Field label="Asset browser (read-only - copy paths to use in starter code)">
          <AssetBrowser
            assetsPath={resolveAssetsPath(lesson.assetsPath)}
            assets={lesson.assets}
            storageAssets={allStorageAssets}
            copyMode="relative"
          />
        </Field>
      )}
    </>
  )
}
