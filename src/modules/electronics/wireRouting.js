// Orthogonal wire routing: given two pin points and the parts in the way, find a path
// that avoids the parts, avoids sitting on top of wires already routed, and bends as
// little as possible. Scored by the penalties below and searched with Dijkstra over a
// lane graph. Extracted from ElectronicsWorkspace.jsx unchanged.
import { clamp } from './boardGeometry'

// How far a route stays clear of a part, and what each undesirable trait costs when
// routes are compared. Overlapping an existing wire is far worse than crossing one,
// which is worse than an extra bend.
const WIRE_CLEARANCE = 18
const WIRE_OBSTACLE_PAD = 8
const WIRE_EXIT_STUB = 12
const WIRE_LANE_GAP = 10
const WIRE_OVERLAP_PENALTY = 5000
const WIRE_CROSSING_PENALTY = 900
const WIRE_BEND_PENALTY = 70

export function wirePath(from, to, componentRects = [], fromRef = '', toRef = '', bounds = null, usedWireSegments = []) {
  return pathFromPoints(wireRoutePoints(from, to, componentRects, fromRef, toRef, bounds, usedWireSegments))
}

export function wireRoutePoints(from, to, componentRects = [], fromRef = '', toRef = '', bounds = null, usedWireSegments = []) {
  const fromComponentId = String(fromRef).split('.')[0]
  const toComponentId = String(toRef).split('.')[0]
  const obstacles = componentRects
    .map(rect => ({
      ...rect,
      left: rect.left - WIRE_OBSTACLE_PAD,
      right: rect.right + WIRE_OBSTACLE_PAD,
      top: rect.top - WIRE_OBSTACLE_PAD,
      bottom: rect.bottom + WIRE_OBSTACLE_PAD,
    }))
  const fromRect = componentRects.find(rect => rect.id === fromComponentId)
  const toRect = componentRects.find(rect => rect.id === toComponentId)
  const fromExit = pinExitPoint(from, fromRef, fromRect)
  const toExit = pinExitPoint(to, toRef, toRect)
  const outerLane = outsideFacingRoute(fromExit, toExit, fromRef, toRef, fromRect, toRect, obstacles, bounds, usedWireSegments)
  const middle = outerLane ?? routeOrthogonal(fromExit, toExit, obstacles, bounds, usedWireSegments)
  const points = compactPathPoints([from, ...middle, to], { preserveIndexes: new Set([1, middle.length]) })
  return points
}

