// Pure logic for the Recommender activity: task validation, the made-up class, similarity,
// recommendations, the bubble meter and marking. Node-safe (no React, JSX or DOM).
//
// The student rates items 👍 / 👎 (or skips). A made-up class of raters is GENERATED from the
// items, so the same lesson always gives the same raters. Recommendations are user-based
// collaborative filtering, kept simple: a rater is similar when they agree with the student on
// the items both rated; each unrated item is scored by what the similar raters thought of it.
// Items from kinds the student likes get a small boost, so rating one kind visibly shrinks the
// feed into a bubble. Everything is recomputed only when a rating changes (see ui.jsx).
//
// State: { v: 1, ratings: { [itemId]: 1 | -1 }, why: boolean, goal?, tried? }. A skipped item has
// no entry. With the task's `goals` the student picks what the feed aims for: `goal` is the one
// now, `tried` the goals they have switched to (the report's "goals tried").
//   like      what the similar raters liked, with a small boost for kinds they like (the default)
//   watching  leans hard on their most-liked kind, so the feed narrows into a bubble
//   new       mixes in kinds they have not rated yet

export const MAX_ITEMS = 20
export const RECOMMENDED_MIN_ITEMS = 12
export const RECOMMENDED_MIN_GROUPS = 3
export const DEFAULT_MIN_RATED = 6
export const FEED_SIZE = 4
export const GOALS = ['like', 'watching', 'new']
export const GOAL_LABELS = {
  like: "What I'll like",
  watching: 'Keep me watching',
  new: 'Something new',
}

// Fixed silly names, handed out in order. The made-up class is always these 8.
export const RATER_NAMES = [
  'Robo Rita',
  'Sporty Sam',
  'Captain Crumb',
  'Dizzy Dot',
  'Sleepy Sid',
  'Zippy Zoe',
  'Mighty Mo',
  'Giggly Gus',
]

// A tiny seeded random number generator (mulberry32). Same seed, same numbers.
function makeRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function groupsOf(items) {
  const seen = []
  for (const item of items ?? []) {
    if (item?.group != null && !seen.includes(item.group)) seen.push(item.group)
  }
  return seen
}

export function minRatedOf(task) {
  const n = task?.minRated
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_MIN_RATED
}

// The made-up class: [{ name, ratings: { [itemId]: 1 | -1 } }]. Seeded from the item ids, so a
// lesson always gets the same raters. Each rater loves one or two kinds (likes nearly all of
// them), dislikes most other things, and skips a few, so the picture is not perfect.
export function generateRaters(items) {
  const list = (items ?? []).filter((item) => item && item.id != null)
  const groups = groupsOf(list)
  if (list.length === 0 || groups.length === 0) return []
  const seed = hashString(list.map((item) => String(item.id)).join('|'))
  const random = makeRandom(seed)
  const offset = seed % groups.length
  return RATER_NAMES.map((name, i) => {
    const loves = [groups[(offset + i) % groups.length]]
    if (groups.length > 2 && i % 3 === 2) {
      loves.push(groups[(offset + i + 1 + Math.floor(i / 3)) % groups.length])
    }
    const ratings = {}
    for (const item of list) {
      const loved = loves.includes(item.group)
      const roll = random()
      if (roll < 0.08) continue // skipped
      if (loved) ratings[item.id] = random() < 0.92 ? 1 : -1
      else ratings[item.id] = random() < 0.1 ? 1 : -1
    }
    return { name, ratings }
  })
}

// ---- Ratings set for the student (task field `startRatings`) ----

// The ratings handed to the student: { [itemId]: 1 | -1 } for the items that exist; {} when the
// task has none. The task writes them as up / down.
export function startRatingsOf(task) {
  const given = task?.startRatings
  if (!given || typeof given !== 'object' || Array.isArray(given)) return {}
  const ids = new Set((task?.items ?? []).map((item) => String(item?.id)))
  const out = {}
  for (const id of Object.keys(given)) {
    if (!ids.has(id)) continue
    if (given[id] === 'up') out[id] = 1
    else if (given[id] === 'down') out[id] = -1
  }
  return out
}

// What the feed sees: the given ratings, with the student's own on top. state.ratings holds ONLY
// the student's own taps; a 0 there means they took a given rating back.
export function effectiveRatings(task, state) {
  const out = { ...startRatingsOf(task) }
  for (const [id, value] of Object.entries(state?.ratings ?? {})) {
    if (value === 1 || value === -1) out[id] = value
    else if (value === 0) delete out[id]
  }
  return out
}

