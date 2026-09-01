import { validateTopicProposals } from '../src/shared/topicAudit.js'
import { checkAllowedForSubmit, checkRequiresRun, evaluateSingleCheck } from '../src/modules/checks.js'
import { makeForkLessonId } from '../src/shared/lessonForks.js'
import { isValidTaskPriority, TASK_PRIORITIES, isValidStageRole, STAGE_ROLES, getStarterStage } from '../src/shared/taskUtils.js'
import { validateDraftLessonStructure } from '../src/shared/draftLesson.js'
import { getModuleCarrySourceIds, getTaskModuleType, validateComposedStructure } from '../src/shared/composedLesson.js'
import { validateFilesystemChecks, validateElectronicsChecks } from '../src/shared/checkAuthoringValidation.js'

const VALID_TYPES = ['python', 'arcade', 'html', 'scratch', 'filesystem', 'electronics', 'composed']

function flattenTasks(tasks) {
  const result = []
  for (const item of tasks) {
    if (item.type === 'group') {
      for (const sub of (Array.isArray(item.subtasks) ? item.subtasks : [])) result.push(sub)
    } else {
      result.push(item)
    }
  }
  return result
}

function normalizeChecks(check) {
  if (!check) return []
  return Array.isArray(check) ? check : [check]
}

function validateStageMetadata(task, n, errors) {
  if (!Array.isArray(task.codeStages)) return
  task.codeStages.forEach((stage, si) => {
    if (stage?.role != null && !isValidStageRole(stage.role)) {
      errors.push(`Task ${n} stage ${si + 1} role must be one of: ${STAGE_ROLES.join(', ')}`)
    }
  })
}

