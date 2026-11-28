import React, { useEffect, useMemo, useRef, useState } from 'react'
import PythonEditor from '../python/PythonEditor'
import { taskShowsBlocks } from '../../shared/blockGuides'
import SplitPane from '../../shared/SplitPane'
import AssetBrowser from '../../shared/AssetBrowser'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { resolveAssetsPath, resolveAssetFileUrl } from '../../shared/assetPaths'
import ArcadePreview from './ArcadePreview'
import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import ArcadeDesignStudio from './ArcadeDesignStudio'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import { starterCodeOf } from '../moduleContract'
import {
  allowsArcadeTool,
  cloneArcadeDesign,
  designForCodeTab,
  generatedArcadeAssets,
  generatedArcadeTilemaps,
  mapToPythonSnippet,
} from './design'
import { selectPythonTaskCode, selectTaskMeta } from '../../app/studentTaskContent'
import { getModuleDefinition } from '../definitions.js'
import CalmCodeRow from '../../shared/calmCode/CalmCodeRow.jsx'
import { taskKeyCode } from '../python/keyRow.js'
import './arcade.css'

const wideScreen = () => typeof window === 'undefined' || window.innerWidth >= 1024
const WORKSPACE_TABS = [
  ['code', 'Code'],
  ['sprites', 'Sprites'],
  ['tilemaps', 'Tilemaps'],
]

