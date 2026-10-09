// Side-quests: optional, unchecked extras on a code task for students who have already passed it
// while the class waits (docs/authoring/AUTHORING_GUIDE.md "Side-quests"). Pure helpers only; the
// student's state lives in src/app/hooks/useSideQuests.js, the workspace in
// src/app/components/sideQuests/, and the Firebase writes in src/app/hooks/useSession.js.
//
// Data (L = lessonId, T = taskId, n = the side-quest's index 0-2):
//   sessions/L/students/{id}/sideQuestOpen         n | null: the side-quest open right now
//   sessions/L/sideQuestLog/{id}/T/n                { openedAt, runs, errorRuns, done, doneAt }
//   localStorage headstart_{L}_{T}_sidequest_{n}_{anonymousId}
//                                                   { code } (python, turtle) or
//                                                   { files: [{ name, content }], activeFile } (html)
// Side-quest code never reaches Firebase, never writes the task's saved work and never feeds
// carryCodeFrom.
import { getModuleDefinition, getModuleTypesWithCapability } from '../modules/definitions.js'

export const SIDE_QUEST_MAX = 3
export const SIDE_QUEST_KINDS = Object.freeze(['challenge', 'debug', 'predict'])
// The modules a side-quest can run in: those declaring `capabilities.sideQuests` (v1: python,
// turtle, html). Scratch and the rest come later.
export const SIDE_QUEST_MODULES = Object.freeze(getModuleTypesWithCapability('sideQuests'))
export const SIDE_QUEST_TITLE_MAX = 60

// Label and icon per kind. The kind changes nothing else: every side-quest is unchecked.
export const SIDE_QUEST_KIND_META = Object.freeze({
  challenge: Object.freeze({ icon: '🏆', label: 'Mini challenge' }),
  debug: Object.freeze({ icon: '🐞', label: 'Debug it' }),
  predict: Object.freeze({ icon: '🔮', label: 'Predict, then run' }),
})

// The task id the throwaway side-quest workspace runs under, and the storage pseudo task id.
export const SIDE_QUEST_TASK_ID = 'side-quest'
export const sideQuestStorageTaskId = (taskId, index) => `${taskId}_sidequest_${index}`

const HTML_ENTRY_FILE = 'index.html'

export function supportsSideQuests(moduleType) {
  return getModuleDefinition(moduleType)?.capabilities.sideQuests === true
}

// A files module (html) keeps its work as files; the rest as one code string.
export const sideQuestUsesFiles = (moduleType) =>
  getModuleDefinition(moduleType)?.wire.sandboxChannel === 'files'

export function sideQuestKindMeta(kind) {
  return SIDE_QUEST_KIND_META[kind] ?? SIDE_QUEST_KIND_META.challenge
}

/**
 * The task's usable side-quests, in order and at most SIDE_QUEST_MAX: entries with a title.
 * Missing fields are filled (kind 'challenge', empty explainer and starter). Each keeps its
 * authored `index`, which is what storage, the log and the report use.
 */
export function getSideQuests(task) {
  if (!Array.isArray(task?.sideQuests)) return []
  return task.sideQuests
    .slice(0, SIDE_QUEST_MAX)
    .map((quest, index) => {
      if (!quest || typeof quest !== 'object') return null
      const title = typeof quest.title === 'string' ? quest.title.trim() : ''
      if (!title) return null
      return {
        index,
        title,
        kind: SIDE_QUEST_KINDS.includes(quest.kind) ? quest.kind : 'challenge',
        explainer: typeof quest.explainer === 'string' ? quest.explainer : '',
        starter: typeof quest.starter === 'string' ? quest.starter : '',
      }
    })
    .filter(Boolean)
}

/**
 * Validation for `sideQuests` on one task (lessonValidation.js). Errors for a malformed list;
 * a warning (the side-quests are ignored) on a module that can't run them yet or a task that
 * isn't a code task.
 */
export function validateSideQuests(task, { n, moduleType, isCodeTask }, errors, warnings) {
  if (task?.sideQuests == null) return
  const quests = task.sideQuests
  if (!Array.isArray(quests)) {
    errors.push(`Task ${n} sideQuests must be a list`)
    return
  }
  if (quests.length > SIDE_QUEST_MAX) {
    errors.push(`Task ${n} sideQuests can have at most ${SIDE_QUEST_MAX} side-quests`)
  }
  quests.forEach((quest, i) => {
    const label = `Task ${n} side-quest ${i + 1}`
    if (!quest || typeof quest !== 'object' || Array.isArray(quest)) {
      errors.push(`${label} must be an object with a title`)
      return
    }
    const title = typeof quest.title === 'string' ? quest.title.trim() : ''
    if (!title) errors.push(`${label} needs a title`)
    else if (title.length > SIDE_QUEST_TITLE_MAX) {
      errors.push(`${label} title must be ${SIDE_QUEST_TITLE_MAX} characters or fewer`)
    }
    if (quest.kind != null && !SIDE_QUEST_KINDS.includes(quest.kind)) {
      errors.push(`${label} kind must be one of: ${SIDE_QUEST_KINDS.join(', ')}`)
    }
    for (const field of ['explainer', 'starter']) {
      if (quest[field] != null && typeof quest[field] !== 'string') {
        errors.push(`${label} ${field} must be text`)
      }
    }
    const extra = Object.keys(quest).filter(
      (key) => !['title', 'kind', 'explainer', 'starter'].includes(key)
    )
    if (extra.length > 0) {
      warnings.push(`${label} has unknown fields (${extra.join(', ')}); they are ignored`)
    }
  })
  if (!isCodeTask) {
    warnings.push(`Task ${n} sideQuests only work on code tasks; they are ignored here`)
  } else if (!supportsSideQuests(moduleType)) {
    warnings.push(
      `Task ${n} sideQuests are not supported on ${moduleType ?? 'this'} tasks yet (only ${SIDE_QUEST_MODULES.join(', ')}); they are ignored`
    )
  }
}

