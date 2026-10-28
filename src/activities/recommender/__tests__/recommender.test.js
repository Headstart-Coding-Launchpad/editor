import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  GOAL_LABELS,
  bubbleInfo,
  generateRaters,
  goalOf,
  goalsOf,
  triedGoalsOf,
  gradeTask,
  groupsOf,
  recommend,
  similarity,
  validateRecommender,
  whyText,
} from '../recommender.js'

const task = () => definition.defaultTask({ id: 1 })
const items = task().items
const raters = generateRaters(items)
const errorsOf = (t) => validateRecommender(t, 1).errors
const warningsOf = (t) => validateRecommender(t, 1).warnings
const groupsInFeed = (feed) => new Set(feed.map((e) => e.item.group))

describe('raters', () => {
  it('are deterministic: the same items give the same class', () => {
    expect(generateRaters(items)).toEqual(generateRaters(task().items))
    expect(raters).toHaveLength(8)
    expect(new Set(raters.map((r) => r.name)).size).toBe(8)
  })

  it('differ when the item ids differ', () => {
    const other = items.map((item) => ({ ...item, id: `x-${item.id}` }))
    const renamed = generateRaters(other).map((r) => Object.values(r.ratings).join(''))
    expect(renamed).not.toEqual(raters.map((r) => Object.values(r.ratings).join('')))
  })

  it('love some kinds but not all', () => {
    const groups = groupsOf(items)
    for (const rater of raters) {
      const liked = groups.filter((g) => {
        const rs = items.filter((i) => i.group === g).map((i) => rater.ratings[i.id])
        return rs.filter((v) => v === 1).length > rs.filter((v) => v === -1).length
      })
      expect(liked.length).toBeGreaterThanOrEqual(1)
      expect(liked.length).toBeLessThan(groups.length)
    }
  })

  it('is empty when there are no items', () => {
    expect(generateRaters([])).toEqual([])
  })
})

describe('similarity', () => {
  it('is 0 with nothing shared, positive on agreement, negative on disagreement', () => {
    expect(similarity({ a: 1 }, { b: 1 })).toBe(0)
    expect(similarity({ a: 1, b: -1 }, { a: 1, b: -1 })).toBeGreaterThan(0)
    expect(similarity({ a: 1, b: -1 }, { a: -1, b: 1 })).toBeLessThan(0)
  })
})

describe('recommend', () => {
  it('cold start: a varied default feed of 4 unrated items', () => {
    const feed = recommend(items, raters, {})
    expect(feed).toHaveLength(4)
    expect(groupsInFeed(feed).size).toBe(4)
    expect(recommend(items, raters, {})).toEqual(feed)
  })

  it('never recommends something already rated', () => {
    const ratings = { football: 1, swimming: -1 }
    const ids = recommend(items, raters, ratings).map((e) => e.item.id)
    expect(ids).not.toContain('football')
    expect(ids).not.toContain('swimming')
  })

  it('follows the ratings: liking one kind puts that kind first', () => {
    expect(recommend(items, raters, { football: 1 })[0].item.group).toBe('sport')
    expect(recommend(items, raters, { guitar: 1 })[0].item.group).toBe('music')
  })

  it('shifts when a rating changes', () => {
    const a = recommend(items, raters, { football: 1 }).map((e) => e.item.id)
    const b = recommend(items, raters, { football: -1, guitar: 1 }).map((e) => e.item.id)
    expect(b).not.toEqual(a)
  })

  it('closes the bubble when only one kind is liked', () => {
    const cold = bubbleInfo(recommend(items, raters, {}), items)
    const one = bubbleInfo(recommend(items, raters, { football: 1 }), items)
    expect(one.kinds).toBeLessThan(cold.kinds)
    expect(one.kinds).toBeLessThanOrEqual(2)
    // Liking something from other kinds opens it again.
    const mixed = recommend(items, raters, { football: 1, guitar: 1 })
    expect(groupsInFeed(mixed)).toEqual(new Set(['sport', 'music']))
    expect(groupsInFeed(recommend(items, raters, { football: 1 })).has('music')).toBe(false)
  })

  it('bubble text and level', () => {
    const entry = (group) => ({ item: { group } })
    const info = bubbleInfo([entry('a'), entry('a')], items)
    expect(info.level).toBe('bubble')
    expect(info.text).toBe('Your feed has 1 of 4 kinds: bubble!')
    expect(bubbleInfo([entry('a'), entry('b'), entry('c'), entry('d')], items).level).toBe('open')
    expect(bubbleInfo([entry('a'), entry('b')], items).level).toBe('closing')
  })

  it('names the similar raters who liked the item', () => {
    const feed = recommend(items, raters, { football: 1, swimming: 1 })
    const named = feed.find((e) => e.because.length > 0)
    expect(named).toBeTruthy()
    expect(whyText(named)).toMatch(/^Because .+, who liked what you liked, liked this\.$/)
    expect(whyText({ because: [], reason: 'People like you liked this' })).toBe(
      'People like you liked this.'
    )
  })

  it('copes with every item rated', () => {
    const all = Object.fromEntries(items.map((i) => [i.id, 1]))
    expect(recommend(items, raters, all)).toEqual([])
  })
})

