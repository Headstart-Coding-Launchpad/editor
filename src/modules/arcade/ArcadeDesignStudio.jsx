import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ARCADE_PALETTE,
  allowsArcadeTool,
  createArcadeDesign,
  createArcadeMap,
  createArcadeSprite,
  generatedArcadeAssets,
  generatedArcadeTilemaps,
  nextTileSymbol,
  resizeArcadeMap,
  resizeArcadeSprite,
  spriteFileName,
  updateMapCell,
} from './design'

const DEFAULT_COLOUR = ARCADE_PALETTE[12].hex
const MAX_HISTORY = 50

function replaceById(items, id, value) {
  return items.map((item) => (item.id === id ? value : item))
}

function shortAssetName(name) {
  return String(name).split('/').pop()
}

export default function ArcadeDesignStudio({
  task,
  design,
  onChange,
  availableAssets = [],
  readOnly = false,
  title = 'Game art & level',
  layout = 'default',
}) {
  const [selectedSpriteId, setSelectedSpriteId] = useState(null)
  const [selectedMapId, setSelectedMapId] = useState(null)
  const [colour, setColour] = useState(DEFAULT_COLOUR)
  const [selectedSymbol, setSelectedSymbol] = useState('.')
  const [objectType, setObjectType] = useState('spawn')
  const [objectX, setObjectX] = useState(0)
  const [objectY, setObjectY] = useState(0)
  const [propertyKey, setPropertyKey] = useState('damage')
  const [propertyValue, setPropertyValue] = useState('')
  const [activeTab, setActiveTab] = useState('sprites')
  const [mapColumns, setMapColumns] = useState('')
  const [mapRows, setMapRows] = useState('')
  const paintModeRef = useRef(null)
  const mapPaintRef = useRef(false)
  // Undo/redo history is local to this component even though `design` is controlled by the
  // parent — undo is just "call onChange with an older snapshot", the same mechanism a
  // normal edit already uses. Bounded to avoid unbounded growth over a long editing session.
  const [historyStack, setHistoryStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const selfChangeRef = useRef(false)
  const sectionRef = useRef(null)
  const undoRef = useRef(() => {})
  const redoRef = useRef(() => {})
  const normal = useMemo(() => createArcadeDesign(design), [design])

  // A `design` change this component didn't itself just cause (switching tasks, switching
  // Builder stage tabs, an incoming teacher/student live update) means the history no longer
  // corresponds to the design now shown — drop it rather than risk undo restoring a snapshot
  // from a different task/stage onto the current one.
  useEffect(() => {
    if (selfChangeRef.current) {
      selfChangeRef.current = false
      return
    }
    setHistoryStack((stack) => (stack.length === 0 ? stack : []))
    setRedoStack((stack) => (stack.length === 0 ? stack : []))
  }, [design])
  const sprite =
    normal.sprites.find((item) => item.id === selectedSpriteId) ?? normal.sprites[0] ?? null
  const map = normal.maps.find((item) => item.id === selectedMapId) ?? normal.maps[0] ?? null
  const selectedTile = map?.tiles?.[selectedSymbol] ?? null
  const generatedAssets = useMemo(() => generatedArcadeAssets(normal), [normal])
  const generatedTilemaps = useMemo(() => generatedArcadeTilemaps(normal), [normal])
  const externalAssets = useMemo(
    () =>
      availableAssets
        .map((asset) => (typeof asset === 'string' ? { name: asset, url: '' } : asset))
        .filter((asset) => asset?.name),
    [availableAssets]
  )
  const assetNames = useMemo(
    () => [
      ...new Set([
        ...externalAssets.map((asset) => asset.name),
        ...generatedAssets.map((asset) => asset.name),
      ]),
    ],
    [externalAssets, generatedAssets]
  )
  const assetUrls = useMemo(
    () => new Map([...externalAssets, ...generatedAssets].map((asset) => [asset.name, asset.url])),
    [externalAssets, generatedAssets]
  )
  const canDrawSprites = allowsArcadeTool(task, 'sprites') || !task
  const canDrawMaps = allowsArcadeTool(task, 'tilemaps') || !task
  const builderLayout = layout === 'builder'
  const tabbedLayout = layout === 'student'

  useEffect(() => {
    if (!selectedSpriteId && normal.sprites[0]) setSelectedSpriteId(normal.sprites[0].id)
    if (!selectedMapId && normal.maps[0]) setSelectedMapId(normal.maps[0].id)
  }, [normal, selectedMapId, selectedSpriteId])
  useEffect(() => {
    setMapColumns(String(map?.columns ?? ''))
    setMapRows(String(map?.rows.length ?? ''))
  }, [map?.id, map?.columns, map?.rows.length])
  useEffect(() => {
    const stopPainting = () => {
      paintModeRef.current = null
      mapPaintRef.current = false
    }
    window.addEventListener('pointerup', stopPainting)
    return () => window.removeEventListener('pointerup', stopPainting)
  }, [])

  // `coalesce: true` skips pushing a new undo checkpoint — used for the paint-drag
  // continuation calls (continuePaint / paintMapCell's drag branch) so a whole brush stroke
  // undoes in one step instead of one step per pixel/cell touched.
  function commit(next, { coalesce = false } = {}) {
    if (!coalesce) {
      setHistoryStack((stack) => [...stack, normal].slice(-MAX_HISTORY))
      setRedoStack([])
    }
    selfChangeRef.current = true
    onChange?.(createArcadeDesign(next))
  }
  function updateSprite(nextSprite, opts) {
    commit({ ...normal, sprites: replaceById(normal.sprites, nextSprite.id, nextSprite) }, opts)
  }
  function updateMap(nextMap, opts) {
    commit({ ...normal, maps: replaceById(normal.maps, nextMap.id, nextMap) }, opts)
  }

  function undo() {
    if (readOnly || historyStack.length === 0) return
    const previous = historyStack[historyStack.length - 1]
    setHistoryStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, normal].slice(-MAX_HISTORY))
    selfChangeRef.current = true
    onChange?.(createArcadeDesign(previous))
  }
  function redo() {
    if (readOnly || redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setHistoryStack((stack) => [...stack, normal].slice(-MAX_HISTORY))
    selfChangeRef.current = true
    onChange?.(createArcadeDesign(next))
  }
  undoRef.current = undo
  redoRef.current = redo

  useEffect(() => {
    if (readOnly) return undefined
    function onKeyDown(event) {
      const mod = event.ctrlKey || event.metaKey
      if (!mod || !sectionRef.current?.contains(document.activeElement)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        redoRef.current()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        undoRef.current()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly])

  function addSprite() {
    const next = createArcadeSprite(normal.sprites)
    commit({ ...normal, sprites: [...normal.sprites, next] })
    setSelectedSpriteId(next.id)
  }

  function addFrame() {
    if (!sprite) return
    updateSprite({
      ...sprite,
      frames: [...sprite.frames, Array(sprite.width * sprite.height).fill(null)],
    })
  }
  function deleteFrame(frameIndex) {
    if (!sprite || sprite.frames.length <= 1) return
    updateSprite({ ...sprite, frames: sprite.frames.filter((_, index) => index !== frameIndex) })
  }
  function copyFrame(frameIndex) {
    if (!sprite) return
    const copied = [...sprite.frames[frameIndex]]
    updateSprite({
      ...sprite,
      frames: sprite.frames.flatMap((frame, index) =>
        index === frameIndex ? [frame, copied] : [frame]
      ),
    })
  }
  function deleteSprite() {
    if (!sprite) return
    const sprites = normal.sprites.filter((item) => item.id !== sprite.id)
    const maps = normal.maps.map((item) => {
      const removedSymbols = Object.entries(item.tiles)
        .filter(([, tile]) => tile.asset === sprite.name)
        .map(([symbol]) => symbol)
      if (!removedSymbols.length) return item
      return {
        ...item,
        tiles: Object.fromEntries(
          Object.entries(item.tiles).filter(([symbol]) => !removedSymbols.includes(symbol))
        ),
        rows: item.rows.map((row) =>
          [...row].map((symbol) => (removedSymbols.includes(symbol) ? '.' : symbol)).join('')
        ),
      }
    })
    commit({ ...normal, sprites, maps })
    setSelectedSpriteId(sprites[0]?.id ?? null)
  }
  function renameSprite(name) {
    if (!sprite) return
    const nextName = spriteFileName(name, sprite.name)
    const maps = normal.maps.map((item) => ({
      ...item,
      tiles: Object.fromEntries(
        Object.entries(item.tiles).map(([symbol, tile]) => [
          symbol,
          tile.asset === sprite.name ? { ...tile, asset: nextName } : tile,
        ])
      ),
    }))
    commit({
      ...normal,
      sprites: replaceById(normal.sprites, sprite.id, { ...sprite, name: nextName }),
      maps,
    })
  }
  function resizeSprite(size) {
    if (!sprite) return
    updateSprite(resizeArcadeSprite(sprite, size, size))
  }

  function paintPixel(frameIndex, index, clear = false, coalesce = false) {
    if (!sprite || readOnly) return
    const frames = sprite.frames.map((frame) => [...frame])
    frames[frameIndex][index] = clear ? null : colour
    updateSprite({ ...sprite, frames }, { coalesce })
  }
  function beginPaint(frameIndex, index, event) {
    if (readOnly) return
    event.preventDefault()
    const mode = event.button === 2 ? 'erase' : 'paint'
    paintModeRef.current = mode
    paintPixel(frameIndex, index, mode === 'erase', false)
  }
  function continuePaint(frameIndex, index) {
    if (!paintModeRef.current || readOnly) return
    paintPixel(frameIndex, index, paintModeRef.current === 'erase', true)
  }

  function addMap() {
    const next = createArcadeMap(normal.maps)
    commit({ ...normal, maps: [...normal.maps, next] })
    setSelectedMapId(next.id)
  }
  function deleteMap() {
    if (!map) return
    const maps = normal.maps.filter((item) => item.id !== map.id)
    commit({ ...normal, maps })
    setSelectedMapId(maps[0]?.id ?? null)
  }

  function addTile() {
    if (!map || !assetNames.length) return
    const symbol = nextTileSymbol(map)
    updateMap({
      ...map,
      tiles: { ...map.tiles, [symbol]: { asset: assetNames[0], properties: {} } },
    })
    setSelectedSymbol(symbol)
  }

  function updateTile(updates) {
    if (!map || !map.tiles[selectedSymbol]) return
    updateMap({
      ...map,
      tiles: { ...map.tiles, [selectedSymbol]: { ...map.tiles[selectedSymbol], ...updates } },
    })
  }
  function deleteTile(symbol = selectedSymbol) {
    if (!map || !map.tiles[symbol]) return
    updateMap({
      ...map,
      tiles: Object.fromEntries(
        Object.entries(map.tiles).filter(([tileSymbol]) => tileSymbol !== symbol)
      ),
      rows: map.rows.map((row) =>
        [...row].map((tileSymbol) => (tileSymbol === symbol ? '.' : tileSymbol)).join('')
      ),
    })
    if (selectedSymbol === symbol) setSelectedSymbol('.')
  }
  function selectTileAsset(asset) {
    if (!map || !selectedTile || selectedTile.asset === asset) return
    updateTile({ asset })
  }
  function resizeMap() {
    if (!map) return
    updateMap(resizeArcadeMap(map, mapColumns, mapRows))
  }

  function addObject() {
    if (!map || !objectType.trim()) return
    updateMap({
      ...map,
      objects: [
        ...map.objects,
        {
          id: `object-${Date.now().toString(36)}`,
          type: objectType.trim(),
          x: Number(objectX) || 0,
          y: Number(objectY) || 0,
          properties: {},
        },
      ],
    })
  }
  function addTileProperty() {
    if (!propertyKey.trim() || !selectedTile) return
    const numeric = Number(propertyValue)
    const value =
      propertyValue.trim() === ''
        ? true
        : Number.isFinite(numeric) && propertyValue.trim() !== ''
          ? numeric
          : propertyValue
    updateTile({ properties: { ...selectedTile.properties, [propertyKey.trim()]: value } })
    setPropertyValue('')
  }
  function deleteTileProperty(key) {
    if (!selectedTile) return
    const properties = { ...selectedTile.properties }
    delete properties[key]
    updateTile({ properties })
  }
  function paintMapCell(column, row, event, drag = false) {
    if (readOnly || !map || (drag && !mapPaintRef.current)) return
    if (!drag) {
      event.preventDefault()
      mapPaintRef.current = true
    }
    updateMap(updateMapCell(map, column, row, event?.button === 2 ? '.' : selectedSymbol), {
      coalesce: drag,
    })
  }

  const canUndo = historyStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <section style={s.section} ref={sectionRef}>
      <header style={s.header}>
        <div>
          <strong>{title}</strong>
          <span style={s.hint}>Pixel art, maps, properties, and spawns</span>
        </div>
        {!readOnly && (
          <div style={s.headerActions}>
            <button
              type="button"
              style={s.secondaryButton}
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              style={s.secondaryButton}
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪ Redo
            </button>
            {canDrawSprites && (
              <button type="button" style={s.primaryButton} onClick={addSprite}>
                + Add sprite
              </button>
            )}
            {canDrawMaps && (
              <button type="button" style={s.secondaryButton} onClick={addMap}>
                + Add map
              </button>
            )}
          </div>
        )}
      </header>
      <div style={s.assets}>
        <strong style={s.assetsTitle}>Assets</strong>
        {generatedAssets.length === 0 && <span style={s.muted}>No Arcade assets made yet.</span>}
        {generatedAssets.map((asset) => (
          <span key={asset.name} style={s.assetButton}>
            <img src={asset.url} alt="" style={s.assetThumb} />
            {shortAssetName(asset.name)} <small>made here</small>
          </span>
        ))}
        {generatedTilemaps.map((tilemap) => (
          <span key={tilemap.name} style={s.mapAssetButton}>
            {tilemap.name}
          </span>
        ))}
        {externalAssets.map((asset) => (
          <span key={asset.name} style={s.assetName}>
            {shortAssetName(asset.name)}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div style={s.modeNotice}>
          Student tools:{' '}
          {task?.arcadeTools === 'both'
            ? 'Sprites and tilemaps'
            : task?.arcadeTools === 'sprites'
              ? 'Sprites'
              : task?.arcadeTools === 'tilemaps'
                ? 'Tilemaps'
                : 'Disabled for students'}
        </div>
      )}
      {tabbedLayout && canDrawSprites && canDrawMaps && (
        <div style={s.tabs} role="tablist" aria-label="Game design tools">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sprites'}
            onClick={() => setActiveTab('sprites')}
            style={{ ...s.tab, ...(activeTab === 'sprites' ? s.tabActive : {}) }}
          >
            Sprites
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tilemaps'}
            onClick={() => setActiveTab('tilemaps')}
            style={{ ...s.tab, ...(activeTab === 'tilemaps' ? s.tabActive : {}) }}
          >
            Tilemaps
          </button>
        </div>
      )}
      <div style={builderLayout ? s.stacked : s.columns}>
        {canDrawSprites && (!tabbedLayout || activeTab === 'sprites') && (
          <details open style={builderLayout ? s.collapsible : s.openPanel}>
            <summary style={builderLayout ? s.sectionSummary : s.hiddenSummary}>
              Sprite editor
            </summary>
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <strong>Sprites</strong>
                {!readOnly && (
                  <div style={s.buttonGroup}>
                    <button className="btn-ghost" style={s.smallButton} onClick={addSprite}>
                      + Sprite
                    </button>
                    {sprite && (
                      <button className="btn-ghost" style={s.dangerButton} onClick={deleteSprite}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              {sprite ? (
                <>
                  <select
                    value={sprite.id}
                    onChange={(event) => setSelectedSpriteId(event.target.value)}
                    style={s.select}
                  >
                    {normal.sprites.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <label style={s.field}>
                    Name
                    <input
                      value={sprite.name.replace(/\.png$/i, '')}
                      disabled={readOnly}
                      onChange={(event) => renameSprite(event.target.value)}
                    />
                    <small style={s.fileHint}>.png added automatically</small>
                  </label>
                  <div style={s.spriteToolbar}>
                    <div style={s.colourPalette} aria-label="16 colour palette">
                      {ARCADE_PALETTE.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          title={item.name.replace('_', ' ')}
                          aria-label={`Use ${item.name.replace('_', ' ')}`}
                          disabled={readOnly}
                          onClick={() => setColour(item.hex)}
                          style={{
                            ...s.colourSwatch,
                            background: item.hex,
                            ...(colour === item.hex ? s.colourSwatchActive : {}),
                          }}
                        />
                      ))}
                    </div>
                    <label style={s.sizeField}>
                      Size
                      <select
                        value={`${sprite.width}x${sprite.height}`}
                        disabled={readOnly}
                        onChange={(event) => resizeSprite(Number(event.target.value.split('x')[0]))}
                      >
                        <option value="8x8">8 x 8</option>
                        <option value="16x16">16 x 16</option>
                      </select>
                    </label>
                    <span style={s.dimension}>
                      {sprite.width} x {sprite.height} px
                    </span>
                    {!readOnly && (
                      <button className="btn-ghost" style={s.smallButton} onClick={addFrame}>
                        + Frame
                      </button>
                    )}
                  </div>
                  <div style={s.frames}>
                    {sprite.frames.map((frame, frameIndex) => (
                      <div key={frameIndex} style={s.frameWrap}>
                        <div style={s.frameHeading}>
                          <span style={s.frameLabel}>Frame {frameIndex + 1}</span>
                          {!readOnly && (
                            <div style={s.frameActions}>
                              <button
                                type="button"
                                style={s.frameCopy}
                                onClick={() => copyFrame(frameIndex)}
                              >
                                Copy
                              </button>
                              {sprite.frames.length > 1 && (
                                <button
                                  type="button"
                                  style={s.frameDelete}
                                  onClick={() => deleteFrame(frameIndex)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            ...s.pixelGrid,
                            gridTemplateColumns: `repeat(${sprite.width}, 22px)`,
                          }}
                        >
                          {frame.map((pixel, index) => (
                            <button
                              key={index}
                              type="button"
                              title="Drag to paint; right-click to erase"
                              onContextMenu={(event) => event.preventDefault()}
                              onPointerDown={(event) => beginPaint(frameIndex, index, event)}
                              onPointerEnter={() => continuePaint(frameIndex, index)}
                              style={{
                                ...s.pixel,
                                ...(pixel ? { background: pixel } : s.emptyPixel),
                              }}
                              disabled={readOnly}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={s.muted}>
                  Create a small pixel sprite. Extra frames become a simple animation strip.
                </p>
              )}
            </div>
          </details>
        )}
        {canDrawMaps && (!tabbedLayout || activeTab === 'tilemaps') && (
          <details open style={builderLayout ? s.collapsible : s.openPanel}>
            <summary style={builderLayout ? s.sectionSummary : s.hiddenSummary}>
              Tilemap editor
            </summary>
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <strong>Tilemaps</strong>
                {!readOnly && (
                  <div style={s.buttonGroup}>
                    <button className="btn-ghost" style={s.smallButton} onClick={addMap}>
                      + Map
                    </button>
                    {map && (
                      <button className="btn-ghost" style={s.dangerButton} onClick={deleteMap}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              {map ? (
                <>
                  <div style={s.row}>
                    <select
                      value={map.id}
                      onChange={(event) => setSelectedMapId(event.target.value)}
                      style={s.select}
                    >
                      {normal.maps.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label style={s.field}>
                    Map name
                    <input
                      value={map.name}
                      disabled={readOnly}
                      onChange={(event) => updateMap({ ...map, name: event.target.value })}
                    />
                  </label>
                  <div style={s.mapDimensions}>
                    <label style={s.field}>
                      Width
                      <input
                        type="number"
                        min="1"
                        max="64"
                        value={mapColumns}
                        disabled={readOnly}
                        onChange={(event) => setMapColumns(event.target.value)}
                      />
                    </label>
                    <label style={s.field}>
                      Height
                      <input
                        type="number"
                        min="1"
                        max="64"
                        value={mapRows}
                        disabled={readOnly}
                        onChange={(event) => setMapRows(event.target.value)}
                      />
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={s.smallButton}
                        onClick={resizeMap}
                      >
                        Resize map
                      </button>
                    )}
                  </div>
                  <div style={s.tilePalette}>
                    <button
                      type="button"
                      onClick={() => setSelectedSymbol('.')}
                      style={{
                        ...s.paletteTile,
                        ...(selectedSymbol === '.' ? s.paletteTileActive : {}),
                      }}
                    >
                      Empty
                    </button>
                    {Object.entries(map.tiles).map(([symbol, tile]) => (
                      <div key={symbol} style={s.paletteTileGroup}>
                        <button
                          type="button"
                          onClick={() => setSelectedSymbol(symbol)}
                          style={{
                            ...s.paletteTile,
                            ...(selectedSymbol === symbol ? s.paletteTileActive : {}),
                          }}
                          title={`Use ${tile.asset}`}
                        >
                          <span style={s.paletteSymbol}>{symbol}</span>
                          {assetUrls.get(tile.asset) && (
                            <img src={assetUrls.get(tile.asset)} alt="" style={s.paletteImage} />
                          )}
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            style={s.tileDelete}
                            onClick={() => deleteTile(symbol)}
                            aria-label={`Remove tile ${symbol}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button
                        className="btn-ghost"
                        style={s.smallButton}
                        onClick={addTile}
                        disabled={!assetNames.length}
                      >
                        + Tile
                      </button>
                    )}
                  </div>
                  {selectedTile && (
                    <>
                      <div style={s.tileSettings}>
                        <label style={s.field}>
                          Image
                          <select
                            value={selectedTile.asset}
                            disabled={readOnly}
                            onChange={(event) => selectTileAsset(event.target.value)}
                          >
                            {assetNames.map((name) => (
                              <option key={name}>{name}</option>
                            ))}
                          </select>
                        </label>
                        <label style={s.check}>
                          <input
                            type="checkbox"
                            checked={!!selectedTile.properties?.solid}
                            disabled={readOnly}
                            onChange={(event) =>
                              updateTile({
                                properties: {
                                  ...selectedTile.properties,
                                  solid: event.target.checked,
                                },
                              })
                            }
                          />{' '}
                          Solid
                        </label>
                        <label style={s.field}>
                          Tag
                          <input
                            value={selectedTile.properties?.tag ?? ''}
                            disabled={readOnly}
                            placeholder="e.g. hazard"
                            onChange={(event) =>
                              updateTile({
                                properties: { ...selectedTile.properties, tag: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label style={s.field}>
                          Property
                          <input
                            value={propertyKey}
                            disabled={readOnly}
                            onChange={(event) => setPropertyKey(event.target.value)}
                          />
                        </label>
                        <label style={s.field}>
                          Value
                          <input
                            value={propertyValue}
                            disabled={readOnly}
                            placeholder="true, 10, lava"
                            onChange={(event) => setPropertyValue(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={s.smallButton}
                          disabled={readOnly}
                          onClick={addTileProperty}
                        >
                          Add
                        </button>
                      </div>
                      {Object.entries(selectedTile.properties ?? {}).filter(
                        ([key]) => key !== 'solid' && key !== 'tag'
                      ).length > 0 && (
                        <div style={s.propertyList}>
                          {Object.entries(selectedTile.properties)
                            .filter(([key]) => key !== 'solid' && key !== 'tag')
                            .map(([key, value]) => (
                              <span key={key} style={s.propertyChip}>
                                {key}: {String(value)}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    style={s.chipDelete}
                                    onClick={() => deleteTileProperty(key)}
                                    aria-label={`Delete ${key} property`}
                                  >
                                    Remove
                                  </button>
                                )}
                              </span>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                  <div style={s.mapHint}>
                    Choose a tile, then click or drag across the map to paint.
                  </div>
                  <div
                    style={{
                      ...s.mapGrid,
                      gridTemplateColumns: `repeat(${map.rows[0]?.length ?? map.columns ?? 16}, 26px)`,
                    }}
                  >
                    {map.rows.flatMap((row, rowIndex) =>
                      [...row].map((symbol, column) => {
                        const tileImage = assetUrls.get(map.tiles?.[symbol]?.asset)
                        return (
                          <button
                            key={`${column}-${rowIndex}`}
                            type="button"
                            disabled={readOnly}
                            onContextMenu={(event) => event.preventDefault()}
                            onPointerDown={(event) => paintMapCell(column, rowIndex, event)}
                            onPointerEnter={() => paintMapCell(column, rowIndex, null, true)}
                            style={{
                              ...s.cell,
                              background: symbol === '.' ? '#f8fafc' : '#ddd6fe',
                            }}
                          >
                            {tileImage ? (
                              <img
                                src={tileImage}
                                alt={map.tiles[symbol]?.asset ?? symbol}
                                style={s.cellImage}
                              />
                            ) : symbol === '.' ? (
                              ''
                            ) : (
                              symbol
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                  <div style={s.objects}>
                    <strong>Object spawns</strong>
                    <div style={s.row}>
                      <input
                        value={objectType}
                        onChange={(event) => setObjectType(event.target.value)}
                        placeholder="coin"
                        disabled={readOnly}
                      />
                      <input
                        type="number"
                        value={objectX}
                        onChange={(event) => setObjectX(event.target.value)}
                        aria-label="Object x"
                        disabled={readOnly}
                      />
                      <input
                        type="number"
                        value={objectY}
                        onChange={(event) => setObjectY(event.target.value)}
                        aria-label="Object y"
                        disabled={readOnly}
                      />
                      <button
                        className="btn-ghost"
                        style={s.smallButton}
                        onClick={addObject}
                        disabled={readOnly}
                      >
                        + Spawn
                      </button>
                    </div>
                    {map.objects.map((object, index) => (
                      <div key={object.id ?? index} style={s.objectRow}>
                        <span>
                          {object.type} @ {object.x}, {object.y}
                        </span>
                        {!readOnly && (
                          <button
                            className="btn-ghost"
                            style={s.removeButton}
                            onClick={() =>
                              updateMap({
                                ...map,
                                objects: map.objects.filter(
                                  (_, objectIndex) => objectIndex !== index
                                ),
                              })
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={s.muted}>Create a map, then paint it using named sprite assets.</p>
              )}
            </div>
          </details>
        )}
      </div>
      {!canDrawSprites && !canDrawMaps && (
        <p style={s.muted}>
          This task does not expose design tools to students. Authors can still prepare its stage
          artwork here.
        </p>
      )}
    </section>
  )
}

const s = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    border: '1px solid #c4b5fd',
    borderRadius: 12,
    padding: 12,
    background: 'linear-gradient(135deg, #fafaff 0%, #f5f3ff 100%)',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    color: '#5b21b6',
  },
  hint: { marginLeft: 8, color: '#64748b', fontSize: 11 },
  headerActions: { display: 'flex', gap: 6, flexShrink: 0 },
  primaryButton: {
    padding: '6px 10px',
    border: '1px solid #6d28d9',
    borderRadius: 7,
    background: '#6d28d9',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(76,29,149,.2)',
  },
  secondaryButton: {
    padding: '6px 10px',
    border: '1px solid #8b5cf6',
    borderRadius: 7,
    background: '#fff',
    color: '#5b21b6',
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  assets: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    padding: '7px 9px',
    borderRadius: 8,
    background: '#eef2ff',
    border: '1px solid #dbeafe',
  },
  assetsTitle: { color: '#312e81' },
  assetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 7px',
    fontSize: 11,
    color: '#312e81',
    background: '#fff',
    border: '1px solid #c7d2fe',
    borderRadius: 999,
    fontWeight: 600,
  },
  mapAssetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 7px',
    fontSize: 11,
    color: '#075985',
    background: '#f0f9ff',
    border: '1px solid #7dd3fc',
    borderRadius: 999,
    fontWeight: 700,
  },
  assetThumb: {
    width: 15,
    height: 15,
    imageRendering: 'pixelated',
    background: '#e0e7ff',
    borderRadius: 3,
  },
  assetName: {
    padding: '3px 6px',
    color: '#475569',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 999,
  },
  modeNotice: { color: '#6d28d9', fontSize: 11, fontWeight: 600 },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #c4b5fd', paddingBottom: 6 },
  tab: {
    padding: '6px 11px',
    border: '1px solid transparent',
    borderRadius: 7,
    background: 'transparent',
    color: '#64748b',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: { color: '#fff', background: '#6d28d9', borderColor: '#6d28d9' },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 12,
  },
  stacked: { display: 'flex', flexDirection: 'column', gap: 10 },
  collapsible: {
    border: '1px solid #c4b5fd',
    borderRadius: 10,
    background: 'rgba(255,255,255,.55)',
    overflow: 'hidden',
  },
  sectionSummary: {
    padding: '9px 11px',
    color: '#4c1d95',
    fontWeight: 800,
    cursor: 'pointer',
    background: '#f5f3ff',
  },
  openPanel: { margin: 0 },
  hiddenSummary: { display: 'none' },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    padding: 10,
    border: '1px solid #d8b4fe',
    borderRadius: 10,
    background: 'rgba(255,255,255,.88)',
    boxShadow: '0 1px 2px rgba(76,29,149,.05)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#4c1d95',
    fontSize: 13,
  },
  buttonGroup: { display: 'flex', gap: 5, alignItems: 'center' },
  smallButton: {
    padding: '4px 8px',
    fontSize: 11,
    background: '#ede9fe',
    border: '1px solid #a78bfa',
    color: '#4c1d95',
    borderRadius: 6,
    fontWeight: 700,
  },
  dangerButton: {
    padding: '4px 8px',
    fontSize: 11,
    background: '#fff1f2',
    border: '1px solid #fda4af',
    color: '#be123c',
    borderRadius: 6,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  removeButton: {
    padding: '2px 6px',
    fontSize: 11,
    color: '#b91c1c',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  select: {
    minWidth: 0,
    width: '100%',
    height: 32,
    padding: '5px 8px',
    border: '1px solid #a5b4fc',
    borderRadius: 7,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    background: '#fff',
    color: '#1e293b',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    color: '#475569',
    fontWeight: 600,
  },
  fileHint: { color: '#64748b', fontWeight: 400, fontSize: 10 },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: '#475569',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  spriteToolbar: {
    display: 'flex',
    alignItems: 'end',
    flexWrap: 'wrap',
    gap: 10,
    padding: '6px 0 2px',
  },
  colourPalette: { display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 3 },
  colourSwatch: {
    width: 18,
    height: 18,
    padding: 0,
    border: '1px solid #64748b',
    borderRadius: 3,
    cursor: 'crosshair',
  },
  colourSwatchActive: { outline: '2px solid #6d28d9', outlineOffset: 1 },
  sizeField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    color: '#475569',
    fontWeight: 600,
  },
  dimension: { paddingBottom: 5, color: '#64748b', fontSize: 11 },
  frames: { display: 'flex', gap: 10, overflowX: 'auto', padding: '3px 2px 6px' },
  frameWrap: { display: 'flex', flexDirection: 'column', gap: 5 },
  frameHeading: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  frameLabel: { color: '#64748b', fontSize: 10, fontWeight: 700 },
  frameActions: { display: 'flex', gap: 4 },
  frameCopy: {
    padding: '2px 5px',
    color: '#4338ca',
    border: '1px solid #a5b4fc',
    borderRadius: 4,
    background: '#eef2ff',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  frameDelete: {
    padding: '2px 5px',
    color: '#be123c',
    border: '1px solid #fda4af',
    borderRadius: 4,
    background: '#fff1f2',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  pixelGrid: {
    display: 'grid',
    width: 'max-content',
    gap: 0,
    padding: 0,
    border: '1px solid #94a3b8',
    borderRadius: 0,
    background: '#f8fafc',
  },
  pixel: {
    width: 22,
    height: 22,
    aspectRatio: '1 / 1',
    boxSizing: 'border-box',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: 0,
    cursor: 'crosshair',
    touchAction: 'none',
    boxShadow: 'none',
  },
  emptyPixel: {
    backgroundColor: '#fff',
    backgroundImage:
      'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
    backgroundSize: '8px 8px',
    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
  },
  mapDimensions: {
    display: 'flex',
    alignItems: 'end',
    gap: 7,
    padding: 7,
    background: '#f8fafc',
    border: '1px solid #ddd6fe',
    borderRadius: 8,
  },
  tileSettings: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(85px,1fr) auto minmax(70px,1fr) minmax(65px,1fr) minmax(65px,1fr) auto',
    gap: 6,
    alignItems: 'end',
    padding: 7,
    background: '#f5f3ff',
    border: '1px solid #ddd6fe',
    borderRadius: 8,
  },
  propertyList: { display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 2px' },
  propertyChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 5px',
    border: '1px solid #c7d2fe',
    borderRadius: 5,
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: 11,
    fontWeight: 700,
  },
  chipDelete: {
    padding: 0,
    border: 0,
    background: 'transparent',
    color: '#be123c',
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
  },
  tilePalette: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '5px 0',
  },
  paletteTileGroup: { display: 'flex', alignItems: 'center', gap: 2 },
  paletteTile: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 30,
    padding: '3px 6px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    background: '#fff',
    color: '#475569',
    cursor: 'pointer',
  },
  paletteTileActive: { border: '2px solid #6d28d9', background: '#f5f3ff', color: '#4c1d95' },
  tileDelete: {
    width: 18,
    height: 22,
    padding: 0,
    border: '1px solid #fda4af',
    borderRadius: 4,
    background: '#fff1f2',
    color: '#be123c',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  paletteSymbol: { fontFamily: 'var(--font-code)', fontWeight: 700 },
  paletteImage: { width: 18, height: 18, imageRendering: 'pixelated' },
  mapHint: { color: '#64748b', fontSize: 11, marginTop: 2 },
  mapGrid: {
    display: 'grid',
    width: 'max-content',
    maxWidth: '100%',
    overflow: 'auto',
    gap: 2,
    padding: 5,
    border: '1px solid #c4b5fd',
    borderRadius: 9,
    background: '#ede9fe',
  },
  cell: {
    width: 26,
    height: 26,
    aspectRatio: '1 / 1',
    boxSizing: 'border-box',
    padding: 2,
    border: '1px solid #a5b4fc',
    borderRadius: 5,
    fontSize: 9,
    color: '#334155',
    cursor: 'cell',
    overflow: 'hidden',
    touchAction: 'none',
  },
  cellImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    imageRendering: 'pixelated',
    pointerEvents: 'none',
  },
  objects: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: 8,
    borderTop: '1px solid #ddd6fe',
    color: '#4c1d95',
    fontWeight: 700,
  },
  objectRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#64748b',
    fontWeight: 400,
  },
  muted: { color: '#64748b', margin: 0 },
}
