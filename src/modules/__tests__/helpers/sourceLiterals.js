// Test-only helpers that read literal values out of production source text.
//
// Some hand-maintained module-type lists are private to their file (not exported), and the
// parity tests must not change production code just to reach them. These helpers read the
// file and pull the literal out with a small bracket-matching scanner instead of a regex, so
// they cope with multi-line literals, nested objects, comments, and strings that contain
// brackets. They deliberately understand only plain literals: if a list stops being a
// literal (for example it becomes derived from the registry), the helper throws with a
// message naming the file and identifier, and the parity entry should switch to importing
// the value instead.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

/** Reads a repo file as text. `relPath` is relative to the repo root, e.g. 'src/app/x.js'. */
export function readRepoFile(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

/** Whether a repo file exists. `relPath` is relative to the repo root. */
export function repoFileExists(relPath) {
  return existsSync(path.join(REPO_ROOT, relPath))
}

/**
 * Walks `src` from `start` and returns the index just past the bracket that closes the one
 * at `start` (`[`, `{` or `(`). Skips string/template literals and comments so brackets
 * inside them do not count. Template `${}` interpolations are treated as plain template
 * text, which is enough for the literals these tests read.
 */
function findClosingBracket(src, start) {
  const pairs = { '[': ']', '{': '}', '(': ')' }
  const stack = []
  let i = start
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      i = src.indexOf('\n', i)
      if (i === -1) break
      continue
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end === -1) break
      i = end + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i += 1
      while (i < src.length && src[i] !== ch) i += src[i] === '\\' ? 2 : 1
      i += 1
      continue
    }
    if (pairs[ch]) stack.push(pairs[ch])
    else if (ch === ']' || ch === '}' || ch === ')') {
      if (stack.pop() !== ch) throw new Error(`Unbalanced '${ch}' at offset ${i}`)
      if (stack.length === 0) return i + 1
    }
    i += 1
  }
  throw new Error(`No closing bracket for '${src[start]}' at offset ${start}`)
}

/**
 * Returns the source text of the array/object literal assigned to `const NAME = ...`
 * (optionally exported, at any nesting level — e.g. a const inside a function body).
 */
export function extractConstLiteral(src, name, fileLabel = 'source') {
  const match = new RegExp(`\\bconst\\s+${name}\\s*=\\s*`).exec(src)
  if (!match) throw new Error(`${fileLabel}: no \`const ${name} = …\` declaration found`)
  const start = match.index + match[0].length
  if (src[start] !== '[' && src[start] !== '{') {
    throw new Error(
      `${fileLabel}: \`${name}\` is no longer an array/object literal — import the value instead`
    )
  }
  return src.slice(start, findClosingBracket(src, start))
}

/** Returns the body text (including braces) of `function NAME(...) { ... }`. */
export function extractFunctionBody(src, name, fileLabel = 'source') {
  const match = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(src)
  if (!match) throw new Error(`${fileLabel}: no \`function ${name}(\` declaration found`)
  const paramsEnd = findClosingBracket(src, match.index + match[0].length - 1)
  const bodyStart = src.indexOf('{', paramsEnd)
  return src.slice(bodyStart, findClosingBracket(src, bodyStart))
}

/** Every single/double-quoted string literal in `text`, in order (comments ignored). */
export function stringLiterals(text) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  return [...withoutComments.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2])
}

/** The string elements of the array literal `const NAME = [...]`. */
export function arrayLiteralStrings(src, name, fileLabel) {
  return stringLiterals(extractConstLiteral(src, name, fileLabel))
}

/**
 * The top-level keys of the object literal `const NAME = {...}`. Nested object/array values
 * are blanked out first so their keys are not reported.
 */
export function objectLiteralKeys(src, name, fileLabel) {
  const literal = extractConstLiteral(src, name, fileLabel)
  let flat = ''
  let i = 1
  while (i < literal.length - 1) {
    const ch = literal[i]
    if (ch === '[' || ch === '{' || ch === '(') {
      const end = findClosingBracket(literal, i)
      flat += ' '.repeat(end - i)
      i = end
    } else {
      flat += ch
      i += 1
    }
  }
  return [...flat.matchAll(/(?:^|,)\s*(?:\/\/[^\n]*\s*)*(['"]?)([A-Za-z_$][\w$-]*)\1\s*:/g)].map(
    (m) => m[2]
  )
}

/**
 * Every string literal compared against `identifier` with `===` inside the body of
 * `function FN(...)`, e.g. `if (type === 'python') ...` → ['python', ...].
 */
export function comparedLiterals(src, fnName, identifier, fileLabel) {
  const body = extractFunctionBody(src, fnName, fileLabel)
  const pattern = new RegExp(`\\b${identifier}\\s*===\\s*(['"])([^'"]*)\\1`, 'g')
  return [...body.matchAll(pattern)].map((m) => m[2])
}
