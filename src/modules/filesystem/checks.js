import {
  normaliseDirPath,
  normaliseFilePath,
  parentPath,
} from '../../shared/filesystem.js'

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

export function evaluateFsCheck(check, fs, context = {}) {
  const { type, path, dir, value } = check

  // These checks only read context, not fs — evaluate before the null-fs guard
  if (type === 'fs_dir_opened')
    return normaliseDirPath(path) === normaliseDirPath(context.currentDir ?? '/')
  if (type === 'fs_file_opened') {
    if (!context.openFile) return false
    return normaliseFilePath(path) === normaliseFilePath(context.openFile)
  }

  if (!fs) return false

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
