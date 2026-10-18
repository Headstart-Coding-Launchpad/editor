import { describe, expect, it } from 'vitest'
import {
  buildNamedBadgeRows,
  namedBadgeCsv,
  namedBadgeFilename,
  NAMED_BADGE_COLUMNS,
} from '../namedBadgeExport.js'

const at = (h) => new Date(2026, 9, 18, h).getTime()

const lesson = {
  title: 'Loops & Lists',
  tasks: [
    { id: 1, title: 'Count to ten' },
    { id: 2, title: 'Shopping list' },
  ],
}

const session = {
  students: {
    a: { displayName: 'Zed' },
    b: { displayName: 'amy' },
    c: { displayName: '=HYPERLINK("x")' },
  },
  badges: {
    a: {
      bug_hunter: { status: 'awarded', source: 'rule', taskId: 2, decidedAt: at(10) },
      gone: { status: 'revoked', source: 'manual', decidedAt: at(9) },
    },
    b: {
      custom_star: {
        status: 'awarded',
        source: 'manual',
        taskId: null,
        decidedAt: at(11),
        badge: { emoji: '🌟', title: 'Star, "helper"', blurb: '' },
      },
      skipped: { status: 'dismissed', source: 'rule', decidedAt: at(9) },
    },
    c: {
      custom_star: {
        status: 'awarded',
        source: 'auto',
        decidedAt: at(12),
        badge: { emoji: '🌟', title: 'Star' },
      },
    },
  },
}

describe('buildNamedBadgeRows', () => {
  it('lists only held badges, with roster names first, sorted by name then time', () => {
    const rows = buildNamedBadgeRows({ session, lesson, rosterNames: { a: 'Zara Smith' } })
    expect(rows.map((r) => [r.student, r.awardedBy])).toEqual([
      ['=HYPERLINK("x")', 'Automatic'],
      ['amy', 'Tutor'],
      ['Zara Smith', 'Tutor (suggested)'],
    ])
    const zara = rows[2]
    expect(zara.task).toBe('Shopping list')
    expect(zara.lesson).toBe('Loops & Lists')
    expect(zara.date).toBe('2026-10-18')
    expect(rows[1]).toMatchObject({ badge: 'Star, "helper"', emoji: '🌟', task: '' })
  })

  it('is empty without badges', () => {
    expect(buildNamedBadgeRows({ session: { students: {} }, lesson })).toEqual([])
  })
})

describe('namedBadgeCsv', () => {
  it('writes a header, escapes quotes and commas, and defuses formulas', () => {
    const csv = namedBadgeCsv(buildNamedBadgeRows({ session, lesson }))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(NAMED_BADGE_COLUMNS.join(','))
    expect(lines[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true)
    expect(lines[2]).toContain('"Star, ""helper"""')
    expect(lines).toHaveLength(4)
  })
})

describe('namedBadgeFilename', () => {
  it('names the file after the lesson and day', () => {
    expect(namedBadgeFilename(lesson, at(10))).toBe('badges-with-names-loops-lists-2026-10-18.csv')
  })
})