// Is this item's rating still the one the task set (not yet touched by the student)?
export function isGivenRating(task, state, itemId) {
  return startRatingsOf(task)[itemId] != null && state?.ratings?.[itemId] == null
}

export function ratedCount(state) {
  return Object.values(state?.ratings ?? {}).filter((v) => v === 1 || v === -1).length
}

// How like-minded a rater is: agreeing minus disagreeing on what both rated, softened so one
// shared item does not count as a perfect match. Needs at least one shared item; 0 otherwise.
export function similarity(mine, theirs) {
  let agree = 0
  let shared = 0
  for (const id of Object.keys(mine ?? {})) {
    const a = mine[id]
    const b = theirs?.[id]
    if ((a !== 1 && a !== -1) || (b !== 1 && b !== -1)) continue
    shared += 1
    if (a === b) agree += 1
  }
  if (shared === 0) return 0
  return (agree - (shared - agree)) / (shared + 1)
}

function popularity(items, raters) {
  const count = {}
  for (const item of items) {
    count[item.id] = raters.reduce((sum, r) => sum + (r.ratings[item.id] === 1 ? 1 : 0), 0)
  }
  return count
}

// The feed: up to `size` unrated items, best first. Returns [{ item, score, because: [names],
// reason }]. With no ratings (cold start) it is simply what the class liked most, one per kind
// first so the starting feed is varied. `because` lists the similar raters who liked the item.
// `goal` (like, watching or new) is only given when the task has `goals`; left out, the feed is
// exactly the original (no goal on the entries).
export function recommend(items, raters, ratings = {}, size = FEED_SIZE, goal = undefined) {
  const list = (items ?? []).filter((item) => item && item.id != null)
  const mine = {}
  for (const id of Object.keys(ratings ?? {})) {
    if (ratings[id] === 1 || ratings[id] === -1) mine[id] = ratings[id]
  }
  const unrated = list.filter((item) => mine[item.id] == null)
  const pop = popularity(list, raters)
  const byPopularity = (a, b) => pop[b.id] - pop[a.id] || list.indexOf(a) - list.indexOf(b)

  if (Object.keys(mine).length === 0) {
    const ordered = [...unrated].sort(byPopularity)
    const picked = []
    const kindsTaken = new Set()
    for (const item of ordered) {
      if (picked.length >= size) break
      if (!kindsTaken.has(item.group)) {
        kindsTaken.add(item.group)
        picked.push(item)
      }
    }
    for (const item of ordered) {
      if (picked.length >= size) break
      if (!picked.includes(item)) picked.push(item)
    }
    return picked.map((item) => ({
      item,
      score: pop[item.id],
      because: [],
      reason: 'Lots of the class liked this',
      ...(goal ? { goal, topKind: null, unseen: false } : {}),
    }))
  }

  const sims = raters.map((r) => similarity(mine, r.ratings))
  const simTotal = sims.reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  const likes = list.filter((item) => mine[item.id] === 1)
  const kindShare = (group) =>
    likes.length === 0 ? 0 : likes.filter((item) => item.group === group).length / likes.length
  // The kind they liked most (a tie goes to the first kind listed), and the kinds they rated.
  const topKind = groupsOf(list).reduce(
    (best, group) => (kindShare(group) > (best ? kindShare(best) : 0) ? group : best),
    null
  )
  const ratedKinds = new Set(list.filter((item) => mine[item.id] != null).map((i) => i.group))

  const scored = unrated.map((item) => {
    let sum = 0
    const because = []
    raters.forEach((r, i) => {
      const s = sims[i]
      const rating = r.ratings[item.id]
      if (s <= 0 || (rating !== 1 && rating !== -1)) return
      sum += s * rating
      if (rating === 1) because.push({ name: r.name, s })
    })
    const cf = simTotal > 0 ? sum / simTotal : 0
    const share = kindShare(item.group)
    const unseen = !ratedKinds.has(item.group)
    let score = cf + 0.5 * share
    if (goal === 'watching') score = 0.25 * cf + 2 * share + (item.group === topKind ? 1 : 0)
    else if (goal === 'new') score = 0.5 * cf + (unseen ? 1 : 0)
    return {
      item,
      score,
      unseen,
      because: because.sort((a, b) => b.s - a.s).map((b) => b.name),
      share,
    }
  })
  scored.sort((a, b) => b.score - a.score || list.indexOf(a.item) - list.indexOf(b.item))

  // "Keep me watching" never pads the feed with other kinds: a shorter feed of one kind is the bubble.
  const keep = (s) => goal !== 'watching' || !topKind || s.item.group === topKind
  const good = scored.filter((s) => s.score > 0 && keep(s)).slice(0, size)
  const rest = scored
    .filter((s) => !good.includes(s) && keep(s))
    .sort((a, b) => byPopularity(a.item, b.item))
    .slice(0, Math.max(0, size - good.length))
  return [...good, ...rest].map((s) => ({
    item: s.item,
    score: s.score,
    because: s.because,
    reason: s.because.length
      ? 'People like you liked this'
      : s.share > 0
        ? `You liked other ${s.item.group} things`
        : 'Lots of the class liked this',
    ...(goal ? { goal, topKind, unseen: s.unseen } : {}),
  }))
}

