import { getModuleDefinition } from '../modules/definitions.js'

// Builds the context object that code-based tasks pass to the shared check evaluator
// (modules/checks.js). One place so every path that checks a student's code — Run, the
// idle-feedback timer, Check/Submit, and Arcade's Run game — agrees on its shape.
//
// A module checked on Run declares its own context builder (`checking.buildContext`, see
// src/modules/moduleContract.js): electronics stores the whole serialized circuit in `code`,
// so it also adds `circuit`, which routes generic `code` checks to the Micro Controller's
// MicroPython source instead of matching against the raw circuit JSON. Other code (HTML) gets
// the plain `{ ...extras, code }` (its own builder takes the files, not a code string).
export function buildCodeCheckContext(lessonType, code, extras = {}) {
  const definition = getModuleDefinition(lessonType)
  if (definition?.checking?.trigger === 'run' && definition.wire.sandboxChannel === 'code') {
    return definition.checking.buildContext(code, extras)
  }
  return { ...extras, code }
}
