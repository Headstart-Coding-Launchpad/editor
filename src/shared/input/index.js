// Shared input recorder: normalised key/pointer events, UK layout table, gesture recognition and
// summaries used by Keyboard and Mouse activities and the Desktop's input_* checks (the check
// definitions live in ./checks.js, registered by src/modules/checks.js).
// See docs/architecture/modular-activities-plan.md (Phase 3). Pure: Node-safe.

export * from './layouts.js'
export * from './events.js'
export * from './gestures.js'
export * from './summary.js'
export * from './recorder.js'
export * from './capabilities.js'
export * from './targetSummary.js'
