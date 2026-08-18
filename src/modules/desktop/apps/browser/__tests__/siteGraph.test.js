import { describe, it, expect } from 'vitest'
import { DEFAULT_SITE_GRAPH, normaliseSiteGraph, getPage, searchPages, findPageByUrl } from '../siteGraph.js'

const SAMPLE = {
  homepageId: 'home',
  pages: {
    home: { url: 'https://kidsearch.example', title: 'KidSearch', kind: 'search', content: 'Search away.', links: [] },
    'wildlife-facts': {
      url: 'https://wildlife.example/facts',
      title: 'Wildlife Facts',
      kind: 'page',
      content: 'Blue whales are the largest animal ever known to have lived.',
      links: [{ label: 'Back home', to: 'home' }],
      searchable: { keywords: ['whale', 'animal', 'wildlife'], snippet: 'Facts about blue whales and other wildlife.' },
    },
    'sponsored-ad': {
      url: 'https://buy-whale-plushies.example',
      title: 'Buy Whale Plushies Now!',
      kind: 'page',
      content: 'Cuddly whale toys for sale.',
      sponsored: true,
      searchable: { keywords: ['whale'], snippet: 'Shop cute whale merchandise.' },
    },
    'broken-page': { url: 'https://wildlife.example/missing', title: 'Missing Page', kind: 'broken' },
    'poster-download': {
      url: 'https://wildlife.example/poster',
      title: 'Ocean Poster',
      kind: 'download',
      content: 'Download a poster about ocean animals.',
      download: { fileName: 'ocean-poster.txt', content: 'A poster about ocean animals.' },
    },
  },
}

describe('siteGraph', () => {
  it('normaliseSiteGraph falls back to the default graph when empty/invalid', () => {
    expect(normaliseSiteGraph(null)).toEqual(DEFAULT_SITE_GRAPH)
    expect(normaliseSiteGraph({})).toEqual(DEFAULT_SITE_GRAPH)
    expect(normaliseSiteGraph({ pages: {} })).toEqual(DEFAULT_SITE_GRAPH)
  })

  it('normaliseSiteGraph falls back to the first page when homepageId is missing/invalid', () => {
    const result = normaliseSiteGraph({ pages: SAMPLE.pages })
    expect(Object.keys(SAMPLE.pages)).toContain(result.homepageId)
  })

  it('normaliseSiteGraph keeps an explicit valid homepageId', () => {
    expect(normaliseSiteGraph(SAMPLE).homepageId).toBe('home')
  })

  it('getPage looks up a page by id', () => {
    expect(getPage(SAMPLE, 'wildlife-facts').title).toBe('Wildlife Facts')
    expect(getPage(SAMPLE, 'nonexistent')).toBeNull()
  })

  it('searchPages only matches pages with a searchable field', () => {
    const results = searchPages(SAMPLE, 'whale')
    const ids = results.map(r => r.pageId)
    expect(ids).toContain('wildlife-facts')
    expect(ids).toContain('sponsored-ad')
    expect(ids).not.toContain('broken-page')
    expect(ids).not.toContain('poster-download')
  })

  it('searchPages pins sponsored results ahead of organic ones', () => {
    const results = searchPages(SAMPLE, 'whale')
    expect(results[0].pageId).toBe('sponsored-ad')
  })

  it('searchPages ranks a title match above a snippet-only match', () => {
    const results = searchPages(SAMPLE, 'wildlife')
    const ids = results.map(r => r.pageId)
    expect(ids[ids.length - 1]).not.toBe(undefined)
    expect(results.find(r => r.pageId === 'wildlife-facts')).toBeTruthy()
  })

  it('searchPages returns nothing for an empty query', () => {
    expect(searchPages(SAMPLE, '')).toEqual([])
    expect(searchPages(SAMPLE, '   ')).toEqual([])
  })

  it('findPageByUrl matches case-insensitively and ignores a trailing slash', () => {
    expect(findPageByUrl(SAMPLE, 'https://kidsearch.example').pageId).toBe('home')
    expect(findPageByUrl(SAMPLE, 'HTTPS://KIDSEARCH.EXAMPLE/').pageId).toBe('home')
    expect(findPageByUrl(SAMPLE, 'https://nope.example')).toBeNull()
  })
})
