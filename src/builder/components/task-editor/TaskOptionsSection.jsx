import { useState } from 'react'
import { normalizeChecks } from '../../../modules/checks'
import { Field, CarryThroughPicker } from './TaskEditorFields'
import { CheckListEditor } from './CheckEditors'
import TestsEditor from './TestsEditor'
import { getLessonModule } from '../../../modules/registry'

export default function TaskOptionsSection({
  task,
  lesson,
  onUpdate,
  activePythonCode,
  activeFiles,
  output,
  setCheckResults,
  setRunStatus,
  handleInteractionModeChange,
}) {
  const lessonMod = getLessonModule(lesson.type)
  const CheckEditor = lessonMod?.CheckEditor ?? null
  const FeedbackCheckEditor = lessonMod?.FeedbackCheckEditor ?? null
  const [optionsOpen, setOptionsOpen] = useState(false)

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  const summaryParts = []
  if (task.check) summaryParts.push('check enabled')
  if (task.interactionMode === 'submit') summaryParts.push('submit mode')
  const summary = summaryParts.join(' · ')

  return (
    <div className="te-options-section">
      <button
        type="button"
        className="te-options-section__toggle"
        onClick={() => setOptionsOpen((o) => !o)}
        aria-expanded={optionsOpen}
      >
        <span className="te-options-section__title">Task options</span>
        {!optionsOpen && summary && <span className="te-options-section__summary">{summary}</span>}
        <span
          className="te-options-section__chevron"
          style={{ transform: optionsOpen ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>

      {optionsOpen && (
        <div className="te-options-section__body">
          <CarryThroughPicker
            task={task}
            lesson={lesson}
            onUpdate={onUpdate}
            lessonMod={lessonMod}
          />

          {lessonMod?.supportsInteractionMode && (
            <Field label="Student interaction">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="te-option-choice-grid">
                  {[
                    { value: 'run', label: 'Run', text: 'Students run code and see output.' },
                    {
                      value: 'submit',
                      label: 'Submit',
                      text: 'Students submit code without running it.',
                    },
                  ].map((choice) => {
                    const active = choice.value === (task.interactionMode ?? 'run')
                    return (
                      <label
                        key={choice.value}
                        className={
                          active
                            ? 'te-option-choice-card te-option-choice-card--active'
                            : 'te-option-choice-card'
                        }
                      >
                        <input
                          type="radio"
                          name={`interaction-${task.id}`}
                          checked={active}
                          onChange={() => handleInteractionModeChange(choice.value)}
                          className="te-option-choice-input"
                        />
                        <span className="te-option-choice-title">{choice.label}</span>
                        <span
                          className={
                            active
                              ? 'te-option-choice-text te-option-choice-text--active'
                              : 'te-option-choice-text'
                          }
                        >
                          {choice.text}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {task.interactionMode === 'submit' && (
                  <p className="te-option-note">
                    Submit mode hides the Run button. Only code-based checks can be evaluated on
                    submit.
                  </p>
                )}
              </div>
            </Field>
          )}

          <Field label="Completion check">
            <label
              className={
                task.check
                  ? 'te-option-toggle-card te-option-toggle-card--active'
                  : 'te-option-toggle-card'
              }
            >
              <input
                type="checkbox"
                checked={!!task.check}
                onChange={(e) =>
                  set(
                    'check',
                    e.target.checked
                      ? (lessonMod?.defaultCheck?.(task.interactionMode ?? 'run') ?? null)
                      : null
                  )
                }
                className="te-option-choice-input"
              />
              <span className="te-option-choice-title">Enable check</span>
              <span
                className={
                  task.check
                    ? 'te-option-choice-text te-option-choice-text--active'
                    : 'te-option-choice-text'
                }
              >
                Add completion criteria students can pass.
              </span>
            </label>
            {task.check && CheckEditor && (
              <CheckEditor
                task={task}
                lesson={lesson}
                onUpdate={onUpdate}
                interactionMode={task.interactionMode ?? 'run'}
                output={output}
                activePythonCode={activePythonCode}
                activeFiles={activeFiles}
              />
            )}
          </Field>

          {task.check && lessonMod?.supportsIncorrectChecks && (
            <Field label="Feedback checks">
              <p className="te-option-note">
                Detect wrong patterns after an attempt or once the student pauses. Blocking feedback
                fails the task when it matches; nudges can guide without blocking.
              </p>
              {FeedbackCheckEditor ? (
                <FeedbackCheckEditor
                  task={task}
                  lesson={lesson}
                  checks={normalizeChecks(task.feedbackChecks ?? task.incorrectChecks ?? [])}
                  onChange={(checks) =>
                    onUpdate({
                      ...task,
                      feedbackChecks: checks?.length > 0 ? checks : null,
                      incorrectChecks: undefined,
                    })
                  }
                  feedbackEditor
                />
              ) : (
                <CheckListEditor
                  checks={normalizeChecks(task.feedbackChecks ?? task.incorrectChecks ?? [])}
                  onChange={(checks) =>
                    onUpdate({
                      ...task,
                      feedbackChecks: checks.length > 0 ? checks : null,
                      incorrectChecks: undefined,
                    })
                  }
                  interactionMode={task.interactionMode ?? 'run'}
                  allowCodeNoError={false}
                  allowVariableChecks={
                    lessonMod?.supportsVariableChecks && task.interactionMode !== 'submit'
                  }
                  allowDomChecks={lessonMod?.supportsDomChecks && task.interactionMode !== 'submit'}
                  lessonType={lesson.type}
                  feedbackEditor
                  stages={task.codeStages ?? []}
                  output={output}
                  code={
                    lessonMod?.supportsTests
                      ? activePythonCode
                      : (activeFiles ?? [])
                          .map((file) => `--- ${file.name} ---\n${file.content ?? ''}`)
                          .join('\n\n')
                  }
                />
              )}
            </Field>
          )}

          {lessonMod?.supportsTests && (task.interactionMode ?? 'run') !== 'submit' && (
            <TestsEditor
              tests={task.tests ?? []}
              onChange={(tests) => set('tests', tests.length > 0 ? tests : undefined)}
              lessonType={lesson.type}
            />
          )}
        </div>
      )}
    </div>
  )
}
