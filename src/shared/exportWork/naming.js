// File names for "Export work" (StudentModal): the task (or lesson) title and the date, never
// the student's name unless the tutor ticks "include first name" (default off). Pure.

const MAX_TITLE_LENGTH = 60

/** A title as a file-name-safe slug: letters, digits and dashes; '' when nothing is left. */
export function slugifyTitle(title) {
  return String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TITLE_LENGTH)
    .replace(/-+$/g, '')
}

/** The local date as YYYY-MM-DD. */
export function exportDateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The first word of a display name ("Jamie-2" → "Jamie"), file-name safe; '' when none. */
export function firstNameForFile(displayName) {
  const first = String(displayName ?? '')
    .trim()
    .split(/[\s-]+/)[0]
  return slugifyTitle(first)
}

/**
 * The stem every exported file starts with: `<Title>_<YYYY-MM-DD>`, or
 * `<FirstName>_<Title>_<YYYY-MM-DD>` when `includeName` is ticked. `fallback` names an untitled
 * task.
 */
export function exportFileStem({
  title,
  date = new Date(),
  displayName = '',
  includeName = false,
  fallback = 'task',
} = {}) {
  const parts = []
  const name = includeName ? firstNameForFile(displayName) : ''
  if (name) parts.push(name)
  parts.push(slugifyTitle(title) || fallback)
  parts.push(exportDateStamp(date))
  return parts.join('_')
}

/** `name`, or `name (2).ext`, `name (3).ext`… so no two files in one export share a name. */
export function uniqueFileName(name, used) {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 2
  while (used.has(`${base} (${n})${ext}`)) n += 1
  const next = `${base} (${n})${ext}`
  used.add(next)
  return next
}
