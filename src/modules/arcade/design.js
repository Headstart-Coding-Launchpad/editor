const DEFAULT_WIDTH = 8
const DEFAULT_HEIGHT = 8
const EMPTY_PIXEL = null
const TILE_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*+=?@'

function copy(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function clampSize(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) ? Math.max(1, Math.min(64, number)) : fallback
}

function safeName(value, fallback) {
  const text = String(value ?? '').trim().replace(/[^a-zA-Z0-9_./-]+/g, '-')
  return text || fallback
}

export function spriteFileName(value, fallback = 'sprite.png') {
  const name = safeName(value, fallback)
  return /\.png$/i.test(name) ? name : `${name}.png`
}

export function tilemapFileName(map) {
  const name = safeName(map?.name, 'world').replace(/\.[^/.]+$/, '')
  return `${name}.tilemap`
}

export function createPixelFrame(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, pixels = null) {
  const size = clampSize(width, DEFAULT_WIDTH) * clampSize(height, DEFAULT_HEIGHT)
  return Array.from({ length: size }, (_, index) => typeof pixels?.[index] === 'string' ? pixels[index] : EMPTY_PIXEL)
}

export function createArcadeSprite(existing = [], overrides = {}) {
  const number = existing.length + 1
  const width = clampSize(overrides.width, DEFAULT_WIDTH)
  const height = clampSize(overrides.height, DEFAULT_HEIGHT)
  const name = spriteFileName(overrides.name, `sprite-${number}.png`)
  return {
    id: overrides.id ?? `sprite-${Date.now().toString(36)}-${number}`,
    name,
    width,
    height,
    frames: [createPixelFrame(width, height, overrides.frames?.[0])],
  }
}

export function createArcadeMap(existing = [], overrides = {}) {
  const sourceRows = Array.isArray(overrides.rows) ? overrides.rows : null
  const inferredColumns = Math.max(...(sourceRows?.map(row => String(row).length) ?? [0]))
  // Maps made during the first visual-editor draft did not record a width and
  // defaulted to a single column. Treat that shape as the old default.
  const requestedColumns = overrides.columns ?? (inferredColumns === 1 && sourceRows?.length >= 4 ? 16 : inferredColumns)
  const columns = clampSize(requestedColumns > 0 ? requestedColumns : 16, 16)
  const rowCount = clampSize(overrides.rowCount ?? sourceRows?.length ?? overrides.rows, 12)
  return {
    id: overrides.id ?? `map-${Date.now().toString(36)}-${existing.length + 1}`,
    name: safeName(overrides.name, `world_${existing.length + 1}`),
    columns,
    tileSize: clampSize(overrides.tileSize, 16),
    rows: Array.from({ length: rowCount }, (_, row) => String(sourceRows?.[row] ?? '.').padEnd(columns, '.').slice(0, columns)),
    tiles: copy(overrides.tiles ?? {}),
    objects: copy(overrides.objects ?? []),
  }
}

export function createArcadeDesign(value = null) {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    version: 1,
    sprites: (raw.sprites ?? []).map(sprite => {
      const sourceFrames = Array.isArray(sprite.frames) && sprite.frames.length ? sprite.frames : [null]
      const isBlankLegacyGrid = sprite.width === 16 && sprite.height === 16 && sourceFrames.every(frame => !frame?.some(Boolean))
      const width = isBlankLegacyGrid ? DEFAULT_WIDTH : clampSize(sprite.width, DEFAULT_WIDTH)
      const height = isBlankLegacyGrid ? DEFAULT_HEIGHT : clampSize(sprite.height, DEFAULT_HEIGHT)
      const frames = sourceFrames
      return {
        id: sprite.id ?? `sprite-${Math.random().toString(36).slice(2, 8)}`,
        name: spriteFileName(sprite.name),
        width,
        height,
        frames: frames.map(frame => createPixelFrame(width, height, frame)),
      }
    }),
    maps: (raw.maps ?? []).map((map, index) => createArcadeMap(raw.maps.slice(0, index), map)),
  }
}

