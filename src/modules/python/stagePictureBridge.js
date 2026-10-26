// The Pyodide worker's Image Lab bridge (pyodide.worker.js; docs/authoring/stage.md "Image Lab"):
// the JS side of the stage module's load_image(), snapshot() and red()/green()/blue() for colour
// names. Each answer is 'ok|…' or 'Kind|message' for Python to raise, like __hsStageHue.
//
// How a picture reaches Python synchronously: load_image() can't wait for a download, so before
// each run (and each stageTarget render) the worker calls prepare(code), which fetches every
// library name the program writes as text (imageNamesInCode) into a cache that lasts as long as
// the worker. A name the scan missed (built from pieces, typed in by input()) is fetched there and
// then with a synchronous request, which workers allow. Only programs that call load_image()
// fetch anything; each picture is one 12 KB file (public/image-lab/<name>.rgb).
import {
  IMAGE_BYTES,
  imageNamesInCode,
  imageUrl,
  readImageRequest,
  resizeImageBytes,
  rgbBytesToHex,
  rgbBytesToNamedPixels,
} from '../../shared/stage/imageLibrary.js'
import { readStageCallPayload } from '../../shared/stage/commands.js'
import { readSnapshotRequest, snapshotHex, stageColourValue } from '../../shared/stage/pictures.js'

async function fetchBytesAsync(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

function fetchBytesSync(url) {
  if (typeof XMLHttpRequest === 'undefined') return null
  const request = new XMLHttpRequest()
  request.open('GET', url, false)
  request.responseType = 'arraybuffer'
  request.send()
  if (request.status < 200 || request.status >= 300 || !request.response) return null
  return new Uint8Array(request.response)
}

// A download is a picture only when it is exactly the stored size (a dev server answers a
// missing file with the app's HTML page).
function asPicture(bytes) {
  return bytes instanceof Uint8Array && bytes.length === IMAGE_BYTES ? bytes : null
}

function readPayload(json) {
  try {
    return readStageCallPayload(JSON.parse(String(json)))
  } catch {
    return null
  }
}

const problem = (error) => `${error.kind}|${error.message}`

/**
 * `{ prepare(code), image(json), colour(name, json), snapshot(json), cached(name) }`.
 * `getCommands()` is the current run's Stage command list; `base` the app's base path.
 */
export function createStagePictureBridge({
  getCommands = () => [],
  base = '/',
  fetchBytes = fetchBytesAsync,
  fetchSync = fetchBytesSync,
} = {}) {
  const cache = new Map()
  const loading = new Map()

  function fetchPicture(name) {
    if (cache.has(name)) return Promise.resolve(cache.get(name))
    if (!loading.has(name)) {
      loading.set(
        name,
        Promise.resolve()
          .then(() => fetchBytes(imageUrl(name, base)))
          .then((bytes) => {
            const picture = asPicture(bytes)
            if (picture) cache.set(name, picture)
            return picture
          })
          .catch(() => null)
          .finally(() => loading.delete(name))
      )
    }
    return loading.get(name)
  }

  function pictureNow(name) {
    if (cache.has(name)) return cache.get(name)
    let picture = null
    try {
      picture = asPicture(fetchSync(imageUrl(name, base)))
    } catch {
      picture = null
    }
    if (picture) cache.set(name, picture)
    return picture
  }

  return {
    /** Fetches the pictures a program names, before it runs. Never throws. */
    async prepare(code) {
      const names = imageNamesInCode(code)
      if (names.length === 0) return
      await Promise.all(names.map(fetchPicture))
    },
    cached(name) {
      return cache.has(name)
    },
    image(json) {
      const payload = readPayload(json)
      if (!payload) return 'ValueError|load_image(): use a name in quotes, like load_image("fox")'
      const request = readImageRequest(payload.args, payload.kwargs)
      if (request.error) return problem(request.error)
      const picture = pictureNow(request.name)
      if (!picture) {
        return `RuntimeError|load_image(): the picture '${request.name}' couldn't be downloaded. Check the internet connection and press Run again`
      }
      const bytes = resizeImageBytes(picture, request.size, { crisp: request.image.crisp })
      // Pixel art comes back as colour names ('orange'), photos as hex (imageLibrary.js).
      if (request.image.crisp) return `names|${rgbBytesToNamedPixels(bytes)}`
      return `ok|${rgbBytesToHex(bytes)}`
    },
    colour(name, json) {
      const payload = readPayload(json)
      const fn = String(name)
      if (!payload) return `ValueError|${fn}(): give it a colour, like '#ff8800'`
      const { value, error } = stageColourValue(fn, payload.args, payload.kwargs)
      return error ? problem(error) : `ok|${value}`
    },
    snapshot(json) {
      const payload = readPayload(json)
      if (!payload) return 'ValueError|snapshot(): use a whole number, like snapshot(size=32)'
      const { size, error } = readSnapshotRequest(payload.args, payload.kwargs)
      if (error) return problem(error)
      return `ok|${snapshotHex(getCommands(), size)}`
    },
  }
}
