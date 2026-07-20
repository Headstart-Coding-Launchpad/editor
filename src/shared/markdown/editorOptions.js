import { SCRATCH_MARKDOWN_BLOCK_CATEGORIES } from '../scratchBlockCatalog'

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

export function getCodeBlockOptions(lessonType) {
  if (lessonType === 'python') return [{ label: 'Python', action: 'code-block:python' }]
  if (lessonType === 'html') {
    return [
      { label: 'HTML', action: 'code-block:html' },
      { label: 'CSS', action: 'code-block:css' },
      { label: 'JavaScript', action: 'code-block:javascript' },
    ]
  }
  if (lessonType === 'scratch') {
    return [
      { label: 'Scratch', action: 'code-block:scratch' },
      { label: 'HTML', action: 'code-block:html' },
      { label: 'CSS', action: 'code-block:css' },
      { label: 'JavaScript', action: 'code-block:javascript' },
    ]
  }
  return [{ label: 'Code block', action: 'code-block:' }]
}

export function getInlineCodeOptions(lessonType, inlineCodeLanguages) {
  const labels = {
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    javascript: 'JS',
    scratch: 'Scratch',
  }
  const fallback =
    lessonType === 'python'
      ? ['python']
      : lessonType === 'html'
      ? ['html', 'javascript', 'css']
      : lessonType === 'scratch'
      ? ['scratch']
      : []

  const languages = Array.isArray(inlineCodeLanguages) && inlineCodeLanguages.length
    ? inlineCodeLanguages
    : fallback

  const seen = new Set()
  return languages
    .map(lang => lang === 'js' ? 'javascript' : lang)
    .filter(lang => {
      if (!labels[lang] || seen.has(lang)) return false
      seen.add(lang)
      return true
    })
    .map(lang => ({ label: labels[lang], action: `inline-code:${lang}` }))
}
