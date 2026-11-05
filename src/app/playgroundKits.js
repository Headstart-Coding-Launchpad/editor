import { PLAYGROUND_LESSON_TYPES } from '../shared/composedLesson'

// Playground types a student reaches as a kit card in the Python playground's chooser (each has its
// own /playground/:type route and workspace), so the Landing picker doesn't list them again.
export const PYTHON_KIT_PLAYGROUND_TYPES = Object.freeze(['turtle', 'arcade'])

// The Landing page's "Open playgrounds" list: every playground-capable module (meta.playground)
// except those inside the Python chooser. Python, Scratch, Electronics today (module order).
export const LANDING_PLAYGROUND_TYPES = Object.freeze(
  PLAYGROUND_LESSON_TYPES.filter((type) => !PYTHON_KIT_PLAYGROUND_TYPES.includes(type))
)