// "Because Robo Rita and Sporty Sam, who liked what you liked, liked this". With no names to
// give it falls back to the reason ("People like you ...").
// With a goal (the task has `goals`) it also names what the feed is aiming for.
export function whyText(entry) {
  const names = (entry?.because ?? []).slice(0, 2)
  const base =
    names.length === 0
      ? `${entry?.reason ?? 'People like you liked this'}.`
      : `Because ${names.join(' and ')}, who liked what you liked, liked this.`
  const goal = entry?.goal
  if (!goal) return base
  if (goal === 'watching') {
    return entry.topKind
      ? `Because you liked lots of ${entry.topKind}, and this feed wants you to keep watching.`
      : `${base} This feed wants you to keep watching.`
  }
  if (goal === 'new') {
    return entry.unseen
      ? `Because you have not rated any ${entry.item.group} yet, and this feed wants to show you something new.`
      : `${base} This feed wants to show you something new.`
  }
  return `${base} This feed wants to show you what you'll like.`
}

// ---- The feed goal switch (task field `goals`) ----

// The goals the student can switch between, in the author's order; [] when the task has none.
export function goalsOf(task) {
  const list = Array.isArray(task?.goals) ? task.goals : []
  return list.filter((g, i) => GOALS.includes(g) && list.indexOf(g) === i)
}

// The goal now: the student's pick if the task offers it, else "like" (or the first goal).
// undefined when the task has no goals: the feed is then the original one.
export function goalOf(task, state) {
  const goals = goalsOf(task)
  if (goals.length === 0) return undefined
  if (goals.includes(state?.goal)) return state.goal
  // `startGoal` opens the task on that goal (e.g. stuck in a "keep me watching" bubble).
  if (goals.includes(task?.startGoal)) return task.startGoal
  return goals.includes('like') ? 'like' : goals[0]
}

// Every goal the student has had the feed on, the one now included (for the report).
export function triedGoalsOf(task, state) {
  const goals = goalsOf(task)
  if (goals.length === 0) return []
  const tried = Array.isArray(state?.tried) ? state.tried : []
  const now = goalOf(task, state)
  return goals.filter((g) => g === now || tried.includes(g))
}

// The bubble meter: how many different kinds are in the feed.
export function bubbleInfo(feed, items) {
  const total = groupsOf(items).length
  const kinds = new Set((feed ?? []).map((entry) => entry.item.group)).size
  let level = 'open'
  if (feed?.length > 0 && kinds <= 1 && total > 1) level = 'bubble'
  else if (kinds * 2 <= total) level = 'closing'
  const text =
    level === 'bubble'
      ? `Your feed has ${kinds} of ${total} kinds: bubble!`
      : `Your feed has ${kinds} of ${total} kinds`
  return { kinds, total, level, text }
}

export const BUBBLE_NUDGE = 'Like something different to break out.'

// Does this task ask for the Why? tap? (showWhy: false turns the button off, so it can't.)
export function needsWhy(task) {
  return task?.showWhy !== false
}

export function gradeTask(task, state) {
  const rated = ratedCount(state)
  const need = minRatedOf(task)
  const why = state?.why === true
  return { rated, need, why, passed: rated >= need && (why || !needsWhy(task)) }
}