describe('gradeTask', () => {
  it('needs minRated ratings and a Why? tap', () => {
    const ratings = Object.fromEntries(items.slice(0, 6).map((i) => [i.id, 1]))
    expect(gradeTask(task(), { ratings, why: false }).passed).toBe(false)
    expect(gradeTask(task(), { ratings: { a: 1 }, why: true }).passed).toBe(false)
    expect(gradeTask(task(), { ratings, why: true }).passed).toBe(true)
    const two = { ...task(), minRated: 2 }
    expect(gradeTask(two, { ratings: { a: 1, b: -1 }, why: true }).passed).toBe(true)
  })

  it('does not ask for Why? when showWhy is off', () => {
    const ratings = Object.fromEntries(items.slice(0, 6).map((i) => [i.id, 1]))
    expect(gradeTask({ ...task(), showWhy: false }, { ratings }).passed).toBe(true)
  })
})

describe('definition', () => {
  it('has a valid default task and a passing solution state', () => {
    expect(errorsOf(task())).toEqual([])
    expect(warningsOf(task())).toEqual([])
    expect(definition.grade(task(), definition.solutionState(task())).passed).toBe(true)
    expect(definition.grade(task(), definition.initialState(task())).passed).toBe(false)
  })

  it('summarises and reports progress', () => {
    const state = { v: 1, ratings: { football: 1, cat: -1 }, why: false }
    expect(definition.summarize(task(), state).text).toMatch(/^2\/6 rated · feed \d of 4 kinds/)
    expect(definition.getProgress(task(), state)).toMatchObject({ filled: 2, total: 6 })
    const report = definition.report.summaryFields(task(), [
      { distinctAttempts: [{ submission: JSON.stringify({ ...state, why: true }) }] },
    ])
    expect(report.recommenderResults).toMatchObject({
      students: 1,
      avgRated: 2,
      openedWhyCount: 1,
    })
  })
})

describe('validation', () => {
  it('lists one message each', () => {
    expect(errorsOf({ ...task(), items: [] })).toContain(
      'Task 1: recommender task needs at least one item.'
    )
    const many = Array.from({ length: 21 }, (_, i) => ({
      id: `i${i}`,
      emoji: 'x',
      label: 'x',
      group: 'g',
    }))
    expect(errorsOf({ ...task(), items: many })).toContain(
      'Task 1: recommender task can have at most 20 items.'
    )
    const bad = [
      { id: 'a', emoji: '', label: '', group: '' },
      { id: 'a', emoji: 'x', label: 'x', group: 'g' },
      { emoji: 'x', label: 'x', group: 'g' },
    ]
    expect(errorsOf({ ...task(), items: bad })).toEqual(
      expect.arrayContaining([
        'Task 1 item 1: emoji is required.',
        'Task 1 item 1: label is required.',
        'Task 1 item 1: group is required.',
        'Task 1 item 2: id "a" is used more than once.',
        'Task 1 item 3: needs an id.',
      ])
    )
    expect(errorsOf({ ...task(), raters: 'shared' })).toContain('Task 1: raters must be preset.')
    expect(errorsOf({ ...task(), showWhy: 'yes' })).toContain(
      'Task 1: showWhy must be true or false.'
    )
    expect(errorsOf({ ...task(), bubble: 1 })).toContain('Task 1: bubble must be true or false.')
    expect(errorsOf({ ...task(), minRated: 0 })).toContain(
      'Task 1: minRated must be a whole number from 1 to the number of items.'
    )
  })

  it('warns about too few items or groups', () => {
    expect(warningsOf({ ...task(), items: items.slice(0, 6) })).toContain(
      'Task 1: recommender works best with 12 to 20 items.'
    )
    const flat = items.map((i, k) => ({ ...i, group: k % 2 ? 'a' : 'b' }))
    expect(warningsOf({ ...task(), items: flat })).toContain(
      'Task 1: recommender needs at least 3 different groups to show a bubble.'
    )
  })
})