export function validateLessonForMcp(lesson) {
  const errors = []
  const warnings = []

  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    return { valid: false, errors: ['lesson must be a JSON object'], warnings: [] }
  }

  const { id, type, title, description, tasks } = lesson
  errors.push(...validateTopicProposals(lesson.topicProposals))

  if (!id || !String(id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9-]+$/.test(id)) errors.push('id must be a lowercase slug (letters, digits, hyphens only)')

  if (!type) errors.push('type is required')
  else if (!VALID_TYPES.includes(type)) errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`)

  if (!title || !String(title).trim()) errors.push('title is required')
  if (!description || !String(description).trim()) errors.push('description is required')
  if (lesson.fork != null) validateLessonFork(lesson, errors)

  if (!tasks || !Array.isArray(tasks)) {
    errors.push('tasks is required and must be an array')
    return { valid: false, errors, warnings }
  }
  validateDraftLessonStructure(lesson, errors)
  errors.push(...validateComposedStructure(lesson))
  if (tasks.length === 0) errors.push('tasks must contain at least one task or group')

  tasks.forEach((item, i) => {
    if (item.type === 'group') {
      if (!item.title) errors.push(`Group ${i + 1} is missing a title`)
      if (!item.subtasks || item.subtasks.length === 0) {
        errors.push(`Group "${item.title || (i + 1)}" has no subtasks`)
      }
    }
  })

  const flat = flattenTasks(tasks)
  flat.forEach((task, i) => {
    const n = i + 1

    if (!task || typeof task !== 'object' || Array.isArray(task)) return
    const taskType = getTaskModuleType(lesson, task) ?? type
    const allowedCarrySources = getModuleCarrySourceIds(lesson, task)
    for (const field of ['carryCodeFrom', 'carryBlocksFrom', 'carryFsFrom', 'carryCircuitFrom']) {
      if (task[field] != null && allowedCarrySources && !allowedCarrySources.includes(task[field])) {
        errors.push(`Task ${n} ${field} must reference an earlier task in the same lesson module`)
      }
    }

    if (!task.title) errors.push(`Task ${n} is missing a title`)

    if (task.estimatedMinutes != null && (!Number.isFinite(Number(task.estimatedMinutes)) || Number(task.estimatedMinutes) <= 0)) {
      errors.push(`Task ${n} estimated time must be a positive number of minutes`)
    }
    if (task.priority != null && !isValidTaskPriority(task.priority)) {
      errors.push(`Task ${n} priority must be one of: ${TASK_PRIORITIES.join(', ')}`)
    }
    // Drafts deliberately allow missing task-specific authoring fields, but
    // still pass the schema/type checks above so Builder can load them safely.
    if (lesson.draft === true) return
    if (task.taskType !== 'information' && task.taskType !== 'quiz') {
      validateStageMetadata(task, n, errors)
    }


    if (task.taskType === 'information' && task.informationType !== 'introduction' && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }

    if (task.taskType === 'quiz') {
      const quizType = task.quizType ?? 'multiple_choice'
      if (quizType === 'multiple_choice') {
        if (!task.options || task.options.length < 2) errors.push(`Task ${n} is a quiz but has fewer than 2 options`)
        if (task.options?.some(o => !o.text?.trim())) errors.push(`Task ${n} is a quiz but has an empty option text`)
        if (task.check?.type !== 'answer_equals' || !task.check.value) errors.push(`Task ${n} is a quiz but no correct answer has been selected`)
      } else if (quizType === 'match') {
        if (!task.pairs || task.pairs.length < 2) errors.push(`Task ${n} is a match quiz but has fewer than 2 pairs`)
        if (task.pairs?.some(p => !p.prompt?.trim() || !p.answer?.trim())) errors.push(`Task ${n} is a match quiz but has an empty prompt or answer`)
      } else if (quizType === 'fill_blank') {
        if (!task.text?.includes('___')) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blanks in the text`)
        if (!task.blanks || task.blanks.length === 0) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blank answers`)
        if (task.blanks?.some(b => !b.answer?.trim())) errors.push(`Task ${n} is a fill-in-the-blank quiz but has an empty answer`)
      } else if (quizType === 'short_answer') {
        if (task.check != null && (!task.check.type?.startsWith('answer_') || !task.check.value?.trim())) {
          errors.push(`Task ${n} is a short-answer quiz with a check enabled but no check value`)
        }
      }
    } else if (task.taskType === 'code_arrange') {
      if (!['python', 'html'].includes(taskType)) {
        errors.push(`Task ${n} is a code-arrange task but must use the Python or HTML module`)
      }
      const lines = Array.isArray(task.lines) ? task.lines : []
      if (lines.length === 0) errors.push(`Task ${n} is a code-arrange task but has no lines`)
      const lineIds = []
      const poolIds = []
      let slotCount = 0
      lines.forEach((line, li) => {
        const ln = li + 1
        if (!line?.id) errors.push(`Task ${n} line ${ln} has no id`)
        else lineIds.push(line.id)
        const parts = Array.isArray(line?.parts) ? line.parts : []
        if (parts.length === 0) errors.push(`Task ${n} line ${ln} has no parts`)
        parts.forEach((part, pi) => {
          const pn = pi + 1
          if (part?.type === 'slot') {
            slotCount++
            if (!part.id) errors.push(`Task ${n} line ${ln} blank ${pn} has no id`)
            else poolIds.push(part.id)
            if (!part.code?.trim()) errors.push(`Task ${n} line ${ln} blank ${pn} has no correct value`)
          } else if (part?.type !== 'text') {
            errors.push(`Task ${n} line ${ln} part ${pn} has an invalid type`)
          }
        })
      })
      if (lines.length > 0 && slotCount === 0) errors.push(`Task ${n} is a code-arrange task but has no blanks`)
      if (new Set(lineIds).size !== lineIds.length) errors.push(`Task ${n} is a code-arrange task but has duplicate line ids`)
      const distractors = Array.isArray(task.distractors) ? task.distractors : []
      distractors.forEach((d, di) => {
        if (!d?.id) errors.push(`Task ${n} distractor ${di + 1} has no id`)
        else poolIds.push(d.id)
        if (!d?.code?.trim()) errors.push(`Task ${n} distractor ${di + 1} has no code`)
      })
      if (new Set(poolIds).size !== poolIds.length) errors.push(`Task ${n} is a code-arrange task but has duplicate blank/distractor ids`)
      if (!task.check) errors.push(`Task ${n} is a code-arrange task but has no completion check`)
      if (taskType === 'html') {
        if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
        else {
          const names = task.starterFiles.map(f => f.name)
          if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
          if (!task.starterFiles.some(f => f.type === 'html' || f.name?.endsWith('.html'))) {
            errors.push(`Task ${n} has no HTML file to use as entry point`)
          }
        }
      }
    } else if (task.taskType !== 'information' && taskType === 'html') {
      if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
      else {
        const names = task.starterFiles.map(f => f.name)
        if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
        if (!task.starterFiles.some(f => f.type === 'html' || f.name?.endsWith('.html'))) {
          errors.push(`Task ${n} has no HTML file to use as entry point`)
        }
      }
    } else if (task.taskType !== 'information' && taskType === 'filesystem') {
      if (task.codeStages?.length > 0) {
        task.codeStages.forEach((stage, si) => {
          if (!stage.label?.trim()) errors.push(`Task ${n} stage ${si + 1} is missing a label`)
          if (!stage.fs || typeof stage.fs !== 'object') errors.push(`Task ${n} stage ${si + 1} has no filesystem state`)
        })
      }
      if (task.check) validateFilesystemChecks(task.check, n, errors)
    } else if (task.taskType !== 'information' && taskType === 'electronics') {
      const starterCircuit = getStarterStage(task)?.stage?.circuit ?? task.starterCircuit
      if (!starterCircuit || !Array.isArray(starterCircuit.components)) {
        errors.push(`Task ${n} has no starter breadboard`)
      }
      if (task.codeStages?.length > 0) {
        task.codeStages.forEach((stage, si) => {
          if (!stage.label?.trim()) errors.push(`Task ${n} stage ${si + 1} is missing a label`)
        })
      }
      if (task.check) validateElectronicsChecks(task.check, n, errors)
    } else if (task.taskType !== 'information' && task.taskType !== 'quiz' && taskType === 'scratch') {
      if (task.check?.type === 'sprite_property') {
        if (!task.check.property) errors.push(`Task ${n} sprite check is missing a property`)
        if (!task.check.operator) errors.push(`Task ${n} sprite check is missing an operator`)
        if (task.check.value == null || task.check.value === '') errors.push(`Task ${n} sprite check is missing a value`)
      }
      if (task.check?.type === 'block_used' && !task.check.opcode) {
        errors.push(`Task ${n} block-used check is missing a block opcode`)
      }
    }

    if (!task.taskType) {
      const hasStarter = taskType === 'python' || taskType === 'arcade' ? !!task.starterCode
        : taskType === 'scratch' ? !!task.starterBlocks
        : taskType === 'filesystem' ? !!task.starterFs
        : taskType === 'electronics' ? !!task.starterCircuit
        : task.starterFiles?.some(f => f.content?.trim())
      if (!hasStarter && taskType !== 'filesystem' && taskType !== 'electronics') {
        warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
      }
    }

    if (task.taskType !== 'information' && task.taskType !== 'quiz' && task.check) {
      const allChecks = normalizeChecks(task.check)
      if ((taskType === 'python' || taskType === 'arcade') && task.completeCode != null) {
        const staticChecks = allChecks.filter(c => checkAllowedForSubmit(c))
        const dynamicChecks = allChecks.filter(c => checkRequiresRun(c))
        if (staticChecks.length > 0 && staticChecks.some(c => !evaluateSingleCheck(c, '', { code: task.completeCode }))) {
          warnings.push(`Task ${n} complete solution fails a code check — review the complete code`)
        }
        if (dynamicChecks.length > 0 && !task._checkTested) {
          warnings.push(`Task ${n} has output checks — open the Complete tab and run to verify the complete solution`)
        }
      }
      if (taskType === 'html' && task.completeFiles?.length > 0) {
        const staticChecks = allChecks.filter(c => checkAllowedForSubmit(c))
        const dynamicChecks = allChecks.filter(c => checkRequiresRun(c))
        if (staticChecks.length > 0) {
          const codeStr = task.completeFiles.map(f => f.content ?? '').join('\n')
          if (staticChecks.some(c => !evaluateSingleCheck(c, '', { code: codeStr }))) {
            warnings.push(`Task ${n} complete solution fails a code check — review the complete files`)
          }
        }
        if (dynamicChecks.length > 0 && !task._checkTested) {
          warnings.push(`Task ${n} has element/output checks — open the Complete tab and run to verify the complete solution`)
        }
      }
      if (taskType === 'filesystem' && task.completeFs && typeof task.completeFs === 'object') {
        const fsChecks = allChecks.filter(c => c.type?.startsWith('fs_') && c.type !== 'fs_dir_opened' && c.type !== 'fs_file_opened')
        if (fsChecks.length > 0 && fsChecks.some(c => !evaluateSingleCheck(c, '', { fs: task.completeFs }))) {
          warnings.push(`Task ${n} complete filesystem does not satisfy a check — review the complete filesystem`)
        }
      }
    }
  })

  return { valid: errors.length === 0, errors, warnings }
}

function validateLessonFork(lesson, errors) {
  const fork = lesson.fork
  if (!fork || typeof fork !== 'object' || Array.isArray(fork)) {
    errors.push('fork must be an object when provided')
    return
  }
  if (!fork.sourceLessonId || !String(fork.sourceLessonId).trim()) {
    errors.push('fork.sourceLessonId is required')
  }
  if (!fork.classId || !String(fork.classId).trim()) {
    errors.push('fork.classId is required')
  }
  if (fork.sourceLessonId && fork.classId) {
    const expectedId = makeForkLessonId(fork.sourceLessonId, fork.classId)
    if (lesson.id !== expectedId) errors.push(`forked lesson id must be '${expectedId}'`)
  }
  if (fork.taskLinks != null && !Array.isArray(fork.taskLinks)) {
    errors.push('fork.taskLinks must be an array when provided')
  }
}
