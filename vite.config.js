import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs'
import path from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SHARED_TYPES = ['python', 'html', 'scratch', 'common']

function listFilesRecursive(dirPath, baseDir) {
  if (!fs.existsSync(dirPath)) return []
  const base = baseDir ?? dirPath
  const results = []
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, base))
    } else {
      results.push(path.relative(base, full).replace(/\\/g, '/'))
    }
  }
  return results
}

function buildManifest(root) {
  const assetsDir = path.join(root, 'public', 'assets')
  const manifest = {
    lessons: {},
    shared: Object.fromEntries(SHARED_TYPES.map(t => [t, []])),
  }
  if (!fs.existsSync(assetsDir)) return manifest
  for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'shared') {
      for (const type of SHARED_TYPES) {
        const typeDir = path.join(assetsDir, 'shared', type)
        manifest.shared[type] = listFilesRecursive(typeDir)
      }
    } else {
      manifest.lessons[entry.name] = listFilesRecursive(path.join(assetsDir, entry.name))
    }
  }
  return manifest
}

function writeManifestTo(targetAssetsDir, root) {
  try {
    const manifest = buildManifest(root)
    fs.mkdirSync(targetAssetsDir, { recursive: true })
    fs.writeFileSync(
      path.join(targetAssetsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    )
  } catch (e) {
    console.warn('[asset-manifest] Failed to write manifest:', e.message)
  }
}

function assetManifestPlugin() {
  let configRoot
  let configOutDir

  return {
    name: 'asset-manifest',
    configResolved(config) {
      configRoot = config.root
      configOutDir = config.build.outDir
    },
    configureServer(server) {
      const root = server.config.root
      writeManifestTo(path.join(root, 'public', 'assets'), root)

      const assetsDir = path.join(root, 'public', 'assets')
      server.watcher.add(assetsDir)
      server.watcher.on('all', (event, filePath) => {
        const norm = filePath.replace(/\\/g, '/')
        if (norm.includes('/public/assets/') && !norm.endsWith('manifest.json')) {
          writeManifestTo(path.join(root, 'public', 'assets'), root)
          server.ws?.send({ type: 'full-reload' })
        }
      })
    },
    closeBundle() {
      const root = configRoot ?? process.cwd()
      const outDir = path.resolve(root, configOutDir ?? 'dist')
      writeManifestTo(path.join(outDir, 'assets'), root)
    },
  }
}

export default defineConfig({
  plugins: [react(), assetManifestPlugin()],
  base: '/editor/',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['blockly'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
