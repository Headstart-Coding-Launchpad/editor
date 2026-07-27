export function parseScratchState(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function cloneScratchState(state) {
  if (!state) return null
  return JSON.parse(JSON.stringify(state))
}

export function cloneFiles(files = []) {
  return files.map(file => ({ ...file }))
}

export function getFileType(name, fallback = 'text') {
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.css')) return 'css'
  if (name.endsWith('.js')) return 'javascript'
  return fallback
}

export function decodeSessionFiles(sessionFiles, decodeKey, fallback = 'text') {
  if (!sessionFiles) return []
  return Object.entries(sessionFiles).map(([key, value]) => {
    // Older teacher-edit sessions briefly stored whole file objects under numeric
    // keys. Keep those sessions readable while ensuring editor content is text.
    const legacyFile = value && typeof value === 'object' && typeof value.name === 'string'
      ? value
      : null
    const name = legacyFile?.name ?? decodeKey(key)
    const content = typeof (legacyFile?.content ?? value) === 'string'
      ? (legacyFile?.content ?? value)
      : String(legacyFile?.content ?? value ?? '')
    return { name, content, type: legacyFile?.type ?? getFileType(name, fallback) }
  })
}
