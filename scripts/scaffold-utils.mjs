// Shared plumbing for the scaffolding kits (`npm run new:activity`, `npm run new:module`): plan
// every file to create or update without writing, then apply the plan only if nothing changed
// meanwhile. Each kit owns its template, naming rules and edit anchors.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as prettier from 'prettier'

// Every file under a template folder, as paths relative to it, except the named ones (the doc
// template, which the kit writes elsewhere).
export function listTemplateFiles(dir, skip = [], prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return listTemplateFiles(path.join(dir, entry.name), skip, rel)
    return skip.includes(rel) ? [] : [rel]
  })
}

export async function formatCode(root, relPath, source) {
  const filepath = path.join(root, relPath)
  const config = (await prettier.resolveConfig(filepath)) ?? {}
  return prettier.format(source, { ...config, filepath })
}

export function lastMatchEnd(text, pattern) {
  let end = -1
  for (const match of text.matchAll(pattern)) end = match.index + match[0].length
  return end
}

export function insertAt(text, index, insertion) {
  return text.slice(0, index) + insertion + text.slice(index)
}

export function freeIdentifier(source, base, suffix) {
  return new RegExp(`\\b${base}\\b`).test(source) ? `${base}${suffix}` : base
}

export function requireAnchor(found, file, what, noun = 'the entry') {
  if (!found) throw new Error(`${file}: could not find ${what}. Add ${noun} by hand.`)
}

// Keep a file's own line endings (a Windows checkout may have CRLF).
export function withLineEndingsOf(before, content) {
  return content.replace(/\r?\n/g, before.includes('\r\n') ? '\r\n' : '\n')
}

export function applyPlan(root, plan) {
  // Re-check just before writing so a second run can never overwrite the first.
  for (const file of plan.files) {
    if (file.action === 'create' && existsSync(path.join(root, file.path))) {
      throw new Error(`${file.path} already exists. Refusing to overwrite.`)
    }
    if (
      file.action === 'update' &&
      readFileSync(path.join(root, file.path), 'utf8') !== file.before
    ) {
      throw new Error(`${file.path} changed while planning. Run the command again.`)
    }
  }
  for (const file of plan.files) {
    const target = path.join(root, file.path)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, file.content)
  }
}

function addedLines(before, after) {
  const old = new Set(before.split(/\r?\n/))
  return after.split(/\r?\n/).filter((line) => line.trim() && !old.has(line))
}

export function describePlan(plan) {
  const lines = []
  for (const file of plan.files) {
    if (file.action === 'create') {
      lines.push(`  create  ${file.path} (${file.content.split('\n').length} lines)`)
    } else {
      lines.push(`  update  ${file.path}`)
      for (const line of addedLines(file.before, file.content)) {
        lines.push(`            + ${line.length > 110 ? `${line.slice(0, 107)}...` : line}`)
      }
    }
  }
  return lines.join('\n')
}
