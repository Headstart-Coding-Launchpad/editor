import React, { useState } from 'react'
import { createEntry } from '../../../filesystem/filesystem.js'
import { recordPageVisit, recordSearchQuery } from '../../desktopState.js'
import { getPage, searchPages, findPageByUrl } from './siteGraph.js'

// A simulated browser window: address bar, Back/Forward/Refresh/Home chrome, a search engine
// homepage, and lesson-authored fake web pages with links, sponsored/broken/download pages.
// Nothing here makes real network requests — every "site" is data from `siteGraph`, authored
// per task (see docs/authoring/desktop.md). Only two pieces of browsing state are persisted
// into desktop state (for checks and continuity): `desktop.browserVisited` (dedup log of every
// page id ever visited) and `desktop.lastSearchQuery` (most recent search box submission).
// Back/forward history and the current page are otherwise local to this window session, the
// same ephemeral-on-close pattern as Text Editor's zoom/Image Viewer's zoom state.
export default function BrowserApp({ win, state, onStateChange, disabled, siteGraph, onInteraction }) {
  const { fs } = state
  const initialLocation = win.pageId
    ? { type: 'page', pageId: win.pageId }
    : win.searchQuery
      ? { type: 'search', query: win.searchQuery }
      : { type: 'page', pageId: siteGraph.homepageId }

  const [history, setHistory] = useState([initialLocation])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [addressDraft, setAddressDraft] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [notFound, setNotFound] = useState(false)

  const location = history[historyIndex]
  const page = location.type === 'page' ? getPage(siteGraph, location.pageId) : null
  const results = location.type === 'search' ? searchPages(siteGraph, location.query) : []

  function pushLocation(next) {
    const truncated = history.slice(0, historyIndex + 1)
    setHistory([...truncated, next])
    setHistoryIndex(truncated.length)
    setNotFound(false)
    setAddressDraft('')
    const windowPatch = next.type === 'page'
      ? { pageId: next.pageId, searchQuery: undefined }
      : { pageId: undefined, searchQuery: next.query }
    const withWindow = { ...state, windows: state.windows.map(w => w.id === win.id ? { ...w, ...windowPatch } : w) }
    if (next.type === 'page') {
      onStateChange(recordPageVisit(withWindow, next.pageId))
      onInteraction?.({ browserPage: next.pageId })
    } else {
      onStateChange(recordSearchQuery(withWindow, next.query))
      onInteraction?.({ browserSearch: next.query })
    }
  }

  function goTo(pageId) {
    if (disabled) return
    if (!getPage(siteGraph, pageId)) { setNotFound(true); return }
    pushLocation({ type: 'page', pageId })
  }

  function goHome() {
    if (disabled) return
    pushLocation({ type: 'page', pageId: siteGraph.homepageId })
  }

  function goBack() {
    if (disabled || historyIndex === 0) return
    setHistoryIndex(historyIndex - 1)
    setNotFound(false)
  }

  function goForward() {
    if (disabled || historyIndex >= history.length - 1) return
    setHistoryIndex(historyIndex + 1)
    setNotFound(false)
  }

  function handleAddressSubmit(e) {
    e.preventDefault()
    if (disabled || !addressDraft.trim()) return
    const found = findPageByUrl(siteGraph, addressDraft)
    if (found) pushLocation({ type: 'page', pageId: found.pageId })
    else setNotFound(true)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    if (disabled || !searchDraft.trim()) return
    pushLocation({ type: 'search', query: searchDraft.trim() })
    setSearchDraft('')
  }

  function handleDownload(downloadPage) {
    if (disabled || !downloadPage?.download) return
    const path = `/Downloads/${downloadPage.download.fileName}`
    onStateChange({ ...state, fs: createEntry(fs, path, 'file', downloadPage.download.content ?? '') })
  }

  const currentUrl = location.type === 'page' ? (page?.url ?? '') : ''

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <button className="btn-ghost-outline" style={s.navBtn} disabled={disabled || historyIndex === 0} onClick={goBack} aria-label="Back">◀</button>
        <button className="btn-ghost-outline" style={s.navBtn} disabled={disabled || historyIndex >= history.length - 1} onClick={goForward} aria-label="Forward">▶</button>
        <button className="btn-ghost-outline" style={s.navBtn} disabled={disabled} onClick={() => setNotFound(false)} aria-label="Refresh">⟳</button>
        <button className="btn-ghost-outline" style={s.navBtn} disabled={disabled} onClick={goHome} aria-label="Home">🏠</button>
        <form onSubmit={handleAddressSubmit} style={s.addressForm}>
          <input
            type="text"
            value={addressDraft || currentUrl}
            onFocus={() => setAddressDraft(currentUrl)}
            onChange={e => setAddressDraft(e.target.value)}
            disabled={disabled}
            aria-label="Address bar"
            style={s.addressInput}
          />
        </form>
      </div>
      <div style={s.viewport}>
        {notFound ? (
          <BrokenPage message={`We can't find that page. Check the address, or go Home.`} />
        ) : location.type === 'search' ? (
          <SearchResults query={location.query} results={results} onOpen={goTo} />
        ) : !page ? (
          <BrokenPage message="This page has no content." />
        ) : page.kind === 'broken' ? (
          <BrokenPage message="This page can't be reached." />
        ) : (
          <PageView page={page} onOpenLink={goTo} onDownload={handleDownload} disabled={disabled} />
        )}
      </div>
      {location.type === 'page' && page?.kind === 'search' && (
        <SearchBox draft={searchDraft} onDraftChange={setSearchDraft} onSubmit={handleSearchSubmit} disabled={disabled} />
      )}
    </div>
  )
}

