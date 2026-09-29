// Template Module check types (owner 'module:template_module'), registered in the shared check
// registry by src/modules/checks.js. Node-safe.
//
// The scaffold evaluates only the core code checks (`code`, `code_contains`, … against
// `checking.buildContext(work)` → `{ code }`), so it registers none of its own. A module check
// type is one definition here (see src/modules/checkRegistry.js and the turtle / filesystem
// modules for real ones):
//
//   {
//     type: 'template_module_word_count',
//     owner: 'module:template_module',
//     subject: 'work',
//     operators: ['at_least'],
//     timing: 'on_run',
//     requiresRun: true,
//     submitAllowed: false,
//     evaluate: (check, _output, ctx) => countWords(ctx.code) >= Number(check.value),
//   }
//
// TODO(new-module): add the module's own check types, their Builder fields in CheckEditor.jsx,
// their validation in definition.js's validateTask, and their documentation in
// docs/authoring/template_module.md. A new type must never reuse an existing id (the registry
// throws on duplicates).
export const CHECKS = []
