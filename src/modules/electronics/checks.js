import { ELECTRONICS_CHECK_TYPES, evaluateElectronicsCheck } from './circuit.js'

// Check-type registry definitions (see ../checkRegistry.js) for the electronics
// circuit_* checks. The evaluators live in circuit.js next to the simulator; a
// generic `code` check in an electronics context is routed to the same evaluator by
// the core `code` definition in ../checks.js.
export const CHECKS = ELECTRONICS_CHECK_TYPES.map((type) => ({
  type,
  owner: 'module:electronics',
  timing: 'on_change',
  requiresRun: false,
  submitAllowed: false,
  contextKey: 'circuit',
  evaluate: (check, _output, context = {}) =>
    evaluateElectronicsCheck(check, context.circuit ?? context.code),
}))
