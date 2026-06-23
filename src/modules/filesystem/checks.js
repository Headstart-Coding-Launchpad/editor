import {
  normaliseDirPath,
  normaliseFilePath,
  parentPath,
} from '../../shared/filesystem.js'
import { normalizeOutput } from '../../shared/checkHelpers.js'

export const FS_CHECK_TYPES = [
  'fs_file_exists',
  'fs_dir_exists',
  'fs_not_exists',
  'fs_content_contains',
  'fs_content_equals',
  'fs_file_in_dir',
  'fs_dir_opened',
  'fs_file_opened',
]

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
  return Object.keys(fs).find(
    k => pathMatchesPattern(k, normalizedPath) && (!type || fs[k].type === type)
  ) ?? null
}

export function evaluateFsCheck(check, fs, context = {}) {
  const { type, path, dir, value } = check

  // These checks only read context, not fs — evaluate before the null-fs guard
  if (type === 'fs_dir_opened')
    return pathMatchesPattern(normaliseDirPath(context.currentDir ?? '/'), normaliseDirPath(path))
  if (type === 'fs_file_opened') {
    if (!context.openFile) return false
    return pathMatchesPattern(normaliseFilePath(context.openFile), normaliseFilePath(path))
  }

  if (!fs) return false

  switch (type) {
    case 'fs_file_exists': {
      return !!fsFindKey(fs, normaliseFilePath(path), 'file')
    }
    case 'fs_dir_exists': {
      return !!fsFindKey(fs, normaliseDirPath(path), 'dir')
    }
    case 'fs_not_exists': {
      return !fsFindKey(fs, normaliseFilePath(path), 'file') && !fsFindKey(fs, normaliseDirPath(path), 'dir')
    }
    case 'fs_content_contains': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return normalizeOutput(fs[key].content ?? '').includes(normalizeOutput(value ?? ''))
    }
    case 'fs_content_equals': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return normalizeOutput(fs[key].content ?? '') === normalizeOutput(value ?? '')
    }
    case 'fs_file_in_dir': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      const expectedDir = normaliseDirPath(dir ?? '/')
      return parentPath(key).toLowerCase() === expectedDir.toLowerCase()
    }
    default:
      return false
  }
}
