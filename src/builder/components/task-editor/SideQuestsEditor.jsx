import React from 'react'
import { Field } from './TaskEditorFields'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import {
  SIDE_QUEST_KIND_META,
  SIDE_QUEST_KINDS,
  SIDE_QUEST_MAX,
  SIDE_QUEST_TITLE_MAX,
  sideQuestUsesFiles,
} from '../../../shared/sideQuests'

/**
 * Task options → Side-quests: up to three optional, unchecked extras a student can open once
 * they pass this code task (src/shared/sideQuests.js). Each has a title, a kind (label and icon
 * only), a Markdown explainer and starter code. Removing the last one removes `sideQuests`.
 */
export default function SideQuestsEditor({ task, lesson, onUpdate }) {
  const quests = Array.isArray(task.sideQuests) ? task.sideQuests : []
  const isHtml = sideQuestUsesFiles(lesson?.type)

  function setQuests(next) {
    onUpdate({ ...task, sideQuests: next.length > 0 ? next : undefined })
  }

  function patch(index, fields) {
    setQuests(quests.map((quest, i) => (i === index ? { ...quest, ...fields } : quest)))
  }

  return (
    <Field label="Side-quests">
      <p className="te-option-note">
        Optional extras for students who pass this task while the class waits. They run in their own
        editor, are never checked, and never change the task’s code. Students mark them done
        themselves. Needs a completion check (side-quests unlock on a pass).
      </p>
      <div style={s.list}>
        {quests.map((quest, index) => (
          <div key={index} style={s.card}>
            <div style={s.row}>
              <span style={s.number}>{index + 1}</span>
              <input
                type="text"
                aria-label={`Side-quest ${index + 1} title`}
                placeholder="Title, e.g. Break it, then fix it"
                value={quest.title ?? ''}
                maxLength={SIDE_QUEST_TITLE_MAX}
                onChange={(e) => patch(index, { title: e.target.value })}
                style={s.title}
              />
              <select
                aria-label={`Side-quest ${index + 1} kind`}
                value={SIDE_QUEST_KINDS.includes(quest.kind) ? quest.kind : 'challenge'}
                onChange={(e) => patch(index, { kind: e.target.value })}
              >
                {SIDE_QUEST_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SIDE_QUEST_KIND_META[kind].icon} {SIDE_QUEST_KIND_META[kind].label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`Remove side-quest ${index + 1}`}
                onClick={() => setQuests(quests.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
            <MarkdownFieldEditor
              title={`Side-quest ${index + 1} explainer`}
              ariaLabel={`Side-quest ${index + 1} explainer`}
              value={quest.explainer ?? ''}
              onChange={(value) => patch(index, { explainer: value })}
              placeholder="What to do, e.g. Run it, read the error, then fix it."
              height={90}
              minHeight={70}
              lessonType={lesson?.type ?? null}
            />
            <label style={s.starterLabel}>
              Starter {isHtml ? '(index.html)' : 'code'}
              <textarea
                aria-label={`Side-quest ${index + 1} starter`}
                value={quest.starter ?? ''}
                onChange={(e) => patch(index, { starter: e.target.value })}
                rows={5}
                spellCheck={false}
                style={s.starter}
              />
            </label>
          </div>
        ))}
      </div>
      {quests.length < SIDE_QUEST_MAX && (
        <button
          type="button"
          className="btn-ghost-outline"
          style={{ marginTop: 6 }}
          onClick={() =>
            setQuests([...quests, { title: '', kind: 'challenge', explainer: '', starter: '' }])
          }
        >
          + Add side-quest
        </button>
      )}
    </Field>
  )
}

const s = {
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    border: '1px solid var(--colour-border, #ddd)',
    borderRadius: 6,
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  number: { fontWeight: 700, minWidth: 16 },
  title: { flex: 1, minWidth: 160 },
  starterLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 },
  starter: { fontFamily: 'monospace', fontSize: 13, width: '100%', boxSizing: 'border-box' },
}
