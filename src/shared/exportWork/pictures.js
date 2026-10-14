// Browser helpers shared by the module exporters' pictures: canvases and SVGs as PNG bytes,
// and CORS-safe image loading (a cross-origin image drawn without CORS taints the canvas,
// which then can't be exported).

/** A fresh canvas (OffscreenCanvas is avoided: toBlob/drawImage support differs). */
export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** A canvas as PNG bytes. */
export async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a PNG'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/** Fetches a file as bytes; throws when the host refuses (no CORS) or it is missing. */
export async function fetchBytes(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim())
  return new Uint8Array(await res.arrayBuffer())
}

function mimeForUrl(url) {
  const path = String(url).split(/[?#]/)[0].toLowerCase()
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.gif')) return 'image/gif'
  if (path.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

/** Decodes image bytes to an <img> (via a blob URL, so the canvas stays untainted). */
export function bytesToImage(bytes, mime = 'image/png') {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode the image'))
    }
    img.src = url
  })
}

/** Loads a remote image CORS-safely: `{ img, bytes, mime }`. Throws when it can't be fetched. */
export async function loadImage(url) {
  const bytes = await fetchBytes(url)
  const mime = mimeForUrl(url)
  return { img: await bytesToImage(bytes, mime), bytes, mime }
}

/** An SVG string drawn to PNG bytes at `scale` (2 = crisp on high-DPI screens). */
export async function svgToPngBytes(svg, width, height, { scale = 2, background = null } = {}) {
  const img = await bytesToImage(new TextEncoder().encode(svg), 'image/svg+xml')
  const canvas = makeCanvas(width * scale, height * scale)
  const ctx = canvas.getContext('2d')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvasToPngBytes(canvas)
}

/** Triggers a browser download of bytes or text. */
export function downloadFile(name, data, mime = 'application/octet-stream') {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Deferred: revoking at once can abort the download before the browser reads the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
