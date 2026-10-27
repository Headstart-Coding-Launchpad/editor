// Only in-app paths. "//host" and "/\host" are protocol-relative URLs that
// can leave the site, so they fall back to the home page.
export function safeRedirect(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}
