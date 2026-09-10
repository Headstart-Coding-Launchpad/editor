import { useState } from 'react'

// Whether the device has touch input at all. Deliberately not a viewport-width
// check like useIsMobile — a touch device can still have a wide viewport (an
// iPad Pro in landscape, a touchscreen laptop), and this needs to catch those
// too since it's used to decide whether on-screen-keyboard affordances (e.g.
// the Python symbol quick-insert row) are worth showing.
export function useIsTouchDevice() {
  const [touch] = useState(
    () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (window.navigator?.maxTouchPoints ?? 0) > 0)
  )
  return touch
}
