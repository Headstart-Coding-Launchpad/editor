import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { firstViewKey, useFirstView } from '../../shared/motion'
import InkSurface from '../liveInk/InkSurface'

// The longest the first-view auto-fold waits for the card's pictures (foldIfTallerThan).
const AUTO_FOLD_SETTLE_MS = 1500

export default function ExplainerPanel({
  title,
  content,
  collapsible = true,
  fill = false,
  markdownTextScale = 1,
  topicType = null,
  showLibrary = true,
  // The calm code screen moves the Topic library chip to the workspace's code row: the chip here
  // hides (`libraryButton` false) and the row asks the library to open through `libraryRequest`
  // (a count; 0 is none), cleared with `onLibraryRequestHandled`.
  libraryButton = true,
  libraryRequest = 0,
  onLibraryRequestHandled,
  onTopicOpen,
  onTopicClose,
  openTopicId,
  disableCopy = false,
  imageLayout = 'stacked',
  onCollapsedChange,
  highlighted = false,
  // Which task this panel shows (usually `firstViewKey(lessonId, taskId)`). On that task's first
  // view the panel drops in and its bullets slide in; null (Builder editor panes, StudentModal)
  // never animates.
  entranceKey = null,
  // Presentation annotations: names this panel's content (e.g. `explainer:7`, `info:3`) so the
  // teacher can point at, draw on and highlight it live. Null leaves it un-annotatable.
  inkSurfaceId = null,
  // Logs a student's open of a "See example" fence in this content (the task explainer only;
  // see MarkdownRenderer's onExampleOpen).
  onExampleOpen,
  // Room (px) to keep clear at the right of the title bar for a control laid over it (the side
  // explainer's collapse arrow), so a long title wraps before it rather than running under it.
  titleEndInset = 0,
  // A height (px) the card has room for: on its first view a card taller than this (all of it,
  // decided once: at once, or when its pictures have loaded, at most AUTO_FOLD_SETTLE_MS later)
  // starts folded to its title strip. Never once the student scrolls, taps or focuses inside it.
  // Null never folds. (The calm Scratch screen, stacked beside the stage.)
  foldIfTallerThan = null,
  // Shown inside the card under the text, folded or not (the calm Scratch screen's hint), so it
  // never scrolls away with the steps and stays when the card folds to its title.
  footer = null,
}) {
  const isFirstView = useFirstView(
    entranceKey == null ? null : firstViewKey('explainer', entranceKey)
  )
  const [collapsed, setCollapsed] = useState(false)
  // The entrance belongs to the task's arrival only: opening the panel again after a ▲/▼ toggle,
  // or new content for the same task (a Builder edit, the complete-code reveal), shows it still.
  // Content arriving into an empty panel is still the arrival.
  const [entrance, setEntrance] = useState({ key: entranceKey, content, over: false })
  if (entrance.key !== entranceKey) {
    setEntrance({ key: entranceKey, content, over: false })
  } else if (!entrance.over && content !== entrance.content) {
    setEntrance(entrance.content ? { ...entrance, over: true } : { ...entrance, content })
  }
  const showEntrance =
    isFirstView && entrance.key === entranceKey && !entrance.over && content === entrance.content
  const [expanded, setExpanded] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const [atBottom, setAtBottom] = useState(false)
  const panelRef = useRef(null)
  const contentRef = useRef(null)
  const isCollapsed = collapsible && collapsed
  const titleBarStyle =
    titleEndInset > 0 ? { ...s.titleBar, paddingRight: 12 + titleEndInset } : s.titleBar
  const canExpandOverlay = !fill

  // Reports this accordion's own open/closed state upward — used by LessonTaskContent so
  // the teacher's student list can show whether the info/explainer pane is open, on lesson
  // types (and the mobile fallback) that use this accordion instead of the side-rail collapse.
  useEffect(() => {
    if (collapsible) onCollapsedChange?.(collapsed)
  }, [collapsible, collapsed, onCollapsedChange])

  // The auto-fold decides ONCE, on the first view: measured as soon as there is a cap, and if the
  // card fits then, once more when its pictures have loaded (or AUTO_FOLD_SETTLE_MS has passed),
  // then never again. A scroll, tap, key or focus inside the card first means the student is
  // reading it: no fold at all. 'idle' (no cap yet) | 'waiting' (pictures) | 'done'.
  const autoFoldRef = useRef({ state: 'idle', deadline: 0 })
  // The card's full height: what it takes on screen now (title, padding, border, the show-more
  // bar), plus the text still scrolled out of view inside it.
  const cardTooTall = useCallback(() => {
    const panel = panelRef.current
    const el = contentRef.current
    if (!panel || !el) return false
    return panel.offsetHeight - el.clientHeight + el.scrollHeight > foldIfTallerThan
  }, [foldIfTallerThan])
  useLayoutEffect(() => {
    const fold = autoFoldRef.current
    if (fold.state === 'done' || isCollapsed || !collapsible || !(foldIfTallerThan > 0)) {
      return undefined
    }
    const panel = panelRef.current
    const el = contentRef.current
    if (!panel || !el) return undefined
    if (fold.state === 'idle') {
      if (cardTooTall()) {
        fold.state = 'done'
        setCollapsed(true)
        return undefined
      }
      fold.state = 'waiting'
      fold.deadline = Date.now() + AUTO_FOLD_SETTLE_MS
    }
    const settle = () => {
      if (fold.state !== 'waiting') return
      fold.state = 'done'
      if (cardTooTall()) setCollapsed(true)
    }
    // A picture loading makes the card taller (load does not bubble: heard in the capture phase).
    const onPicture = () => {
      if ([...el.querySelectorAll('img')].every((img) => img.complete)) settle()
    }
    const onRead = () => {
      fold.state = 'done'
    }
    const timer = setTimeout(settle, Math.max(0, fold.deadline - Date.now()))
    el.addEventListener('load', onPicture, true)
    el.addEventListener('error', onPicture, true)
    el.addEventListener('scroll', onRead, true)
    const readEvents = ['pointerdown', 'keydown', 'focusin', 'wheel']
    for (const type of readEvents) panel.addEventListener(type, onRead, true)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('load', onPicture, true)
      el.removeEventListener('error', onPicture, true)
      el.removeEventListener('scroll', onRead, true)
      for (const type of readEvents) panel.removeEventListener(type, onRead, true)
    }
  }, [cardTooTall, collapsible, foldIfTallerThan, isCollapsed])

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
      // The "See example" dialog is portalled out of the panel but belongs to it.
      if (event.target?.closest?.('.md-example-backdrop')) return
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
    // Keyed by task so a panel that stays mounted across tasks (the teacher view) still gets a
    // fresh element, and its entrance, for each new task.
    <div
      key={entranceKey ?? undefined}
      ref={panelRef}
      style={{
        ...s.panel,
        ...(expanded ? s.panelExpanded : {}),
        ...(fill ? s.panelFill : {}),
      }}
      className={showEntrance ? 'card ui-collapsible motion-drop-in' : 'card ui-collapsible'}
    >
      {collapsible ? (
        <button
          className={highlighted ? 'pane-highlight-pulse' : undefined}
          style={titleBarStyle}
          onClick={() => {
            autoFoldRef.current.state = 'done'
            setEntrance((current) => ({ ...current, over: true }))
            setCollapsed((c) => !c)
          }}
          aria-expanded={!collapsed}
        >
          <h2 style={s.titleText}>{title}</h2>
          <span style={s.toggleIcon}>{collapsed ? '▼' : '▲'}</span>
        </button>
      ) : (
        title && (
          <div style={titleBarStyle}>
            <h2 style={s.titleText}>{title}</h2>
          </div>
        )
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
            data-explainer-content=""
            style={{
              ...s.content,
              ...(fill ? s.contentFill : {}),
              ...(fill && footer ? s.contentFillAboveFooter : {}),
            }}
            onScroll={updateScrollState}
          >
            <InkSurface id={inkSurfaceId}>
              <MarkdownRenderer
                content={content}
                textScale={markdownTextScale}
                topicType={topicType}
                showLibrary={showLibrary}
                libraryButton={libraryButton}
                libraryRequest={libraryRequest}
                onLibraryRequestHandled={onLibraryRequestHandled}
                onTopicOpen={onTopicOpen}
                onTopicClose={onTopicClose}
                openTopicId={openTopicId}
                disableCopy={disableCopy}
                imageLayout={imageLayout}
                onExampleOpen={onExampleOpen}
                animateLists={showEntrance}
              />
            </InkSurface>
          </div>
          {!expanded && canExpandOverlay && canScroll && !atBottom && (
            <div style={s.showMoreBar}>
              <span style={s.showMoreFade} aria-hidden="true" />
              <button
                type="button"
                className="btn-primary"
                style={s.showMoreBtn}
                onClick={handleShowMore}
              >
                show more
              </button>
            </div>
          )}
        </div>
      )}
      {footer && (
        <div style={isCollapsed ? { ...s.footer, paddingTop: 12 } : s.footer}>{footer}</div>
      )}
      {expanded && !isCollapsed && canExpandOverlay && (
        <>
          <div style={s.expandedBackdrop} onPointerDown={() => setExpanded(false)} />
          <div style={s.expandedShell}>
            <div style={s.expandedTitleBar}>
              <h2 style={s.titleText}>{title}</h2>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.expandedHideBtn}
                onClick={() => setExpanded(false)}
              >
                hide
              </button>
            </div>
            <div style={s.contentExpanded}>
              <MarkdownRenderer
                content={content}
                textScale={markdownTextScale}
                topicType={topicType}
                showLibrary={showLibrary}
                libraryButton={libraryButton}
                onTopicOpen={onTopicOpen}
                onTopicClose={onTopicClose}
                openTopicId={openTopicId}
                disableCopy={disableCopy}
                imageLayout={imageLayout}
                onExampleOpen={onExampleOpen}
              />
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
    // Sizes to its content and shrinks only when there is not room, rather than always
    // stretching. An information task with two bullet points used to leave roughly 85%
    // of the viewport as empty panel below the text, and information is the second most
    // common task type in the product. Long content still fills and scrolls internally.
    flex: '0 1 auto',
    minHeight: 0,
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
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
    // Composed lessons use longer, emoji-prefixed titles than a single-type lesson does,
    // and the title ran straight into the collapse chevron with no gap at all.
    gap: 10,
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
    minWidth: 0,
    overflowWrap: 'anywhere',
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
    padding: '10px 14px 12px',
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
  contentFillAboveFooter: { paddingBottom: 12 },
  footer: {
    flexShrink: 0,
    minHeight: 0,
    maxHeight: '45%',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 12px 12px',
  },
  contentExpanded: {
    flex: 1,
    maxHeight: 'calc(min(62vh, 560px) - 42px)',
    overflowY: 'auto',
    padding: '14px 18px 48px',
  },
  // Its own row under the text, never floating over it: on a tablet the clamped content is only
  // a few lines tall, and an overlaid button hid most of the tutor's instructions (HSC Audit #6).
  showMoreBar: {
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 12px 6px',
    borderTop: '1px solid #f1f5f9',
    background: '#fff',
  },
  showMoreFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 18,
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0), #fff)',
  },
  showMoreBtn: {
    padding: '5px 14px',
    fontSize: 12.5,
    borderRadius: 999,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
}
