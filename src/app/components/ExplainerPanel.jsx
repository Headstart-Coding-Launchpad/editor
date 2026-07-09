import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerPanel({ title, content, collapsible = true, fill = false, markdownTextScale = 1, topicType = null, onTopicOpen, onTopicClose, openTopicId, disableCopy = false }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const [atBottom, setAtBottom] = useState(false)
  const panelRef = useRef(null)
  const contentRef = useRef(null)
  const isCollapsed = collapsible && collapsed
  const canExpandOverlay = !fill

  const updateScrollState = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const overflow = el.scrollHeight > el.clientHeight + 2
    setCanScroll(overflow)
    setAtBottom(!overflow || el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
  }, [])

  useEffect(() => {
    if (isCollapsed) return
    const frame = requestAnimationFrame(updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [content, expanded, fill, isCollapsed, updateScrollState])

  useEffect(() => {
    if (!expanded) return
    function onPointerDown(event) {
      if (panelRef.current?.contains(event.target)) return
      setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [expanded])

  function handleShowMore() {
    setExpanded(true)
    requestAnimationFrame(() => {
      updateScrollState()
    })
  }

  return (
    <div
      ref={panelRef}
      style={{
        ...s.panel,
        ...(expanded ? s.panelExpanded : {}),
        ...(fill ? s.panelFill : {}),
      }}
      className="card ui-collapsible"
    >
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
        <div
          style={{
            ...s.contentShell,
            ...(fill ? s.contentShellFill : {}),
          }}
        >
          <div
            ref={contentRef}
            style={{
              ...s.content,
              ...(fill ? s.contentFill : {}),
            }}
            onScroll={updateScrollState}
          >
            <MarkdownRenderer content={content} textScale={markdownTextScale} topicType={topicType} showLibrary onTopicOpen={onTopicOpen} onTopicClose={onTopicClose} openTopicId={openTopicId} disableCopy={disableCopy} />
          </div>
          {!expanded && canExpandOverlay && canScroll && !atBottom && (
            <div style={s.showMoreBar}>
              <button type="button" className="btn-primary" style={s.showMoreBtn} onClick={handleShowMore}>
                show more
              </button>
            </div>
          )}
        </div>
      )}
      {expanded && !isCollapsed && canExpandOverlay && (
        <>
          <div style={s.expandedBackdrop} onPointerDown={() => setExpanded(false)} />
          <div style={s.expandedShell}>
            <div style={s.expandedTitleBar}>
              <h2 style={s.titleText}>{title}</h2>
              <button type="button" className="btn-primary" style={s.expandedHideBtn} onClick={() => setExpanded(false)}>
                hide
              </button>
            </div>
            <div style={s.contentExpanded}>
              <MarkdownRenderer content={content} textScale={markdownTextScale} topicType={topicType} showLibrary onTopicOpen={onTopicOpen} onTopicClose={onTopicClose} openTopicId={openTopicId} disableCopy={disableCopy} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  panel: {
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'clamp(86px, calc(30vh - 78px), 220px)',
    minHeight: 0,
    position: 'relative',
  },
  panelExpanded: {
    overflow: 'visible',
    zIndex: 60,
  },
  expandedBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    background: 'transparent',
  },
  panelFill: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'none',
  },
  titleBar: {
    width: '100%',
    background: 'var(--colour-primary)',
    border: 'none',
    borderRadius: 0,
    padding: '7px 12px 8px',
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
    fontSize: '1.05rem',
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
  contentShell: {
    position: 'relative',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  expandedShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 62,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 18px 40px rgba(15,23,42,0.24)',
    maxHeight: 'min(62vh, 560px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  expandedTitleBar: {
    width: '100%',
    background: 'var(--colour-primary)',
    padding: '7px 12px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexShrink: 0,
  },
  expandedHideBtn: {
    background: '#fff',
    color: 'var(--colour-primary)',
    borderColor: '#fff',
    padding: '5px 12px',
    fontSize: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  contentShellFill: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    zIndex: 'auto',
    background: 'transparent',
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
  },
  content: {
    padding: '10px 14px 42px',
    overflowY: 'auto',
    maxHeight: 'clamp(48px, calc(30vh - 132px), 180px)',
    minHeight: 0,
  },
  contentFill: {
    flex: 1,
    minHeight: 0,
    maxHeight: 'none',
    overflowY: 'auto',
    padding: '18px 22px 48px',
  },
  contentExpanded: {
    flex: 1,
    maxHeight: 'calc(min(62vh, 560px) - 42px)',
    overflowY: 'auto',
    padding: '14px 18px 48px',
  },
  showMoreBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 12px 8px',
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.96) 45%)',
  },
  showMoreBtn: {
    pointerEvents: 'auto',
    padding: '7px 16px',
    fontSize: 13,
    borderRadius: 999,
    boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
  },
}
