// `hsc lessons ready`: the browser half (headless runs). Not built yet: every planned run is
// reported as not checked.

export async function runPlannedTasks({ plans }) {
  const results = {}
  for (const p of plans) {
    results[p.id] = Object.fromEntries(
      p.runs.map((r) => [
        r.role,
        { status: 'not_checked', reason: 'headless runs are not built yet' },
      ])
    )
  }
  return { results, network: null, run: null }
}
