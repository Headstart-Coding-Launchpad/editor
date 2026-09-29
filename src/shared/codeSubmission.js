// logAttempt always writes a submission as a JSON-safe string (see useSession.js), so an
// object-shaped submission (Scratch workspace state, a filesystem tree, an HTML file map)
// round-trips through the attempt log as text. Parse it back to its original shape so a
// report reads it as structured data rather than an escaped JSON blob; plain code strings
// (Python, etc.) simply fail to parse as an object and are left as-is. Pure.
export function normalizeCodeSubmission(submission) {
  if (typeof submission !== 'string' || !submission) return submission ?? null
  try {
    const parsed = JSON.parse(submission)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {}
  return submission
}
