import { checkAllowedForSubmit, checkRequiresRun, evaluateSingleCheck, normalizeChecks, normalizeFeedbackChecks } from '../modules/checks'
import { flattenTasks, isValidTaskPriority, TASK_PRIORITIES, isValidStageRole, STAGE_ROLES, getStarterStage } from '../shared/taskUtils'
import { validateTopicProposals } from '../shared/topicAudit'
import { makeForkLessonId } from '../shared/lessonForks'
import { DEFAULT_CIRCUIT, cloneCircuit, ELECTRONICS_CHECK_TYPES } from '../modules/electronics/circuit'
import { normalizeFsCheck } from '../modules/filesystem/checks'
import { normalizeHtmlCheck } from '../modules/html/checks'
import { normalizeSequenceItem } from '../modules/scratch/checks'
import { validateDraftLessonStructure } from '../shared/draftLesson'
import { getModuleCarrySourceIds, getTaskModuleType, validateComposedStructure } from '../shared/composedLesson'

const SCRATCH_STARTER_SPRITE_STATE_FIELDS = ['x', 'y', 'size', 'direction', 'visible', 'rotationStyle', 'costume']
const TASK_CARRY_FIELDS = ['carryCodeFrom', 'carryBlocksFrom', 'carryFsFrom', 'carryCircuitFrom']

function validateStageMetadata(task, n, errors) {
  if (!Array.isArray(task.codeStages)) return
  task.codeStages.forEach((stage, si) => {
    if (stage?.role != null && !isValidStageRole(stage.role)) {
      errors.push(`Task ${n} stage ${si + 1} role must be one of: ${STAGE_ROLES.join(', ')}`)
    }
  })
}

function hasCircuitSelectorTarget(selector) {
  return !!(
    selector?.type?.trim?.()
    || selector?.componentType?.trim?.()
    || selector?.typeName?.trim?.()
    || selector?.label?.trim?.()
    || selector?.id?.trim?.()
  )
}

function hasCircuitEndpointTarget(endpoint) {
  return hasCircuitSelectorTarget(endpoint?.component ?? endpoint) && !!endpoint?.pin?.trim?.()
}

function hasValue(value) {
  return value === 0 || value === false || String(value ?? '').trim() !== ''
}

function labelCheckKind(kind) {
  return kind === 'feedback' ? 'feedback check' : 'check'
}

function collectFeedbackChecks(task) {
  return normalizeFeedbackChecks(task)
}

function validateFeedbackBasics(task, n, errors, warnings) {
  if (task.feedbackChecks == null && task.incorrectChecks == null) return []
  const feedbackChecks = collectFeedbackChecks(task)
  if (feedbackChecks.length === 0) return feedbackChecks
  if (!task.check) errors.push(`Task ${n} has feedback checks but no completion check`)
  if (feedbackChecks.some(check => (check.mode ?? 'blocking') === 'blocking' && !String(check.hint ?? '').trim())) {
    warnings.push(`Task ${n} has a blocking feedback check with no hint`)
  }
  feedbackChecks.forEach((check, index) => {
    if (check.priority != null && (!Number.isInteger(Number(check.priority)) || Number(check.priority) <= 0)) {
      errors.push(`Task ${n} feedback check ${index + 1} priority must be a positive whole number`)
    }
    if (check.stageOffer == null) return
    const stageIndex = Number(check.stageOffer.stageIndex)
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= (task.codeStages?.length ?? 0)) {
      errors.push(`Task ${n} feedback check ${index + 1} references a code stage that does not exist`)
    }
    if (!['preview', 'replace'].includes(check.stageOffer.action)) {
      errors.push(`Task ${n} feedback check ${index + 1} stage offer action must be preview or replace`)
    }
    if (check.stageOffer.afterMatches != null && (!Number.isInteger(Number(check.stageOffer.afterMatches)) || Number(check.stageOffer.afterMatches) <= 0)) {
      errors.push(`Task ${n} feedback check ${index + 1} stage offer threshold must be a positive whole number`)
    }
  })
  return feedbackChecks
}

