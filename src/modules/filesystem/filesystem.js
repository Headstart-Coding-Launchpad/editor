export const DEFAULT_FS = { '/': { type: 'dir' } }

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

// Case-insensitive collision check, matching how checks.js's fsFindKey and the
// "Windows Explorer-style" framing in the docs already treat paths — without this, a
// student could create "Notes.txt" and "notes.txt" side by side, which real Explorer
// (and the check-evaluation layer) both treat as the same entry. excludePath lets a
// pure case-only rename of an entry succeed against its own prior path.
function findCaseInsensitiveMatch(fs, targetPath, excludePath = null) {
  const target = targetPath.toLowerCase()
  return Object.keys(fs).find((key) => key !== excludePath && key.toLowerCase() === target) ?? null
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
  return Object.keys(fs).filter((p) => {
    if (p === dir) return false
    const parent = parentPath(p)
    return parent === dir
  })
}

export function createEntry(fs, path, type, content = '') {
  const normPath = type === 'dir' ? normaliseDirPath(path) : normaliseFilePath(path)
  if (fs[normPath] || findCaseInsensitiveMatch(fs, normPath)) return fs
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
  if (fs[newPath] || findCaseInsensitiveMatch(fs, newPath, oldPath)) return fs

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
  const newPath = isDirectory ? normaliseDirPath(destDir + name) : normaliseFilePath(destDir + name)
  if (fs[newPath] || findCaseInsensitiveMatch(fs, newPath, srcPath)) return fs

  const next = {}
  for (const [key, value] of Object.entries(fs)) {
    if (key === srcPath) {
      next[newPath] = value
    } else if (isDirectory && key.startsWith(srcPath)) {
      next[newPath + key.slice(srcPath.length)] = value
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
  const newPath = isDirectory ? normaliseDirPath(destDir + name) : normaliseFilePath(destDir + name)
  if (fs[newPath] || findCaseInsensitiveMatch(fs, newPath, srcPath)) return fs

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
