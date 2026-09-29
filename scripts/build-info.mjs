import { execSync } from 'node:child_process'

function defaultRun(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function tryRun(run, command) {
  try {
    return run(command)
  } catch {
    return null
  }
}

// Build metadata baked into the bundle by vite.config.js as __APP_BUILD_INFO__.
// `version` is MAJOR.MINOR from package.json (bumped by hand for milestones); `build` is the
// commit count on HEAD, so it rises on every merge to main with no manual step. A shallow
// clone would report a tiny count, so `build` is null there rather than misleading.
export function getBuildInfo({ packageVersion, run = defaultRun, now = new Date() }) {
  const [major = '0', minor = '0'] = String(packageVersion ?? '').split('.')
  const shallow = tryRun(run, 'git rev-parse --is-shallow-repository') === 'true'
  const count = shallow ? null : tryRun(run, 'git rev-list --count HEAD')
  const build = count && /^\d+$/.test(count) ? Number(count) : null
  const commit = tryRun(run, 'git rev-parse --short HEAD')
  return {
    version: `${major}.${minor}`,
    build,
    commit: commit || null,
    builtAt: now.toISOString(),
  }
}