export default function StudentWorkspace({
  task,
  lessonId,
  lesson,
  cs,
  isMobile,
  isSandbox,
  viewingTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  isTeacherEditing,
  displayCode,
  displayArcadeDesign,
  teacherLiveCode,
  teacherLiveArcadeDesign,
  teacherLiveWorkspace,
  onVisiblePanesChange,
  // The calm host (LessonTaskContent, capabilities.calmCodeScreen): the "What to change" fold, and
  // the Topic library (a More item) when the code row holds it.
  whatToChange = null,
  onOpenTopicLibrary,
}) {
  const [runId, setRunId] = useState(0)
  // The assets panel: null follows the default (open while the student has drawn sprites or maps).
  const [assetsChoice, setAssetsChoice] = useState(null)
  const editorApiRef = useRef(null)
  const keyCode = useMemo(() => taskKeyCode(task), [task])
  const [runCode, setRunCode] = useState('')
  const [running, setRunning] = useState(false)
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('code')
  const { storageAssets: allStorageAssets } = useLessonStorageAssets(
    lesson?.isPlayground ? null : lessonId,
    lesson?.storageAssets ?? []
  )
  const { typeStorageAssets: allTypeStorageAssets } = useTypeAssets('arcade')
  const storageAssets = useMemo(
    () => allStorageAssets.filter((a) => a.showInEditor),
    [allStorageAssets]
  )
  const typeStorageAssets = useMemo(
    () => allTypeStorageAssets.filter((a) => a.showInEditor),
    [allTypeStorageAssets]
  )
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const viewedWork = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const viewedCode = isViewingPrev
    ? (viewedWork?.code ??
      selectPythonTaskCode({
        tasks: lesson.tasks,
        task,
        taskId: viewingTaskId,
        phase: 'solo',
        readSavedCode: cs.readSavedTaskCode,
      }))
    : null
  // The design of the task looked back at: as loading it would build it.
  function viewedDesign() {
    const { storage, workSlot } = getModuleDefinition('arcade')
    const { arcadeDesign } = selectTaskMeta({
      tasks: lesson.tasks,
      task,
      taskId: viewingTaskId,
      workSlot,
      own: storage.fromTaskRecord(viewedWork),
      readStored: (id) => storage.fromTaskRecord(cs.readSavedTaskCode(id)),
    })
    return arcadeDesign ? cloneArcadeDesign(arcadeDesign) : designForCodeTab(task, 'starter')
  }
  const code = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
      ? (teacherLiveCode ?? '')
      : isViewingPrev
        ? viewedCode
        : cs.code
  const design = isForcedTeacherLive
    ? (displayArcadeDesign ?? designForCodeTab(task, 'starter'))
    : isTeacherEditing
      ? (teacherLiveArcadeDesign ?? cs.arcadeDesign)
      : isViewingPrev
        ? viewedDesign()
        : cs.arcadeDesign
  const workspaceTab = isTeacherEditing ? (teacherLiveWorkspace ?? 'code') : activeWorkspaceTab
  const previousCodeRef = useRef(code)
  const staticAssets = useMemo(
    () =>
      (lesson?.assets ?? []).map((name) => ({
        name,
        url: resolveAssetFileUrl(resolveAssetsPath(lesson.assetsPath ?? ''), name),
      })),
    [lesson]
  )
  const generatedAssets = useMemo(() => generatedArcadeAssets(design), [design])
  const generatedTilemaps = useMemo(() => generatedArcadeTilemaps(design), [design])
  const assetsOpen = assetsChoice ?? generatedAssets.length + generatedTilemaps.length > 0
  const assets = useMemo(
    () => [...staticAssets, ...storageAssets, ...typeStorageAssets, ...generatedAssets],
    [staticAssets, storageAssets, typeStorageAssets, generatedAssets]
  )
  const standardAssets = useMemo(
    () => [...staticAssets, ...storageAssets, ...typeStorageAssets],
    [staticAssets, storageAssets, typeStorageAssets]
  )
  const showCopyCode =
    !isSandbox &&
    !cs.inPersonalSandbox &&
    typeof task?.copyCode === 'string' &&
    !!task.copyCode.trim() &&
    !whatToChange?.hideCopyCode

  function run() {
    setRunCode(code)
    setRunning(true)
    setRunId((id) => id + 1)
    // The game itself runs in ArcadePreview's iframe; the task's code checks are
    // evaluated against the code that was just run.
    if (!readOnly) cs.handleArcadeRun?.(code)
  }
  function stop() {
    setRunning(false)
  }
  useRemoteRunTrigger(
    cs.remoteRunToken,
    () => {
      if (!running) run()
    },
    { enabled: !readOnly, onHandled: cs.acknowledgeRemoteRun }
  )
  function handleCodeChange(nextCode) {
    if (running) stop()
    cs.handleCodeChange(nextCode)
  }
  function handleResetCode() {
    stop()
    cs.handleResetCode()
  }
  function handleDesignChange(nextDesign) {
    stop()
    cs.handleArcadeDesignChange(nextDesign)
  }
  function insertCode(snippet) {
    handleCodeChange(`${code.trimEnd()}${code.trim() ? '\n' : ''}${snippet}\n`)
  }

  useEffect(() => {
    if (previousCodeRef.current !== code) {
      previousCodeRef.current = code
      setRunning(false)
    }
  }, [code])
  useEffect(() => {
    if (activeWorkspaceTab !== 'code' && !allowsArcadeTool(task, activeWorkspaceTab)) {
      setActiveWorkspaceTab('code')
    }
  }, [activeWorkspaceTab, task])
  useEffect(() => {
    onVisiblePanesChange?.([workspaceTab, ...(running ? ['running'] : [])])
  }, [workspaceTab, running, onVisiblePanesChange])

  const editor = (
    <div style={s.editor}>
      {!readOnly && (
        <div className="ui-tabs arcade-tabs" role="tablist" aria-label="Arcade workspace">
          {WORKSPACE_TABS.filter(([id]) => id === 'code' || allowsArcadeTool(task, id)).map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`ui-tab arcade-tab${activeWorkspaceTab === id ? ' is-active' : ''}`}
                aria-selected={activeWorkspaceTab === id}
                onClick={() => setActiveWorkspaceTab(id)}
                // Play and Stop live on the Code tab: a highlight points here from the others.
                data-highlight-reveal={id === 'code' ? 'run stop' : undefined}
              >
                {label}
              </button>
            )
          )}
          <button
            type="button"
            className="btn-ghost-outline arcade-assets-chip"
            aria-expanded={assetsOpen}
            onClick={() => {
              // From Sprites or Tilemaps: to Code with the assets open; on Code: fold or open.
              setAssetsChoice(activeWorkspaceTab !== 'code' || !assetsOpen)
              setActiveWorkspaceTab('code')
            }}
          >
            <span aria-hidden="true">🎨 </span>Assets
          </button>
        </div>
      )}
      {workspaceTab === 'code' && (
        <>
          {!readOnly && (
            <CalmCodeRow
              onEmoji={(emoji) => editorApiRef.current?.insertAtCursor(emoji)}
              showBlocks={taskShowsBlocks(task)}
              title={false}
              run={{ word: 'Play', stop: running, onClick: running ? stop : run }}
              more={[
                { id: 'reset', icon: '↺', label: 'Reset code', onClick: handleResetCode },
                onOpenTopicLibrary && {
                  id: 'topics',
                  icon: '📚',
                  label: 'Topic library',
                  onClick: onOpenTopicLibrary,
                },
              ]}
            />
          )}
          {showCopyCode && (
            <div className="arcade-copy-code">
              <CopyCodePanel
                code={task.copyCode}
                language="python"
                after={task.copyAfter}
                before={task.copyBefore}
                starter={starterCodeOf(task)}
                calm={!!whatToChange}
                folded={!!whatToChange?.folded}
                onToggleFolded={whatToChange?.onToggle}
              />
            </div>
          )}
          <PythonEditor
            calm
            keyCode={keyCode}
            editorApiRef={editorApiRef}
            code={code}
            readOnly={readOnly}
            onChange={readOnly ? undefined : handleCodeChange}
            pyodideStatus="ready"
            onRunShortcut={readOnly ? undefined : running ? stop : run}
            showBlocks={taskShowsBlocks(task)}
          />
          {!readOnly && assetsOpen && (
            <div className="arcade-assets" role="region" aria-label="Assets">
              <div className="arcade-assets__row">
                <span>
                  Select an asset to insert <code>Sprite("...")</code>, or copy a name into{' '}
                  <code>game.sound("...")</code>.
                </span>
              </div>
              {generatedAssets.length > 0 && (
                <div className="arcade-assets__row">
                  {generatedAssets.map((asset) => (
                    <button
                      key={asset.name}
                      type="button"
                      title={`Insert ${asset.name}`}
                      className="arcade-asset-btn"
                      onClick={() => insertCode(`Sprite(${JSON.stringify(asset.name)})`)}
                    >
                      <img src={asset.url} alt="" className="arcade-asset-btn__thumb" />
                      {asset.name} <small>made here</small>
                    </button>
                  ))}
                </div>
              )}
              {generatedTilemaps.length > 0 && (
                <div className="arcade-assets__row">
                  {generatedTilemaps.map((tilemap, index) => (
                    <button
                      key={tilemap.name}
                      type="button"
                      title={`Insert ${tilemap.name}`}
                      className="arcade-asset-btn arcade-asset-btn--map"
                      onClick={() => insertCode(mapToPythonSnippet(cs.arcadeDesign.maps[index]))}
                    >
                      {tilemap.name}
                    </button>
                  ))}
                </div>
              )}
              <AssetBrowser
                assetsPath={lesson?.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                assets={lesson?.assets ?? []}
                storageAssets={[...storageAssets, ...typeStorageAssets]}
                style={s.flat}
              />
            </div>
          )}
        </>
      )}
      {workspaceTab !== 'code' && allowsArcadeTool(task, workspaceTab) && (
        <div className="arcade-designer">
          <ArcadeDesignStudio
            task={{ ...task, arcadeTools: workspaceTab }}
            design={design}
            readOnly={readOnly}
            onChange={readOnly ? undefined : handleDesignChange}
            availableAssets={standardAssets}
            title={workspaceTab === 'sprites' ? 'Your sprites' : 'Your tilemaps'}
          />
        </div>
      )}
    </div>
  )
  const preview = (
    <div style={s.preview}>
      <ArcadePreview
        code={runCode}
        assets={assets}
        tilemaps={generatedTilemaps}
        runId={runId}
        running={running}
        onError={readOnly ? undefined : cs.handleArcadeRunError}
      />
    </div>
  )
  return isMobile ? (
    <div style={s.mobile}>
      {editor}
      {preview}
    </div>
  ) : (
    // The game gets the room on a desktop; a tablet keeps the editor wide enough for its rows.
    <SplitPane
      style={s.split}
      defaultSplit={wideScreen() ? 46 : 56}
      left={editor}
      right={preview}
    />
  )
}

const s = {
  split: { flex: '1 1 auto', minHeight: 0, overflow: 'hidden' },
  mobile: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 },
  editor: { display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' },
  preview: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
  },
  flat: { borderRadius: 0 },
}