function SearchBox({ draft, onDraftChange, onSubmit, disabled }) {
  return (
    <form onSubmit={onSubmit} style={s.searchBoxForm}>
      <input
        type="search"
        value={draft}
        onChange={e => onDraftChange(e.target.value)}
        placeholder="Search…"
        aria-label="Search the web"
        disabled={disabled}
        style={s.searchBoxInput}
      />
      <button type="submit" className="btn-primary" style={s.searchBoxBtn} disabled={disabled}>Search</button>
    </form>
  )
}

function PageView({ page, onOpenLink, onDownload, disabled }) {
  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>{page.title}</h2>
      {page.content && <p style={s.pageContent}>{page.content}</p>}
      {page.kind === 'download' && page.download && (
        <button className="btn-primary" style={s.downloadBtn} disabled={disabled} onClick={() => onDownload(page)}>
          ⬇ Download {page.download.fileName}
        </button>
      )}
      {page.links?.length > 0 && (
        <ul style={s.linkList}>
          {page.links.map(link => (
            <li key={link.to}>
              <button className="btn-link" style={s.linkBtn} disabled={disabled} onClick={() => onOpenLink(link.to)}>
                {link.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchResults({ query, results, onOpen }) {
  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Results for "{query}"</h2>
      {results.length === 0 ? (
        <p style={s.pageContent}>No results found. Try different words.</p>
      ) : (
        <ul style={s.resultList}>
          {results.map(({ pageId, page }) => (
            <li key={pageId} style={s.resultItem}>
              {page.sponsored && <span style={s.sponsoredTag}>Ad</span>}
              <button className="btn-link" style={s.resultLink} onClick={() => onOpen(pageId)}>
                {page.title}
              </button>
              <div style={s.resultUrl}>{page.url}</div>
              {page.searchable?.snippet && <div style={s.resultSnippet}>{page.searchable.snippet}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BrokenPage({ message }) {
  return (
    <div style={s.brokenPage}>
      <span style={{ fontSize: '2rem' }}>⚠️</span>
      <p>{message}</p>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--ui-border)' },
  navBtn: { fontSize: '0.78rem', padding: '3px 8px' },
  addressForm: { flex: 1, minWidth: 0 },
  addressInput: {
    width: '100%', boxSizing: 'border-box', fontSize: '0.8rem', padding: '4px 10px',
    border: '1px solid var(--ui-border)', borderRadius: 14, fontFamily: 'var(--font-body)',
  },
  viewport: { flex: 1, minHeight: 0, overflowY: 'auto', background: '#fff' },
  page: { padding: '16px 20px', fontFamily: 'var(--font-body)' },
  pageTitle: { margin: '0 0 10px', fontSize: '1.1rem', color: 'var(--colour-text)' },
  pageContent: { fontSize: '0.88rem', color: 'var(--colour-text)', lineHeight: 1.6 },
  downloadBtn: { fontSize: '0.82rem', padding: '6px 14px', marginTop: 6 },
  linkList: { listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 },
  linkBtn: { fontSize: '0.85rem', textAlign: 'left', color: '#5b3bd6', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  resultList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 },
  resultItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  sponsoredTag: { alignSelf: 'flex-start', fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 3, padding: '1px 6px', marginBottom: 2 },
  resultLink: { fontSize: '0.95rem', textAlign: 'left', color: '#1a0dab', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  resultUrl: { fontSize: '0.76rem', color: '#0f9d58' },
  resultSnippet: { fontSize: '0.82rem', color: '#4b5563' },
  searchBoxForm: { display: 'flex', gap: 6, padding: '8px 12px', borderTop: '1px solid var(--ui-border)' },
  searchBoxInput: { flex: 1, fontSize: '0.85rem', padding: '5px 10px', border: '1px solid var(--ui-border)', borderRadius: 14, fontFamily: 'var(--font-body)' },
  searchBoxBtn: { fontSize: '0.8rem', padding: '5px 14px' },
  brokenPage: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 20px', color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.85rem', textAlign: 'center' },
}
