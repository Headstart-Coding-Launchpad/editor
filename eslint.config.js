import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'

// Module and task type names core code must not compare against: ask the module registry
// (src/modules/definitions.js — meta, capabilities, lifecycle, wire, workSlot) or the activity
// registry (src/activities/registry.pure.js) instead. The same names as the type-branch ratchet
// (src/modules/__tests__/typeBranchRatchet.test.js), which also counts inline type arrays.
const TYPE_NAME_PATTERN =
  '/^(python|turtle|html|scratch|filesystem|desktop|electronics|arcade|quiz|code_arrange)$/'
const TYPE_BRANCH_MESSAGE =
  'Do not compare against a module/task type name outside src/modules and src/activities; read the definition (capabilities, lifecycle, wire, workSlot) or the activity registry instead. See docs/architecture/lesson-type-modules.md.'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/node_modules/**',
      'functions/lib/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,

  // Browser source (app, shared, modules, builder, admin, auth)
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/*.worker.js', 'src/**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Only the two classic correctness rules from react-hooks; the rest of its
      // "recommended" set targets React Compiler readiness (purity, immutability,
      // set-state-in-effect, etc.) and flags many ordinary, working patterns as
      // errors — not appropriate to mass-"fix" in a behavior-preserving pass.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/prop-types': 'off',
      // Cosmetic only — raw quotes/apostrophes in JSX text render identically to their
      // escaped entities, this rule just has an opinion about writing them literally.
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
    settings: {
      react: { version: '18.3' },
    },
  },

  // Web Workers
  {
    files: ['src/**/*.worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.worker },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Test files (vitest)
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
    settings: {
      react: { version: '18.3' },
    },
  },

  // Playwright e2e tests
  {
    files: ['e2e/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Security rules tests (vitest, Node, Firebase emulators)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Node-side config/scripts/CLI tool
  {
    files: ['*.config.js', 'scripts/**/*.mjs', 'cli/**/*.mjs', 'cli/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // CLI tool tests (vitest)
  {
    files: ['cli/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // No lesson-type branching outside the plugin folders (plan step 4.8). The ratchet test keeps
  // the per-file counts at zero; this catches a new comparison as it is written.
  // TODO(module-kit): remove the src/builder/** ignore once the Builder branch that zeroes
  // src/builder merges.
  {
    files: ['src/**/*.{js,jsx}', 'cli/**/*.mjs'],
    ignores: [
      'src/modules/**',
      'src/activities/**',
      'src/builder/**',
      'src/test/**',
      '**/__tests__/**',
      '**/*.test.{js,jsx,mjs}',
      'src/**/*.worker.js',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `BinaryExpression[operator=/^[!=]==?$/] > Literal[value=${TYPE_NAME_PATTERN}]`,
          message: TYPE_BRANCH_MESSAGE,
        },
        {
          selector: `SwitchCase > Literal.test[value=${TYPE_NAME_PATTERN}]`,
          message: TYPE_BRANCH_MESSAGE,
        },
      ],
    },
  },

  // Cloud Functions (CommonJS)
  {
    files: ['functions/**/*.js'],
    ignores: ['functions/lib/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  prettierConfig,
]
