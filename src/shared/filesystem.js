export const DEFAULT_FS = { '/': { type: 'dir' } }

export const FS_CHECK_TYPES = [
  'fs_file_exists',
  'fs_dir_exists',
  'fs_not_exists',
  'fs_content_contains',
  'fs_content_not_contains',
  'fs_content_equals',
  'fs_content_not_equals',
  'fs_content_matches_regex',
  'fs_file_in_dir',
  'fs_dir_opened',
  'fs_file_opened',
]

// ── path helpers ─────────────────────────────────────────────────────────────

export function normaliseDirPath(p) {
  if (!p.startsWith('/')) p = '/' + p
  if (!p.endsWith('/')) p = p + '/'
  return p
}

export function normaliseFilePath(p) {
  if (!p.startsWith('/')) p = '/' + p
  if (p.endsWith('/')) p = p.slice(0, -1)
  return p
}

export function isDir(entry) {
  return entry?.type === 'dir'
}

export function parentPath(path) {
  const isDirectory = path.endsWith('/')
  const trimmed = isDirectory ? path.slice(0, -1) : path
  const slashIdx = trimmed.lastIndexOf('/')
  if (slashIdx <= 0) return '/'
  return trimmed.slice(0, slashIdx) + '/'
}

export function entryName(path) {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  return trimmed.slice(trimmed.lastIndexOf('/') + 1)
}

// ── fs operations (all pure — return new fs map) ──────────────────────────────

export function listChildren(fs, dirPath) {
  const dir = normaliseDirPath(dirPath)
  return Object.keys(fs).filter(p => {
    if (p === dir) return false
    const parent = parentPath(p)
    return parent === dir
  })
}

export function createEntry(fs, path, type, content = '') {
  const normPath = type === 'dir' ? normaliseDirPath(path) : normaliseFilePath(path)
  if (fs[normPath]) return fs
  return { ...fs, [normPath]: type === 'dir' ? { type: 'dir' } : { type: 'file', content } }
}

export function deleteEntry(fs, path) {
  const next = { ...fs }
  // delete the entry and all descendants
  for (const key of Object.keys(next)) {
    if (key === path || key.startsWith(path.endsWith('/') ? path : path + '/')) {
      delete next[key]
    }
  }
  return next
}

export function renameEntry(fs, oldPath, newName) {
  if (!newName.trim()) return fs
  const isDirectory = oldPath.endsWith('/')
  const parent = parentPath(oldPath)
  const newPath = isDirectory
    ? normaliseDirPath(parent + newName.trim())
    : normaliseFilePath(parent + newName.trim())
  if (fs[newPath]) return fs

  const next = {}
  for (const [key, value] of Object.entries(fs)) {
    if (key === oldPath) {
      next[newPath] = value
    } else if (isDirectory && key.startsWith(oldPath)) {
      // update all descendants
      next[newPath + key.slice(oldPath.length)] = value
    } else {
      next[key] = value
    }
  }
  return next
}

export function moveEntry(fs, srcPath, destDirPath) {
  const destDir = normaliseDirPath(destDirPath)
  if (!fs[destDir]) return fs
  // prevent moving into itself
  if (destDir === srcPath || destDir.startsWith(srcPath)) return fs

  const name = entryName(srcPath)
  const isDirectory = srcPath.endsWith('/')
  const newPath = isDirectory
    ? normaliseDirPath(destDir + name)
    : normaliseFilePath(destDir + name)
  if (fs[newPath]) return fs

  const next = {}
  for (const [key, value] of Object.entries(fs)) {
    if (key === srcPath) {
      next[newPath] = value
    } else if (isDirectory && key.startsWith(srcPath)) {
      next[newPath + (key.endsWith('/') ? '' : '') + key.slice(srcPath.length)] = value
    } else {
      next[key] = value
    }
  }
  return next
}

export function copyEntry(fs, srcPath, destDirPath) {
  const destDir = normaliseDirPath(destDirPath)
  if (!fs[destDir]) return fs
  if (destDir === srcPath || destDir.startsWith(srcPath)) return fs

  const name = entryName(srcPath)
  const isDirectory = srcPath.endsWith('/')
  const newPath = isDirectory
    ? normaliseDirPath(destDir + name)
    : normaliseFilePath(destDir + name)
  if (fs[newPath]) return fs

  const additions = {}
  for (const [key, value] of Object.entries(fs)) {
    if (key === srcPath) {
      additions[newPath] = { ...value }
    } else if (isDirectory && key.startsWith(srcPath)) {
      additions[newPath + key.slice(srcPath.length)] = { ...value }
    }
  }
  return { ...fs, ...additions }
}

export function updateFileContent(fs, path, content) {
  if (!fs[path] || fs[path].type !== 'file') return fs
  return { ...fs, [path]: { type: 'file', content } }
}

// ── check evaluation ──────────────────────────────────────────────────────────

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
      return (fs[key].content ?? '').toLowerCase().includes((value ?? '').toLowerCase())
    }
    case 'fs_content_not_contains': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return !(fs[key].content ?? '').toLowerCase().includes((value ?? '').toLowerCase())
    }
    case 'fs_content_equals': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return (fs[key].content ?? '').trim().toLowerCase() === (value ?? '').trim().toLowerCase()
    }
    case 'fs_content_not_equals': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      return (fs[key].content ?? '').trim().toLowerCase() !== (value ?? '').trim().toLowerCase()
    }
    case 'fs_content_matches_regex': {
      const key = fsFindKey(fs, normaliseFilePath(path), 'file')
      if (!key) return false
      try { return new RegExp(value ?? '').test(fs[key].content ?? '') } catch { return false }
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
