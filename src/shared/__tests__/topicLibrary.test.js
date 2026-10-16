// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  expandTopicLinks,
  filterTopicsForType,
  findAllTopicSuggestions,
  findRelatedTopicId,
  findTopicSuggestion,
  normalizeTopicLibrary,
  parseTopicHref,
  searchTopics,
  topicHref,
} from '../topicLibrary'

const topics = normalizeTopicLibrary({
  topics: [
    {
      id: 'for-loop',
      title: 'For loops',
      types: ['python'],
      category: 'Loop',
      summary: 'Repeat code.',
      aliases: ['for loop'],
    },
    {
      id: 'selectors',
      title: 'CSS selectors',
      types: ['html'],
      category: 'CSS',
      summary: 'Choose elements.',
      aliases: ['selector'],
    },
  ],
})

describe('topic library utilities', () => {
  it('normalizes valid topic records and ignores invalid entries', () => {
    expect(
      normalizeTopicLibrary({
        topics: [
          { id: 'print', title: 'print()' },
          { id: '', title: 'Missing' },
        ],
      })
    ).toEqual([
      expect.objectContaining({ id: 'print', title: 'print()', aliases: [], related: [] }),
    ])
  })

  it('searches titles, aliases and descriptions', () => {
    expect(searchTopics(topics, 'selector').map((topic) => topic.id)).toEqual(['selectors'])
    expect(searchTopics(topics, 'repeat').map((topic) => topic.id)).toEqual(['for-loop'])
  })

  it('expands wiki topic links while leaving code examples unchanged', () => {
    const content = 'Read [[for-loop]] or `[[for-loop]]`.\n```\n[[selectors]]\n```'
    expect(expandTopicLinks(content, topics)).toBe(
      'Read [For loops](#topic/for-loop) or `[[for-loop]]`.\n```\n[[selectors]]\n```'
    )
  })

  it('round trips topic link fragments', () => {
    expect(parseTopicHref(topicHref('for-loop'))).toBe('for-loop')
  })

  it('suggests an unlinked topic mention for builder authors', () => {
    expect(findTopicSuggestion('Use a for loop to repeat this.', topics)).toEqual(
      expect.objectContaining({
        label: 'for loop',
        topic: expect.objectContaining({ id: 'for-loop' }),
      })
    )
    expect(findTopicSuggestion('Use [[for-loop|a for loop]] here.', topics)).toBeNull()
  })

  it('finds all unlinked topic mentions', () => {
    const result = findAllTopicSuggestions('Use a for loop and CSS selector here.', topics)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(
      expect.objectContaining({ topic: expect.objectContaining({ id: 'for-loop' }) })
    )
    expect(result[1]).toEqual(
      expect.objectContaining({ topic: expect.objectContaining({ id: 'selectors' }) })
    )
  })

  it('returns empty array when no topics match', () => {
    expect(findAllTopicSuggestions('No matching terms here.', topics)).toEqual([])
  })

  it('excludes already-linked topics from all suggestions', () => {
    const result = findAllTopicSuggestions('Use [[for-loop|a for loop]] and a selector.', topics)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({ topic: expect.objectContaining({ id: 'selectors' }) })
    )
  })
})

describe('filterTopicsForType (audit: composed-lesson topic types)', () => {
  const library = [
    { id: 'loops', types: ['python'] },
    { id: 'tags', types: ['html'] },
    { id: 'any', types: [] },
  ]
  const ids = (list) => list.map((topic) => topic.id)

  it('filters by a module type', () => {
    expect(ids(filterTopicsForType(library, 'python'))).toEqual(['loops', 'any'])
  })

  it('keeps every topic for a composed lesson slide or no type', () => {
    expect(ids(filterTopicsForType(library, 'composed'))).toEqual(['loops', 'tags', 'any'])
    expect(ids(filterTopicsForType(library, null))).toEqual(['loops', 'tags', 'any'])
  })
})

describe('findRelatedTopicId', () => {
  const library = normalizeTopicLibrary({
    topics: [
      { id: 'accumulators', title: 'Accumulators', summary: 'Collect.' },
      { id: 'print', title: 'print()', summary: 'Show text.' },
      { id: 'for-loop', title: 'For loops', summary: 'Repeat.', aliases: ['for loop'] },
    ],
  })

  it('prefers an explicit topic link', () => {
    expect(findRelatedTopicId('Use a for loop, see [[print]].', library)).toBe('print')
    expect(findRelatedTopicId('See [the loop](#topic/for-loop).', library)).toBe('for-loop')
  })

  it('matches an inline code span named like a topic', () => {
    expect(findRelatedTopicId('Write a `print()` call with a message.', library)).toBe('print')
  })

  it('falls back to the earliest topic named in the text', () => {
    expect(findRelatedTopicId('A for loop with accumulators.', library)).toBe('for-loop')
  })

  it('returns null when nothing matches', () => {
    expect(findRelatedTopicId('Draw a square.', library)).toBeNull()
    expect(findRelatedTopicId('', library)).toBeNull()
  })
})
