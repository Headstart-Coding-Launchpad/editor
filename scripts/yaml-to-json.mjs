/**
 * CLI tool: convert a YAML lesson to lesson JSON.
 *
 * Usage:
 *   node scripts/yaml-to-json.mjs <input.yaml>               # output to stdout
 *   node scripts/yaml-to-json.mjs <input.yaml> <output.json> # output to file
 *
 * Task IDs are auto-assigned. See YAML_LESSON_FORMAT.md for the YAML syntax.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const [,, inputPath, outputPath] = process.argv

if (!inputPath || inputPath === '--help' || inputPath === '-h') {
  console.error('Usage: node scripts/yaml-to-json.mjs <input.yaml> [output.json]')
  process.exit(0)
}

// Use pathToFileURL so Windows absolute paths are valid ESM specifiers
const { parseYamlLesson } = await import(pathToFileURL(join(__dirname, '..', 'mcp', 'yaml-converter.mjs')))
const { validateLessonForMcp } = await import(pathToFileURL(join(__dirname, '..', 'mcp', 'validate.mjs')))

let yamlText
try {
  yamlText = await readFile(inputPath, 'utf-8')
} catch (err) {
  console.error(`Error reading ${inputPath}: ${err.message}`)
  process.exit(1)
}

let lesson
try {
  lesson = parseYamlLesson(yamlText)
} catch (err) {
  console.error(`YAML parse error: ${err.message}`)
  process.exit(1)
}

const { valid, errors, warnings } = validateLessonForMcp(lesson)

for (const w of warnings) {
  console.warn(`Warning: ${w}`)
}

if (!valid) {
  for (const e of errors) {
    console.error(`Error: ${e}`)
  }
  process.exit(1)
}

const json = JSON.stringify(lesson, null, 2)

if (outputPath) {
  await writeFile(outputPath, json, 'utf-8')
  console.error(`Written to ${outputPath}`)
} else {
  process.stdout.write(json + '\n')
}
