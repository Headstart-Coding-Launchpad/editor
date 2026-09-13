import { defineConfig } from 'vitest/config'

const nodeHasNativeWebStorage = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')

export default defineConfig({
  test: {
    environment: 'jsdom',
    execArgv: nodeHasNativeWebStorage ? ['--no-webstorage'] : [],
    setupFiles: ['./src/test/setup.js'],
    // Placeholder Firebase config for tests. src/shared/firebase.js initialises the SDK on
    // import and throws without a database URL, which broke 38 suites in CI (no .env
    // there). Using a demo project also keeps tests that forget to mock Firebase from
    // reaching the real project when a local .env is present.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-hsc-test.firebaseapp.com',
      VITE_FIREBASE_DATABASE_URL: 'https://demo-hsc-test-default-rtdb.firebaseio.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-hsc-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-hsc-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
    },
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