describe('feed goals', () => {
  const GOALS_TASK = { ...task(), goals: ['like', 'watching', 'new'] }
  // A student who liked two sport things and nothing else.
  const ratings = { football: 1, swimming: 1 }
  const feedFor = (goal) => recommend(items, raters, ratings, 4, goal)

  it('validates goals', () => {
    expect(errorsOf(GOALS_TASK)).toEqual([])
    const message = 'Task 1: goals must list 1 to 3 different goals from like, watching and new.'
    expect(errorsOf({ ...task(), goals: [] })).toEqual([message])
    expect(errorsOf({ ...task(), goals: ['like', 'like'] })).toEqual([message])
    expect(errorsOf({ ...task(), goals: ['love'] })).toEqual([message])
    expect(errorsOf({ ...task(), goals: 'like' })).toEqual([message])
  })

  it('without goals the feed is exactly the original', () => {
    expect(goalsOf(task())).toEqual([])
    expect(goalOf(task(), { goal: 'watching' })).toBeUndefined()
    const plain = recommend(items, raters, ratings)
    expect(plain).toEqual(recommend(items, raters, ratings, 4, undefined))
    expect(plain.every((e) => !('goal' in e))).toBe(true)
  })

  it('like is the current feed, with the goal named on each entry', () => {
    const plain = recommend(items, raters, ratings)
    const like = feedFor('like')
    expect(like.map((e) => e.item.id)).toEqual(plain.map((e) => e.item.id))
    expect(like.every((e) => e.goal === 'like')).toBe(true)
  })

  it('watching leans on their most-liked kind and narrows the feed', () => {
    const watching = feedFor('watching')
    expect(watching[0].item.group).toBe('sport')
    expect(groupsInFeed(watching).size).toBeLessThanOrEqual(groupsInFeed(feedFor('like')).size)
    // Only their most-liked kind: a shorter feed of one kind rather than padding with others.
    expect(watching.filter((e) => e.item.group === 'sport')).toHaveLength(1)
    expect(groupsInFeed(watching).size).toBe(1)
    const info = bubbleInfo(watching, items)
    expect(info.kinds).toBeLessThanOrEqual(bubbleInfo(feedFor('new'), items).kinds)
  })

  it('new mixes in kinds the student has not rated', () => {
    const fresh = feedFor('new')
    expect(fresh.every((e) => e.item.group !== 'sport')).toBe(true)
    expect(groupsInFeed(fresh).size).toBeGreaterThanOrEqual(groupsInFeed(feedFor('watching')).size)
    expect(fresh[0].unseen).toBe(true)
  })

  it('Why? names the goal', () => {
    expect(whyText(feedFor('watching')[0])).toBe(
      'Because you liked lots of sport, and this feed wants you to keep watching.'
    )
    expect(whyText(feedFor('new')[0])).toMatch(
      /^Because you have not rated any \w+ yet, and this feed wants to show you something new\.$/
    )
    expect(whyText(feedFor('like')[0])).toMatch(/This feed wants to show you what you'll like\.$/)
  })

  it('starts on like (or the first goal), and keeps only goals the task offers', () => {
    expect(goalOf(GOALS_TASK, {})).toBe('like')
    expect(goalOf({ ...task(), goals: ['watching', 'new'] }, {})).toBe('watching')
    expect(goalOf(GOALS_TASK, { goal: 'new' })).toBe('new')
    expect(goalOf({ ...task(), goals: ['like', 'new'] }, { goal: 'watching' })).toBe('like')
  })

  it('reports the goals tried, the current one included', () => {
    expect(triedGoalsOf(GOALS_TASK, { goal: 'new', tried: ['watching'] })).toEqual([
      'watching',
      'new',
    ])
    expect(triedGoalsOf(GOALS_TASK, {})).toEqual(['like'])
    expect(triedGoalsOf(task(), { tried: ['new'] })).toEqual([])
  })

  it('tutor card and report follow the goal, and passing is unchanged', () => {
    const state = { v: 1, ratings, why: true, goal: 'watching', tried: ['like', 'watching'] }
    expect(definition.summarize(GOALS_TASK, state).text).toContain(`aim: ${GOAL_LABELS.watching}`)
    expect(definition.summarize(task(), state).text).not.toContain('aim:')
    const out = definition.report.summaryFields(GOALS_TASK, [
      { distinctAttempts: [{ submission: JSON.stringify(state) }] },
    ])
    expect(out.recommenderResults.goalCounts).toEqual({ like: 1, watching: 1, new: 0 })
    expect(gradeTask(GOALS_TASK, state).passed).toBe(gradeTask(task(), state).passed)
  })
})
