import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { searchTopics } from './topicLibrary'

export function TopicReference({ topic, label, onOpen, renderSummary: SummaryContent = null }) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewPosition, setPreviewPosition] = useState(null)
  const referenceRef = useRef(null)
  const closeTimerRef = useRef(null)

  const positionPreview = useCallback(() => {
    const rect = referenceRef.current?.getBoundingClientRect()
    if (!rect) return
    const gutter = 10
    const previewWidth = 250
    const maxLeft = Math.max(gutter, window.innerWidth - previewWidth - gutter)
    setPreviewPosition({
      left: Math.min(Math.max(rect.left, gutter), maxLeft),
      top: rect.bottom + 7,
    })
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const openPreview = useCallback(() => {
    cancelClose()
    positionPreview()
    setShowPreview(true)
  }, [cancelClose, positionPreview])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setShowPreview(false), 80)
  }, [cancelClose])

  useEffect(() => {
    if (!showPreview) return undefined
    positionPreview()
    window.addEventListener('resize', positionPreview)
    window.addEventListener('scroll', positionPreview, true)
    return () => {
      window.removeEventListener('resize', positionPreview)
      window.removeEventListener('scroll', positionPreview, true)
    }
  }, [positionPreview, showPreview])

  useEffect(() => () => cancelClose(), [cancelClose])

  return (
    <span
      ref={referenceRef}
      style={s.referenceWrap}
      onMouseEnter={openPreview}
      onMouseLeave={scheduleClose}
      onFocus={openPreview}
      onBlur={scheduleClose}
    >
      <button type="button" style={s.reference} onClick={() => onOpen(topic?.id)}>
        {label}
      </button>
      {showPreview &&
        previewPosition &&
        topic &&
        createPortal(
          <span
            style={{ ...s.preview, ...previewPosition }}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              style={s.previewTitle}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onOpen(topic.id)}
            >
              {topic.title}
            </button>
            <span style={s.previewCategory}>{topic.category}</span>
            {SummaryContent ? (
              <SummaryContent content={topic.summary} />
            ) : (
              <span style={s.previewText}>{topic.summary}</span>
            )}
          </span>,
          document.body
        )}
    </span>
  )
}

