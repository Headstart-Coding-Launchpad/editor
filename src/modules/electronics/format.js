// Display formatting for electrical quantities, shared by the inspector's readouts and
// the part drawings. Extracted from ElectronicsWorkspace.jsx unchanged.
export function formatResistance(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  if (numeric >= 1000) return `${numeric / 1000}k ohm`
  return `${numeric} ohm`
}

export function formatVoltage(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0V'
  return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2).replace(/\.?0+$/, '')}V`
}

export function formatCurrent(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0mA'
  return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2).replace(/\.?0+$/, '')}mA`
}
