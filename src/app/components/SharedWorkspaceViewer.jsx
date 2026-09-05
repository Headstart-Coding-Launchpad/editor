import React, { useMemo, useRef, useState } from 'react'
import { resolveSnapshotContext, snapshotFiles } from './SharedWorkspacePreview'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { parseScratchState } from '../../shared/workspaceData'
import ScratchWorkspace from '../../modules/scratch/ScratchWorkspace.jsx'
import HtmlTeacherLiveView from '../../modules/html/TeacherLiveView.jsx'
import ArcadeTeacherLiveView from '../../modules/arcade/TeacherLiveView.jsx'
import ElectronicsTeacherLiveView from '../../modules/electronics/TeacherLiveView.jsx'
import { CodeEditor } from '../../shared/CodeEditor'
import IframePreview from './IframePreview'
import OutputPanel from './OutputPanel'

/**
 * A classmate's shared workspace, opened as a throwaway copy.
 *
 * Non-destructive BY CONSTRUCTION, not by gating: this component holds its own
 * local React state and is deliberately not wired to useStudentCodeState,
 * createStudentPersistence, or any useSession writer. There is no code path
 * from here to localStorage or Firebase, so editing or running a shared
 * workspace cannot touch the viewer's own saved work, cannot stream as their
 * live code, and cannot log an attempt against their task.
 *
 * The one bridge into their real work is "Copy to my editor", which is
 * explicit, confirmed, and offered only when the snapshot is for the task they
 * are actually on.
 */
