// Soft-delete / restore, layered on top of the existing pure filesystem.js operations.
// Deliberately does not modify filesystem.js — the 'filesystem' module keeps its
// original hard-delete behaviour for backward compatibility.
import { createEntry, deleteEntry, entryName, parentPath } from '../../../filesystem/filesystem.js'

// Snapshots a path and every descendant out of `fs` before it is removed.
function snapshotEntries(fs, path) {
  const isDirectory = path.endsWith('/')
  const prefix = isDirectory ? path : path + '/'
  const entries = {}
  for (const [key, value] of Object.entries(fs)) {
    if (key === path || (isDirectory && key.startsWith(prefix))) {
      entries[key] = value
    }
  }
  return entries
}

// Moves `path` (and any descendants) from `fs` into `recycleBin`. Returns the new
// { fs, recycleBin } pair.
export function softDeleteEntry(fs, recycleBin, path) {
  const entries = snapshotEntries(fs, path)
  if (Object.keys(entries).length === 0) return { fs, recycleBin }
  const item = {
    path,
    entries,
    originalParent: parentPath(path),
    deletedAt: Date.now(),
  }
  return {
    fs: deleteEntry(fs, path),
    recycleBin: [...recycleBin, item],
  }
}

// Restores a previously soft-deleted item by its recycle-bin entry id (its original
// path at deletion time). Restores to the original location, or — if something now
// occupies that path — appends " (restored)" to avoid clobbering the newer item.
export function restoreEntry(fs, recycleBin, path) {
  const item = recycleBin.find(i => i.path === path)
  if (!item) return { fs, recycleBin }

  let nextFs = fs
  const conflict = Object.prototype.hasOwnProperty.call(fs, item.path)
  if (!conflict) {
    nextFs = { ...fs, ...item.entries }
  } else {
    const isDirectory = item.path.endsWith('/')
    const name = entryName(item.path) + ' (restored)'
    const restoredRoot = isDirectory
      ? `${item.originalParent}${name}/`
      : `${item.originalParent}${name}`
    const additions = {}
    for (const [key, value] of Object.entries(item.entries)) {
      additions[restoredRoot + key.slice(item.path.length)] = value
    }
    additions[restoredRoot] = item.entries[item.path]
    nextFs = { ...fs, ...additions }
  }

  return {
    fs: nextFs,
    recycleBin: recycleBin.filter(i => i.path !== path),
  }
}

// Permanently removes an item from the recycle bin without restoring it ("Empty Recycle Bin").
export function purgeEntry(recycleBin, path) {
  return recycleBin.filter(i => i.path !== path)
}

export function isInRecycleBin(recycleBin, path) {
  return recycleBin.some(i => i.path === path)
}

// createEntry re-exported for callers that need to build a fresh item without going
// through softDeleteEntry (e.g. seeding a starter recycle bin in authored lessons).
export { createEntry }
