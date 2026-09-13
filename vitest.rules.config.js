import { defineConfig } from 'vitest/config'

// Security rules tests run against the Firebase emulators, not jsdom. Run them with
// `npm run test:rules`, which starts the emulators (needs firebase-tools and Java 21)
// and points these tests at them. They are excluded from `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
