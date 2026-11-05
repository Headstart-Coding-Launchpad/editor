// Control highlights: pulse one control on the student's screen (Run, Stop, Scratch's green
// flag, a Costumes tab, a block category…). Pure and Node-safe: the target lists come from each
// module's `capabilities.highlightTargets` (src/modules/defineModule.js), shared by validation,
// the CLI, the Builder and the tutor menus. The DOM half is ./useControlHighlight.js.
//
// Sources (whichever was started most recently wins on the student's screen):
//   task field   `highlight: green_flag` or `highlight: { target: green_flag }`, pulsed once per
//                task per student when the task opens
//   RTDB         sessions/L/students/{id}/teacherControlHighlight   one student (StudentModal)
//                sessions/L/teacherClassControlHighlight             whole class (TeacherView)
//                both { target, taskId, pushedAt }; null clears
//
// Workspaces mark each control with `data-highlight-target="<id>"` (space-separated when one
// button is several targets, e.g. "run stop"), and a control that reveals a hidden one (a
// collapsed stage rail, a hidden palette toggle) with `data-highlight-reveal="<id>"`.
// `category:<name>` targets are found by their Blockly flyout label text instead.
import { getModuleDefinition } from '../modules/definitions.js'

// How long a highlight pulses before it gives up on its own.
export const CONTROL_HIGHLIGHT_TIMEOUT_MS = 20000
// The DOM event the hook dispatches so a workspace can bring a target into view (Scratch scrolls
// its block palette to a category). detail: { target }.
export const CONTROL_HIGHLIGHT_REVEAL_EVENT = 'launchpad:control-highlight-reveal'
export const CONTROL_HIGHLIGHT_ATTR = 'data-highlight-target'
export const CONTROL_HIGHLIGHT_REVEAL_ATTR = 'data-highlight-reveal'

const OPTION_SEPARATOR = ':'

// The module's declared targets (frozen specs), or [] for a module without any.
export function getModuleHighlightTargets(moduleType) {
  return getModuleDefinition(moduleType)?.capabilities.highlightTargets ?? []
}

export function moduleHasHighlightTargets(moduleType) {
  return getModuleHighlightTargets(moduleType).length > 0
}

/**
 * Every concrete target for a module, as the tutor menu lists them: plain targets as they are,
 * an `options` family expanded to one entry per option (`category:Motion`).
 * Each is { id, label, pane, group, revealKey, spoken, touchOnly }: `group` is the family label
 * (or null), `revealKey` the word `data-highlight-reveal` uses (the family id, or the target id),
 * `spoken` the option's words for a screen reader (or null) and `touchOnly` true for a control
 * that only exists on touch screens (Python's key row).
 */
export function listHighlightTargets(moduleType) {
  const list = []
  for (const spec of getModuleHighlightTargets(moduleType)) {
    if (spec.options) {
      for (const option of spec.options) {
        list.push({
          id: `${spec.id}${OPTION_SEPARATOR}${option}`,
          label: option,
          pane: spec.pane,
          group: spec.label,
          revealKey: spec.id,
          option,
          spoken: spec.optionNames?.[option] ?? null,
          touchOnly: spec.touchOnly === true,
        })
      }
    } else {
      list.push({
        id: spec.id,
        label: spec.label,
        pane: spec.pane,
        group: null,
        revealKey: spec.id,
        option: null,
        spoken: null,
        touchOnly: spec.touchOnly === true,
      })
    }
  }
  return list
}

// The touch-only targets (Python's key row), grouped by family for the Builder's
// "Keys (touch screens)" optgroup: [{ label, targets }].
export function touchHighlightGroups(moduleType) {
  const groups = []
  for (const target of listHighlightTargets(moduleType)) {
    if (!target.touchOnly) continue
    const label = target.group ?? target.label
    let group = groups.find((entry) => entry.label === label)
    if (!group) groups.push((group = { label, targets: [] }))
    group.targets.push(target)
  }
  return groups
}

