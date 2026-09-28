import { SCRATCH_MARKDOWN_BLOCK_CATEGORIES } from '../scratchBlockCatalog'
import { getModuleDefinition } from '../../modules/definitions'
import { CODE_LANGUAGE_LABELS } from '../codeLanguages'

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

export const SCRATCH_BLOCK_CATEGORIES = SCRATCH_MARKDOWN_BLOCK_CATEGORIES

export function isInsideScratchCodeBlock(text) {
  let inScratch = false
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!inScratch && t === '```scratch') inScratch = true
    else if (inScratch && t === '```') inScratch = false
  }
  return inScratch
}

// Code-block menu for an explainer, from the module definition's
// `explainerCodeBlockLanguages`; a generic block when the module declares none.
export function getCodeBlockOptions(lessonType) {
  const languages = getModuleDefinition(lessonType)?.explainerCodeBlockLanguages ?? []
  if (languages.length === 0) return [{ label: 'Code block', action: 'code-block:' }]
  return languages.map((lang) => ({
    label: CODE_LANGUAGE_LABELS[lang] ?? lang,
    action: `code-block:${lang}`,
  }))
}

export function getInlineCodeOptions(lessonType, inlineCodeLanguages) {
  const labels = { ...CODE_LANGUAGE_LABELS, javascript: 'JS' }
  const fallback = getModuleDefinition(lessonType)?.explainerInlineCodeLanguages ?? []

  const languages =
    Array.isArray(inlineCodeLanguages) && inlineCodeLanguages.length
      ? inlineCodeLanguages
      : fallback

  const seen = new Set()
  return languages
    .map((lang) => (lang === 'js' ? 'javascript' : lang))
    .filter((lang) => {
      if (!labels[lang] || seen.has(lang)) return false
      seen.add(lang)
      return true
    })
    .map((lang) => ({ label: labels[lang], action: `inline-code:${lang}` }))
}
