// Emoji in a student's code, for the 🤩 Emoji Artist badge signal (`studentSignals.emojiRun`,
// src/badges/signals.js). Pure, import-free and Node-safe. Only what the program shows counts:
// - Python: the contents of string literals (any quotes, prefixes and triple quotes). `#`
//   comments never count.
// - HTML: text and attribute values. `<!-- -->` comments never count, nor CSS `/* */` and JS
//   `//` / `/* */` comments inside <style> and <script> (or in a .css / .js file of the project).
// Typed, pasted or picked from the emoji picker all look the same here.
// Emoji the task already gave the student (its code stages, copyCode, a tutor's sandbox code)
// don't count (Ryan, 2026-10-16): only ones the student added (codeHasNewEmoji).

// Extended_Pictographic is the emoji set without the plain characters the Emoji property also
// covers (digits, #, *). Flags are pairs of regional indicators, and a keycap (1️⃣) is a digit
// plus U+20E3, so both are added.
const EMOJI_PATTERN = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|⃣/gu

// Typographic symbols that are Extended_Pictographic but read as text in code: © ® ™.
const NOT_EMOJI = new Set(['©', '®', '™'])

/** Whether `text` contains an emoji (see EMOJI_PATTERN; © ® ™ don't count). */
export function containsEmoji(text) {
  return emojiCountsIn(text).size > 0
}

/** How many of each emoji `text` contains (a Map of emoji → count). */
function emojiCountsIn(text, counts = new Map()) {
  if (typeof text !== 'string' || !text) return counts
  for (const match of text.matchAll(EMOJI_PATTERN)) {
    if (NOT_EMOJI.has(match[0])) continue
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1)
  }
  return counts
}

/**
 * The contents of every string literal in Python `code`, joined by newlines. Comments and code
 * outside strings are left out. Escapes are skipped over, not decoded; an unterminated string
 * runs to the end of its line (or, triple-quoted, the end of the code).
 */
export function pythonStringText(code) {
  const text = String(code ?? '')
  const parts = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '#') {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (ch !== '"' && ch !== "'") {
      i += 1
      continue
    }
    const triple = text.startsWith(ch.repeat(3), i)
    const close = triple ? ch.repeat(3) : ch
    let j = i + close.length
    let content = ''
    while (j < text.length) {
      if (text[j] === '\\') {
        content += text.slice(j, j + 2)
        j += 2
        continue
      }
      if (text.startsWith(close, j)) break
      if (!triple && text[j] === '\n') break
      content += text[j]
      j += 1
    }
    parts.push(content)
    i = text.startsWith(close, j) ? j + close.length : j
  }
  return parts.join('\n')
}

/**
 * `text` (CSS or JavaScript) without its comments: `/* … *\/` always, `// …` too when
 * `lineComments`. Quoted strings (' " and `) are kept whole, so `"http://…"` is not a comment.
 */
export function stripCLikeComments(text, { lineComments = false } = {}) {
  const source = String(text ?? '')
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }
    if (lineComments && ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== ch) {
        if (source[j] === '\\') j += 1
        else if (ch !== '`' && source[j] === '\n') break
        j += 1
      }
      out += source.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

const stripJsComments = (text) => stripCLikeComments(text, { lineComments: true })
const stripCssComments = (text) => stripCLikeComments(text)

/**
 * An HTML document's text and attribute values (with the markup left in), without `<!-- -->`
 * comments and without the comments inside its <style> and <script> elements.
 */
export function htmlContentText(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(
      /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>|$)/gi,
      (_, open, tag, body, close) =>
        open + (tag.toLowerCase() === 'style' ? stripCssComments : stripJsComments)(body) + close
    )
}

// What counts in each code language a module declares as `meta.language`.
const LANGUAGE_TEXT = Object.freeze({
  python: pythonStringText,
  html: htmlContentText,
})

// A project file's own syntax, by extension, when it isn't the module's language.
const FILE_TEXT = Object.freeze({
  py: pythonStringText,
  css: stripCssComments,
  js: stripJsComments,
  mjs: stripJsComments,
})

/** Whether emoji in `language` code can be told apart from comments here. */
export function canDetectEmojiIn(language) {
  return typeof language === 'string' && Object.hasOwn(LANGUAGE_TEXT, language)
}

function filesOf(work) {
  if (Array.isArray(work)) {
    return work.map((file) => ({ name: String(file?.name ?? ''), content: file?.content }))
  }
  return Object.entries(work).map(([name, content]) => ({ name, content }))
}

/**
 * Whether the student's work has an emoji the program would show. `work` is a code string, or
 * a project's files (`[{ name, content }]` or a name → content map); each file is read by its
 * extension (.py, .css, .js), else as `language`. `language` is the module's `meta.language`;
 * any other language (or none) is never scanned.
 */
export function codeHasEmoji(work, language) {
  return emojiCounts(work, language).size > 0
}

/** How many of each emoji the program would show (codeHasEmoji's reading), as a Map. */
export function emojiCounts(work, language) {
  const counts = new Map()
  if (!canDetectEmojiIn(language) || work == null) return counts
  const asLanguage = LANGUAGE_TEXT[language]
  if (typeof work === 'string') return emojiCountsIn(asLanguage(work), counts)
  if (typeof work !== 'object') return counts
  for (const { name, content } of filesOf(work)) {
    if (typeof content !== 'string' || !content) continue
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
    const textOf = Object.hasOwn(FILE_TEXT, ext) ? FILE_TEXT[ext] : asLanguage
    emojiCountsIn(textOf(content), counts)
  }
  return counts
}

/**
 * Whether the work has an emoji the student added: one emoji more of some kind than any of the
 * `given` works (the code the task gave them, givenCodeOf) has. Running given code unchanged
 * doesn't count; adding another 🐍 to a starter that has one does.
 */
export function codeHasNewEmoji(work, language, given = []) {
  const counts = emojiCounts(work, language)
  if (counts.size === 0) return false
  const givenMax = new Map()
  for (const item of given) {
    for (const [emoji, n] of emojiCounts(item, language)) {
      givenMax.set(emoji, Math.max(givenMax.get(emoji) ?? 0, n))
    }
  }
  for (const [emoji, n] of counts) {
    if (n > (givenMax.get(emoji) ?? 0)) return true
  }
  return false
}

/**
 * The code a task gives the student, as works for codeHasNewEmoji: every code stage (starter,
 * support, complete; `code` or `files`), the legacy starterCode / starterFiles, the copyCode, and
 * `extra` (e.g. the tutor's sandbox code).
 */
export function givenCodeOf(task, extra = []) {
  const given = []
  const add = (work) => {
    if (typeof work === 'string' ? work : Array.isArray(work) && work.length) given.push(work)
  }
  for (const stage of Array.isArray(task?.codeStages) ? task.codeStages : []) {
    add(stage?.code)
    add(stage?.files)
  }
  add(task?.starterCode)
  add(task?.starterFiles)
  add(task?.copyCode)
  for (const work of extra) add(work)
  return given
}
