// Shared builders for the modules' `authoring` hooks (see ./defineModule.js). Node-safe.

// Code-string modules (python, turtle, arcade): a new task starts from the previous task's
// complete (else starter) code and carries its code.
export function codeDefaultTypeFields(prevTask) {
  return {
    starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
    carryCodeFrom: prevTask?.id ?? null,
  }
}

// "Reset to starter code" for a module with a separate `completeCode`.
export function codeCopyStarterToComplete(task) {
  return { completeCode: task.starterCode ?? '' }
}

// Modules whose draft tasks always have a usable workspace, or that have nothing to copy.
export function never() {
  return false
}

export function noUpdates() {
  return {}
}

export const PYTHON_COPY_CODE_PLACEHOLDER = 'Code students can copy...'
export const MARKUP_COPY_CODE_PLACEHOLDER = '<!-- Code students can copy... -->'
