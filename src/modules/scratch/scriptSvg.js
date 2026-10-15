// A rendered Blockly workspace as one standalone SVG (computed styles copied onto every element,
// images and the Quicksand block font embedded), so it draws the same anywhere: as a file, or
// drawn to a PNG. Shared by `hsc scratch render` (cli/scratch-render/page.js, headless) and the
// tutor's "Export work" script pictures (./export/scriptPictures.js). Browser only.

const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@600&display=block'
const SVG_NS = 'http://www.w3.org/2000/svg'

// Computed styles copied onto every exported element, so the SVG needs no stylesheet.
const STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'filter',
  'font-family',
  'font-size',
  'font-weight',
  'dominant-baseline',
  'text-anchor',
  'display',
  'visibility',
]

// The read-only, chrome-free workspace options both callers render with.
export const SCRIPT_RENDER_OPTIONS = Object.freeze({
  renderer: 'zelos',
  readOnly: true,
  trashcan: false,
  sounds: false,
  zoom: { controls: false, wheel: false, startScale: 1 },
  move: { scrollbars: false, drag: false, wheel: false },
})

export function copyStyles(source, target) {
  const computed = getComputedStyle(source)
  const style = STYLE_PROPS.map((prop) => [prop, computed.getPropertyValue(prop)])
    .filter(([, value]) => value && value !== 'none' && value !== 'normal')
    .map(([prop, value]) => `${prop}:${value}`)
  if (computed.display === 'none') style.push('display:none')
  if (style.length) target.setAttribute('style', style.join(';'))
  for (let i = 0; i < source.children.length; i++)
    copyStyles(source.children[i], target.children[i])
}

export async function toDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Inlines <image> files that aren't already data: URIs (Blockly's dropdown arrow).
export async function inlineImages(root, warnings) {
  for (const img of root.querySelectorAll('image')) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href')
    if (!href || href.startsWith('data:')) continue
    try {
      img.setAttribute('href', await toDataUrl(new URL(href, location.href).href))
      img.removeAttribute('xlink:href')
    } catch (e) {
      warnings.push(`Could not inline image ${href}: ${e.message}`)
    }
  }
}

// The Quicksand 600 @font-face rules with the font files embedded, so text renders in the
// app's font wherever the SVG is used.
export async function embeddedFontCss(warnings) {
  try {
    const css = await (await fetch(FONT_CSS_URL)).text()
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]
    let out = css
    for (const url of urls) out = out.split(url).join(await toDataUrl(url))
    return out
  } catch (e) {
    warnings.push(`Could not embed the Quicksand font: ${e.message}`)
    return ''
  }
}

/**
 * The rendered workspace `ws` as a standalone SVG string, cropped to its blocks plus `padding`.
 * `decorate(clone, { x0, y0 })` may annotate the cloned canvas before it is serialised.
 * Returns { svg, width, height } (width/height 0 for an empty workspace).
 */
export async function workspaceToSvg(
  ws,
  { padding = 8, embedFont = true, warnings = [], decorate = null } = {}
) {
  const canvas = ws.getCanvas()
  const box = canvas.getBBox()
  const x0 = box.x - padding
  const y0 = box.y - padding
  const width = Math.ceil(box.width + padding * 2)
  const height = Math.ceil(box.height + padding * 2)

  const clone = canvas.cloneNode(true)
  copyStyles(canvas, clone)
  clone.removeAttribute('transform')
  clone.setAttribute('transform', `translate(${-x0} ${-y0})`)
  decorate?.(clone, { x0, y0 })

  const out = document.createElementNS(SVG_NS, 'svg')
  out.setAttribute('xmlns', SVG_NS)
  out.setAttribute('width', String(width))
  out.setAttribute('height', String(height))
  out.setAttribute('viewBox', `0 0 ${width} ${height}`)
  out.setAttribute('class', 'hsc-scratch-script')
  const defs = ws.getParentSvg().querySelector('defs')
  if (defs) out.appendChild(defs.cloneNode(true))
  if (embedFont) {
    const css = await embeddedFontCss(warnings)
    if (css) {
      const style = document.createElementNS(SVG_NS, 'style')
      style.textContent = css
      out.insertBefore(style, out.firstChild)
    }
  }
  out.appendChild(clone)
  await inlineImages(out, warnings)
  return { svg: new XMLSerializer().serializeToString(out), width, height }
}
