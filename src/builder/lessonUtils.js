import { checkAllowedForSubmit, checkRequiresRun, evaluateSingleCheck, normalizeChecks } from '../modules/checks'
import { flattenTasks } from '../shared/taskUtils'
import { validateTopicProposals } from '../shared/topicAudit'

const SCRATCH_STARTER_SPRITE_STATE_FIELDS = ['x', 'y', 'size', 'direction', 'visible', 'rotationStyle', 'costume']

export function copyScratchSpriteStateToStarters(sprites, spriteStates) {
  return sprites.map(sprite => {
    const state = spriteStates?.[sprite.id]
    if (!state) return { ...sprite }

    const next = { ...sprite }
    for (const field of SCRATCH_STARTER_SPRITE_STATE_FIELDS) {
      if (state[field] !== undefined) next[field] = state[field]
    }
    return next
  })
}

export function copyStarterToComplete(task, lessonType) {
  if (lessonType === 'python') {
    return { completeCode: task.starterCode ?? '' }
  }
  if (lessonType === 'html') {
    return {
      completeFiles: (task.starterFiles ?? []).map(file => ({ ...file })),
      completeEntryFile: task.entryFile ?? 'index.html',
    }
  }
  return {}
}

export function validateLesson(lesson) {
  const errors = []
  const warnings = []
  const { id, title, type, tasks } = lesson
  errors.push(...validateTopicProposals(lesson.topicProposals))

  if (!id) errors.push('Lesson ID is required')
  else if (!/^[a-z0-9-]+$/.test(id)) errors.push('Lesson ID must be lowercase with hyphens only')
  if (!title) errors.push('Lesson title is required')
  if (!tasks || tasks.length === 0) errors.push('Lesson must have at least one task')

  tasks.forEach((item, i) => {
    if (item.type === 'group') {
      if (!item.title) errors.push(`Group ${i + 1} is missing a title`)
      if (!item.subtasks || item.subtasks.length === 0) {
        errors.push(`Group "${item.title || (i + 1)}" has no subtasks — add at least one subtask`)
      }
    }
  })

  const flat = flattenTasks(tasks)
  flat.forEach((task, i) => {
    const n = i + 1
    if (!task.title) errors.push(`Task ${n} is missing a title`)
    if (task.estimatedMinutes != null && (!Number.isInteger(Number(task.estimatedMinutes)) || Number(task.estimatedMinutes) <= 0)) {
      errors.push(`Task ${n} estimated time must be a positive whole number of minutes`)
    }
    if (task.taskType === 'draft') {
      warnings.push(`Task ${n} "${task.title || 'Untitled'}" is a draft — convert it to a real task type before publishing`)
      return
    }
    if (task.taskType === 'information' && task.informationType !== 'introduction' && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }

    if (task.taskType === 'quiz') {
      const quizType = task.quizType ?? 'multiple_choice'
      if (quizType === 'multiple_choice') {
        if (!task.options || task.options.length < 2) errors.push(`Task ${n} is a quiz but has fewer than 2 options.`)
        if (task.options?.some(option => !option.text?.trim())) errors.push(`Task ${n} is a quiz but has an empty option text field.`)
        if (task.check?.type !== 'answer_equals' || !task.check.value) errors.push(`Task ${n} is a quiz but no correct answer has been selected.`)
      } else if (quizType === 'match') {
        if (!task.pairs || task.pairs.length < 2) errors.push(`Task ${n} is a match quiz but has fewer than 2 pairs.`)
        if (task.pairs?.some(pair => !pair.prompt?.trim() || !pair.answer?.trim())) errors.push(`Task ${n} is a match quiz but has an empty prompt or answer.`)
      } else if (quizType === 'fill_blank') {
        if (!task.text?.includes('___')) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blanks in the text.`)
        if (!task.blanks || task.blanks.length === 0) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blank answers.`)
        if (task.blanks?.some(blank => !blank.answer?.trim())) errors.push(`Task ${n} is a fill-in-the-blank quiz but has an empty answer.`)
      } else if (quizType === 'short_answer') {
        if (task.check != null && (!task.check.type?.startsWith('answer_') || !task.check.value?.trim())) {
          errors.push(`Task ${n} is a short-answer quiz with a check enabled but no check value.`)
        }
      }
    } else if (task.taskType !== 'information' && type === 'filesystem') {
      if (task.codeStages?.length > 0) {
        task.codeStages.forEach((stage, si) => {
          if (!stage.label?.trim()) errors.push(`Task ${n} stage ${si + 1} is missing a label`)
          if (!stage.fs || typeof stage.fs !== 'object') errors.push(`Task ${n} stage ${si + 1} has no filesystem state`)
        })
      }
      if (task.check) {
        const checks = normalizeChecks(task.check)
        if (checks.some(c => c.type?.startsWith('fs_') && !c.path?.trim())) {
          errors.push(`Task ${n} has a filesystem check but no path`)
        }
        if (checks.some(c => c.type === 'fs_content_contains' && !c.value?.trim())) {
          errors.push(`Task ${n} has a file content check but no expected value`)
        }
        if (checks.some(c => c.type === 'fs_content_equals' && !c.value?.trim())) {
          errors.push(`Task ${n} has a file equals check but no expected value`)
        }
        if (checks.some(c => c.type === 'fs_file_in_dir' && !c.dir?.trim())) {
          errors.push(`Task ${n} has a file-in-dir check but no parent folder`)
        }
      }
      const carryFsFrom = task.carryFsFrom ?? null
      if (carryFsFrom != null && !flat.some(t => t.id === carryFsFrom)) {
        errors.push(`Task ${n} references task ${carryFsFrom} for carry-through but that task does not exist`)
      }
    } else if (task.taskType !== 'information' && type === 'html') {
      if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
      else {
        const names = task.starterFiles.map(file => file.name)
        if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
        if (!task.starterFiles.some(file => file.type === 'html' || file.name.endsWith('.html'))) {
          errors.push(`Task ${n} has no HTML file to use as entry point`)
        }
      }
    }

    if (task.taskType !== 'information' && task.taskType !== 'quiz') {
      if (type === 'scratch') {
        if (task.toolbox) {
          try {
            const parsed = new DOMParser().parseFromString(task.toolbox, 'text/xml')
            if (parsed.querySelector('parsererror')) errors.push(`Task ${n} has invalid toolbox XML`)
          } catch {
            errors.push(`Task ${n} has invalid toolbox XML`)
          }
        }
        if (task.check?.type === 'sprite_property') {
          if (!task.check.property) errors.push(`Task ${n} sprite check is missing a property`)
          if (!task.check.operator) errors.push(`Task ${n} sprite check is missing an operator`)
          if (task.check.value == null || task.check.value === '') errors.push(`Task ${n} sprite check is missing a value`)
        }
        if (task.check?.type === 'block_used' && !task.check.opcode) {
          errors.push(`Task ${n} block-used check is missing a block opcode`)
        }
      } else if (task.check && type !== 'filesystem') {
        const checks = normalizeChecks(task.check)
        if (task.interactionMode === 'submit' && checks.some(check => !checkAllowedForSubmit(check))) {
          errors.push(`Task ${n} uses submit mode but has a check that requires running the code`)
        }
        if (checks.some(check => check.type?.startsWith('element_') && !check.selector?.trim())) {
          errors.push(`Task ${n} has an element check but no CSS selector`)
        }
        if (checks.some(check => check.type === 'element_attribute' && !check.attribute?.trim())) {
          errors.push(`Task ${n} has an element attribute check but no attribute name`)
        }
        if (checks.some(check => check.type === 'element_style_property' && !check.property?.trim())) {
          errors.push(`Task ${n} has an element style check but no CSS property`)
        }
        if (checks.some(check => check.type?.startsWith('variable_') && !check.name?.trim())) {
          errors.push(`Task ${n} has a variable check but no variable name`)
        }
        if (checks.some(check => check.type === 'variable_dict_key_value' && !check.key?.trim())) {
          errors.push(`Task ${n} has a dictionary key-value check but no key`)
        }
        if (checks.some(check => check.type === 'variable_array_nth_item' && (check.index == null || check.index === '' || Number(check.index) < 0))) {
          errors.push(`Task ${n} has an array N-th item check but no valid index`)
        }
        if (checks.some(check => !['code_no_error', 'output_not_empty', 'output_empty', 'element_exists', 'element_attribute', 'element_style_property', 'variable_exists'].includes(check.type) && !check.value && check.value !== 0)) {
          errors.push(`Task ${n} has a check enabled but no check value`)
        }
      }
    }

    if (task.tests?.length > 0 && type === 'python' && task.taskType !== 'information' && task.taskType !== 'quiz') {
      task.tests.forEach((test, ti) => {
        const tn = ti + 1
        if (!test.inputs?.length) {
          warnings.push(`Task ${n} test ${tn} has no inputs — consider adding at least one input`)
        } else if (test.inputs.some(inp => !inp.name?.trim())) {
          warnings.push(`Task ${n} test ${tn} has an input with no name — it can still run, but {placeholder} substitution won't work`)
        }
        if (!test.check) {
          errors.push(`Task ${n} test ${tn} has no check — add an output check for this test case`)
        }
      })
    }

    const carryFrom = task.taskType === 'quiz' || task.taskType === 'information' || type === 'filesystem'
      ? null
      : type === 'scratch' ? task.carryBlocksFrom : task.carryCodeFrom
    if (carryFrom != null && !flat.some(candidate => candidate.id === carryFrom)) {
      errors.push(`Task ${n} references task ${carryFrom} for carry-through but that task does not exist`)
    }

    const hasStarter = task.taskType === 'information'
      ? true
      : task.taskType === 'quiz'
        ? quizHasStarter(task)
        : type === 'python'
          ? !!task.starterCode
          : type === 'scratch'
            ? !!task.starterBlocks
            : type === 'filesystem'
              ? !!task.starterFs
              : task.starterFiles?.some(file => file.content.trim())
    if (!hasStarter && type !== 'filesystem') warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)

    if (task.taskType !== 'information' && task.taskType !== 'quiz' && task.check) {
      const allChecks = normalizeChecks(task.check)
      if (type === 'python' && task.completeCode != null) {
        const staticChecks = allChecks.filter(c => checkAllowedForSubmit(c))
        const dynamicChecks = allChecks.filter(c => checkRequiresRun(c))
        if (staticChecks.length > 0 && staticChecks.some(c => !evaluateSingleCheck(c, '', { code: task.completeCode }))) {
          warnings.push(`Task ${n} complete solution fails a code check — review the complete code`)
        }
        if (dynamicChecks.length > 0 && !task._checkTested) {
          warnings.push(`Task ${n} has output checks — open the Complete tab and run to verify the complete solution`)
        }
      }
      if (type === 'html' && task.completeFiles?.length > 0) {
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
      if (type === 'filesystem' && task.completeFs && typeof task.completeFs === 'object') {
        const fsChecks = allChecks.filter(c => c.type?.startsWith('fs_') && c.type !== 'fs_dir_opened' && c.type !== 'fs_file_opened')
        if (fsChecks.length > 0 && fsChecks.some(c => !evaluateSingleCheck(c, '', { fs: task.completeFs }))) {
          warnings.push(`Task ${n} complete filesystem does not satisfy a check — review the complete filesystem`)
        }
      }
    }

    const checkHasValue = task.taskType === 'information'
      ? false
      : task.taskType === 'quiz'
        ? quizHasCheckValue(task)
        : type === 'scratch'
          ? !!task.check
          : type === 'filesystem'
            ? !!task.check
            : normalizeChecks(task.check).some(check => ['code_no_error', 'output_not_empty', 'output_empty', 'element_exists', 'element_attribute', 'element_style_property', 'variable_exists'].includes(check.type) || check.value)
    if (checkHasValue && !task._checkTested) {
      warnings.push(`Task ${n} has a completion check that hasn't been tested — run the task to verify it`)
    }
  })

  return { errors, warnings }
}

