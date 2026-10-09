// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildClassWall,
  classWallText,
  CLASS_WALL_TITLE,
  groupClassWall,
  reportClassWall,
  rosterNameFor,
} from '../badgeSummary'

const decisions = {
  sam: {
    bug_hunter: { status: 'awarded', source: 'rule', decidedAt: 300 },
    keyboard_wizard: { status: 'awarded', source: 'auto', decidedAt: 100 },
  },
  alex: {
    bug_hunter: { status: 'awarded', source: 'rule', decidedAt: 200 },
    persistence: { status: 'dismissed', source: 'rule', decidedAt: 150 },
    code_fixer: { status: 'revoked', source: 'rule', decidedAt: 120 },
  },
}
const students = { sam: { displayName: 'Sam' }, alex: { displayName: 'Alex' } }

describe('buildClassWall', () => {
  it('groups awarded badges by badge, never by student, oldest award first', () => {
    const wall = buildClassWall(decisions, { nameFor: rosterNameFor(students) })
    expect(wall.map((row) => [row.badgeId, row.badge.emoji, row.names])).toEqual([
      ['bug_hunter', '🐛', ['Alex', 'Sam']],
      ['keyboard_wizard', '⌨️', ['Sam']],
    ])
  })

  it('leaves out dismissed and revoked decisions', () => {
    const ids = buildClassWall(decisions, { nameFor: rosterNameFor(students) }).map(
      (row) => row.badgeId
    )
    expect(ids).not.toContain('persistence')
    expect(ids).not.toContain('code_fixer')
  })

  it('gives a student who has left a friendly placeholder name', () => {
    const wall = buildClassWall(
      { gone: { bug_hunter: { status: 'awarded', decidedAt: 1 } } },
      { nameFor: rosterNameFor({}) }
    )
    expect(wall[0].names).toEqual(['A coder'])
  })

  it('is empty with no decisions', () => {
    expect(buildClassWall(undefined)).toEqual([])
  })
})

describe('groupClassWall', () => {
  it('orders rows as the picker does and lists a name once per badge', () => {
    const wall = groupClassWall([
      { badgeId: 'helpful_coder', name: 'Student 2' },
      { badgeId: 'bug_hunter', name: 'Student 1' },
      { badgeId: 'bug_hunter', name: 'Student 1' },
      { badgeId: 'catalogue_star', name: 'Student 3' },
    ])
    expect(wall.map((row) => row.badgeId)).toEqual([
      'bug_hunter',
      'helpful_coder',
      'catalogue_star',
    ])
    expect(wall[0].names).toEqual(['Student 1'])
  })
})

describe('classWallText', () => {
  it('copies the wall as plain text grouped by badge', () => {
    const wall = buildClassWall(decisions, { nameFor: rosterNameFor(students) })
    expect(classWallText(wall)).toBe(
      `${CLASS_WALL_TITLE}\n🐛 Bug Hunter: Alex, Sam\n⌨️ Keyboard Wizard: Sam`
    )
  })

  it('says so when nothing was awarded', () => {
    expect(classWallText([], { title: 'Moments' })).toBe('Moments\nNo coding moments were awarded.')
  })
})

describe('reportClassWall', () => {
  it('groups a report’s student badges by badge, using the stored emoji and title', () => {
    const report = {
      students: [
        {
          studentLabel: 'Student 1',
          badges: [{ badgeId: 'star', emoji: '🌟', title: 'Star Coder' }],
        },
        {
          studentLabel: 'Student 2',
          badges: [{ badgeId: 'star', emoji: '🌟', title: 'Star Coder' }],
        },
        { studentLabel: 'Student 3' },
      ],
    }
    const wall = reportClassWall(report)
    expect(wall).toHaveLength(1)
    expect(wall[0].badge).toMatchObject({ emoji: '🌟', title: 'Star Coder' })
    expect(classWallText(wall, { title: 'Report' })).toBe(
      'Report\n🌟 Star Coder: Student 1, Student 2'
    )
  })
})
