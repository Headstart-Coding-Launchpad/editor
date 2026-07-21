import React, { useState, useEffect } from 'react'
import HtmlEditor from './HtmlEditor.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'

export default function HtmlTeacherLiveView({ lesson, displayState, readOnly, onChange, onActivity }) {
  const files = displayState?.files ?? []
  const fileNamesKey = files.map(f => f.name).join('\0')

  const [activeFile, setActiveFile] = useState(() => files[0]?.name ?? '')

  // Reset active file tab when the file list changes (tab switch), but not on content edits
  useEffect(() => {
    setActiveFile(files[0]?.name ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileNamesKey])

  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets('html')
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(lesson?.id, lesson?.storageAssets ?? [])
  const htmlSharedAssetNames = lesson?.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const storageAssets = [
    ...lessonStorageAssets.filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]

  return (
    <HtmlEditor
      files={files}
      activeFile={activeFile}
      onTabChange={setActiveFile}
      onFileChange={onChange}
      onActivity={onActivity}
      readOnly={readOnly}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      assets={lesson?.assets}
      storageAssets={storageAssets}
      attachedTop={!readOnly ? undefined : true}
    />
  )
}