export function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(point.x)} ${Math.round(point.y)}`).join(' ')
}

export function directWirePath(from, to) {
  return `M ${Math.round(from.x)} ${Math.round(from.y)} L ${Math.round(to.x)} ${Math.round(to.y)}`
}

export function pinExitPoint(point, ref, rect) {
  if (!rect) return point
  const side = pinExitSide(point, rect)
  if (side === 'left') return { x: rect.left - WIRE_EXIT_STUB, y: point.y }
  if (side === 'right') return { x: rect.right + WIRE_EXIT_STUB, y: point.y }
  if (side === 'top') return { x: point.x, y: rect.top - WIRE_EXIT_STUB }
  return { x: point.x, y: rect.bottom + WIRE_EXIT_STUB }
}

export function pinExitSide(point, rect) {
  const distances = [
    ['left', Math.abs(point.x - rect.left)],
    ['right', Math.abs(point.x - rect.right)],
    ['top', Math.abs(point.y - rect.top)],
    ['bottom', Math.abs(point.y - rect.bottom)],
  ]
  distances.sort((a, b) => a[1] - b[1])
  return distances[0]?.[0] ?? 'bottom'
}

export function outsideFacingRoute(start, end, fromRef, toRef, fromRect, toRect, obstacles, bounds = null, usedWireSegments = []) {
  if (!fromRect || !toRect) return null
  const fromSide = pinExitSide(start, fromRect)
  const toSide = pinExitSide(end, toRect)
  const leftToRightAway = fromSide === 'left' && toSide === 'right' && start.x < end.x
  const rightToLeftAway = fromSide === 'right' && toSide === 'left' && start.x > end.x
  if (!leftToRightAway && !rightToLeftAway) return null

  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const minSpanX = Math.min(start.x, end.x)
  const maxSpanX = Math.max(start.x, end.x)
  const relevant = obstacles.filter(rect => rect.right >= minSpanX && rect.left <= maxSpanX)
  const topLane = clamp(Math.min(start.y, end.y, ...relevant.map(rect => rect.top)) - WIRE_CLEARANCE * 1.5, minY, maxY)
  const bottomLane = clamp(Math.max(start.y, end.y, ...relevant.map(rect => rect.bottom)) + WIRE_CLEARANCE * 1.5, minY, maxY)
  const candidates = [
    [start, { x: start.x, y: topLane }, { x: end.x, y: topLane }, end],
    [start, { x: start.x, y: bottomLane }, { x: end.x, y: bottomLane }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1, 2]) }))
    .filter(points => !pathHitsObstacles(points, obstacles))
    .map(points => ({ points, score: scoreWireRoute(points, usedWireSegments) }))
    .sort((a, b) => a.score - b.score)

  return candidates[0]?.points ?? null
}

export function compactPathPoints(points, options = {}) {
  return points.filter((point, index, all) => {
    const previous = all[index - 1]
    const next = all[index + 1]
    if (previous && Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5) return false
    if (!previous || !next) return true
    if (options.preserveIndexes?.has(index) && !isTinyReversal(previous, point, next)) return true
    const sameVertical = Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5
    const sameHorizontal = Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5
    return !sameVertical && !sameHorizontal
  })
}

export function isTinyReversal(previous, point, next) {
  const sameHorizontal = Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5
  const sameVertical = Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5
  if (sameHorizontal) {
    const turnsBack = Math.sign(point.x - previous.x) !== Math.sign(next.x - point.x)
    return turnsBack && Math.min(Math.abs(point.x - previous.x), Math.abs(next.x - point.x)) <= WIRE_EXIT_STUB
  }
  if (sameVertical) {
    const turnsBack = Math.sign(point.y - previous.y) !== Math.sign(next.y - point.y)
    return turnsBack && Math.min(Math.abs(point.y - previous.y), Math.abs(next.y - point.y)) <= WIRE_EXIT_STUB
  }
  return false
}

export function routeOrthogonal(start, end, obstacles, bounds = null, usedWireSegments = []) {
  const directHitsComponent = obstacles.some(rect => segmentIntersectsRect(start, end, rect))
  const directIsOrthogonal = isHorizontalSegment(start, end) || isVerticalSegment(start, end)
  if (directIsOrthogonal && !directHitsComponent && wireLanePenalty(start, end, usedWireSegments) === 0) return [start, end]

  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const xs = new Set([roundCoord(start.x), roundCoord(end.x), minX, maxX])
  const ys = new Set([roundCoord(start.y), roundCoord(end.y), minY, maxY])
  ;[start, end].forEach(point => {
    xs.add(roundCoord(clamp(point.x - WIRE_LANE_GAP, minX, maxX)))
    xs.add(roundCoord(clamp(point.x + WIRE_LANE_GAP, minX, maxX)))
    ys.add(roundCoord(clamp(point.y - WIRE_LANE_GAP, minY, maxY)))
    ys.add(roundCoord(clamp(point.y + WIRE_LANE_GAP, minY, maxY)))
  })

  obstacles.forEach(rect => {
    xs.add(roundCoord(clamp(rect.left - WIRE_CLEARANCE, minX, maxX)))
    xs.add(roundCoord(clamp(rect.right + WIRE_CLEARANCE, minX, maxX)))
    ys.add(roundCoord(clamp(rect.top - WIRE_CLEARANCE, minY, maxY)))
    ys.add(roundCoord(clamp(rect.bottom + WIRE_CLEARANCE, minY, maxY)))
  })
  usedWireSegments.forEach(segment => {
    xs.add(roundCoord(clamp(segment.a.x, minX, maxX)))
    xs.add(roundCoord(clamp(segment.b.x, minX, maxX)))
    ys.add(roundCoord(clamp(segment.a.y, minY, maxY)))
    ys.add(roundCoord(clamp(segment.b.y, minY, maxY)))
    if (isHorizontalSegment(segment.a, segment.b)) {
      ys.add(roundCoord(clamp(segment.a.y - WIRE_LANE_GAP, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y + WIRE_LANE_GAP, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y - WIRE_LANE_GAP * 2, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y + WIRE_LANE_GAP * 2, minY, maxY)))
    } else if (isVerticalSegment(segment.a, segment.b)) {
      xs.add(roundCoord(clamp(segment.a.x - WIRE_LANE_GAP, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x + WIRE_LANE_GAP, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x - WIRE_LANE_GAP * 2, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x + WIRE_LANE_GAP * 2, minX, maxX)))
    }
  })

  const xValues = [...xs].sort((a, b) => a - b)
  const yValues = [...ys].sort((a, b) => a - b)
  const nodes = []
  yValues.forEach(y => {
    xValues.forEach(x => {
      const point = { x, y }
      if (!obstacles.some(rect => pointInsideRect(point, rect))) nodes.push(point)
    })
  })

  const keyFor = point => `${point.x},${point.y}`
  const nodeMap = new Map(nodes.map(point => [keyFor(point), point]))
  const startKey = keyFor({ x: roundCoord(start.x), y: roundCoord(start.y) })
  const endKey = keyFor({ x: roundCoord(end.x), y: roundCoord(end.y) })
  if (!nodeMap.has(startKey)) nodeMap.set(startKey, { x: roundCoord(start.x), y: roundCoord(start.y) })
  if (!nodeMap.has(endKey)) nodeMap.set(endKey, { x: roundCoord(end.x), y: roundCoord(end.y) })

  const graph = new Map()
  const byY = new Map()
  const byX = new Map()
  nodeMap.forEach(point => {
    if (!byY.has(point.y)) byY.set(point.y, [])
    if (!byX.has(point.x)) byX.set(point.x, [])
    byY.get(point.y).push(point)
    byX.get(point.x).push(point)
  })
  byY.forEach(row => connectVisibleNeighbours(row.sort((a, b) => a.x - b.x), graph, obstacles, keyFor, usedWireSegments))
  byX.forEach(col => connectVisibleNeighbours(col.sort((a, b) => a.y - b.y), graph, obstacles, keyFor, usedWireSegments))

  const simple = simpleOrthogonalRoutes(start, end)
    .filter(points => !pathHitsObstacles(points, obstacles))
    .map(points => ({ points, score: scoreWireRoute(points, usedWireSegments) }))
    .sort((a, b) => a.score - b.score)[0]
  if (simple && simple.score < WIRE_OVERLAP_PENALTY) return simple.points

  const path = shortestPath(graph, startKey, endKey)
  if (!path.length) return fallbackOrthogonalRoute(start, end, obstacles, bounds, usedWireSegments)
  return path.map(key => {
    const [x, y] = key.split(',').map(Number)
    return { x, y }
  })
}

export function simpleOrthogonalRoutes(start, end) {
  if (isHorizontalSegment(start, end) || isVerticalSegment(start, end)) return [[start, end]]
  return [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1]) }))
}

export function fallbackOrthogonalRoute(start, end, obstacles, bounds = null, usedWireSegments = []) {
  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const relevant = obstacles.filter(rect => {
    const minSpanX = Math.min(start.x, end.x)
    const maxSpanX = Math.max(start.x, end.x)
    const minSpanY = Math.min(start.y, end.y)
    const maxSpanY = Math.max(start.y, end.y)
    return rect.right >= minSpanX && rect.left <= maxSpanX && rect.bottom >= minSpanY && rect.top <= maxSpanY
  })
  const topLane = clamp(Math.min(start.y, end.y, ...relevant.map(rect => rect.top)) - WIRE_CLEARANCE * 1.5, minY, maxY)
  const bottomLane = clamp(Math.max(start.y, end.y, ...relevant.map(rect => rect.bottom)) + WIRE_CLEARANCE * 1.5, minY, maxY)
  const leftLane = clamp(Math.min(start.x, end.x, ...relevant.map(rect => rect.left)) - WIRE_CLEARANCE * 1.5, minX, maxX)
  const rightLane = clamp(Math.max(start.x, end.x, ...relevant.map(rect => rect.right)) + WIRE_CLEARANCE * 1.5, minX, maxX)
  const candidates = [
    ...simpleOrthogonalRoutes(start, end),
    [start, { x: start.x, y: topLane }, { x: end.x, y: topLane }, end],
    [start, { x: start.x, y: bottomLane }, { x: end.x, y: bottomLane }, end],
    [start, { x: leftLane, y: start.y }, { x: leftLane, y: end.y }, end],
    [start, { x: rightLane, y: start.y }, { x: rightLane, y: end.y }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1, points.length - 2]) }))
    .map(points => ({
      points,
      obstacleHits: countPathObstacleHits(points, obstacles),
      score: scoreWireRoute(points, usedWireSegments),
    }))
    .sort((a, b) => a.obstacleHits - b.obstacleHits || a.score - b.score)
  return candidates[0]?.points ?? simpleOrthogonalRoutes(start, end)[0]
}

export function connectVisibleNeighbours(points, graph, obstacles, keyFor, usedWireSegments) {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (obstacles.some(rect => segmentIntersectsRect(a, b, rect))) continue
    const aKey = keyFor(a)
    const bKey = keyFor(b)
    const cost = Math.hypot(b.x - a.x, b.y - a.y) + wireLanePenalty(a, b, usedWireSegments)
    if (!graph.has(aKey)) graph.set(aKey, [])
    if (!graph.has(bKey)) graph.set(bKey, [])
    graph.get(aKey).push({ key: bKey, cost })
    graph.get(bKey).push({ key: aKey, cost })
  }
}

export function segmentsFromPoints(points) {
  const segments = []
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue
    segments.push({ a, b })
  }
  return segments
}

export function pathHitsObstacles(points, obstacles) {
  return countPathObstacleHits(points, obstacles) > 0
}

export function countPathObstacleHits(points, obstacles) {
  return segmentsFromPoints(points).reduce((count, segment) => (
    count + obstacles.filter(rect => segmentIntersectsRect(segment.a, segment.b, rect)).length
  ), 0)
}

export function scoreWireRoute(points, usedWireSegments = []) {
  return segmentsFromPoints(points).reduce((score, segment) => {
    return score + Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) + wireLanePenalty(segment.a, segment.b, usedWireSegments)
  }, points.length * 8 + countBends(points) * WIRE_BEND_PENALTY)
}

export function countBends(points) {
  let bends = 0
  for (let index = 2; index < points.length; index += 1) {
    const a = points[index - 2]
    const b = points[index - 1]
    const c = points[index]
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1 || Math.hypot(c.x - b.x, c.y - b.y) < 1) continue
    const firstHorizontal = isHorizontalSegment(a, b)
    const secondHorizontal = isHorizontalSegment(b, c)
    if (firstHorizontal !== secondHorizontal) bends += 1
  }
  return bends
}

export function wireLanePenalty(a, b, usedWireSegments = []) {
  if (!usedWireSegments.length) return 0
  return usedWireSegments.reduce((penalty, segment) => {
    if (segmentsOverlap(a, b, segment.a, segment.b)) return penalty + WIRE_OVERLAP_PENALTY
    if (segmentsCross(a, b, segment.a, segment.b)) return penalty + WIRE_CROSSING_PENALTY
    return penalty
  }, 0)
}

export function segmentsOverlap(a, b, c, d) {
  if (isHorizontalSegment(a, b) && isHorizontalSegment(c, d) && Math.abs(a.y - c.y) < 0.5) {
    return rangesOverlap(a.x, b.x, c.x, d.x)
  }
  if (isVerticalSegment(a, b) && isVerticalSegment(c, d) && Math.abs(a.x - c.x) < 0.5) {
    return rangesOverlap(a.y, b.y, c.y, d.y)
  }
  return false
}

export function segmentsCross(a, b, c, d) {
  if (isHorizontalSegment(a, b) && isVerticalSegment(c, d)) {
    return between(c.x, a.x, b.x) && between(a.y, c.y, d.y)
  }
  if (isVerticalSegment(a, b) && isHorizontalSegment(c, d)) {
    return between(a.x, c.x, d.x) && between(c.y, a.y, b.y)
  }
  return false
}

export function isHorizontalSegment(a, b) {
  return Math.abs(a.y - b.y) < 0.5
}

export function isVerticalSegment(a, b) {
  return Math.abs(a.x - b.x) < 0.5
}

export function rangesOverlap(a1, a2, b1, b2) {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.max(minA, minB) < Math.min(maxA, maxB)
}

export function between(value, a, b) {
  return value > Math.min(a, b) && value < Math.max(a, b)
}

export function shortestPath(graph, startKey, endKey) {
  const distances = new Map([[startKey, 0]])
  const previous = new Map()
  const queue = [startKey]

  while (queue.length) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))
    const current = queue.shift()
    if (current === endKey) break
    graph.get(current)?.forEach(edge => {
      const nextDistance = (distances.get(current) ?? Infinity) + edge.cost
      if (nextDistance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, nextDistance)
        previous.set(edge.key, current)
        if (!queue.includes(edge.key)) queue.push(edge.key)
      }
    })
  }

  if (!distances.has(endKey)) return []
  const path = []
  let current = endKey
  while (current) {
    path.unshift(current)
    if (current === startKey) break
    current = previous.get(current)
  }
  return path[0] === startKey ? path : []
}

export function segmentIntersectsRect(a, b, rect) {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) return false
  if (Math.abs(a.x - b.x) < 0.5) return a.x >= rect.left && a.x <= rect.right
  if (Math.abs(a.y - b.y) < 0.5) return a.y >= rect.top && a.y <= rect.bottom
  return true
}

export function pointInsideRect(point, rect) {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom
}

export function roundCoord(value) {
  return Math.round(value)
}