function validateFilesystemChecks(checks, n, errors, kind = 'completion') {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks).map(normalizeFsCheck)
  if (normalized.some(c => c.type?.startsWith('fs_') && !c.path?.trim())) {
    errors.push(`Task ${n} has a filesystem ${label} but no path`)
  }
  if (normalized.some(c => c.type === 'fs_file_content' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a file-content ${label} but no expected value`)
  }
  if (normalized.some(c => c.type === 'fs_file_line_count' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a file line-count ${label} but no expected count`)
  }
  if (normalized.some(c => c.type === 'fs_file_location' && !c.dir?.trim())) {
    errors.push(`Task ${n} has a file-location ${label} but no parent folder`)
  }
  if (normalized.some(c => c.type === 'fs_folder_count' && !hasValue(c.value))) {
    errors.push(`Task ${n} has a folder-count ${label} but no expected count`)
  }
}

function validateElectronicsChecks(checks, n, errors, kind = 'completion') {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks)
  if (normalized.some(c => c.type === 'circuit_has_component' && !hasCircuitSelectorTarget(c.component))) {
    errors.push(`Task ${n} has a part-exists ${label} but no part type or label`)
  }
  if (normalized.some(c => (c.type === 'circuit_component_powered' || c.type === 'circuit_component_unpowered') && !hasCircuitSelectorTarget(c.component))) {
    errors.push(`Task ${n} has a powered-part ${label} but no part type or label`)
  }
  if (normalized.some(c => c.type === 'circuit_control_affects_power' && (!hasCircuitSelectorTarget(c.control) || !hasCircuitSelectorTarget(c.component)))) {
    errors.push(`Task ${n} has a control ${label} but no control or controlled part`)
  }
  if (normalized.some(c => (c.type === 'circuit_path_exists' || c.type === 'circuit_path_includes') && (!hasCircuitEndpointTarget(c.from) || !hasCircuitEndpointTarget(c.to)))) {
    errors.push(`Task ${n} has a circuit connection ${label} but no source or destination part/pin`)
  }
  if (normalized.some(c => c.type === 'circuit_path_includes' && !hasCircuitSelectorTarget(c.includes))) {
    errors.push(`Task ${n} has a circuit connection-includes ${label} but no required part`)
  }
}

