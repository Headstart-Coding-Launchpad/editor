// The solo study log is not recorded (Ryan, 2026-10-23, handoff #130): no student writes it and
// the database rule is gone, so there is nothing to read. The Admin portal's Solo panel keeps
// calling this and shows an empty log.

/** Tutor/admin read of the whole log: { [lessonId]: { [anonymousId]: entry } }. Always empty. */
export async function readSoloLog() {
  return {}
}
