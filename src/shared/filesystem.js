export const DEFAULT_FS = { '/': { type: 'dir' } }

export const FS_CHECK_TYPES = [
  'fs_file_exists',
  'fs_dir_exists',
  'fs_not_exists',
  'fs_content_contains',
  'fs_content_equals',
  'fs_file_in_dir',
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

export function updateFileContent(fs, path, content) {
  if (!fs[path] || fs[path].type !== 'file') return fs
  return { ...fs, [path]: { type: 'file', content } }
}

// ── check evaluation ──────────────────────────────────────────────────────────

export function evaluateFsCheck(check, fs) {
  if (!fs) return false
  const { type, path, dir, value } = check

  switch (type) {
    case 'fs_file_exists': {
      const p = normaliseFilePath(path)
      return !!fs[p] && fs[p].type === 'file'
    }
    case 'fs_dir_exists': {
      const p = normaliseDirPath(path)
      return !!fs[p] && fs[p].type === 'dir'
    }
    case 'fs_not_exists': {
      const pFile = normaliseFilePath(path)
      const pDir = normaliseDirPath(path)
      return !fs[pFile] && !fs[pDir]
    }
    case 'fs_content_contains': {
      const p = normaliseFilePath(path)
      if (!fs[p] || fs[p].type !== 'file') return false
      return (fs[p].content ?? '').toLowerCase().includes((value ?? '').toLowerCase())
    }
    case 'fs_content_equals': {
      const p = normaliseFilePath(path)
      if (!fs[p] || fs[p].type !== 'file') return false
      return (fs[p].content ?? '').trim().toLowerCase() === (value ?? '').trim().toLowerCase()
    }
    case 'fs_file_in_dir': {
      const p = normaliseFilePath(path)
      if (!fs[p] || fs[p].type !== 'file') return false
      const expectedDir = normaliseDirPath(dir ?? '/')
      return parentPath(p) === expectedDir
    }
    default:
      return false
  }
}
