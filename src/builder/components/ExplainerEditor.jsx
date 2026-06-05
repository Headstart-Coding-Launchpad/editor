import React from 'react'
export { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'

export default function ExplainerEditor({ title, value, onChange, lessonType, inlineCodeLanguages, assets, assetsPath, storageAssets }) {
  return (
    <MarkdownFieldEditor
      title={title}
      value={value}
      onChange={onChange}
      ariaLabel="Explainer editor views"
      placeholder="Write the task explainer in Markdown..."
      height={240}
      minHeight={180}
      showTitle
      lessonType={lessonType}
      inlineCodeLanguages={inlineCodeLanguages}
      assets={assets}
      assetsPath={assetsPath}
      storageAssets={storageAssets}
    />
  )
}
