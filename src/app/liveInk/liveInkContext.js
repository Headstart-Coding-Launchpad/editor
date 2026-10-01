import { createContext, useContext } from 'react'
import { EMPTY_LIVE_INK } from './liveInkData'

// See LiveInkProvider for why there are two. Config is null outside a live lesson or the
// Presentation window, which leaves every InkSurface inert.
export const LiveInkConfigContext = createContext(null)
export const LiveInkDataContext = createContext(EMPTY_LIVE_INK)

export function useLiveInkConfig() {
  return useContext(LiveInkConfigContext)
}

export function useLiveInkData() {
  return useContext(LiveInkDataContext)
}
