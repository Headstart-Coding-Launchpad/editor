import React from 'react'
import { auditLessonTopics } from '../../shared/topicAudit'
import { topicHref } from '../../shared/topicLibrary'

function taskList(reference) {
  return reference.tasks
    .map((task) => `task ${task.id ?? task.index}${task.title ? ` (${task.title})` : ''}`)
    .join(', ')
}

export default function LessonTopicSummary({ lesson, topics, loading, error, onUpdate }) {
  const audit = auditLessonTopics(lesson, topics)
  const proposals = lesson.topicProposals ?? []

  function updateProposal(index, field, value) {
    onUpdate((prev) => ({
      ...prev,
      topicProposals: (prev.topicProposals ?? []).map((proposal, proposalIndex) =>
        proposalIndex === index ? { ...proposal, [field]: value } : proposal
      ),
    }))
  }

  function addProposal() {
    onUpdate((prev) => ({
      ...prev,
      topicProposals: [
        ...(prev.topicProposals ?? []),
        {
          id: '',
          title: '',
          description: '',
          status: 'proposed',
        },
      ],
    }))
  }

  function removeProposal(index) {
    onUpdate((prev) => ({
      ...prev,
      topicProposals: (prev.topicProposals ?? []).filter(
        (_, proposalIndex) => proposalIndex !== index
      ),
    }))
  }

  return (
    <section style={s.section}>
      <div style={s.headingRow}>
        <span style={s.heading}>Topic Library</span>
        <button type="button" className="btn-ghost" style={s.addBtn} onClick={addProposal}>
          Add proposal
        </button>
      </div>

      {loading && <p style={s.note}>Checking the current Topic Library…</p>}
      {error && (
        <p style={{ ...s.note, color: '#b91c1c' }}>
          Could not check Topic Library: {error.message}
        </p>
      )}
      {!loading && !error && audit.references.length === 0 && (
        <p style={s.note}>
          No topic references yet. Add IDs to draft tasks or topic links to task content.
        </p>
      )}

      {audit.existing.length > 0 && (
        <TopicGroup title="Existing" tone="#166534">
          {audit.existing.map((reference) => (
            <TopicRow key={reference.id} symbol="✓" reference={reference} />
          ))}
        </TopicGroup>
      )}

      {audit.missing.length > 0 && (
        <TopicGroup title="Missing" tone="#b45309">
          {audit.missing.map((reference) => (
            <TopicRow
              key={reference.id}
              symbol="⚠"
              reference={reference}
              suffix={
                reference.proposal
                  ? `proposal ${reference.proposal.status ?? 'proposed'}`
                  : 'no proposal'
              }
            />
          ))}
        </TopicGroup>
      )}

      {audit.unusedProposals.length > 0 && (
        <TopicGroup title="Unused proposals" tone="#b45309">
          {audit.unusedProposals.map((proposal) => (
            <div key={proposal.id} style={s.row}>
              <span>⚠</span>
              <span>
                <code>{proposal.id}</code> — not referenced
              </span>
            </div>
          ))}
        </TopicGroup>
      )}

      {proposals.length > 0 && (
        <div style={s.proposals}>
          {proposals.map((proposal, index) => (
            <div key={`${proposal.id}-${index}`} style={s.proposalCard}>
              <div style={s.proposalTop}>
                <input
                  style={s.input}
                  value={proposal.id ?? ''}
                  onChange={(event) =>
                    updateProposal(
                      index,
                      'id',
                      event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')
                    )
                  }
                  placeholder="topic-id"
                  aria-label={`Proposal ${index + 1} topic ID`}
                />
                <select
                  style={s.select}
                  value={proposal.status ?? 'proposed'}
                  onChange={(event) => updateProposal(index, 'status', event.target.value)}
                  aria-label={`Proposal ${index + 1} status`}
                >
                  <option value="proposed">Proposed</option>
                  <option value="deferred">Deferred</option>
                </select>
                <button
                  type="button"
                  style={s.removeBtn}
                  onClick={() => removeProposal(index)}
                  title="Remove proposal"
                >
                  ×
                </button>
              </div>
              <input
                style={s.input}
                value={proposal.title ?? ''}
                onChange={(event) => updateProposal(index, 'title', event.target.value)}
                placeholder="Topic title"
                aria-label={`Proposal ${index + 1} title`}
              />
              <textarea
                style={{ ...s.input, resize: 'vertical', minHeight: 56 }}
                value={proposal.description ?? ''}
                onChange={(event) => updateProposal(index, 'description', event.target.value)}
                placeholder="Short description of the proposed Topic Library entry"
                aria-label={`Proposal ${index + 1} description`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TopicGroup({ title, tone, children }) {
  return (
    <div style={s.group}>
      <div style={{ ...s.groupTitle, color: tone }}>{title}</div>
      {children}
    </div>
  )
}

function TopicRow({ symbol, reference, suffix }) {
  return (
    <div style={s.row}>
      <span>{symbol}</span>
      <span>
        <a href={topicHref(reference.id)} style={s.link}>
          <code>{reference.id}</code>
        </a>
        {' — '}
        {taskList(reference)}
        {suffix ? ` — ${suffix}` : ''}
      </span>
    </div>
  )
}

const s = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 12,
    borderTop: '1px solid #e5e7eb',
  },
  headingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: '#374151',
  },
  addBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '4px 8px',
    fontSize: '0.75rem',
  },
  note: {
    margin: 0,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
  },
  group: { display: 'flex', flexDirection: 'column', gap: 4 },
  groupTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    color: '#4b5563',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    lineHeight: 1.4,
  },
  link: { color: 'var(--colour-primary)', textDecoration: 'none' },
  proposals: { display: 'flex', flexDirection: 'column', gap: 8 },
  proposalCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#f9fafb',
  },
  proposalTop: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
  },
  select: {
    padding: '6px 5px',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
  },
  removeBtn: {
    border: 0,
    background: 'transparent',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 2,
  },
}
