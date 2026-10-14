// A stable path to an element in the preview page, so a selection survives a re-run (the iframe
// is rebuilt on every Run) and can be sent to the class in Go Live as a short string.

function escapeIdent(name) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(name)
  return String(name).replace(/[^\w-]/g, (ch) => `\\${ch}`)
}

/**
 * "body > div:nth-of-type(2) > p:nth-of-type(1)", or "#intro" when an id is unique on the page.
 * Null for anything outside the document's <body> (or <html> itself).
 */
export function selectorPathFor(el) {
  const doc = el?.ownerDocument
  if (!doc || !el.tagName) return null
  const parts = []
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const tag = node.tagName.toLowerCase()
    if (tag === 'html') break
    if (node.id) {
      const idSelector = `#${escapeIdent(node.id)}`
      let unique = false
      try {
        unique = doc.querySelectorAll(idSelector).length === 1
      } catch {
        unique = false
      }
      if (unique) {
        parts.unshift(idSelector)
        return parts.join(' > ')
      }
    }
    if (tag === 'body' || tag === 'head') {
      parts.unshift(tag)
      break
    }
    const parent = node.parentElement
    const sameTag = parent
      ? Array.from(parent.children).filter((child) => child.tagName === node.tagName)
      : [node]
    parts.unshift(`${tag}:nth-of-type(${sameTag.indexOf(node) + 1})`)
  }
  return parts.length > 0 ? parts.join(' > ') : null
}

/** The first element matching `selector` in `doc`, or null (bad selectors are null too). */
export function resolveSelector(doc, selector) {
  if (!doc || typeof selector !== 'string' || !selector.trim()) return null
  try {
    return doc.querySelector(selector)
  } catch {
    return null
  }
}

/** Whether the Inspector can choose this element (not <html>, <head>, <script> or <style>). */
export function isInspectable(el) {
  const tag = el?.tagName?.toLowerCase()
  return !!tag && tag !== 'html' && tag !== 'head' && tag !== 'script' && tag !== 'style'
}
