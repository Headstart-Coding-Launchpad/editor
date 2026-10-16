// The tabbed result pane of Python and Turtle tasks (docs/authoring/python.md "Screen layout").
// Pure and Node-safe: the layout choice, which tab shows first and after a Run, when Picture and
// Tags stack, the Console's unread badge, and the task's `layout` hint and its validation.
//
// Ryan's layout (2026-10-15): when the result side is too narrow for everything side by side
// (tablets, 1366 × 768 Chromebooks), the editor sits on the left and ONE result pane on the
// right shows tabs Picture · Tags · Console. Portrait screens put the editor above the tabs.
// Wide desktops keep everything side by side. After Run the pane switches to what the task is
// about; the Console tab shows an unread badge so it is always one tap away.

export const RESULT_PANES = Object.freeze(['picture', 'tags', 'console'])

export const RESULT_PANE_LABELS = Object.freeze({
  picture: 'Picture',
  tags: 'Tags',
  console: 'Console',
})

// The result side (the workspace width minus the editor's share) needs at least this much width
// and the workspace this much height to show the picture, the name tags and the console at
// once. Below either, the panes become tabs.
export const SIDE_BY_SIDE_MIN_RESULT_WIDTH = 520
export const SIDE_BY_SIDE_MIN_HEIGHT = 600
// A workspace this much taller than wide is portrait: the editor goes above the result pane.
export const PORTRAIT_RATIO = 1.1

/**
 * How the workspace lays out its editor and result panes:
 *
 * - 'side': editor | everything side by side (wide desktops; also before the workspace has
 *   been measured, and in landscape whenever there are at most two result panes: the picture
 *   sits above the console and shrinks to fit, so it never needs tabs — Ryan, 2026-10-16);
 * - 'tabs': editor | one tabbed result pane;
 * - 'below': editor above, result pane (tabbed when it has more than one pane) below — phones
 *   and portrait screens.
 *
 * `width`/`height` are the workspace's own size, `split` the editor's share in percent.
 */
export function chooseWorkspaceLayout({
  width = 0,
  height = 0,
  isMobile = false,
  split = 50,
  paneCount = 1,
} = {}) {
  if (isMobile) return 'below'
  if (!(width > 0) || !(height > 0)) return 'side'
  if (height > width * PORTRAIT_RATIO) return 'below'
  if (paneCount <= 2) return 'side'
  const resultWidth = width * (1 - split / 100)
  if (resultWidth < SIDE_BY_SIDE_MIN_RESULT_WIDTH || height < SIDE_BY_SIDE_MIN_HEIGHT) {
    return 'tabs'
  }
  return 'side'
}

// ─── The task's `layout` hint ────────────────────────────────────────────────

export const LAYOUT_TASK_FIELD = Object.freeze({
  name: 'layout',
  type: 'object',
  description:
    "Screen layout hint: { firstPane: picture | tags | console } — the result tab selected when the task opens on a tablet or small screen (default: what the task is about). Tabs the task doesn't have are ignored.",
})

const LAYOUT_KEYS = new Set(['firstPane'])

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** The task's layout hint, normalised (`{ firstPane }`, null when unset), or null. */
export function getTaskLayout(task) {
  const raw = task?.layout
  if (!isPlainObject(raw)) return null
  return { firstPane: RESULT_PANES.includes(raw.firstPane) ? raw.firstPane : null }
}

/**
 * Lesson validation for `layout` (the module's validateTask calls it; messages are documented
 * in docs/authoring/validation-errors.md). `panes` are the result panes the module can show.
 */
export function validateTaskLayout(task, n, errors, warnings = [], { panes = RESULT_PANES } = {}) {
  const raw = task?.layout
  if (raw == null) return
  if (!isPlainObject(raw)) {
    errors.push(`Task ${n} layout must be an object like layout: { firstPane: picture }`)
    return
  }
  const extra = Object.keys(raw).filter((key) => !LAYOUT_KEYS.has(key))
  if (extra.length) {
    warnings.push(`Task ${n} layout has unknown fields (${extra.join(', ')}); they are ignored`)
  }
  if (raw.firstPane == null) return
  if (!RESULT_PANES.includes(raw.firstPane)) {
    errors.push(`Task ${n} layout.firstPane must be one of: ${RESULT_PANES.join(', ')}`)
    return
  }
  if (!panes.includes(raw.firstPane)) {
    warnings.push(
      `Task ${n} layout.firstPane is ${raw.firstPane}, but this task type has no ${RESULT_PANE_LABELS[raw.firstPane]} pane; it is ignored`
    )
  } else if (raw.firstPane === 'tags' && !isPlainObject(task.showVariables)) {
    warnings.push(
      `Task ${n} layout.firstPane is tags, but the task has no showVariables name-tag panel; it is ignored`
    )
  }
}