/**
 * The throwaway task a side-quest runs as: the module's starter shape filled from the side-quest's
 * `starter`, its explainer as the instructions, and nothing else (no check, tests, copy code,
 * stages to reveal or carry-through).
 */
export function buildSideQuestTask(task, quest, moduleType) {
  const base = {
    id: SIDE_QUEST_TASK_ID,
    title: `${sideQuestKindMeta(quest.kind).icon} ${quest.title}`,
    explainer: quest.explainer ?? '',
    ...(task?.moduleType ? { moduleType: task.moduleType } : {}),
    ...(task?.showBlocks === false ? { showBlocks: false } : {}),
  }
  if (sideQuestUsesFiles(moduleType)) {
    const files = [{ name: HTML_ENTRY_FILE, type: 'html', content: quest.starter ?? '' }]
    return {
      ...base,
      starterFiles: files,
      entryFile: HTML_ENTRY_FILE,
      codeStages: [
        {
          label: 'Starter',
          role: 'starter',
          files: files.map((f) => ({ ...f })),
          entryFile: HTML_ENTRY_FILE,
        },
      ],
    }
  }
  const code = quest.starter ?? ''
  return {
    ...base,
    starterCode: code,
    codeStages: [{ label: 'Starter', role: 'starter', code }],
  }
}

/**
 * Whether a student may see the side-quests of the task on screen right now: the task has some
 * on a supported module, the student has passed it, and they are on it — in a live lesson the
 * class is still on it (not looking back at an earlier task), or solo. Never in the teacher's
 * presentation window, the session sandbox or the personal sandbox.
 */
export function canShowSideQuests({
  quests,
  moduleType,
  phase,
  checkPassed,
  isViewingPrev = false,
  inPersonalSandbox = false,
  teacherPresentation = false,
}) {
  if (!Array.isArray(quests) || quests.length === 0) return false
  if (!supportsSideQuests(moduleType)) return false
  if (teacherPresentation || inPersonalSandbox || !checkPassed) return false
  if (phase === 'lesson') return !isViewingPrev
  return phase === 'solo'
}

// ─── Saved work (localStorage record) ────────────────────────────────────────

/** The localStorage record for a side-quest's current work (see the header comment). */
export function sideQuestRecord(moduleType, { code, files, activeFile } = {}) {
  if (sideQuestUsesFiles(moduleType)) {
    return {
      files: (files ?? []).map((file) => ({ name: file.name, content: file.content ?? '' })),
      activeFile: activeFile ?? '',
    }
  }
  return { code: code ?? '' }
}

/**
 * A saved record as a share-style snapshot (`{ code }` or `{ files: { name: content } }`), the
 * shape seedSharedWorkspace writes into the throwaway workspace's store. Null when there is no
 * usable record.
 */
export function sideQuestRecordToSnapshot(moduleType, record) {
  if (!record || typeof record !== 'object') return null
  if (sideQuestUsesFiles(moduleType)) {
    if (!Array.isArray(record.files) || record.files.length === 0) return null
    return {
      files: Object.fromEntries(
        record.files
          .filter((file) => file && typeof file.name === 'string' && file.name)
          .map((file) => [file.name, String(file.content ?? '')])
      ),
      activeFile: record.activeFile ?? '',
    }
  }
  if (typeof record.code !== 'string') return null
  return { code: record.code }
}

// ─── Live log ────────────────────────────────────────────────────────────────

const count = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0)

/** A run counter transaction step: the stored count plus one. */
export function bumpSideQuestCount(current) {
  return count(current) + 1
}

/** One student's log for one task as { [index]: entry }, from `sideQuestLog/{id}/{taskId}`. */
function taskLogEntries(taskLog) {
  if (!taskLog || typeof taskLog !== 'object') return []
  // Firebase may hand a small numeric-keyed object back as an array.
  return Object.entries(taskLog).filter(([, entry]) => entry && typeof entry === 'object')
}

/**
 * The teacher card's side-quest status for one student on the class's current task:
 * `{ open: n | null (0-based), total, done }`, or null when the task has no side-quests and the
 * student has none open.
 */
export function sideQuestStatus({ student, session, task }) {
  const total = getSideQuests(task).length
  const rawOpen = student?.sideQuestOpen
  const open =
    Number.isInteger(rawOpen) && rawOpen >= 0 && rawOpen < SIDE_QUEST_MAX ? rawOpen : null
  const taskLog =
    task && student?.anonymousId ? session?.sideQuestLog?.[student.anonymousId]?.[task.id] : null
  const done = taskLogEntries(taskLog).filter(([, entry]) => entry.done === true).length
  if (total === 0 && open == null) return null
  return { open, total, done }
}

/**
 * The session report's `sideQuests` for one student on one task: one entry per side-quest they
 * opened, by index. Times are ms; `done` is self-reported, never checked.
 */
export function buildSideQuestReport(taskLog, quests = []) {
  return taskLogEntries(taskLog)
    .map(([key, entry]) => {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0) return null
      const quest = quests.find((q) => q.index === index)
      return {
        index,
        ...(quest ? { title: quest.title, kind: quest.kind } : {}),
        openedAt: Number.isFinite(Number(entry.openedAt)) ? Number(entry.openedAt) : null,
        runs: count(entry.runs),
        errorRuns: count(entry.errorRuns),
        done: entry.done === true,
        doneAt:
          entry.done === true && Number.isFinite(Number(entry.doneAt))
            ? Number(entry.doneAt)
            : null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
}
