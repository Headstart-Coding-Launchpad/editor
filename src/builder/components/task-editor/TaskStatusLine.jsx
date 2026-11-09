import React, { useEffect, useRef, useState } from 'react'
import { TaskFormatIcon } from './TaskEditorFields'

// The task's set-once settings on one line at the top of the Content tab: Priority, Must see,
// Available in, and the Task format chip (opens the format buttons). Same fields and values as
// the old full-width card rows.
export default function TaskStatusLine({
  task,
  onPriorityChange,
  onMustSeeChange,
  onModeChange,
  formats,
  activeFormat,
  onFormatChange,
}) {
  const [formatsOpen, setFormatsOpen] = useState(false)
  const wrapRef = useRef(null)
  const chipRef = useRef(null)
  const current = formats.find((f) => f.value === activeFormat) ?? formats[0]

  useEffect(() => {
    if (!formatsOpen) return undefined
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'mousedown' && wrapRef.current?.contains(event.target)) return
      setFormatsOpen(false)
      // Escape puts focus back on the chip (the format buttons it was on are gone).
      if (event.type === 'keydown') chipRef.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [formatsOpen])

  return (
    <div className="te-status-line" data-testid="task-status-line">
      <span className="te-status-line__label">Task is:</span>
      <select
        className="te-status-chip"
        aria-label="Priority"
        title="Core: expected lesson path. Optional: safe to skip."
        value={task.priority ?? 'core'}
        onChange={(e) => onPriorityChange(e.target.value)}
      >
        <option value="core">Core</option>
        <option value="optional">Optional</option>
      </select>
      <label
        className={task.mustSee ? 'te-status-chip te-status-chip--on' : 'te-status-chip'}
        title="Must see: warn before the class skips it"
      >
        <input
          type="checkbox"
          checked={!!task.mustSee}
          onChange={(e) => onMustSeeChange(e.target.checked)}
          data-testid="task-must-see"
        />
        Must see
      </label>
      <select
        className="te-status-chip"
        aria-label="Available in"
        title="Where the task shows: live sessions, solo mode, or both"
        value={task.taskMode ?? 'both'}
        onChange={(e) => onModeChange(e.target.value)}
      >
        <option value="both">Live + Solo</option>
        <option value="live">Live only</option>
        <option value="solo">Solo only</option>
      </select>

      <div className="te-status-line__format" ref={wrapRef}>
        <button
          ref={chipRef}
          type="button"
          className="te-status-chip te-status-chip--format"
          aria-haspopup="true"
          aria-expanded={formatsOpen}
          aria-label={`Task format: ${current?.label ?? ''}`}
          onClick={() => setFormatsOpen((open) => !open)}
        >
          {current && <TaskFormatIcon type={current.iconType} size={16} />}
          <span>{current?.label}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {formatsOpen && (
          <div className="te-status-line__formats" role="group" aria-label="Task format">
            <div className="te-task-format-grid">
              {formats.map(({ value, label, iconType }) => {
                const active = value === activeFormat
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    className={
                      active
                        ? 'te-task-format-btn te-task-format-btn--active'
                        : 'te-task-format-btn'
                    }
                    onClick={() => {
                      setFormatsOpen(false)
                      onFormatChange(value)
                    }}
                  >
                    <TaskFormatIcon type={iconType} />
                    <span className="te-task-format-label">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