function validateScratchChecks(checks, n, errors, kind = 'completion') {
  const label = labelCheckKind(kind)
  for (const check of normalizeChecks(checks)) {
    if ((check.type === 'block_used' || check.type === 'block_run' || check.type === 'block_count') && !check.opcode) {
      errors.push(`Task ${n} has a Scratch ${label} but no block opcode`)
    }
    if (check.type === 'blocks_in_order') {
      if (!Array.isArray(check.sequence) || check.sequence.length === 0) {
        errors.push(`Task ${n} has a Scratch block-order ${label} but no block sequence`)
      } else if (check.sequence.some(item => !normalizeSequenceItem(item).opcode)) {
        errors.push(`Task ${n} has a Scratch block-order ${label} with an empty block opcode`)
      }
    }
    if ((check.type === 'sprite_property' || check.type === 'sprite_property_delta') && (!check.property || !check.operator || !hasValue(check.value))) {
      errors.push(`Task ${n} has a Scratch sprite-property ${label} with missing property, operator, or value`)
    }
    if (check.type === 'sprite_property_changed' && !check.property) {
      errors.push(`Task ${n} has a Scratch sprite-changed ${label} but no property`)
    }
    if ((check.type === 'variable_equals' || check.type === 'variable_compare') && !(check.variableName ?? check.name)?.trim?.()) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no variable name`)
    }
    if ((check.type === 'variable_equals' || check.type === 'variable_compare') && !hasValue(check.value)) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no expected value`)
    }
    if (check.type === 'variable_compare' && !check.operator) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no operator`)
    }
    if (check.type === 'costume_is' && !hasValue(check.value)) {
      errors.push(`Task ${n} has a Scratch costume ${label} but no costume name`)
    }
  }
}

function validateCodeChecks(checks, n, errors, { type, interactionMode, kind = 'completion' } = {}) {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks).map(normalizeHtmlCheck)
  if (interactionMode === 'submit' && normalized.some(check => !checkAllowedForSubmit(check))) {
    errors.push(`Task ${n} uses submit mode but has a ${label} that requires running the code`)
  }
  if (normalized.some(check => check.type?.startsWith('html_element') && !check.selector?.trim())) {
    errors.push(`Task ${n} has an element ${label} but no CSS selector`)
  }
  if (normalized.some(check => check.type === 'html_element_attribute' && !check.attribute?.trim())) {
    errors.push(`Task ${n} has an element attribute ${label} but no attribute name`)
  }
  if (normalized.some(check => check.type === 'html_element_style_property' && !check.property?.trim())) {
    errors.push(`Task ${n} has an element style ${label} but no CSS property`)
  }
  if (normalized.some(check => check.type?.startsWith('variable_') && !check.name?.trim())) {
    errors.push(`Task ${n} has a variable ${label} but no variable name`)
  }
  if (normalized.some(check => check.type === 'variable_dict_key_value' && !check.key?.trim())) {
    errors.push(`Task ${n} has a dictionary key-value ${label} but no key`)
  }
  if (normalized.some(check => check.type === 'variable_array_nth_item' && (check.index == null || check.index === '' || Number(check.index) < 0))) {
    errors.push(`Task ${n} has an array N-th item ${label} but no valid index`)
  }
  const noValueTypes = ['code_no_error', 'output_not_empty', 'output_empty', 'html_element', 'variable_exists']
  if (type === 'html') noValueTypes.push('html_element_attribute', 'html_element_style_property')
  if (normalized.some(check => !noValueTypes.includes(check.type) && !hasValue(check.value))) {
    errors.push(`Task ${n} has a ${label} enabled but no check value`)
  }
}

function describeTaskForWarning(task, index) {
  return `task ${index + 1}${task.title ? ` "${task.title}"` : ''}`
}

function warnDuplicateTaskIds(flat, warnings) {
  const firstById = new Map()
  flat.forEach((task, index) => {
    if (!task || typeof task !== 'object' || Array.isArray(task) || task.id == null || task.id === '') return
    const key = String(task.id)
    const first = firstById.get(key)
    if (first) {
      warnings.push(`Task ID ${key} is used by ${describeTaskForWarning(first.task, first.index)} and ${describeTaskForWarning(task, index)} - renumber task IDs before publishing`)
    } else {
      firstById.set(key, { task, index })
    }
  })
}

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
  if (lessonType === 'python' || lessonType === 'arcade') {
    return { completeCode: task.starterCode ?? '' }
  }
  if (lessonType === 'html') {
    return {
      completeFiles: (task.starterFiles ?? []).map(file => ({ ...file })),
      completeEntryFile: task.entryFile ?? 'index.html',
    }
  }
  if (lessonType === 'electronics') {
    return { completeCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) }
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
  if (lesson.fork != null) validateLessonFork(lesson, errors)
  if (!tasks || tasks.length === 0) errors.push('Lesson must have at least one task')
  validateDraftLessonStructure(lesson, errors)
  errors.push(...validateComposedStructure(lesson))

  tasks.forEach((item, i) => {
    if (item?.type === 'group') {
      if (!item.title) errors.push(`Group ${i + 1} is missing a title`)
      if (!item.subtasks || item.subtasks.length === 0) {
        errors.push(`Group "${item.title || (i + 1)}" has no subtasks — add at least one subtask`)
      }
    }
  })

  const flat = flattenTasks(tasks)
  warnDuplicateTaskIds(flat, warnings)
  flat.forEach((task, i) => {
    const n = i + 1
    if (!task || typeof task !== 'object' || Array.isArray(task)) return
    const type = getTaskModuleType(lesson, task) ?? lesson.type
    // In draft mode only the shared structural/type checks are required.
    if (lesson.draft === true) return
    const feedbackChecks = validateFeedbackBasics(task, n, errors, warnings)
    if (!task.title) errors.push(`Task ${n} is missing a title`)
    if (task.estimatedMinutes != null && (!Number.isFinite(Number(task.estimatedMinutes)) || Number(task.estimatedMinutes) <= 0)) {
      errors.push(`Task ${n} estimated time must be a positive number of minutes`)
    }
    if (task.priority != null && !isValidTaskPriority(task.priority)) {
      errors.push(`Task ${n} priority must be one of: ${TASK_PRIORITIES.join(', ')}`)
    }
    if (task.taskType !== 'information' && task.taskType !== 'quiz') {
      validateStageMetadata(task, n, errors)
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
      if (task.check) validateFilesystemChecks(task.check, n, errors)
      if (feedbackChecks.length > 0) validateFilesystemChecks(feedbackChecks, n, errors, 'feedback')
      const carryFsFrom = task.carryFsFrom ?? null
      if (carryFsFrom != null && !flat.some(t => t.id === carryFsFrom)) {
        errors.push(`Task ${n} references task ${carryFsFrom} for carry-through but that task does not exist`)
      }
    } else if (task.taskType !== 'information' && type === 'electronics') {
      const starterCircuit = getStarterStage(task)?.stage?.circuit ?? task.starterCircuit
      if (!starterCircuit || !Array.isArray(starterCircuit.components)) {
        errors.push(`Task ${n} has no starter breadboard`)
      }
      const carryCircuitFrom = task.carryCircuitFrom ?? null
      if (carryCircuitFrom != null && !flat.some(t => t.id === carryCircuitFrom)) {
        errors.push(`Task ${n} references task ${carryCircuitFrom} for circuit carry-through but that task does not exist`)
      }
      if (task.check) validateElectronicsChecks(task.check, n, errors)
      if (feedbackChecks.length > 0) validateElectronicsChecks(feedbackChecks, n, errors, 'feedback')
    } else if (task.taskType === 'code_arrange') {
      if (!['python', 'html'].includes(type)) {
        errors.push(`Task ${n} is a code-arrange task but must use the Python or HTML module`)
      }
      const lines = Array.isArray(task.lines) ? task.lines : []
      if (lines.length === 0) errors.push(`Task ${n} is a code-arrange task but has no lines.`)
      const lineIds = []
      const poolIds = []
      lines.forEach((line, li) => {
        const ln = li + 1
        if (!line?.id) errors.push(`Task ${n} line ${ln} has no id.`)
        else lineIds.push(line.id)
        const parts = Array.isArray(line?.parts) ? line.parts : []
        if (parts.length === 0) errors.push(`Task ${n} line ${ln} has no parts.`)
        if (!parts.some(part => part?.type === 'slot')) errors.push(`Task ${n} line ${ln} has no blanks.`)
        parts.forEach((part, pi) => {
          const pn = pi + 1
          if (part?.type === 'slot') {
            if (!part.id) errors.push(`Task ${n} line ${ln} blank ${pn} has no id.`)
            else poolIds.push(part.id)
            if (!part.code?.trim()) errors.push(`Task ${n} line ${ln} blank ${pn} has no correct value.`)
          } else if (part?.type !== 'text') {
            errors.push(`Task ${n} line ${ln} part ${pn} has an invalid type.`)
          }
        })
      })
      if (new Set(lineIds).size !== lineIds.length) errors.push(`Task ${n} is a code-arrange task but has duplicate line ids.`)
      const distractors = Array.isArray(task.distractors) ? task.distractors : []
      distractors.forEach((d, di) => {
        if (!d?.id) errors.push(`Task ${n} distractor ${di + 1} has no id.`)
        else poolIds.push(d.id)
        if (!d?.code?.trim()) errors.push(`Task ${n} distractor ${di + 1} has no code.`)
      })
      if (new Set(poolIds).size !== poolIds.length) errors.push(`Task ${n} is a code-arrange task but has duplicate blank/distractor ids.`)
      if (!task.check) errors.push(`Task ${n} is a code-arrange task but has no completion check.`)
      if (type === 'html') {
        if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
        else {
          const names = task.starterFiles.map(file => file.name)
          if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
          if (!task.starterFiles.some(file => file.type === 'html' || file.name.endsWith('.html'))) {
            errors.push(`Task ${n} has no HTML file to use as entry point`)
          }
        }
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
        if (task.check) validateScratchChecks(task.check, n, errors)
        if (feedbackChecks.length > 0) validateScratchChecks(feedbackChecks, n, errors, 'feedback')
      } else if (type !== 'filesystem' && type !== 'electronics') {
        if (task.check) validateCodeChecks(task.check, n, errors, { type, interactionMode: task.interactionMode })
        if (feedbackChecks.length > 0) validateCodeChecks(feedbackChecks, n, errors, { type, interactionMode: task.interactionMode, kind: 'feedback' })
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

    const carryFrom = task.taskType === 'quiz' || task.taskType === 'information' || task.taskType === 'code_arrange' || type === 'filesystem' || type === 'electronics'
      ? null
      : type === 'scratch' ? task.carryBlocksFrom : task.carryCodeFrom
    if (carryFrom != null && !flat.some(candidate => candidate.id === carryFrom)) {
      errors.push(`Task ${n} references task ${carryFrom} for carry-through but that task does not exist`)
    }
    const allowedCarrySourceIds = getModuleCarrySourceIds(lesson, task)
    if (carryFrom != null && allowedCarrySourceIds != null && !allowedCarrySourceIds.includes(carryFrom)) {
      errors.push(`Task ${n} may only carry work from an earlier task in the same lesson module`)
    }

    const hasStarter = task.taskType === 'information'
      ? true
      : task.taskType === 'quiz'
        ? quizHasStarter(task)
        : task.taskType === 'code_arrange'
          ? (Array.isArray(task.lines) && task.lines.length > 0)
          : type === 'python' || type === 'arcade'
          ? !!task.starterCode
          : type === 'scratch'
            ? !!task.starterBlocks
            : type === 'filesystem'
              ? !!task.starterFs
              : type === 'electronics'
                ? !!task.starterCircuit
                : task.starterFiles?.some(file => file.content.trim())
    if (!hasStarter && type !== 'filesystem' && type !== 'electronics') warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)

    if (task.taskType !== 'information' && task.taskType !== 'quiz' && task.check) {
      const allChecks = normalizeChecks(task.check)
      if ((type === 'python' || type === 'arcade') && task.completeCode != null) {
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

    if (task.taskType !== 'information' && task.taskType !== 'quiz' && task.check && type === 'electronics' && task.completeCircuit) {
      const circuitChecks = normalizeChecks(task.check).filter(c => ELECTRONICS_CHECK_TYPES.includes(c.type))
      if (circuitChecks.length > 0 && circuitChecks.some(c => !evaluateSingleCheck(c, '', { circuit: task.completeCircuit }))) {
        warnings.push(`Task ${n} complete breadboard does not satisfy a check - review the complete circuit`)
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
            : type === 'electronics'
              ? !!task.check
              : normalizeChecks(task.check).some(check => ['code_no_error', 'output_not_empty', 'output_empty', 'element_exists', 'element_attribute', 'element_style_property', 'variable_exists'].includes(check.type) || check.value)
    if (checkHasValue && !task._checkTested) {
      warnings.push(`Task ${n} has a completion check that hasn't been tested — run the task to verify it`)
    }
  })

  return { errors, warnings }
}

