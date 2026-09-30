import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BADGE_IDS,
  getBadgeDefinition,
  getBadgeDefinitions,
  getBadgesByPattern,
  getHintableBadges,
  getTutorOnlyBadges,
} from '../registry.pure.js'
import { evaluateBadgeRules } from '../evaluate.js'
import { EXAMPLE_LESSON } from '../exampleLesson.js'
import { defineBadge } from '../defineBadge.js'
import { TASK_ACTIVITY_PATTERN_IDS } from '../../shared/taskActivity.js'

const DEFINITION_FILES = readdirSync(resolve(process.cwd(), 'src/badges/definitions'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => name.replace(/\.js$/, ''))

describe('badge registry', () => {
  it('registers every definition file, named after its id', () => {
    expect([...BADGE_IDS].sort()).toEqual([...DEFINITION_FILES].sort())
  })

  it('gives every badge a unique emoji', () => {
    const emoji = getBadgeDefinitions().map((badge) => badge.emoji)
    expect(new Set(emoji).size).toBe(emoji.length)
    expect(getBadgeDefinition('focused_coder').emoji).toBe('🧘')
    expect(getBadgeDefinition('project_explorer').emoji).toBe('🧭')
  })

  it('has the plan’s tutor-only badges', () => {
    // A tutor-only badge added later (npm run new:badge -- --tutor-only) goes after these.
    expect(
      getTutorOnlyBadges()
        .map((badge) => badge.id)
        .slice(0, 8)
    ).toEqual([
      'problem_solver',
      'experimenter',
      'creative_coder',
      'comedy_coder',
      'focused_coder',
      'project_explorer',
      'knowledge_builder',
      'helpful_coder',
    ])
  })

  it('marks only the pattern and first-in-class badges as auto-awardable', () => {
    expect(
      getBadgeDefinitions()
        .filter((badge) => badge.autoAwardable)
        .map((badge) => badge.id)
    ).toEqual(['bug_hunter', 'code_builder', 'code_detective', 'challenge_solver', 'quiz_master'])
  })

  it('only triggers on real taskActivity patterns', () => {
    for (const pattern of Object.keys(getBadgesByPattern())) {
      expect(TASK_ACTIVITY_PATTERN_IDS).toContain(pattern)
    }
    expect(getBadgesByPattern().debug_code_task).toEqual(['bug_hunter'])
    expect(getHintableBadges().map((badge) => badge.id)).toEqual([
      'bug_hunter',
      'code_builder',
      'code_detective',
      'challenge_solver',
    ])
  })

  it('rejects malformed definitions', () => {
    expect(() => defineBadge({ id: 'Bad Id', emoji: 'x', title: 'x', blurb: 'x' })).toThrow(
      /lowercase identifier/
    )
    expect(() =>
      defineBadge({ id: 'x', emoji: 'x', title: 'x', blurb: 'x', autoAwardable: true })
    ).toThrow(/rule-backed/)
    expect(() =>
      defineBadge({
        id: 'x',
        emoji: 'x',
        title: 'x',
        blurb: 'x',
        rule: getBadgeDefinition('bug_hunter').rule,
        ruleText: 'x',
        reasonText: () => 'x',
        examples: [],
      })
    ).toThrow(/two examples/)
  })
})

// Every rule-backed badge's `examples` run here, so a new badge is tested by adding examples.
const EXAMPLES = getBadgeDefinitions().flatMap((badge) =>
  badge.examples.map((example) => ({ badge, example, label: `${badge.id}: ${example.name}` }))
)

describe('badge examples', () => {
  it('has examples for every rule-backed badge', () => {
    for (const badge of getBadgeDefinitions().filter((b) => b.rule)) {
      expect(badge.examples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it.each(EXAMPLES)('$label', ({ badge, example }) => {
    const suggestions = evaluateBadgeRules({
      timelines: example.timelines,
      lesson: example.lesson ?? EXAMPLE_LESSON,
      decisions: example.decisions ?? {},
      options: {
        ...(example.options ?? {}),
        badgeOptions: example.options,
        badgeIds: [badge.id],
      },
    })
    const pairs = suggestions.map((s) => [s.studentId, s.taskId])
    expect(pairs).toEqual(example.expect)
    for (const suggestion of suggestions) {
      expect(suggestion.badgeId).toBe(badge.id)
      expect(typeof suggestion.reason).toBe('string')
      expect(suggestion.reason).not.toMatch(/undefined/)
    }
  })
})
