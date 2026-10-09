// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// The CLI imports shared validation and module checks under plain Node ESM. Vitest resolves a
// missing named export to undefined, so a broken import can pass the suite and only fail in
// `vite build` or the CLI (the FS_CHECK_DEFINITIONS removal broke a deploy this way). This test
// loads the Node-side import graph in a real Node process so those errors fail here instead.

const root = path.resolve(__dirname, '../../..')

// CLI entry points that need Firebase credentials exit on import, so only pure CLI files are
// loaded. cli.mjs is the argument-parsing entry point and firebase.mjs holds the credentials check.
function pureCliFiles() {
  const dir = path.join(root, 'cli')
  return readdirSync(dir)
    .filter(
      (name) =>
        name.endsWith('.mjs') &&
        !name.endsWith('.test.mjs') &&
        name !== 'cli.mjs' &&
        name !== 'firebase.mjs'
    )
    .filter((name) => !/from '\.\/firebase\.mjs'/.test(readFileSync(path.join(dir, name), 'utf8')))
    .map((name) => `cli/${name}`)
}

function moduleCheckFiles() {
  const dir = path.join(root, 'src', 'modules')
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
    .map((entry) => `src/modules/${entry.name}/checks.js`)
    .filter((file) => existsSync(path.join(root, file)))
}

const files = [
  ...pureCliFiles(),
  'src/modules/checks.js',
  ...moduleCheckFiles(),
  'src/shared/checkAuthoringValidation.js',
  'src/shared/composedLesson.js',
]

describe('Node ESM import graph', () => {
  it('covers the CLI validator and every module checks file', () => {
    expect(files).toContain('cli/validate.mjs')
    expect(files).toContain('cli/yaml-converter.mjs')
    expect(
      files.filter((file) => file.startsWith('src/modules/') && file.endsWith('/checks.js')).length
    ).toBeGreaterThan(5)
  })

  it('loads every Node-side file in a real Node process', () => {
    const script = `
      const files = ${JSON.stringify(files)};
      const failures = [];
      for (const file of files) {
        try { await import(new URL(file, 'file:///' + process.cwd().replace(/\\\\/g, '/') + '/').href) }
        catch (error) { failures.push(file + ': ' + String(error && error.message).split('\\n')[0]) }
      }
      if (failures.length) { console.error(failures.join('\\n')); process.exit(1) }
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
