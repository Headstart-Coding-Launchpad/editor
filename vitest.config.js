import { defineConfig } from 'vitest/config'

const nodeHasNativeWebStorage = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')

export default defineConfig({
  test: {
    environment: 'jsdom',
    execArgv: nodeHasNativeWebStorage ? ['--no-webstorage'] : [],
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{js,jsx}', 'cli/**/*.mjs'],
      exclude: [
        'src/**/*.worker.js',
        'src/**/*.test.{js,jsx}',
        'src/test/**',
        'src/main.jsx',
        'cli/**/*.test.js',
        // Entry point: argument parsing and process exit only; command logic lives in
        // the modules it imports, which are covered.
        'cli/cli.mjs',
        'node_modules/**',
      ],
      // Global floors sit just under the measured suite (Sept 2026: lines 54.7%,
      // branches 49.2%, functions 49.2%, statements 52.8%). Raise them when coverage
      // grows; never lower them to make a PR pass. The per-file floors protect the
      // pure logic that decides what students see and what authors can publish.
      thresholds: {
        lines: 53,
        branches: 48,
        functions: 48,
        statements: 51,
        'src/modules/checks.js': { lines: 90, branches: 85 },
        'src/modules/{python,turtle,filesystem,scratch}/checks.js': { lines: 85, branches: 75 },
        'src/shared/taskUtils.js': { lines: 90, branches: 85 },
        'src/shared/composedLesson.js': { lines: 90, branches: 75 },
        'src/builder/lessonUtils.js': { lines: 75, branches: 65 },
      },
    },
  },
})