// The raw target an authored `highlight` field (or a command) names: a string, or an object
// with a `target` string. Anything else is null.
export function highlightTargetName(value) {
  if (typeof value === 'string') return value.trim() || null
  if (value && typeof value === 'object' && typeof value.target === 'string') {
    return value.target.trim() || null
  }
  return null
}

/**
 * Resolves a target name (from a task field or a tutor command) against a module's targets.
 * Ids and aliases match case-insensitively; option names too (`category:motion` →
 * `category:Motion`). Returns the canonical entry from listHighlightTargets, or null.
 */
export function resolveHighlightTarget(moduleType, value) {
  const name = highlightTargetName(value)
  if (!name) return null
  const lower = name.toLowerCase()
  const separator = lower.indexOf(OPTION_SEPARATOR)
  const base = separator === -1 ? lower : lower.slice(0, separator).trim()
  const option = separator === -1 ? null : name.slice(separator + 1).trim()
  const spec = getModuleHighlightTargets(moduleType).find(
    (target) => target.id === base || target.aliases.includes(base)
  )
  if (!spec) return null
  const list = listHighlightTargets(moduleType)
  if (!spec.options) {
    return option == null ? (list.find((entry) => entry.id === spec.id) ?? null) : null
  }
  if (!option) return null
  const match = spec.options.find((candidate) => candidate.toLowerCase() === option.toLowerCase())
  return match ? (list.find((entry) => entry.id === `${spec.id}:${match}`) ?? null) : null
}

// The names an author can write for a module, for error messages ("green_flag, stop, …,
// category:<name>"). A family of symbols (Python's key row) is described, not listed: the full
// list of keys is long, and a symbol target must be quoted in YAML.
export function describeHighlightTargets(moduleType) {
  return getModuleHighlightTargets(moduleType)
    .map((spec) => {
      if (!spec.options) return spec.id
      if (spec.optionNames) {
        return `"${spec.id}:<symbol>" (in quotes, e.g. "${spec.id}:${spec.example ?? spec.options[0]}")`
      }
      return `${spec.id}:<${spec.options.join('|')}>`
    })
    .join(', ')
}

// A symbol family's id ("key") when an authored name or mapping is aimed at it, so its errors can
// say to quote it. `highlight: key: (` parses as the mapping { key: "(" }.
function symbolFamilyNamed(moduleType, value) {
  const families = getModuleHighlightTargets(moduleType).filter((spec) => spec.optionNames)
  if (value && typeof value === 'object') {
    return families.find((spec) => Object.hasOwn(value, spec.id))?.id ?? null
  }
  const lower = String(value ?? '').toLowerCase()
  return families.find((spec) => lower.startsWith(`${spec.id}${OPTION_SEPARATOR}`))?.id ?? null
}

// The friendly text a student's screen reader hears and the tutor menu shows. A key is named in
// words ("open bracket key"), never read out as a bare symbol.
export function highlightTargetText(entry) {
  if (!entry) return ''
  if (entry.spoken) return entry.spoken
  return entry.group ? `${entry.label} (${entry.group.toLowerCase()})` : entry.label
}

/**
 * Validates a task's `highlight` field. `moduleType` is the task's effective module (composed
 * lessons: the per-task type, never lesson.type); `isModuleTask` is false for quiz, information
 * and activity tasks, which have no workspace controls.
 */
