// Inlines an HTML project's own stylesheets and scripts into its entry page, for the single-file
// download and the share viewer's preview (see ./exportWork.js). Pure.

const ATTR = (name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')

function attrValue(tag, name) {
  const match = tag.match(ATTR(name))
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null
}

function normalisePath(path) {
  return String(path ?? '')
    .trim()
    .replace(/^\.\//, '')
    .split(/[?#]/)[0]
}

/**
 * The entry page with the project's own stylesheets and scripts inlined, so it works as one
 * downloaded file. Pure. Links to other files (images, other pages) are left as they are.
 */
export function inlineHtmlFiles(files, entryFile) {
  const byName = new Map((files ?? []).map((file) => [file.name, file.content ?? '']))
  const entryName =
    (entryFile && byName.has(entryFile) ? entryFile : null) ??
    (files ?? []).find((file) => /\.html?$/i.test(file.name))?.name ??
    null
  if (!entryName) return null
  let html = byName.get(entryName)
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = (attrValue(tag, 'rel') ?? '').toLowerCase()
    const href = normalisePath(attrValue(tag, 'href'))
    if (!rel.split(/\s+/).includes('stylesheet') || !byName.has(href)) return tag
    return `<style>\n${byName.get(href).replace(/<\/style/gi, '<\\/style')}\n</style>`
  })
  html = html.replace(/<script\b([^>]*)>\s*<\/script\s*>/gi, (tag, attrs) => {
    const src = normalisePath(attrValue(`<script ${attrs}>`, 'src'))
    if (!src || !byName.has(src)) return tag
    const rest = attrs.replace(ATTR('src'), '').trim()
    const body = byName.get(src).replace(/<\/script/gi, '<\\/script')
    return `<script${rest ? ` ${rest}` : ''}>\n${body}\n</script>`
  })
  return html
}