export function TopicLibraryDialog({
  topics,
  initialTopicId,
  onClose,
  onTopicSelect,
  renderMarkdown: MarkdownContent,
  topicType = null,
  studentName,
  onSendToStudent,
  onSendToAll,
  students,
  onSendToIndividual,
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialTopicId || topics[0]?.id || '')
  const [sendMenuOpen, setSendMenuOpen] = useState(false)
  const sendMenuRef = useRef(null)
  const filteredTopics = useMemo(() => searchTopics(topics, query), [topics, query])
  const selectedTopic =
    topics.find((topic) => topic.id === selectedId) ?? filteredTopics[0] ?? topics[0]

  // teacher-view mode: "Send to all" default with per-student dropdown
  const hasStudentList = students && students.length > 0 && (onSendToAll || onSendToIndividual)
  // student-modal mode: "Send to [name]" with optional "Send to all"
  const hasStudentTarget = !hasStudentList && (onSendToStudent || onSendToAll)
  const hasSendButton = hasStudentList || hasStudentTarget

  useEffect(() => {
    if (!sendMenuOpen) return
    function onDown(e) {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target)) setSendMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [sendMenuOpen])

  useEffect(() => {
    if (initialTopicId) setSelectedId(initialTopicId)
  }, [initialTopicId])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      style={s.overlay}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section style={s.dialog} role="dialog" aria-modal="true" aria-label="Topic library">
        <header style={s.header}>
          <div>
            <h2 style={s.heading}>Topic Library</h2>
            <div style={s.subheading}>Look up commands, concepts and building blocks.</div>
          </div>
          <button type="button" style={s.close} onClick={onClose} aria-label="Close topic library">
            x
          </button>
        </header>
        <div style={s.body}>
          <aside style={s.listPane}>
            <input
              style={s.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics..."
              aria-label="Search topics"
              autoFocus
            />
            <div style={s.results}>
              {filteredTopics.map((topic) => (
                <button
                  type="button"
                  key={topic.id}
                  style={{
                    ...s.topicResult,
                    ...(selectedTopic?.id === topic.id ? s.topicResultActive : {}),
                  }}
                  onClick={() => {
                    setSelectedId(topic.id)
                    onTopicSelect?.(topic.id)
                  }}
                >
                  <span style={s.resultTitle}>{topic.title}</span>
                  <span style={s.resultMeta}>{topic.category}</span>
                </button>
              ))}
              {filteredTopics.length === 0 && <p style={s.empty}>No matching topics.</p>}
            </div>
          </aside>
          <article style={s.detail}>
            {selectedTopic ? (
              <>
                <div style={s.detailTopRow}>
                  <div style={s.detailCategory}>{selectedTopic.category}</div>
                  {hasSendButton && (
                    <div ref={sendMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                      {hasStudentList ? (
                        // Teacher-view mode: "Send to all ▾" with per-student list
                        <>
                          <button
                            style={s.sendBtn}
                            onClick={
                              students.length > 0 || onSendToIndividual
                                ? () => setSendMenuOpen((v) => !v)
                                : () => onSendToAll?.(selectedTopic.id)
                            }
                            aria-expanded={sendMenuOpen}
                          >
                            Send to all {students.length > 0 ? '▾' : ''}
                          </button>
                          {sendMenuOpen && (
                            <div
                              style={{ ...s.sendMenu, maxHeight: 260, overflowY: 'auto' }}
                              className="ui-popover"
                            >
                              {onSendToAll && (
                                <button
                                  style={{ ...s.sendMenuItem, fontWeight: 700 }}
                                  onClick={() => {
                                    setSendMenuOpen(false)
                                    onSendToAll(selectedTopic.id)
                                  }}
                                >
                                  Send to all students
                                </button>
                              )}
                              {students.length > 0 && <div style={s.sendMenuDivider} />}
                              {students.map((st) => (
                                <button
                                  key={st.anonymousId}
                                  style={s.sendMenuItem}
                                  onClick={() => {
                                    setSendMenuOpen(false)
                                    onSendToIndividual?.(selectedTopic.id, st.anonymousId)
                                  }}
                                >
                                  {st.displayName}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : onSendToStudent && !onSendToAll ? (
                        // Student-modal mode, no "send to all"
                        <button style={s.sendBtn} onClick={() => onSendToStudent(selectedTopic.id)}>
                          Send to {studentName ?? 'student'}
                        </button>
                      ) : (
                        // Student-modal mode with "send to all" dropdown
                        <>
                          <button
                            style={s.sendBtn}
                            onClick={() => setSendMenuOpen((v) => !v)}
                            aria-expanded={sendMenuOpen}
                          >
                            Send to {studentName ?? 'student'} ▾
                          </button>
                          {sendMenuOpen && (
                            <div style={s.sendMenu} className="ui-popover">
                              {onSendToStudent && (
                                <button
                                  style={s.sendMenuItem}
                                  onClick={() => {
                                    setSendMenuOpen(false)
                                    onSendToStudent(selectedTopic.id)
                                  }}
                                >
                                  Send to {studentName ?? 'student'}
                                </button>
                              )}
                              {onSendToAll && (
                                <button
                                  style={{ ...s.sendMenuItem, fontWeight: 700 }}
                                  onClick={() => {
                                    setSendMenuOpen(false)
                                    onSendToAll(selectedTopic.id)
                                  }}
                                >
                                  Send to all students
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <h3 style={s.detailTitle}>{selectedTopic.title}</h3>
                <p style={s.detailSummary}>{selectedTopic.summary}</p>
                {selectedTopic.description && (
                  <div style={s.detailText}>
                    <MarkdownContent
                      content={selectedTopic.description}
                      textScale={0.95}
                      topicType={topicType}
                    />
                  </div>
                )}
                {selectedTopic.syntax && (
                  <div style={s.syntaxContent}>
                    <MarkdownContent
                      content={selectedTopic.syntax}
                      textScale={0.95}
                      topicType={topicType}
                    />
                  </div>
                )}
                {selectedTopic.related.length > 0 && (
                  <div style={s.related}>
                    <div style={s.relatedLabel}>Related topics</div>
                    {selectedTopic.related.map((id) => {
                      const relatedTopic = topics.find((topic) => topic.id === id)
                      if (!relatedTopic) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          style={s.relatedButton}
                          onClick={() => setSelectedId(id)}
                        >
                          {relatedTopic.title}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <p style={s.empty}>No topics are available for this lesson type.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}

const s = {
  referenceWrap: { position: 'relative', display: 'inline-block' },
  reference: {
    border: 'none',
    background: '#f0eafa',
    borderBottom: '2px dotted var(--colour-primary)',
    borderRadius: 4,
    color: 'var(--colour-primary-dark)',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 700,
    padding: '0 3px',
  },
  preview: {
    position: 'fixed',
    zIndex: 1200,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    width: 250,
    boxSizing: 'border-box',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 8px 26px rgba(35,18,76,0.18)',
    padding: 10,
  },
  previewTitle: {
    border: 'none',
    background: 'none',
    padding: 0,
    textAlign: 'left',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-title)',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  previewCategory: {
    color: '#6b7280',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  previewText: { color: 'var(--colour-text)', fontSize: '0.82rem', lineHeight: 1.4 },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(17, 24, 39, 0.48)',
    padding: 24,
  },
  dialog: {
    display: 'flex',
    flexDirection: 'column',
    width: 'min(850px, 100%)',
    height: 'min(620px, 90vh)',
    background: '#fff',
    color: 'var(--colour-text)',
    borderRadius: 14,
    boxShadow: '0 18px 60px rgba(0,0,0,0.28)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: '18px 22px',
    color: '#fff',
    background: 'var(--colour-primary)',
  },
  heading: { margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.35rem' },
  subheading: { marginTop: 3, fontSize: '0.83rem', opacity: 0.9 },
  close: {
    width: 34,
    height: 34,
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: 8,
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  body: { display: 'grid', gridTemplateColumns: '290px 1fr', minHeight: 0, flex: 1 },
  listPane: {
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    background: '#fff',
    minHeight: 0,
  },
  search: {
    margin: 14,
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
  results: { overflowY: 'auto', padding: '0 8px 12px' },
  topicResult: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderRadius: 7,
    background: 'none',
    padding: '9px 10px',
    cursor: 'pointer',
  },
  topicResultActive: { background: '#f0eafa' },
  resultTitle: { color: 'var(--colour-text)', fontFamily: 'var(--font-body)', fontWeight: 700 },
  resultMeta: { color: '#6b7280', fontSize: '0.75rem' },
  detail: {
    overflowY: 'auto',
    padding: '28px 32px',
    background: '#fff',
    color: 'var(--colour-text)',
    fontFamily: 'var(--font-body)',
  },
  detailTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 2,
  },
  detailCategory: {
    color: 'var(--colour-primary)',
    fontSize: '0.76rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  sendBtn: {
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  sendMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: 200,
    zIndex: 100,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sendMenuItem: {
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 5,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  sendMenuDivider: {
    height: 1,
    background: '#e5e7eb',
    margin: '4px 0',
  },
  detailTitle: {
    margin: '6px 0 10px',
    color: 'var(--colour-primary-dark)',
    fontFamily: 'var(--font-title)',
    fontSize: '1.55rem',
  },
  detailSummary: {
    margin: '0 0 16px',
    color: 'var(--colour-text)',
    fontWeight: 700,
    fontSize: '1.02rem',
    lineHeight: 1.5,
  },
  detailText: { color: 'var(--colour-text)', lineHeight: 1.6, margin: '0 0 16px' },
  syntaxContent: { marginTop: 10 },
  related: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 22 },
  relatedLabel: {
    width: '100%',
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  relatedButton: {
    border: '1px solid #ded1f3',
    background: '#f7f2ff',
    color: 'var(--colour-primary)',
    borderRadius: 999,
    padding: '5px 11px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  empty: { color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', padding: 10 },
}