export function validateTaskHighlight(task, { n, moduleType, isModuleTask }, errors, warnings) {
  const value = task?.highlight
  if (value == null) return
  const name = highlightTargetName(value)
  if (!name) {
    const family = symbolFamilyNamed(moduleType, value)
    errors.push(
      family
        ? `Task ${n} highlight must be one target in quotes, e.g. highlight: "${family}:("`
        : `Task ${n} highlight must be a target name, e.g. highlight: run`
    )
    return
  }
  if (!isModuleTask) {
    errors.push(`Task ${n} highlight is only supported on code tasks`)
    return
  }
  if (!moduleHasHighlightTargets(moduleType)) {
    errors.push(`Task ${n} highlight is not supported in ${moduleType ?? 'this'} lessons`)
    return
  }
  const entry = resolveHighlightTarget(moduleType, value)
  if (!entry) {
    const family = symbolFamilyNamed(moduleType, name)
    errors.push(
      family
        ? `Task ${n} highlight "${name}" is not a key on the ${moduleType} key row. Write one symbol in quotes, e.g. highlight: "${family}:("`
        : `Task ${n} highlight "${name}" is not a ${moduleType} control. Use one of: ${describeHighlightTargets(moduleType)}`
    )
    return
  }
  if (entry.touchOnly) {
    warnings?.push(
      `Task ${n} highlight ${entry.id} only shows on touch screens (iPad); keyboard screens have no key row`
    )
  }
  if (entry.id === 'costumes_tab' && task.showCostumesTab !== true) {
    warnings?.push(`Task ${n} highlight costumes_tab has no effect without showCostumesTab`)
  }
  if (entry.id === 'sounds_tab' && task.showSoundsTab !== true) {
    warnings?.push(`Task ${n} highlight sounds_tab has no effect without showSoundsTab`)
  }
}

// The tutor command written to RTDB.
export function buildControlHighlightCommand(target, taskId, now = Date.now()) {
  return { target, taskId: taskId ?? null, pushedAt: now }
}

/**
 * Picks the live command the student should see: the per-student or the class one, whichever
 * was pushed last. Returns null when neither is a valid command.
 */
export function pickLiveControlHighlight(studentCommand, classCommand) {
  const valid = (command) =>
    command && typeof command.target === 'string' && Number.isFinite(command.pushedAt)
      ? command
      : null
  const student = valid(studentCommand)
  const klass = valid(classCommand)
  if (!student) return klass
  if (!klass) return student
  return klass.pushedAt >= student.pushedAt ? klass : student
}

/**
 * The tutor card's read-only "glowing: (" label (request #126): the key a live `key:` command
 * is making glow on this student's screen, or null. Read from the existing commands only, so it
 * shows for the highlight's 20 s lifetime (the student's tap is not written back).
 * Returns { key, endsAt } so the card can drop the label on time.
 */
export function glowingKeyOnCard(
  studentCommand,
  classCommand,
  { taskId = null, now = Date.now() } = {}
) {
  const live = pickLiveControlHighlight(studentCommand, classCommand)
  if (!live || !live.target.startsWith('key:')) return null
  const endsAt = live.pushedAt + CONTROL_HIGHLIGHT_TIMEOUT_MS
  if (now >= endsAt) return null
  if (live.taskId != null && taskId != null && String(live.taskId) !== String(taskId)) return null
  const key = live.target.slice('key:'.length).trim()
  return key ? { key, endsAt } : null
}

// The CSS selector for a plain target's control.
export function highlightTargetSelector(id) {
  return `[${CONTROL_HIGHLIGHT_ATTR}~="${String(id).replace(/["\\]/g, '\\$&')}"]`
}

export function highlightRevealSelector(revealKey) {
  return `[${CONTROL_HIGHLIGHT_REVEAL_ATTR}~="${String(revealKey).replace(/["\\]/g, '\\$&')}"]`
}

// Task-field highlights pulse once per task per student per page load (memory only, like
// useFirstView: a reload may pulse it again, which is harmless).
const shownTaskHighlights = new Set()

export function claimTaskHighlight(lessonId, taskId, identityId) {
  const key = `${lessonId ?? ''}|${taskId ?? ''}|${identityId ?? ''}`
  if (shownTaskHighlights.has(key)) return false
  shownTaskHighlights.add(key)
  return true
}

// Tests only.
export function resetTaskHighlightMemory() {
  shownTaskHighlights.clear()
}
