// SPIKE only: builds the spike page in production mode (bundle sizes, real timings).
import { defineConfig, mergeConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import base from '../../vite.config.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export default mergeConfig(
  { ...base, build: { ...base.build, rollupOptions: {} } },
  defineConfig({
    root,
    build: {
      outDir: resolve(root, 'dist-spike'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          spike: resolve(root, 'spike/explainer-blockly/index.html'),
        },
      },
    },
  })
)
