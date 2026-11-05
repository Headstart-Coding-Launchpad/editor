import { PLAYGROUND_LESSON_TYPES } from '../shared/composedLesson'

// The Python playground's "Pick a kit" chooser (sketch: HSC Hub Research, "LaunchPad playground
// kit chooser sketch 2026-11-05"; Ryan OK 2026-11-05). Each kit is a starter that does something
// on the first Run. The chooser is a front door: some kits route to another playground.
// A kit with `playgroundType` is its own playground (own workspace and runtime) at
// /playground/<playgroundType>; the rest are starters inside the chooser's own playground.

// The playground type that opens on the kit chooser.
const CHOOSER_PLAYGROUND_TYPE = 'python'

const PICTURE_LAB_STARTER = `from stage import *

fox = load_image("pixel_fox")
recolour(fox, "orange", "purple")
grid(fox, width=32)
`

const BEATS_STARTER = `from beats import *

kick  = "x...x...x...x..."
snare = "....x.......x..."
hat   = "x.x.x.x.x.x.x.x."
play(kick, snare, hat, tempo=100)
`

const CHARTS_STARTER = `import matplotlib.pyplot as plt

planets = {"Mercury": 4879, "Venus": 12104, "Earth": 12742, "Mars": 6779}

names = []
sizes = []
for name, size in planets.items():
    names.append(name)
    sizes.append(size)

plt.bar(names, sizes, color="orange")
plt.title("How wide are the planets?")
plt.show()
`

// The four kits on the chooser's first screen (at most 5 controls with More kits).
export const MAIN_KITS = Object.freeze([
  {
    id: 'turtle',
    label: 'Turtle',
    icon: '🐢',
    blurb: 'Draw with code',
    playgroundType: 'turtle',
  },
  {
    id: 'game',
    label: 'Game',
    icon: '🕹️',
    blurb: 'Move a sprite with the arrow keys',
    playgroundType: 'arcade',
  },
  {
    id: 'picture',
    label: 'Picture Lab',
    icon: '🦊',
    blurb: 'Change the colours in a picture',
    starterCode: PICTURE_LAB_STARTER,
  },
  {
    id: 'beats',
    label: 'Beats',
    icon: '🥁',
    blurb: 'Make a drum beat',
    starterCode: BEATS_STARTER,
  },
])

// Behind "More kits".
export const MORE_KITS = Object.freeze([
  {
    id: 'charts',
    label: 'Charts',
    icon: '📊',
    blurb: 'Draw a bar chart',
    starterCode: CHARTS_STARTER,
  },
  { id: 'blank', label: 'Blank page', icon: '📄', blurb: 'Start from nothing', starterCode: '' },
])

const ALL_KITS = [...MAIN_KITS, ...MORE_KITS]

export function getKit(id) {
  return ALL_KITS.find((kit) => kit.id === id) ?? null
}

// A kit that opens in the chooser's own (Python) playground, or null.
export function getPythonKit(id) {
  const kit = getKit(id)
  return kit && !kit.playgroundType ? kit : null
}

// Where a kit card goes.
export function kitPath(kit) {
  return kit.playgroundType
    ? `/playground/${kit.playgroundType}`
    : `${CHOOSER_PATH}?kit=${encodeURIComponent(kit.id)}`
}

export const CHOOSER_PATH = `/playground/${CHOOSER_PLAYGROUND_TYPE}`

// Playground types a student reaches as a kit card in the chooser (Turtle, Arcade), so the Landing
// picker doesn't list them again.
export const KIT_PLAYGROUND_TYPES = Object.freeze(
  MAIN_KITS.map((kit) => kit.playgroundType).filter(Boolean)
)

// Does this playground open on the kit chooser (when no kit is picked yet)?
export function hasKitChooser(type) {
  return type === CHOOSER_PLAYGROUND_TYPE
}

// Does this playground's top bar offer Switch kit (back to the chooser)?
export function canSwitchKit(type) {
  return hasKitChooser(type) || KIT_PLAYGROUND_TYPES.includes(type)
}

// The playground lesson id for a Python kit. Each kit keeps its own code because the lesson id is
// the first part of the existing task localStorage key (headstart_{lessonId}_{taskId}_{id}).
// Blank page keeps the original `__playground__python`, so code saved there before kits existed
// still opens.
export function pythonKitLessonId(kitId) {
  const base = `__playground__${CHOOSER_PLAYGROUND_TYPE}`
  return kitId === 'blank' ? base : `${base}:${kitId}`
}

// The Landing page's "Open playgrounds" list: every playground-capable module (meta.playground)
// except those inside the chooser. Python, Scratch, Electronics today (module order).
export const LANDING_PLAYGROUND_TYPES = Object.freeze(
  PLAYGROUND_LESSON_TYPES.filter((type) => !KIT_PLAYGROUND_TYPES.includes(type))
)

// The kit a student opened last on this device, for the chooser's "Carry on" mark. A new
// localStorage key (no existing key changes); best-effort, like the other device settings.
export const LAST_KIT_STORAGE_KEY = 'headstart_playground_last_kit'

export function loadLastKitId() {
  try {
    const id = localStorage.getItem(LAST_KIT_STORAGE_KEY)
    return getKit(id) ? id : null
  } catch {
    return null
  }
}

export function saveLastKitId(id) {
  try {
    if (getKit(id)) localStorage.setItem(LAST_KIT_STORAGE_KEY, id)
  } catch {
    // Storage full or blocked: the chooser just shows no Carry on mark.
  }
}

// The kit a playground is showing: the Python kit, or the kit card that routes to this type
// (Turtle, Game); null for playgrounds that are not kits (Electronics, Scratch).
export function kitIdForPlayground(type, pythonKit = null) {
  if (pythonKit) return pythonKit.id
  return MAIN_KITS.find((kit) => kit.playgroundType === type)?.id ?? null
}