function validateLessonFork(lesson, errors) {
  const fork = lesson.fork
  if (!fork || typeof fork !== 'object' || Array.isArray(fork)) {
    errors.push('Fork metadata must be an object')
    return
  }
  if (!fork.sourceLessonId?.trim()) errors.push('Fork metadata needs a source lesson ID')
  if (!fork.classId?.trim()) errors.push('Fork metadata needs a class ID')
  if (fork.sourceLessonId && fork.classId) {
    const expectedId = makeForkLessonId(fork.sourceLessonId, fork.classId)
    if (lesson.id !== expectedId) errors.push(`Forked lesson ID must be ${expectedId}`)
  }
  if (fork.taskLinks != null && !Array.isArray(fork.taskLinks)) {
    errors.push('Fork task links must be an array')
  }
}

export function renumberTasks(tasks) {
  const idMap = new Map()
  let nextId = 1

  function assignIds(items) {
    return (items ?? []).map(item => {
      if (item.type === 'group') {
        return { ...item, subtasks: assignIds(item.subtasks ?? []) }
      }
      const oldKey = String(item.id)
      const newId = nextId++
      if (!idMap.has(oldKey)) idMap.set(oldKey, newId)
      return { ...item, id: newId }
    })
  }

  function updateCarryReferences(items) {
    return items.map(item => {
      if (item.type === 'group') {
        return { ...item, subtasks: updateCarryReferences(item.subtasks ?? []) }
      }
      const next = { ...item }
      for (const field of TASK_CARRY_FIELDS) {
        if (next[field] == null) continue
        const mapped = idMap.get(String(next[field]))
        if (mapped != null) next[field] = mapped
      }
      return next
    })
  }

  return updateCarryReferences(assignIds(tasks))
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
      if (task.priority != null) exported.priority = task.priority
      if ((task.informationType ?? 'standard') !== 'standard') exported.informationType = task.informationType
      if (task.leftContent) exported.leftContent = task.leftContent
      if (task.taskMode && task.taskMode !== 'both') exported.taskMode = task.taskMode
      // Authoring metadata is intentionally retained for all task formats.
      if (task.intent != null) exported.intent = task.intent
      if (task.taskActivity != null) exported.taskActivity = task.taskActivity
      if (task.intentLastChangedAt != null) exported.intentLastChangedAt = task.intentLastChangedAt
      if (task.taskLastChangedAt != null) exported.taskLastChangedAt = task.taskLastChangedAt
      return exported
    }

    const { _checkTested, _customTitle, hints: _hints, ...rest } = task
    const exported = { ...rest, id: idMap[task.id] }
    if (exported.copyCode != null && !String(exported.copyCode).trim()) delete exported.copyCode
    if (exported.taskType === 'quiz') delete exported.copyCode
    if (exported.taskMode === 'both') delete exported.taskMode
    if (exported.carryCodeFrom != null) exported.carryCodeFrom = idMap[exported.carryCodeFrom] ?? exported.carryCodeFrom
    if (exported.carryBlocksFrom != null) exported.carryBlocksFrom = idMap[exported.carryBlocksFrom] ?? exported.carryBlocksFrom
    if (exported.carryFsFrom != null) exported.carryFsFrom = idMap[exported.carryFsFrom] ?? exported.carryFsFrom
    if (exported.carryCircuitFrom != null) exported.carryCircuitFrom = idMap[exported.carryCircuitFrom] ?? exported.carryCircuitFrom
    if (Array.isArray(exported.check)) exported.check = exported.check.map(normalizeCheckForExport)
    else if (exported.check) exported.check = normalizeCheckForExport(exported.check)
    if (Array.isArray(exported.feedbackChecks)) exported.feedbackChecks = exported.feedbackChecks.map(normalizeCheckForExport)
    else if (exported.feedbackChecks) exported.feedbackChecks = normalizeCheckForExport(exported.feedbackChecks)
    delete exported.incorrectChecks
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
    ? {
        id: item.id,
        type: 'group',
        title: item.title,
        ...(item.moduleId ? { moduleId: item.moduleId } : {}),
        ...(item.moduleType ? { moduleType: item.moduleType } : {}),
        ...(item.sandbox ? { sandbox: item.sandbox } : {}),
        subtasks: (item.subtasks ?? []).map(normalizeTask),
      }
    : normalizeTask(item))
}
