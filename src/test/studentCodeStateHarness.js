// Shared harness for driving useStudentCodeState directly through renderHook, with
// every session writer replaced by a vi.fn so tests can assert the exact arguments
// the hook hands to Firebase, plus helpers for the exact localStorage keys/records it
// writes. Used by the characterization suite in
// src/app/hooks/__tests__/useStudentCodeState.*.test.js.
//
// Test files must still declare the module mocks themselves (vi.mock is hoisted per
// test file) using the dependency-free factories in ./studentCodeStateMocks.js:
//
//   vi.mock('../../../modules/python/pyodide', async () =>
//     (await import('../../../test/studentCodeStateMocks')).pyodideMock())
//   (same for useTypeAssets / useLessonStorageAssets)
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useStudentCodeState } from '../app/hooks/useStudentCodeState'
import { getLessonModule } from '../modules/registry'
import { getEffectiveLessonForTask } from '../shared/composedLesson'

export const LESSON_ID = 'lesson-1'
export const ANON = 'stu-1'
export const STUDENT_NAME = 'Sam'

export const IDENTITY = Object.freeze({ anonymousId: ANON, displayName: STUDENT_NAME })

// ── Storage keys ──────────────────────────────────────────────────────────────

export const taskKey = (taskId, { lessonId = LESSON_ID, anon = ANON } = {}) =>
  `headstart_${lessonId}_${taskId}_${anon}`

