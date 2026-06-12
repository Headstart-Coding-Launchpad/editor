import React, { useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerPanel({ title, content, collapsible = true, fill = false, markdownTextScale = 1, topicType = null, onTopicOpen, onTopicClose, openTopicId }) {
  const [collapsed, setCollapsed] = useState(false)
  const isCollapsed = collapsible && collapsed

  return (
    <div style={{ ...s.panel, ...(fill ? s.panelFill : {}) }} className="card ui-collapsible">
      {collapsible ? (
        <button
          style={s.titleBar}
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
        >
          <h2 style={s.titleText}>{title}</h2>
          <span style={s.toggleIcon}>{collapsed ? '▼' : '▲'}</span>
        </button>
      ) : (
        title && <div style={s.titleBar}><h2 style={s.titleText}>{title}</h2></div>
      )}

      {!isCollapsed && (
        <div style={{ ...s.content, ...(fill ? s.contentFill : {}) }}>
          <MarkdownRenderer content={content} textScale={markdownTextScale} topicType={topicType} showLibrary onTopicOpen={onTopicOpen} onTopicClose={onTopicClose} openTopicId={openTopicId} />
        </div>
      )}
    </div>
  )
}

const s = {
  panel: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  panelFill: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  titleBar: {
    width: '100%',
    background: 'var(--colour-primary)',
    border: 'none',
    borderRadius: 0,
    padding: '10px 14px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
  },
  titleText: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: '#fff',
    lineHeight: 1.25,
  },
  toggleIcon: {
    fontSize: '0.75rem',
    color: '#fff',
    opacity: 0.8,
    flexShrink: 0,
    marginLeft: 10,
  },
  content: {
    padding: '14px 16px',
  },
  contentFill: {
    flex: 1,
    maxHeight: 'none',
    padding: '24px 28px',
  },
}
