import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseYamlLesson } from '../../../cli/yaml-converter.mjs'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// Authoring agents copy the examples in docs/authoring word for word, so every complete
// lesson example (a YAML or JSON block with a top-level `id` and `tasks`) must parse and pass
// CLI validation. Put `<!-- example:template -->` on the line before a block that is a
// deliberate skeleton (e.g. an envelope with `tasks: []`).

const DOCS_DIR = resolve(process.cwd(), 'docs/authoring')

function lessonExamples() {
  const examples = []
  for (const file of readdirSync(DOCS_DIR).filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(resolve(DOCS_DIR, file), 'utf8').replace(/\r\n/g, '\n')
    const pattern = /(<!--\s*example:template\s*-->\n)?```(yaml|json)\n([\s\S]*?)```/g
    let match
    while ((match = pattern.exec(text))) {
      const [, templateMarker, lang, body] = match
      if (templateMarker) continue
      const isLesson =
        lang === 'yaml'
          ? /^id:/m.test(body) && /^tasks:/m.test(body)
          : body.trim().startsWith('{') && /"id"\s*:/.test(body) && /"tasks"\s*:/.test(body)
      if (!isLesson) continue
      const line = text.slice(0, match.index).split('\n').length + 1
      examples.push({ name: `${file}:${line}`, lang, body })
    }
  }
  return examples
}

describe('authoring doc lesson examples', () => {
  const examples = lessonExamples()

  it('finds the complete lesson examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(10)
  })

  it.each(examples)('$name is a valid lesson', ({ lang, body }) => {
    const lesson = lang === 'yaml' ? parseYamlLesson(body) : JSON.parse(body)
    const { errors } = validateLessonForMcp(lesson)
    expect(errors).toEqual([])
  })
})