export const fileKey = (taskId, filename, { lessonId = LESSON_ID, anon = ANON } = {}) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anon}`

export const personalSandboxKey = ({ lessonId = LESSON_ID, anon = ANON, moduleId = null } = {}) =>
  moduleId
    ? `headstart_${lessonId}_module_${moduleId}_sandbox_${anon}`
    : `headstart_${lessonId}_personalsandbox_${anon}`

export const personalSandboxFileKey = (
  filename,
  { lessonId = LESSON_ID, anon = ANON, moduleId = null } = {}
) =>
  moduleId
    ? `headstart_${lessonId}_module_${moduleId}_sandbox_${filename}_${anon}`
    : `headstart_${lessonId}_personalsandbox_${filename}_${anon}`

export function readStored(key) {
  const raw = localStorage.getItem(key)
  return raw == null ? null : JSON.parse(raw)
}

export function writeStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function storedKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i))
  return keys.sort()
}

// ── Session ───────────────────────────────────────────────────────────────────

// The studentSignals writers, handed to the hook as one `badgeSignalWriters` object (as
// StudentView does) but kept flat in `writers` so tests can assert on each.
export const BADGE_SIGNAL_WRITER_NAMES = [
  'recordTopicOpenSignal',
  'recordShortcutSignal',
  'recordFirstEditSignal',
  'recordCompleteShownSignal',
  'recordSandboxRunSignal',
  'flagSandboxRunError',
  'addSandboxTimeSignal',
]

export const WRITER_NAMES = [
  'writeStudentRun',
  'writeStudentHintState',
  'logAttempt',
  'writeStudentAnswer',
  'writeStudentCode',
  'writeStudentArcadeDesign',
  'writeStudentTurtleResult',
  'writeStudentSpriteState',
  'writeStudentCursor',
  'writeStudentBlockDrag',
  'writeStudentCodeArrangeSlots',
  'writeStudentFiles',
  'writeStudentOutput',
  'writeStudentInputState',
  'writeStudentInteraction',
  'recordStudentCarryFallback',
  'recordSupportStageReveal',
  'recordStudentPaste',
  'recordStudentTyping',
  'writeStudentPersonalSandbox',
  'writeStudentPresence',
  'registerPresence',
  'removeStudent',
  'updateTeacherLive',
  'setTeacherLive',
  'setTeacherLiveReference',
  'removeTeacherHighlight',
  'clearTeacherAnswerEdit',
  'clearRemoteRun',
  'flagAttemptError',
  ...BADGE_SIGNAL_WRITER_NAMES,
]

export function makeWriters() {
  const writers = {}
  for (const name of WRITER_NAMES) {
    writers[name] =
      name === 'writeStudentRun' ? vi.fn(() => Promise.resolve()) : vi.fn(() => undefined)
  }
  return writers
}

/** A session snapshot as useSession would expose it. `student` becomes students[ANON]. */
export function makeSession({ student = {}, ...rest } = {}) {
  return {
    status: 'active',
    activeStudentView: null,
    students: { [ANON]: { name: STUDENT_NAME, ...student } },
    ...rest,
  }
}

/** teacherLive broadcast with this student as the Go Live source. */
export function studentSourcedTeacherLive(extra = {}) {
  return { active: true, source: 'student', sourceStudentId: ANON, ...extra }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Renders useStudentCodeState with mocked writers. `lesson` may be a composed lesson —
 * like StudentView, the hook receives getEffectiveLessonForTask(lesson, currentTaskId)
 * unless `effectiveLesson: false` is passed.
 *
 * Returns { result, writers, update(patch), props() }. `update` re-renders with merged
 * props inside act(), recomputing the effective lesson when lesson/currentTaskId change.
 */
export function renderStudentCodeState({
  lesson,
  currentTaskId = null,
  viewingTaskId = null,
  phase = 'lesson',
  session = makeSession(),
  identity = IDENTITY,
  effectiveIdentity,
  teacherPresentation = false,
  previewMode = false,
  connected = true,
  lessonId = LESSON_ID,
  effectiveLesson = true,
} = {}) {
  const writers = makeWriters()
  let rawProps = {
    lessonId,
    lesson,
    currentTaskId: currentTaskId ?? lesson?.tasks?.[0]?.id ?? null,
    viewingTaskId,
    phase,
    effectiveIdentity: effectiveIdentity === undefined ? identity : effectiveIdentity,
    identity,
    session,
    connected,
    teacherPresentation,
    previewMode,
  }
  const toHookProps = (p) => ({
    ...p,
    lesson: effectiveLesson ? getEffectiveLessonForTask(p.lesson, p.currentTaskId) : p.lesson,
    ...writers,
    badgeSignalWriters: Object.fromEntries(
      BADGE_SIGNAL_WRITER_NAMES.map((name) => [name, writers[name]])
    ),
  })
  const utils = renderHook((p) => useStudentCodeState(toHookProps(p)), {
    initialProps: rawProps,
  })
  function update(patch) {
    rawProps = { ...rawProps, ...(typeof patch === 'function' ? patch(rawProps) : patch) }
    act(() => utils.rerender(rawProps))
  }
  /** Merge fields into this student's session record (students[ANON]). */
  function updateStudent(fields) {
    update((p) => ({
      session: {
        ...p.session,
        students: {
          ...p.session.students,
          [ANON]: { ...(p.session.students?.[ANON] ?? {}), ...fields },
        },
      },
    }))
  }
  function updateSession(fields) {
    update((p) => ({ session: { ...p.session, ...fields } }))
  }
  return {
    ...utils,
    writers,
    props: () => rawProps,
    update,
    updateStudent,
    updateSession,
  }
}

/** Runs a (possibly async) hook action inside act and returns its result. */
export async function actAsync(fn) {
  let value
  await act(async () => {
    value = await fn()
  })
  return value
}

export function actSync(fn) {
  let value
  act(() => {
    value = fn()
  })
  return value
}

// ── Runtimes ──────────────────────────────────────────────────────────────────

/**
 * Replaces a module's runtime.run with a scripted fake. `script` receives the
 * callbacks (onOutput, onInputRequired, onCodeUpdate, getRuntimeCode) and returns the
 * run result ({ status, variables?, turtle?, updatedCode? }).
 */
export function mockModuleRun(type, script = () => ({ status: 'success' })) {
  const runtime = getLessonModule(type).runtime
  return vi.spyOn(runtime, 'run').mockImplementation(async (code, task, callbacks) => {
    return script(callbacks, code, task)
  })
}

/** Fakes the HTML runtime: preview src and the text the iframe reports back. */
export function mockHtmlPreview({ src = 'blob:preview', text = '' } = {}) {
  const runtime = getLessonModule('html').runtime
  const build = vi.spyOn(runtime, 'buildPreviewSrc').mockReturnValue(src)
  const wait = vi.spyOn(runtime, 'waitForPreviewText').mockResolvedValue(text)
  return { build, wait }
}
