// Board grid metrics and the geometry that places parts and their pins on it: part
// sizes, pin offsets, rotation and the rectangles the wire router treats as obstacles.
// Extracted from ElectronicsWorkspace.jsx unchanged.
import { normalizeMicrocontrollerPins } from './circuit'

// The breadboard's hole pitch, and the footprint of a part sitting on it.
export const GRID_X = 28
export const GRID_Y = 24
export const BOARD_PAD = 24
export const PART_W = 112
export const PART_H = 70
const LCD_PART_W = 196
const LCD_PART_H = 118

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function componentDimensions(component) {
  return component?.type === 'lcd1602'
    ? { width: LCD_PART_W, height: LCD_PART_H }
    : { width: PART_W, height: PART_H }
}

export function pinOffset(component, pin, pinIndex) {
  return rotateOffset(basePinOffset(component, pin, pinIndex), component.rotation, component)
}

export function componentAnchorOffset(component) {
  const firstPin = component.pins?.[0] ?? 'a'
  return pinOffset(component, firstPin, 0)
}

function basePinOffset(component, pin, pinIndex) {
  if (component.type === 'microcontroller') {
    const pins = normalizeMicrocontrollerPins(component.pins)
    const leftCount = Math.ceil(pins.length / 2)
    if (pinIndex < leftCount) {
      const y = 12 + pinIndex * ((PART_H - 24) / Math.max(1, leftCount - 1))
      return { x: 4, y }
    }
    const rightIndex = pinIndex - leftCount
    const rightCount = pins.length - leftCount
    const y = 12 + rightIndex * ((PART_H - 24) / Math.max(1, rightCount - 1))
    return { x: PART_W - 4, y }
  }
  if (component.type === 'potentiometer') {
    const xs = [28, PART_W / 2, PART_W - 28]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (
    component.type === 'transistor' ||
    component.type === 'sensor' ||
    component.type === 'servo_motor'
  ) {
    const xs = [28, PART_W / 2, PART_W - 28]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (component.type === 'lcd1602') {
    const { width, height } = componentDimensions(component)
    const xs = [
      Math.round(width * 0.14),
      Math.round(width * 0.39),
      Math.round(width * 0.61),
      Math.round(width * 0.86),
    ]
    return { x: xs[pinIndex] ?? width / 2, y: height - 6 }
  }
  if (component.type === 'rgb_led') {
    const xs = [14, 42, 70, 98]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (component.type === 'terminal') return { x: PART_W / 2, y: PART_H - 4 }
  if (component.type === 'battery') {
    if (pin === 'positive') return { x: PART_W, y: PART_H / 2 }
    if (pin === 'negative') return { x: 0, y: PART_H / 2 }
  }
  if (pin === 'positive' || pin === 'anode' || pin === 'a' || pin === 'left')
    return { x: 0, y: PART_H / 2 }
  if (pin === 'negative' || pin === 'cathode' || pin === 'b' || pin === 'right')
    return { x: PART_W, y: PART_H / 2 }
  return { x: pinIndex % 2 === 0 ? 0 : PART_W, y: PART_H / 2 }
}

export function normalizeRotation(rotation = 0) {
  const numeric = Number(rotation)
  if (!Number.isFinite(numeric)) return 0
  return (((Math.round(numeric / 90) * 90) % 360) + 360) % 360
}

export function rotatedComponentRect(point, component) {
  const { width, height } = componentDimensions(component)
  const normalized = normalizeRotation(component.rotation)
  if (normalized === 90 || normalized === 270) {
    const centerX = point.x + width / 2
    const centerY = point.y + height / 2
    return {
      left: centerX - height / 2,
      top: centerY - width / 2,
      right: centerX + height / 2,
      bottom: centerY + width / 2,
    }
  }
  return {
    left: point.x,
    top: point.y,
    right: point.x + width,
    bottom: point.y + height,
  }
}

function rotateOffset(offset, rotation = 0, component = null) {
  const { width, height } = componentDimensions(component)
  const normalized = normalizeRotation(rotation)
  if (normalized === 0) return offset
  const centerX = width / 2
  const centerY = height / 2
  const x = offset.x - centerX
  const y = offset.y - centerY
  if (normalized === 90) return { x: centerX - y, y: centerY + x }
  if (normalized === 180) return { x: centerX - x, y: centerY - y }
  if (normalized === 270) return { x: centerX + y, y: centerY - x }
  return offset
}

export function pinHandleStyle(pin) {
  const normalizedPin = String(pin).toLowerCase()
  if (
    pin === 'positive' ||
    pin === 'anode' ||
    pin === 'red' ||
    normalizedPin === '3v3' ||
    normalizedPin === 'vcc'
  )
    return { background: '#ef4444', borderColor: '#fecaca' }
  if (pin === 'green') return { background: '#16a34a', borderColor: '#bbf7d0' }
  if (pin === 'negative' || pin === 'cathode' || pin === 'emitter' || normalizedPin === 'gnd')
    return { background: '#111827', borderColor: '#94a3b8' }
  if (
    pin === 'blue' ||
    pin === 'signal' ||
    pin === 'base' ||
    normalizedPin === 'sda' ||
    normalizedPin === 'scl' ||
    normalizedPin.startsWith('gp')
  )
    return { background: '#2563eb', borderColor: '#bfdbfe' }
  return { background: '#f59e0b', borderColor: '#fde68a' }
}
