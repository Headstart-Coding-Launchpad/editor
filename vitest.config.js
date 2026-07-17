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
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/modules/python/pyodide.worker.js',
        'src/modules/scratch/scratch.js',
        'src/**/*.worker.js',
        'src/main.jsx',
        'src/builder/main.jsx',
        'node_modules/**',
      ],
      // Thresholds reflect current test scope (pure functions + simple components).
      // Raise these incrementally as StudentView, TeacherView, useSession, and
      // builder components gain test coverage.
      thresholds: {
        lines: 8,
        branches: 6,
        functions: 8,
        statements: 8,
      },
    },
  },
})
