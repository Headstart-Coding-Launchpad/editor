// Which computer the student is on, and what the keys being taught are called there. Families
// bring their own Macs and Chromebooks, whose keyboards name (or lack) some keys:
//
//   Taught as   Mac                  Chromebook
//   Backspace   delete               Backspace
//   Delete      fn + delete          Alt + Backspace
//   Caps Lock   caps lock            Alt + Search
//   Home / End  fn + ← / fn + →      Search + ← / Search + →  (also Cmd + ← / → on a Mac)
//   Enter       return               Enter
//   Ctrl (in shortcuts)  Cmd         Ctrl
//
// The browser already reports those presses as the Windows key (fn + delete arrives as
// `Delete`, ChromeOS rewrites Alt + Backspace to `Delete`), so checks match `event.key` and only
// the names shown to students change. Pure: pass the navigator fields in.

export const PLATFORMS = ['windows', 'mac', 'chromeos', 'other']

export const PLATFORM_LABELS = {
  windows: 'Windows',
  mac: 'Mac',
  chromeos: 'Chromebook',
  other: 'Other',
}

export function detectPlatform({ userAgentData, userAgent = '', maxTouchPoints = 0 } = {}) {
  const hinted = String(userAgentData?.platform ?? '').toLowerCase()
  const ua = String(userAgent).toLowerCase()
  if (hinted === 'chrome os' || hinted === 'chromeos' || ua.includes('cros')) return 'chromeos'
  if (hinted === 'macos' || ua.includes('macintosh') || ua.includes('mac os x')) {
    // iPadOS asks for desktop sites with a Mac user agent; it has touch points, Macs don't.
    return maxTouchPoints > 1 ? 'other' : 'mac'
  }
  if (hinted === 'windows' || ua.includes('windows')) return 'windows'
  return 'other'
}

const KEY_NAMES = {
  mac: {
    Backspace: 'delete',
    Delete: 'fn + delete',
    CapsLock: 'caps lock',
    Home: 'fn + ←',
    End: 'fn + →',
    Enter: 'return',
  },
  chromeos: {
    Delete: 'Alt + Backspace',
    CapsLock: 'Alt + Search',
    Home: 'Search + ←',
    End: 'Search + →',
  },
}

// A named key as it is labelled on the student's keyboard ('Backspace' → 'delete' on a Mac).
export function keyName(key, platform) {
  return KEY_NAMES[platform]?.[key] ?? key
}

// The name of the Ctrl-or-Cmd modifier in shortcuts.
export function modKeyName(platform) {
  return platform === 'mac' ? 'Cmd' : 'Ctrl'
}
