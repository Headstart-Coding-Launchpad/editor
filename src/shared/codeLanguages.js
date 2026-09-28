// Display names for code-fence / editor languages (CopyCodePanel, the explainer editor's
// code-block menu). Module-level labels live on each module definition's `meta` instead.
export const CODE_LANGUAGE_LABELS = Object.freeze({
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  scratch: 'Scratch',
})

export function getCodeLanguageLabel(language) {
  return CODE_LANGUAGE_LABELS[language] ?? 'Code'
}