// Authoring validation shared by the Builder and the CLI. Returns { errors, warnings }.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateRecommender(task, n) {
  const errors = []
  const warnings = []
  const where = `Task ${n}`
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: recommender task needs at least one item.`)
  if (items.length > MAX_ITEMS) {
    errors.push(`${where}: recommender task can have at most ${MAX_ITEMS} items.`)
  }
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    const id = item?.id
    if (id == null || id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(id))) errors.push(`${label}: id "${id}" is used more than once.`)
    seen.add(String(id))
    if (typeof item?.emoji !== 'string' || !item.emoji.trim()) {
      errors.push(`${label}: emoji is required.`)
    }
    if (typeof item?.label !== 'string' || !item.label.trim()) {
      errors.push(`${label}: label is required.`)
    }
    if (typeof item?.group !== 'string' || !item.group.trim()) {
      errors.push(`${label}: group is required.`)
    }
  })
  if (task?.raters != null && task.raters !== 'preset') {
    errors.push(`${where}: raters must be preset.`)
  }
  if (
    task?.goals != null &&
    !(
      Array.isArray(task.goals) &&
      task.goals.length >= 1 &&
      task.goals.length <= GOALS.length &&
      new Set(task.goals).size === task.goals.length &&
      task.goals.every((g) => GOALS.includes(g))
    )
  ) {
    errors.push(`${where}: goals must list 1 to 3 different goals from like, watching and new.`)
  }
  if (task?.showWhy != null && typeof task.showWhy !== 'boolean') {
    errors.push(`${where}: showWhy must be true or false.`)
  }
  if (task?.bubble != null && typeof task.bubble !== 'boolean') {
    errors.push(`${where}: bubble must be true or false.`)
  }
  if (
    task?.minRated != null &&
    (!Number.isInteger(task.minRated) || task.minRated < 1 || task.minRated > items.length)
  ) {
    errors.push(`${where}: minRated must be a whole number from 1 to the number of items.`)
  }
  if (task?.startGoal != null && !goalsOf(task).includes(task.startGoal)) {
    errors.push(`${where}: startGoal must be one of the task's goals.`)
  }
  if (task?.startRatings != null) {
    const given = task.startRatings
    if (typeof given !== 'object' || Array.isArray(given)) {
      errors.push(`${where}: startRatings must be a list of item id: up or down.`)
    } else {
      const ids = new Set(items.map((item) => String(item?.id)))
      for (const [id, value] of Object.entries(given)) {
        if (!ids.has(id)) {
          errors.push(`${where}: startRatings has "${id}", which is not an item id.`)
        } else if (value !== 'up' && value !== 'down') {
          errors.push(`${where}: startRatings "${id}" must be up or down.`)
        }
      }
    }
  }
  if (items.length > 0 && items.length < RECOMMENDED_MIN_ITEMS) {
    warnings.push(
      `${where}: recommender works best with ${RECOMMENDED_MIN_ITEMS} to ${MAX_ITEMS} items.`
    )
  }
  if (items.length > 0 && groupsOf(items).length < RECOMMENDED_MIN_GROUPS) {
    warnings.push(
      `${where}: recommender needs at least ${RECOMMENDED_MIN_GROUPS} different groups to show a bubble.`
    )
  }
  return { errors, warnings }
}

// Kinds in the feed before the student rated anything (the task's given ratings only, on the
// task's first goal as the student sees it when it opens).
export function startFeedKinds(task, state) {
  const stored = state?.startKinds
  if (Number.isInteger(stored) && stored >= 0) return stored
  return feedKinds(task, { ratings: {} }).kinds
}

export function summaryText(task, state) {
  const { rated, need, why } = gradeTask(task, state)
  const goal = goalOf(task, state)
  const aim = goal && goalsOf(task).length > 1 && rated > 0 ? ` · aim: ${GOAL_LABELS[goal]}` : ''
  return `${rated}/${need} rated${why ? ' · opened Why?' : ''}${aim}`
}

// The student's feed size in kinds right now (for the report): { kinds, total, level, text }.
export function feedKinds(task, state) {
  const items = task?.items ?? []
  const feed = recommend(
    items,
    generateRaters(items),
    effectiveRatings(task, state),
    FEED_SIZE,
    goalOf(task, state)
  )
  return bubbleInfo(feed, items)
}
