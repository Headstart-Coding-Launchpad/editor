// The eight modules that existed when the value pins in the module tests were written (registry
// order). A module added later with `npm run new:module` is covered by the registry-driven tests
// (moduleInterface, moduleTypeParity, the StudentViewModules click-through, the contract checks
// in defineModule) and by its own folder's tests; the pins keep describing the built-ins' exact
// values, so scaffolding a module never has to edit them.
export const BUILT_IN_MODULE_TYPES = Object.freeze([
  'python',
  'arcade',
  'turtle',
  'scratch',
  'html',
  'filesystem',
  'desktop',
  'electronics',
])

export function isBuiltInModule(type) {
  return BUILT_IN_MODULE_TYPES.includes(type)
}

/** The built-in types among `types`, in their given order. */
export function builtInOnly(types) {
  return types.filter(isBuiltInModule)
}
