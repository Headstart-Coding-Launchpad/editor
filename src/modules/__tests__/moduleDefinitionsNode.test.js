import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Module definition.js files must load under plain Node ESM (the CLI imports them through
// src/shared/composedLesson.js). Vitest resolves extensionless imports, JSX and missing named
// exports that real Node rejects, so this loads them in a real Node process.

const root = path.resolve(__dirname, '../../..')

function definitionFiles() {
  const dir = path.join(root, 'src', 'modules')
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
    .map((entry) => `src/modules/${entry.name}/definition.js`)
    .filter((file) => existsSync(path.join(root, file)))
}

const files = ['src/modules/definitions.js', ...definitionFiles(), 'src/shared/composedLesson.js']

describe('module definitions under Node ESM', () => {
  it('finds a definition.js for every module folder', () => {
    expect(definitionFiles()).toHaveLength(8)
  })

  it('loads every definition in a real Node process', () => {
    const script = `
      const files = ${JSON.stringify(files)};
      const failures = [];
      const base = 'file:///' + process.cwd().replace(/\\\\/g, '/') + '/';
      for (const file of files) {
        try { await import(new URL(file, base).href) }
        catch (error) { failures.push(file + ': ' + String(error && error.message).split('\\n')[0]) }
      }
      const { MODULE_TYPES, getModuleDefinition } = await import(new URL('src/modules/definitions.js', base).href);
      if (MODULE_TYPES.length !== 8) failures.push('expected 8 MODULE_TYPES, got ' + MODULE_TYPES.length);
      for (const type of MODULE_TYPES) {
        if (typeof getModuleDefinition(type)?.getDisplayState !== 'function') failures.push(type + ': bad definition');
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
