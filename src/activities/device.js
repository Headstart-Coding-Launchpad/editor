// What device an activity attempt ran on, read back from the activity's own state so the
// teacher sees it without any extra Firebase field. Activities record `state.device`
// ({ touch, virtualKeyboard, platform }) and per-item `source: 'virtual'` when the on-screen
// keyboard was used. Pure.

export function describeActivityDevice(state) {
  if (!state || typeof state !== 'object') return null
  const items = Object.values(state.items ?? {})
  const virtualKeyboard =
    !!state.device?.virtualKeyboard || items.some((item) => item?.source === 'virtual')
  if (virtualKeyboard) {
    return { id: 'virtual_keyboard', icon: '⌨️', label: 'On-screen keyboard' }
  }
  if (state.device?.touch) return { id: 'touch', icon: '📱', label: 'Touch screen' }
  // Macs and Chromebooks name (or lack) some taught keys; Windows is the reference layout.
  if (state.device?.platform === 'mac') return { id: 'mac', icon: '💻', label: 'Mac' }
  if (state.device?.platform === 'chromeos') {
    return { id: 'chromeos', icon: '💻', label: 'Chromebook' }
  }
  return null
}

// A device the activity's `requires` can't be met on, with the fallback the host applies.
// capabilities come from detectInputCapabilities; `keyboardOverride` is the student's
// "I have a keyboard" answer. A touch-only device with no keyboard evidence is treated as
// having no physical keyboard (tablets), since the browser can't detect one up front.
export function effectiveCapabilities(capabilities = {}, { keyboardOverride = false } = {}) {
  let physicalKeyboard = capabilities.physicalKeyboard ?? null
  if (keyboardOverride) physicalKeyboard = true
  else if (physicalKeyboard == null && capabilities.touch && !capabilities.finePointer) {
    physicalKeyboard = false
  }
  return { ...capabilities, physicalKeyboard }
}
