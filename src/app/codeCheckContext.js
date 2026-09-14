// Builds the context object that code-based tasks pass to the shared check evaluator
// (modules/checks.js). One place so every path that checks a student's code — Run, the
// idle-feedback timer, Check/Submit, and Arcade's Run game — agrees on its shape.
//
// Electronics stores the whole serialized circuit in `code`, so it also needs `circuit`:
// that is what routes generic `code` checks to the Micro Controller's MicroPython source
// instead of matching against the raw circuit JSON.
export function buildCodeCheckContext(lessonType, code, extras = {}) {
  return {
    ...extras,
    code,
    ...(lessonType === 'electronics' ? { circuit: code } : {}),
  }
}