export function cloneArcadeDesign(value) {
  return createArcadeDesign(copy(value))
}

export function designForCodeTab(task, codeTab = 'starter') {
  if (codeTab === 'complete') return cloneArcadeDesign(task?.completeArcadeDesign)
  const stageMatch = String(codeTab).match(/^stage_(\d+)$/)
  if (stageMatch) return cloneArcadeDesign(task?.codeStages?.[Number(stageMatch[1])]?.arcadeDesign)
  return cloneArcadeDesign(task?.arcadeDesign)
}

export function updateDesignForCodeTab(task, codeTab = 'starter', design) {
  const next = cloneArcadeDesign(design)
  if (codeTab === 'complete') return { ...task, completeArcadeDesign: next }
  const stageMatch = String(codeTab).match(/^stage_(\d+)$/)
  if (stageMatch) {
    const index = Number(stageMatch[1])
    return { ...task, codeStages: (task.codeStages ?? []).map((stage, stageIndex) => stageIndex === index ? { ...stage, arcadeDesign: next } : stage) }
  }
  return { ...task, arcadeDesign: next }
}

export function generatedArcadeAssets(design) {
  return createArcadeDesign(design).sprites.map(sprite => ({ name: sprite.name, url: spriteToDataUrl(sprite), generated: true }))
}

export function generatedArcadeTilemaps(design) {
  return createArcadeDesign(design).maps.map(map => {
    const normal = createArcadeMap([], map)
    const tiles = Object.fromEntries(Object.entries(normal.tiles).map(([symbol, tile]) => [symbol, tile.asset ?? '']))
    const properties = Object.fromEntries(Object.entries(normal.tiles).map(([symbol, tile]) => [symbol, tile.properties ?? {}]))
    const solid = Object.entries(normal.tiles).filter(([, tile]) => tile.properties?.solid).map(([symbol]) => symbol).join('')
    return { name: tilemapFileName(normal), generated: true, data: { rows: normal.rows, tileSize: normal.tileSize, tiles, properties, objects: normal.objects, solid } }
  })
}

export function spriteToDataUrl(sprite) {
  const { width, height, frames } = createArcadeDesign({ sprites: [sprite] }).sprites[0]
  const rects = []
  frames.forEach((frame, frameIndex) => frame.forEach((colour, index) => {
    if (!colour) return
    const x = (index % width) + frameIndex * width
    const y = Math.floor(index / width)
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${String(colour).replace(/["<&]/g, '')}"/>`)
  }))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * frames.length}" height="${height}" viewBox="0 0 ${width * frames.length} ${height}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function nextTileSymbol(map) {
  const used = new Set(Object.keys(map?.tiles ?? {}))
  return [...TILE_SYMBOLS].find(symbol => !used.has(symbol)) ?? '?'
}

export function updateMapCell(map, column, row, symbol) {
  const rows = [...(map?.rows ?? [])]
  if (!rows[row] || column < 0 || column >= rows[row].length) return map
  rows[row] = rows[row].slice(0, column) + symbol + rows[row].slice(column + 1)
  return { ...map, rows }
}

function python(value) {
  if (value == null) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(python).join(', ')}]`
  return `{${Object.entries(value).map(([key, item]) => `${python(key)}: ${python(item)}`).join(', ')}}`
}

export function mapToPythonSnippet(map) {
  const normal = createArcadeMap([], map)
  const identifier = safeName(normal.name, 'world').replace(/[^a-zA-Z0-9_]/g, '_')
  return `from headstart_arcade import TileMap\n${identifier} = TileMap(${python(tilemapFileName(normal))})`
}

export function taskArcadeTools(task) {
  return task?.arcadeTools ?? 'none'
}

export function allowsArcadeTool(task, tool) {
  const setting = taskArcadeTools(task)
  return setting === 'both' || setting === tool
}
