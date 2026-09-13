import React, { useEffect, useMemo, useRef, useState } from 'react'
import PythonEditor from '../python/PythonEditor'
import SplitPane from '../../shared/SplitPane'
import AssetBrowser from '../../shared/AssetBrowser'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { resolveAssetsPath, resolveAssetFileUrl } from '../../shared/assetPaths'
import ArcadePreview from './ArcadePreview'
import ArcadeDesignStudio from './ArcadeDesignStudio'
import {
  allowsArcadeTool,
  cloneArcadeDesign,
  designForCodeTab,
  generatedArcadeAssets,
  generatedArcadeTilemaps,
  mapToPythonSnippet,
} from './design'
import { selectPythonTaskCode } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  task,
  lessonId,
  lesson,
  cs,
  isMobile,
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
}) {
  const [runId, setRunId] = useState(0)
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
        ? viewedWork?.arcadeDesign
          ? cloneArcadeDesign(viewedWork.arcadeDesign)
          : designForCodeTab(task, 'starter')
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
  const assets = useMemo(
    () => [...staticAssets, ...storageAssets, ...typeStorageAssets, ...generatedAssets],
    [staticAssets, storageAssets, typeStorageAssets, generatedAssets]
  )
  const canDrawSprites = allowsArcadeTool(task, 'sprites')
  const canDrawMaps = allowsArcadeTool(task, 'tilemaps')
  const standardAssets = useMemo(
    () => [...staticAssets, ...storageAssets, ...typeStorageAssets],
    [staticAssets, storageAssets, typeStorageAssets]
  )

  function run() {
    setRunCode(code)
    setRunning(true)
    setRunId((id) => id + 1)
  }
  function stop() {
    setRunning(false)
  }
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
    if (activeWorkspaceTab === 'sprites' && !canDrawSprites) setActiveWorkspaceTab('code')
    if (activeWorkspaceTab === 'tilemaps' && !canDrawMaps) setActiveWorkspaceTab('code')
  }, [activeWorkspaceTab, canDrawMaps, canDrawSprites])
  useEffect(() => {
    onVisiblePanesChange?.([workspaceTab, ...(running ? ['running'] : [])])
  }, [workspaceTab, running, onVisiblePanesChange])

  const editor = (
    <div style={s.editor}>
      {!readOnly && (
        <div style={s.workspaceTabs} role="tablist" aria-label="Arcade workspace">
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === 'code'}
            onClick={() => setActiveWorkspaceTab('code')}
            style={{
              ...s.workspaceTab,
              ...(activeWorkspaceTab === 'code' ? s.workspaceTabActive : {}),
            }}
          >
            Code
          </button>
          {canDrawSprites && (
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspaceTab === 'sprites'}
              onClick={() => setActiveWorkspaceTab('sprites')}
              style={{
                ...s.workspaceTab,
                ...(activeWorkspaceTab === 'sprites' ? s.workspaceTabActive : {}),
              }}
            >
              Sprites
            </button>
          )}
          {canDrawMaps && (
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspaceTab === 'tilemaps'}
              onClick={() => setActiveWorkspaceTab('tilemaps')}
              style={{
                ...s.workspaceTab,
                ...(activeWorkspaceTab === 'tilemaps' ? s.workspaceTabActive : {}),
              }}
            >
              Tilemaps
            </button>
          )}
        </div>
      )}
      {workspaceTab === 'code' && (
        <>
          {!readOnly && (
            <div style={s.toolbar}>
              <strong>game.py</strong>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
                Click the game to use the arrow keys.
              </span>
              <button
                className={running ? 'btn-danger' : 'btn-primary'}
                style={s.runButton}
                onClick={running ? stop : run}
              >
                {running ? 'Stop' : 'Run game'}
              </button>
              <button className="btn-ghost-outline" style={s.button} onClick={handleResetCode}>
                Reset
              </button>
            </div>
          )}
          <PythonEditor
            code={code}
            readOnly={readOnly}
            onChange={readOnly ? undefined : handleCodeChange}
            pyodideStatus="ready"
            onRunShortcut={readOnly ? undefined : running ? stop : run}
          />
          {!readOnly && (
            <details
              style={s.assets}
              open={generatedAssets.length > 0 || generatedTilemaps.length > 0}
            >
              <summary style={s.assetsSummary}>Assets</summary>
              <div style={s.assetBar}>
                <span>
                  Select an asset to insert <code>Sprite("...")</code>, or copy a name into{' '}
                  <code>game.sound("...")</code>.
                </span>
              </div>
              {generatedAssets.length > 0 && (
                <div style={s.generatedAssets}>
                  {generatedAssets.map((asset) => (
                    <button
                      key={asset.name}
                      type="button"
                      className="btn-ghost"
                      title={`Insert ${asset.name}`}
                      style={s.generatedAssetButton}
                      onClick={() => insertCode(`Sprite(${JSON.stringify(asset.name)})`)}
                    >
                      <img src={asset.url} alt="" style={s.generatedAssetThumb} />
                      {asset.name} <small>made here</small>
                    </button>
                  ))}
                </div>
              )}
              {generatedTilemaps.length > 0 && (
                <div style={s.generatedTilemaps}>
                  {generatedTilemaps.map((tilemap, index) => (
                    <button
                      key={tilemap.name}
                      type="button"
                      className="btn-ghost"
                      title={`Insert ${tilemap.name}`}
                      style={s.generatedTilemapButton}
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
                style={{ borderRadius: 0 }}
              />
            </details>
          )}
        </>
      )}
      {workspaceTab === 'sprites' && canDrawSprites && (
        <div style={s.designer}>
          <ArcadeDesignStudio
            task={{ ...task, arcadeTools: 'sprites' }}
            design={design}
            readOnly={readOnly}
            onChange={readOnly ? undefined : handleDesignChange}
            availableAssets={standardAssets}
            title="Your sprites"
          />
        </div>
      )}
      {workspaceTab === 'tilemaps' && canDrawMaps && (
        <div style={s.designer}>
          <ArcadeDesignStudio
            task={{ ...task, arcadeTools: 'tilemaps' }}
            design={design}
            readOnly={readOnly}
            onChange={readOnly ? undefined : handleDesignChange}
            availableAssets={standardAssets}
            title="Your tilemaps"
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
      />
    </div>
  )
  return isMobile ? (
    <div style={s.mobile}>
      {editor}
      {preview}
    </div>
  ) : (
    <SplitPane style={s.split} defaultSplit={56} left={editor} right={preview} />
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
  workspaceTabs: {
    display: 'flex',
    flexShrink: 0,
    gap: 3,
    padding: '6px 8px 0',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  workspaceTab: {
    padding: '7px 12px',
    border: '1px solid transparent',
    borderBottom: 0,
    borderRadius: '7px 7px 0 0',
    background: 'transparent',
    color: '#64748b',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  workspaceTabActive: {
    background: '#fff',
    borderColor: '#c4b5fd',
    color: '#5b21b6',
    marginBottom: -1,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  runButton: { padding: '7px 14px', fontSize: 13 },
  button: { padding: '6px 10px', fontSize: 12 },
  assets: {
    flexShrink: 0,
    borderTop: '1px solid #e5e7eb',
    background: '#f8fafc',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
  },
  designer: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    padding: 10,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
  },
  assetsSummary: {
    cursor: 'pointer',
    padding: '8px 10px',
    color: 'var(--colour-primary)',
    fontWeight: 700,
  },
  assetBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    background: '#f8fafc',
    borderTop: '1px solid #e5e7eb',
  },
  generatedAssets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '7px 10px',
    borderTop: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  generatedTilemaps: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 10px 7px',
    background: '#f8fafc',
  },
  generatedAssetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 7px',
    fontSize: 11,
    color: '#312e81',
    background: '#fff',
    border: '1px solid #a5b4fc',
    borderRadius: 7,
    fontWeight: 700,
    cursor: 'pointer',
  },
  generatedTilemapButton: {
    padding: '4px 7px',
    fontSize: 11,
    color: '#075985',
    background: '#f0f9ff',
    border: '1px solid #7dd3fc',
    borderRadius: 7,
    fontWeight: 700,
    cursor: 'pointer',
  },
  generatedAssetThumb: {
    width: 18,
    height: 18,
    imageRendering: 'pixelated',
    background: '#e0e7ff',
    borderRadius: 2,
  },
}
