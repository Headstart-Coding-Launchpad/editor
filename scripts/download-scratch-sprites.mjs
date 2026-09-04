import fs from 'fs'
import path from 'path'
import https from 'https'

const CDN = 'https://assets.scratch.mit.edu/internalapi/asset'
const OUT_DIR = path.resolve('public/scratch-assets/sprites')
const RAW = path.resolve('public/scratch-assets/sprites-raw.json')
const CONCURRENCY = 10

fs.mkdirSync(OUT_DIR, { recursive: true })

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'))

function fetchFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve()
    const file = fs.createWriteStream(dest)
    https
      .get(`${url}/get/`, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          fs.unlinkSync(dest)
          return fetchFile(res.headers.location, dest).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          file.close()
          try {
            fs.unlinkSync(dest)
          } catch {}
          return reject(new Error(`${res.statusCode} ${url}`))
        }
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(dest)
        } catch {}
        reject(err)
      })
  })
}

async function pool(tasks, concurrency) {
  const results = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function run() {
  const library = []
  let downloaded = 0,
    skipped = 0,
    errors = 0

  // Build work list
  const sprites = raw.filter((s) => s.costumes.some((c) => c.dataFormat === 'svg'))
  skipped = raw.length - sprites.length

  // All costume download tasks
  const allTasks = sprites.flatMap((sprite) =>
    sprite.costumes
      .filter((c) => c.dataFormat === 'svg')
      .map((c) => async () => {
        const dest = path.join(OUT_DIR, c.md5ext)
        const url = `${CDN}/${c.md5ext}`
        try {
          await fetchFile(url, dest)
          downloaded++
        } catch (e) {
          errors++
          console.error(`\n  ERROR: ${c.md5ext} — ${e.message}`)
        }
        process.stdout.write(`\r  ${downloaded} downloaded, ${errors} errors...   `)
      })
  )

  console.log(
    `Downloading ${allTasks.length} SVG costumes for ${sprites.length} sprites (${CONCURRENCY} concurrent)...`
  )
  await pool(allTasks, CONCURRENCY)

  // Build library index
  for (const sprite of sprites) {
    const costumes = sprite.costumes
      .filter((c) => c.dataFormat === 'svg' && fs.existsSync(path.join(OUT_DIR, c.md5ext)))
      .map((c) => ({
        name: c.name,
        file: c.md5ext,
        rotationCenterX: c.rotationCenterX,
        rotationCenterY: c.rotationCenterY,
      }))
    if (costumes.length > 0) library.push({ name: sprite.name, tags: sprite.tags ?? [], costumes })
  }

  console.log('\nWriting sprites.json...')
  fs.writeFileSync(
    path.resolve('public/scratch-assets/sprites.json'),
    JSON.stringify(library, null, 2)
  )
  fs.unlinkSync(RAW)
  console.log(
    `Done. ${library.length} sprites in library, ${downloaded} SVG files, ${skipped} non-SVG sprites skipped, ${errors} errors.`
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
