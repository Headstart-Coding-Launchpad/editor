// A site graph is lesson-authored, read-only content — a small set of fake web pages that a
// Desktop task's simulated Browser app can navigate and search across. It is never part of
// mutable desktop state (unlike fs/recycleBin/windows): it doesn't change at runtime, only
// which pages a student has visited/searched does (see desktopState.js's browserVisited and
// lastSearchQuery).
//
// Shape:
// {
//   homepageId: 'home',
//   pages: {
//     [pageId]: {
//       url: 'https://example.com',        // fake address shown in the address bar
//       title: 'Example Site',
//       kind: 'page' | 'search' | 'broken' | 'download', // default 'page'; 'search' shows an inline search box
//       content: 'Plain-text body shown on the page.',
//       links: [{ label: 'Link text', to: 'other-page-id' }],
//       sponsored: false,                  // marks a search result as a sponsored/ad result
//       searchable: { keywords: ['...'], snippet: '...' }, // present => indexed by the search engine
//       download: { fileName: 'poster.txt', content: '...' }, // required when kind === 'download'
//     },
//   },
// }
//
// The search engine does not itself judge relevance or truthfulness — an authored page with
// `sponsored: true` or misleading `searchable` keywords ranks exactly as well as its keywords
// earn. That's deliberate: Unit 3 teaches pupils to tell a sponsored/irrelevant/misleading
// result apart from a genuine one, not to have the platform filter it out for them.

export const DEFAULT_SITE_GRAPH = {
  homepageId: 'home',
  pages: {
    home: {
      url: 'https://kidsearch.example',
      title: 'KidSearch',
      kind: 'search',
      content: 'A safe search engine for practising research skills. Try searching for something below.',
      links: [],
    },
  },
}

export function normaliseSiteGraph(raw) {
  if (!raw || typeof raw !== 'object' || !raw.pages || typeof raw.pages !== 'object' || Object.keys(raw.pages).length === 0) {
    return DEFAULT_SITE_GRAPH
  }
  const homepageId = raw.homepageId && raw.pages[raw.homepageId] ? raw.homepageId : Object.keys(raw.pages)[0]
  return { homepageId, pages: raw.pages }
}

export function getPage(siteGraph, pageId) {
  return siteGraph?.pages?.[pageId] ?? null
}

// Free-text search over every page with an authored `searchable` field. Title matches score
// highest, then keywords, then snippet; sponsored results are pinned ahead of organic ones
// (in authored order among themselves), exactly like a real search engine's ad slots.
export function searchPages(siteGraph, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const scored = []
  for (const [pageId, page] of Object.entries(siteGraph?.pages ?? {})) {
    if (!page.searchable) continue
    const title = (page.title ?? '').toLowerCase()
    const keywords = (page.searchable.keywords ?? []).join(' ').toLowerCase()
    const snippet = (page.searchable.snippet ?? '').toLowerCase()
    let score = 0
    for (const term of terms) {
      if (title.includes(term)) score += 3
      if (keywords.includes(term)) score += 2
      if (snippet.includes(term)) score += 1
    }
    if (score > 0) scored.push({ pageId, page, score })
  }
  scored.sort((a, b) => {
    if (!!a.page.sponsored !== !!b.page.sponsored) return a.page.sponsored ? -1 : 1
    return b.score - a.score
  })
  return scored.map(({ pageId, page }) => ({ pageId, page }))
}

// Looks up a page by its authored fake `url` (case-insensitive, trailing slash tolerant) —
// used when a pupil types an address directly into the browser's address bar.
export function findPageByUrl(siteGraph, url) {
  const target = (url ?? '').trim().toLowerCase().replace(/\/$/, '')
  if (!target) return null
  for (const [pageId, page] of Object.entries(siteGraph?.pages ?? {})) {
    if ((page.url ?? '').trim().toLowerCase().replace(/\/$/, '') === target) return { pageId, page }
  }
  return null
}