// ─── Which tab shows ─────────────────────────────────────────────────────────

const usesTagGoal = (tagsMode) => tagsMode === 'predict' || tagsMode === 'target'
const firstOf = (available, order) => order.find((id) => available.includes(id)) ?? null

/**
 * The tab selected when the task opens: the author's `firstPane` when the task has that tab;
 * otherwise Tags in predict / target mode (the student fills or reads them before Run), the
 * Picture when the task has a picture goal (a stage target, a course) or the module is a
 * drawing one (`preferPicture`, Turtle), then Tags, then Console.
 */
export function initialResultPane({
  available = [],
  firstPane = null,
  tagsMode = null,
  pictureGoal = false,
  preferPicture = false,
} = {}) {
  if (firstPane && available.includes(firstPane)) return firstPane
  if (usesTagGoal(tagsMode) && available.includes('tags')) return 'tags'
  if ((pictureGoal || preferPicture) && available.includes('picture')) return 'picture'
  return firstOf(available, ['tags', 'console', 'picture'])
}

/**
 * The tab to show once a Run finishes — what the task is about: the Console when the run
 * failed before drawing anything; the Picture when the program drew (or the task has a picture
 * goal); Tags in predict / target mode; the Console otherwise. During slow-mo playback the
 * Picture (stacked with Tags) or Tags show.
 */
export function paneAfterRun({
  available = [],
  drew = false,
  error = false,
  tagsMode = null,
  pictureGoal = false,
  slowMo = false,
} = {}) {
  if (slowMo) return firstOf(available, ['picture', 'tags', 'console'])
  if (error && !drew && available.includes('console')) return 'console'
  if ((drew || pictureGoal) && available.includes('picture')) return 'picture'
  if (usesTagGoal(tagsMode) && available.includes('tags')) return 'tags'
  return firstOf(available, ['console', 'picture', 'tags'])
}

/**
 * Whether the Picture and Tags show together, one above the other, as one tab: during slow-mo
 * (the highlighted line, the tags and the picture are seen together while stepping), and in
 * predict / target mode once there is a picture to see (so both results of a Run show).
 */
export function stacksPictureAndTags({
  available = [],
  slowMo = false,
  tagsMode = null,
  pictureShown = false,
} = {}) {
  if (!available.includes('picture') || !available.includes('tags')) return false
  return slowMo || (usesTagGoal(tagsMode) && pictureShown)
}

// ─── The Console's unread badge ──────────────────────────────────────────────

/** How many lines of output there are (a trailing newline doesn't start a new line). */
export function countOutputLines(output) {
  const text = typeof output === 'string' ? output : ''
  if (!text) return 0
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.length
}

/**
 * The Console tab's badge while it is hidden: `{ text, label }` — '!' for an unseen error,
 * otherwise the number of unseen lines (99+ past 99) — or null when there is nothing new.
 */
export function consoleBadge({ total = 0, seen = 0, error = false } = {}) {
  if (error) return { text: '!', label: 'error in the Console', tone: 'error' }
  const unread = Math.max(0, total - seen)
  if (!unread) return null
  return {
    text: unread > 99 ? '99+' : String(unread),
    label: `${unread} new ${unread === 1 ? 'line' : 'lines'} in the Console`,
    tone: 'info',
  }
}

/**
 * What the polite live region says after a Run switches the pane, e.g. "Picture updated. 3 new
 * lines in the Console". `badge` is the Console's badge (null when it is showing or empty).
 */
export function runAnnouncement({ pane = null, stacked = false, badge = null } = {}) {
  const parts = []
  if (pane === 'picture' && stacked) parts.push('Picture and Tags updated')
  else if (pane) parts.push(`${RESULT_PANE_LABELS[pane]} updated`)
  if (badge && pane !== 'console') parts.push(badge.label.replace(/^./, (c) => c.toUpperCase()))
  return parts.join('. ')
}