export function quizHasStarter(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'multiple_choice') return task.options?.some(option => option.text?.trim())
  if (quizType === 'match') return task.pairs?.some(pair => pair.prompt?.trim() || pair.answer?.trim())
  if (quizType === 'fill_blank') return !!task.text?.trim() || task.blanks?.some(blank => blank.answer?.trim())
  if (quizType === 'short_answer') return !!task.explainer?.trim()
  if (quizType === 'confidence') return !!task.explainer?.trim()
  return false
}

export function quizHasCheckValue(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'match') return task.pairs?.length > 0 && task.pairs.every(pair => pair.prompt?.trim() && pair.answer?.trim())
  if (quizType === 'fill_blank') return task.blanks?.length > 0 && task.blanks.every(blank => blank.answer?.trim())
  if (quizType === 'confidence') return true
  return !!task.check?.value
}

export function normalizeTasksForExport(tasks, { preserveIds = false } = {}) {
  let counter = 0
  const idMap = {}
  function assignIds(items) {
    for (const item of items) {
      if (item.type === 'group') assignIds(item.subtasks ?? [])
      else idMap[item.id] = preserveIds ? item.id : ++counter
    }
  }
  assignIds(tasks)

  function normalizeCheckForExport(check) {
    const next = { ...check }
    if (next.hint != null) {
      const hint = String(next.hint).trim()
      if (hint) next.hint = hint
      else delete next.hint
    }
    return next
  }

  function normalizeTask(task) {
    if (task.taskType === 'information') {
      const exported = {
        id: idMap[task.id],
        taskType: 'information',
        title: task.title,
        explainer: task.explainer ?? '',
      }
      if (task.estimatedMinutes != null) exported.estimatedMinutes = task.estimatedMinutes
      if ((task.informationType ?? 'standard') !== 'standard') exported.informationType = task.informationType
      if (task.leftContent) exported.leftContent = task.leftContent
      if (task.taskMode && task.taskMode !== 'both') exported.taskMode = task.taskMode
      return exported
    }

    const { _checkTested, _customTitle, hints: _hints, ...rest } = task
    const exported = { ...rest, id: idMap[task.id] }
    if (preserveIds && _customTitle) exported._customTitle = _customTitle
    if (exported.taskMode === 'both') delete exported.taskMode
    if (exported.carryCodeFrom != null) exported.carryCodeFrom = idMap[exported.carryCodeFrom] ?? exported.carryCodeFrom
    if (exported.carryBlocksFrom != null) exported.carryBlocksFrom = idMap[exported.carryBlocksFrom] ?? exported.carryBlocksFrom
    if (exported.carryFsFrom != null) exported.carryFsFrom = idMap[exported.carryFsFrom] ?? exported.carryFsFrom
    if (Array.isArray(exported.check)) exported.check = exported.check.map(normalizeCheckForExport)
    else if (exported.check) exported.check = normalizeCheckForExport(exported.check)
    if (Array.isArray(exported.options)) {
      exported.options = exported.options.map(option => {
        const next = { ...option }
        if (next.feedback != null) {
          const feedback = String(next.feedback).trim()
          if (feedback) next.feedback = feedback
          else delete next.feedback
        }
        return next
      })
    }
    return exported
  }

  return tasks.map(item => item.type === 'group'
    ? { id: item.id, type: 'group', title: item.title, subtasks: (item.subtasks ?? []).map(normalizeTask) }
    : normalizeTask(item))
}
