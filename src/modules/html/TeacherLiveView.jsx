import React, { useState, useEffect, useMemo, useRef } from 'react'
import HtmlEditor from './HtmlEditor.jsx'
import { buildIframeSrc } from './iframe'
import IframePreview from '../../app/components/IframePreview'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'

export default function HtmlTeacherLiveView({
  lesson,
  task,
  displayState,
  readOnly,
  onChange,
  onTabChange,
  onActivity,
}) {
  const files = displayState?.files ?? []
  const fileNamesKey = files.map((f) => f.name).join('\0')

  const [activeFile, setActiveFile] = useState(() => files[0]?.name ?? '')

  // Reset active file tab when the file list changes (tab switch), but not on content edits
  useEffect(() => {
    setActiveFile(files[0]?.name ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileNamesKey])

  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets('html')
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(
    lesson?.id,
    lesson?.storageAssets ?? []
  )
  const htmlSharedAssetNames = lesson?.sharedAssetNames ?? null
  const htmlIncludedTypeAssets =
    htmlSharedAssetNames !== null
      ? htmlTypeAssets.filter((a) => htmlSharedAssetNames.includes(a.name))
      : htmlTypeAssets
  const storageAssets = [
    ...lessonStorageAssets.filter((a) => a.showInEditor),
    ...htmlIncludedTypeAssets.filter((a) => !lessonStorageAssets.some((b) => b.name === a.name)),
  ]

  // The read-only stage view (the tutor's panel during a lesson) shows the page beside the
  // code, as students see it (HSC Audit, Visual Review 11). A stage's files are fixed, so it
  // rebuilds only when the shown stage changes, never per keystroke.
  const iframeRef = useRef(null)
  const filesKey = files.map((file) => `${file.name}\u0000${file.content}`).join('\u0001')
  const assetsKey = storageAssets
    .map((asset) => `${asset.name}\u0000${asset.url ?? ''}`)
    .join('\u0001')
  const previewSrc = useMemo(
    () =>
      readOnly && files.length
        ? buildIframeSrc(files, task?.entryFile ?? 'index.html', {
            assets: lesson?.assets ?? [],
            assetsPath: resolveAssetsPath(lesson?.assetsPath) || '',
            storageAssets,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly, filesKey, assetsKey, task?.entryFile, lesson?.assetsPath]
  )

  const editor = (
    <HtmlEditor
      files={files}
      activeFile={activeFile}
      onTabChange={(filename) => {
        setActiveFile(filename)
        onTabChange?.(filename)
      }}
      onFileChange={onChange}
      onActivity={onActivity}
      readOnly={readOnly}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      assets={lesson?.assets}
      storageAssets={storageAssets}
      attachedTop={!readOnly ? undefined : true}
    />
  )

  if (!previewSrc) return editor

  return (
    <div style={s.row} data-testid="html-teacher-preview-row">
      <div style={s.editorCol}>{editor}</div>
      <div style={s.previewCol}>
        <IframePreview src={previewSrc} iframeRef={iframeRef} fill />
      </div>
    </div>
  )
}

const s = {
  row: { display: 'flex', gap: 8, flex: 1, minHeight: 320, minWidth: 0 },
  editorCol: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' },
  previewCol: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' },
}
