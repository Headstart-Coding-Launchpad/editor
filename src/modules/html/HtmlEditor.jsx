import React, { useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import AssetBrowser from '../../shared/AssetBrowser'

export default function HtmlEditor({
  files = [],
  activeFile,
  onTabChange,
  onFileChange,
  onSelectionChange,
  onActivity,
  remoteSelection,
  teacherHighlights,
  onHighlightDismiss,
  readOnly = false,
  assetsPath,
  assets,
  storageAssets,
  attachedTop = false,
  errorLine = null,
  onRunShortcut,
}) {
  const [showAssets, setShowAssets] = useState(false)
  const current = files.find((f) => f.name === activeFile) ?? files[0]
  const hasAssets = !!(assetsPath && assets?.length) || storageAssets?.length > 0

  return (
    <div style={s.wrap}>
      {/* File tabs + Assets toggle */}
      <div style={{ ...s.tabs, ...(attachedTop ? s.tabsAttachedTop : {}) }} className="ui-tabs">
        {files.map((f) => (
          <button
            key={f.name}
            className={`ui-tab ui-tab--code${f.name === activeFile ? ' is-active' : ''}`}
            style={{
              ...s.tab,
              ...(f.name === activeFile ? s.tabActive : {}),
            }}
            onClick={() => onTabChange?.(f.name)}
          >
            {f.name}
          </button>
        ))}
        {hasAssets && (
          <button
            className={`ui-tab${showAssets ? ' is-active' : ''}`}
            style={{
              ...s.tab,
              ...s.assetsTab,
              ...(showAssets ? s.assetsTabActive : {}),
            }}
            onClick={() => setShowAssets((o) => !o)}
          >
            Assets
          </button>
        )}
      </div>

      {/* Asset panel */}
      {showAssets && hasAssets && (
        <div style={s.assetPanel}>
          <AssetBrowser
            assetsPath={assetsPath}
            assets={assets}
            storageAssets={storageAssets}
            copyMode="relative"
          />
        </div>
      )}

      {/* Editor */}
      {current && (
        <CodeEditor
          key={current.name}
          value={current.content}
          language={current.type ?? 'html'}
          readOnly={readOnly}
          onChange={(content) => onFileChange?.(current.name, content)}
          onSelectionChange={(selection) => onSelectionChange?.(selection, current.name)}
          onActivity={(activity) => onActivity?.(activity, current.name)}
          remoteSelection={remoteSelection}
          teacherHighlights={teacherHighlights}
          onHighlightDismiss={onHighlightDismiss}
          errorLine={errorLine}
          onRunShortcut={onRunShortcut}
          style={{ flex: 1, minHeight: 240, ...(attachedTop ? s.editorAttachedTop : {}) }}
        />
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 240,
  },
  tabs: {
    display: 'flex',
    gap: 2,
    background: '#e5e7eb',
    padding: '4px 4px 0',
    borderRadius: '8px 8px 0 0',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tabsAttachedTop: {
    borderRadius: 0,
  },
  tab: {
    background: 'transparent',
    color: 'var(--colour-text)',
    fontFamily: 'var(--font-code)',
    fontSize: '0.8rem',
    padding: '5px 14px',
    borderRadius: '6px 6px 0 0',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    opacity: 0.65,
  },
  tabActive: {
    background: '#fafafa',
    opacity: 1,
    fontWeight: 700,
  },
  assetsTab: {
    marginLeft: 'auto',
    opacity: 0.75,
    background: 'transparent',
  },
  assetsTabActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
    opacity: 1,
    borderRadius: '6px 6px 0 0',
  },
  assetPanel: {
    maxHeight: 200,
    overflowY: 'auto',
    flexShrink: 0,
    borderBottom: '1px solid #e5e7eb',
  },
  editorAttachedTop: {
    borderRadius: '0 0 8px 8px',
  },
}