export default function SharedWorkspaceViewer({
  lesson,
  entry,
  snapshot,
  onClose,
  onCopyToMyEditor,
  copyTargetTaskId,
}) {
  const { task, effectiveLesson, moduleType, module } = useMemo(
    () => resolveSnapshotContext(lesson, snapshot),
    [lesson, snapshot]
  )

  const [code, setCode] = useState(() => snapshot?.code ?? '')
  const [files, setFiles] = useState(() => snapshotFiles(snapshot))
  const [design, setDesign] = useState(() => snapshot?.arcadeDesign ?? null)
  const [output, setOutput] = useState(() => snapshot?.output ?? '')
  const [runStatus, setRunStatus] = useState(() => snapshot?.runStatus ?? null)
  const [running, setRunning] = useState(false)
  const [iframeSrc, setIframeSrc] = useState(null)
  const [confirmingCopy, setConfirmingCopy] = useState(false)
  const iframeRef = useRef(null)

  const isScratch = moduleType === 'scratch'
  const isHtml = moduleType === 'html'
  const isArcade = moduleType === 'arcade'
  const isElectronics = moduleType === 'electronics'
  const isFilesystem = moduleType === 'filesystem'

  const canRunCode = !!module?.runtime?.run && !isHtml && !isScratch && !isFilesystem
  const canPreview = isHtml && !!module?.runtime?.buildPreviewSrc
  // Copying overwrites the viewer's own editor, so only offer it when the
  // snapshot belongs to the task they are actually working on.
  const canCopy =
    !!onCopyToMyEditor && snapshot?.taskId != null && snapshot.taskId === copyTargetTaskId

  async function handleRun() {
    if (canPreview) {
      setIframeSrc(
        module.runtime.buildPreviewSrc(
          { files, entryFile: task?.entryFile ?? 'index.html' },
          task,
          {
            assets: effectiveLesson?.assets ?? [],
            assetsPath: resolveAssetsPath(effectiveLesson?.assetsPath),
          }
        )
      )
      return
    }
    if (!canRunCode) return
    setRunning(true)
    setOutput('')
    let buffer = ''
    try {
      await module.runtime.init?.()
      const result = await module.runtime.run(code, task, {
        onOutput: (text) => {
          buffer += text
          setOutput(buffer)
        },
        onInputRequired: () => module.runtime.provideInput?.(''),
      })
      setOutput(buffer)
      setRunStatus(result?.status ?? 'success')
    } catch (err) {
      setOutput(buffer + (err?.message ?? 'Something went wrong running this.'))
      setRunStatus('error')
    } finally {
      setRunning(false)
    }
  }

  function handleStop() {
    module?.runtime?.stop?.()
    setRunning(false)
  }

  function renderWorkspace() {
    if (isScratch) {
      return (
        <ScratchWorkspace
          // Remounted per share: handing a Blockly workspace new state without a
          // remount has previously mutated the source project in place.
          key={`shared-scratch-${entry?.shareId}`}
          task={task}
          readOnly={false}
          assetsPath={resolveAssetsPath(effectiveLesson?.assetsPath) || undefined}
          initialState={parseScratchState(snapshot?.code)}
          onStateChange={(next) => setCode(JSON.stringify(next))}
          unrestricted
        />
      )
    }
    if (isHtml) {
      return (
        <HtmlTeacherLiveView
          lesson={effectiveLesson}
          displayState={{ files }}
          readOnly={false}
          onChange={(name, content) =>
            setFiles((prev) => prev.map((f) => (f.name === name ? { ...f, content } : f)))
          }
        />
      )
    }
    if (isArcade) {
      return (
        <ArcadeTeacherLiveView
          task={task}
          displayState={code}
          design={design}
          readOnly={false}
          onChange={setCode}
          onDesignChange={setDesign}
          onWorkspaceChange={() => {}}
        />
      )
    }
    if (isElectronics) {
      return (
        <ElectronicsTeacherLiveView
          task={task}
          displayState={code}
          readOnly={false}
          onChange={setCode}
        />
      )
    }
    const LiveView = module?.TeacherLiveView
    if (isFilesystem && LiveView) {
      return (
        <LiveView
          task={task}
          lesson={effectiveLesson}
          displayState={module.deserializeState ? module.deserializeState(code) : code}
          readOnly={false}
          onChange={(next) => setCode(JSON.stringify(next))}
        />
      )
    }
    return (
      <div style={s.editorWrap}>
        <CodeEditor
          value={code}
          language={moduleType === 'python' ? 'python' : 'text'}
          readOnly={false}
          onChange={setCode}
          style={{ height: '100%' }}
        />
      </div>
    )
  }

  return (
    <div style={s.overlay} role="dialog" aria-label="Shared workspace">
      <div style={s.panel}>
        <div style={s.header}>
          <div style={s.headerText}>
            <span style={s.title}>📤 {entry?.sharerName ?? 'A classmate'}&apos;s workspace</span>
            <span style={s.subtitle}>
              {task?.title ? `${task.title} · ` : ''}Try anything you like — your own work is safe
              and unchanged.
            </span>
          </div>
          <div style={s.headerActions}>
            {(canRunCode || canPreview) && (
              <button
                type="button"
                className="btn-primary"
                style={s.headerBtn}
                onClick={running ? handleStop : handleRun}
              >
                {running ? '■ Stop' : '▶ Run'}
              </button>
            )}
            {canCopy && (
              <button
                type="button"
                className="btn-ghost"
                style={s.headerBtn}
                onClick={() => setConfirmingCopy(true)}
              >
                Copy to my editor
              </button>
            )}
            <button type="button" className="btn-ghost" style={s.headerBtn} onClick={onClose}>
              ← Back to my work
            </button>
          </div>
        </div>

        {confirmingCopy && (
          <div style={s.confirm} role="alertdialog" aria-label="Confirm copy">
            <span style={s.confirmText}>
              This replaces your own code for this task with {entry?.sharerName ?? 'their'} version.
              You cannot undo it.
            </span>
            <div style={s.confirmActions}>
              <button
                type="button"
                className="btn-primary"
                style={s.headerBtn}
                onClick={() => {
                  setConfirmingCopy(false)
                  onCopyToMyEditor({ code, files, design, moduleType })
                }}
              >
                Replace my work
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={s.headerBtn}
                onClick={() => setConfirmingCopy(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={s.body}>{renderWorkspace()}</div>

        {canPreview && iframeSrc && (
          <IframePreview src={iframeSrc} iframeRef={iframeRef} height={260} />
        )}
        {canRunCode && (
          <OutputPanel output={output} runStatus={runStatus} running={running} openOnRun />
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--colour-bg, #fff)',
    zIndex: 1400,
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
  },
  panel: { display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    borderBottom: '2px solid #0d9488',
    paddingBottom: 8,
  },
  headerText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  title: { fontWeight: 700, fontSize: 15 },
  subtitle: { fontSize: 12, color: 'var(--colour-muted)' },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  headerBtn: { fontSize: 13, padding: '5px 12px' },
  confirm: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: 10,
    borderRadius: 8,
    border: '1px solid var(--colour-danger, #dc2626)',
    background: 'rgba(220, 38, 38, 0.06)',
  },
  confirmText: { fontSize: 12 },
  confirmActions: { display: 'flex', gap: 8 },
  body: { flex: 1, minHeight: 0, overflow: 'auto' },
  editorWrap: { height: '100%', minHeight: 240 },
}
