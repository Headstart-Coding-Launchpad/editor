import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// After a new deploy, a tab left open (or one loading from a stale cache) can
// still hold references to lazy-loaded chunk filenames that no longer exist,
// causing dynamic import() to 404 and the app to crash to a blank screen.
// Vite fires this event when that happens; reload once to pick up the
// current build. The sessionStorage guard stops a reload loop if the fetch
// keeps failing for an unrelated reason (e.g. no network).
const RELOAD_GUARD_KEY = 'vite-preload-reload-attempted'

window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
  window.location.reload()
})

window.addEventListener('load', () => {
  sessionStorage.removeItem(RELOAD_GUARD_KEY)
})

createRoot(document.getElementById('root')).render(<App />)
