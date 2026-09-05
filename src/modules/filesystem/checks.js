import { normaliseDirPath, normaliseFilePath, parentPath } from './filesystem.js'
import {
  compareValues,
  countOutputLines,
  matchesContainValue,
  matchesRegex,
  normalizeOutput,
} from '../../shared/checkHelpers.js'

export const FS_CHECK_TYPES = [
  'fs_path',
  'fs_file_content',
  'fs_file_line_count',
  'fs_file_location',
  'fs_folder_count',
  'fs_opened',
  'fs_file_exists',
  'fs_dir_exists',
  'fs_not_exists',
  'fs_content_contains',
  'fs_content_not_contains',
  'fs_content_equals',
  'fs_content_matches_regex',
  'fs_content_not_matches_regex',
  'fs_content_line_count',
  'fs_file_in_dir',
  'fs_file_count',
  'fs_dir_count',
  'fs_dir_opened',
  'fs_file_opened',
]

const FS_LEGACY_CHECK_ALIASES = {
  fs_file_exists: { type: 'fs_path', operator: 'exists', itemType: 'file' },
  fs_dir_exists: { type: 'fs_path', operator: 'exists', itemType: 'dir' },
  fs_not_exists: { type: 'fs_path', operator: 'not_exists', itemType: 'any' },
  fs_content_contains: { type: 'fs_file_content', operator: 'contains' },
  fs_content_not_contains: { type: 'fs_file_content', operator: 'not_contains' },
  fs_content_equals: { type: 'fs_file_content', operator: 'equals' },
  fs_content_matches_regex: { type: 'fs_file_content', operator: 'matches_regex' },
  fs_content_not_matches_regex: { type: 'fs_file_content', operator: 'not_matches_regex' },
  fs_content_line_count: { type: 'fs_file_line_count' },
  fs_file_in_dir: { type: 'fs_file_location', operator: 'in_folder' },
  fs_file_count: { type: 'fs_folder_count', itemType: 'file' },
  fs_dir_count: { type: 'fs_folder_count', itemType: 'dir' },
  fs_dir_opened: { type: 'fs_opened', operator: 'is_open', itemType: 'dir' },
  fs_file_opened: { type: 'fs_opened', operator: 'is_open', itemType: 'file' },
}

export function normalizeFsCheck(check) {
  const alias = FS_LEGACY_CHECK_ALIASES[check?.type]
  if (!alias) return check
  return {
    ...check,
    legacyType: check.legacyType ?? check.type,
    ...alias,
    operator: check.operator ?? alias.operator,
    itemType: check.itemType ?? alias.itemType,
  }
}

// Converts a glob pattern to a case-insensitive regex.
// * matches any sequence of non-/ chars; ** matches anything; ? matches one non-/ char.
function pathMatchesPattern(path, pattern) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.+')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${regexStr}$`, 'i').test(path)
}

function fsFindKey(fs, normalizedPath, type = null) {
  return (
    Object.keys(fs).find(
      (k) => pathMatchesPattern(k, normalizedPath) && (!type || fs[k].type === type)
    ) ?? null
  )
}

function fsDirectChildCount(fs, dir, type) {
  const parent = normaliseDirPath(dir ?? '/').toLowerCase()
  return Object.keys(fs).filter(
    (k) => fs[k]?.type === type && k !== '/' && parentPath(k).toLowerCase() === parent
  ).length
}

export function evaluateFsCheck(check, fs, context = {}) {
  check = normalizeFsCheck(check)
  const { type, path, dir, value } = check

  if (type === 'fs_opened' && check.itemType === 'dir') {
    return pathMatchesPattern(normaliseDirPath(context.currentDir ?? '/'), normaliseDirPath(path))
  }
  if (type === 'fs_opened' && check.itemType === 'file') {
    if (!context.openFile) return false
    return pathMatchesPattern(normaliseFilePath(context.openFile), normaliseFilePath(path))
  }

  if (!fs) return false

  switch (type) {
    case 'fs_path': {
      const exists =
        check.itemType === 'file'
          ? !!fsFindKey(fs, normaliseFilePath(path), 'file')
          : check.itemType === 'dir'
            ? !!fsFindKey(fs, normaliseDirPath(path), 'dir')
            : !!fsFindKey(fs, normaliseFilePath(path), 'file') ||
              !!fsFindKey(fs, normaliseDirPath(path), 'dir')
      return check.operator === 'not_exists' ? !exists : exists
    }
    case 'fs_file_content': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      const content = fs[key].content ?? ''
      if (check.operator === 'contains')
        return matchesContainValue(content, value ?? '', normalizeOutput)
      if (check.operator === 'not_contains')
        return !matchesContainValue(content, value ?? '', normalizeOutput)
      if (check.operator === 'equals')
        return normalizeOutput(content) === normalizeOutput(value ?? '')
      if (check.operator === 'not_equals')
        return normalizeOutput(content) !== normalizeOutput(value ?? '')
      if (check.operator === 'matches_regex')
        return matchesRegex(normalizeOutput(content, true), value, check.flags)
      if (check.operator === 'not_matches_regex')
        return !matchesRegex(normalizeOutput(content, true), value, check.flags)
      return false
    }
    case 'fs_file_line_count': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return compareValues(
        countOutputLines(fs[key].content ?? ''),
        check.operator ?? 'equals',
        value
      )
    }
    case 'fs_file_location': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      const expectedDir = normaliseDirPath(dir ?? '/')
      return (
        check.operator === 'in_folder' &&
        parentPath(key).toLowerCase() === expectedDir.toLowerCase()
      )
    }
    case 'fs_folder_count': {
      return compareValues(
        fsDirectChildCount(fs, path, check.itemType ?? 'file'),
        check.operator ?? 'equals',
        value
      )
    }
    default:
      return false
  }
}
