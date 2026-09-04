export function resolveAssetsPath(rawPath, options = {}) {
  if (!rawPath) return ''
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL
  const origin = options.origin ?? window.location.origin
  const base = baseUrl.replace(/\/$/, '')
  const encoded = rawPath
    .split('/')
    .map((segment) => (segment ? encodeURIComponent(segment) : segment))
    .join('/')
  return origin + base + encoded
}

export function resolveAssetFileUrl(assetsPath, filePath, options = {}) {
  if (!filePath) return ''
  if (/^(?:https?:|data:|blob:)/.test(filePath)) return filePath
  if (filePath.startsWith('/')) return resolveAssetsPath(filePath, options)
  if (!assetsPath) return ''
  return assetsPath.replace(/\/$/, '') + '/' + filePath.replace(/^\//, '')
}
