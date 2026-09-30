import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getBadgeDefinitions } from '../badges/registry'
import { makeCatalogueId, sortCatalogue, validateCatalogueBadge } from '../badges/catalogue'
import {
  fetchBadgeCatalogue,
  saveCatalogueBadge,
  setCatalogueBadgeArchived,
} from '../badges/catalogueService'
import { AdminBadge, AdminCell, AdminMessage, AdminSection, AdminTable } from './AdminUi'

const EMPTY_FORM = { id: '', emoji: '', title: '', blurb: '' }

const KIND_BADGE = {
  rule: { background: '#dbeafe', color: '#1d4ed8' },
  tutor: { background: '#f3f4f6', color: '#4b5563' },
  archived: { background: '#fef9c3', color: '#854d0e' },
}

/**
 * Admin Portal → Badges (docs/architecture/live-badges-plan.md, "Admin catalogue"). Lists the
 * built-in registry badges read-only (they change only in code, via `npm run new:badge`), and
 * lets admins add, edit, archive and restore manual-only catalogue badges in Firestore
 * `badgeCatalogue`, which reach tutors' pickers with no deploy. Ids can't collide with the
 * registry and emoji must be unique across every badge; both are checked on save.
 */
export default function BadgesPanel() {
  const { user } = useAuth()
  const [catalogue, setCatalogue] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  // null (closed), { mode: 'add' } or { mode: 'edit', id }
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [idTouched, setIdTouched] = useState(false)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchBadgeCatalogue()
      .then((entries) => {
        if (!cancelled) setCatalogue(entries)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isNew = editing?.mode === 'add'
  const registry = getBadgeDefinitions()

  function openAdd() {
    setEditing({ mode: 'add' })
    setForm(EMPTY_FORM)
    setIdTouched(false)
    setErrors([])
  }

  function openEdit(entry) {
    setEditing({ mode: 'edit', id: entry.id })
    setForm({ id: entry.id, emoji: entry.emoji, title: entry.title, blurb: entry.blurb })
    setErrors([])
  }

  function closeForm() {
    setEditing(null)
    setErrors([])
  }

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // A new badge's id follows its title until the admin types an id of their own.
      if (field === 'title' && isNew && !idTouched) next.id = makeCatalogueId(value)
      return next
    })
    if (field === 'id') setIdTouched(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    const existing = catalogue.find((entry) => entry.id === form.id)
    const entry = { ...form, archived: isNew ? false : !!existing?.archived }
    const found = validateCatalogueBadge(entry, { catalogue, isNew })
    setErrors(found)
    if (found.length) return
    setSaving(true)
    try {
      const saved = await saveCatalogueBadge(entry, {
        catalogue,
        isNew,
        updatedBy: user?.email ?? null,
      })
      setCatalogue((prev) => sortCatalogue([...prev.filter((e) => e.id !== saved.id), saved]))
      setEditing(null)
    } catch (err) {
      setErrors(err.errors ?? [err.message])
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(entry, archived) {
    setActionError(null)
    try {
      await setCatalogueBadgeArchived(entry.id, archived, { updatedBy: user?.email ?? null })
      setCatalogue((prev) =>
        sortCatalogue(prev.map((e) => (e.id === entry.id ? { ...e, archived } : e)))
      )
    } catch (err) {
      setActionError(`Couldn't ${archived ? 'archive' : 'restore'} ${entry.title}: ${err.message}`)
    }
  }

  return (
    <div style={s.page}>
      <AdminSection
        title="Catalogue badges"
        subtitle="Manual-only badges tutors can award. No deploy needed."
      >
        <div>
          <button
            className="btn-secondary"
            style={s.addBtn}
            onClick={editing ? closeForm : openAdd}
          >
            {editing ? 'Cancel' : 'Add badge'}
          </button>
        </div>

        {editing && (
          <form onSubmit={handleSave} style={s.form} aria-label="Catalogue badge">
            <h3 style={s.formTitle}>{isNew ? 'New badge' : `Edit ${form.title || form.id}`}</h3>
            <div style={s.formRow}>
              <div style={s.emojiField}>
                <label style={s.label} htmlFor="badge-emoji">
                  Emoji
                </label>
                <input
                  id="badge-emoji"
                  style={s.input}
                  value={form.emoji}
                  onChange={(e) => updateField('emoji', e.target.value)}
                  placeholder="🌟"
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="badge-title">
                  Title
                </label>
                <input
                  id="badge-title"
                  style={s.input}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Star Speaker"
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="badge-id">
                  Id
                </label>
                <input
                  id="badge-id"
                  style={{ ...s.input, fontFamily: 'var(--font-code)' }}
                  value={form.id}
                  onChange={(e) => updateField('id', e.target.value)}
                  disabled={!isNew}
                  placeholder="star_speaker"
                />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label} htmlFor="badge-blurb">
                Blurb (shown on the student&apos;s card)
              </label>
              <input
                id="badge-blurb"
                style={s.input}
                value={form.blurb}
                onChange={(e) => updateField('blurb', e.target.value)}
                placeholder="Explained their code to the class."
              />
            </div>
            {errors.length > 0 && (
              <ul style={s.errorList} role="alert">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <button className="btn-primary" style={s.submitBtn} type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save badge'}
            </button>
          </form>
        )}

        {loadError && <AdminMessage tone="error">Could not load badges: {loadError}</AdminMessage>}
        {actionError && <AdminMessage tone="error">{actionError}</AdminMessage>}

        <AdminTable headers={['Badge', 'Id', 'Status', 'Actions']}>
          {!loading && catalogue.length === 0 && (
            <tr>
              <AdminCell colSpan={4} style={s.emptyCell}>
                No catalogue badges yet.
              </AdminCell>
            </tr>
          )}
          {catalogue.map((entry) => (
            <tr key={entry.id} data-testid={`catalogue-row-${entry.id}`}>
              <AdminCell>
                <BadgeLabel badge={entry} />
              </AdminCell>
              <AdminCell>
                <code style={s.id}>{entry.id}</code>
              </AdminCell>
              <AdminCell>
                {entry.archived ? (
                  <AdminBadge style={KIND_BADGE.archived}>Archived</AdminBadge>
                ) : (
                  <AdminBadge style={KIND_BADGE.tutor}>In picker</AdminBadge>
                )}
              </AdminCell>
              <AdminCell>
                <div style={s.actions}>
                  <button
                    className="btn-ghost-outline"
                    style={s.actionBtn}
                    onClick={() => openEdit(entry)}
                    aria-label={`Edit ${entry.title}`}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-ghost-outline"
                    style={s.actionBtn}
                    onClick={() => handleArchive(entry, !entry.archived)}
                    aria-label={`${entry.archived ? 'Restore' : 'Archive'} ${entry.title}`}
                  >
                    {entry.archived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </AdminCell>
            </tr>
          ))}
        </AdminTable>
        <AdminMessage>
          Archived badges leave the tutor&apos;s picker but still show wherever they were awarded.
          Badges are never deleted.
        </AdminMessage>
      </AdminSection>

      <AdminSection
        title="Built-in badges"
        subtitle="Defined in code (src/badges/definitions). Add one with npm run new:badge."
      >
        <AdminTable headers={['Badge', 'Rule', 'Kind', 'Auto-award']}>
          {registry.map((badge) => (
            <tr key={badge.id} data-testid={`registry-row-${badge.id}`}>
              <AdminCell>
                <BadgeLabel badge={badge} />
              </AdminCell>
              <AdminCell style={s.ruleCell}>{badge.ruleText}</AdminCell>
              <AdminCell>
                {badge.rule ? (
                  <AdminBadge style={KIND_BADGE.rule}>Rule-backed</AdminBadge>
                ) : (
                  <AdminBadge style={KIND_BADGE.tutor}>Tutor-only</AdminBadge>
                )}
              </AdminCell>
              <AdminCell>{badge.autoAwardable ? 'Yes' : '–'}</AdminCell>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>
    </div>
  )
}

function BadgeLabel({ badge }) {
  return (
    <div style={s.badgeLabel}>
      <span style={s.emoji} aria-hidden="true">
        {badge.emoji}
      </span>
      <span>
        <span style={s.title}>{badge.title}</span>
        {badge.blurb && <span style={s.blurb}>{badge.blurb}</span>}
      </span>
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 32 },
  addBtn: { padding: '8px 18px', fontSize: '0.88rem' },
  form: {
    background: '#f9fafb',
    border: '1.5px solid #e5e7eb',
    borderRadius: 8,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  formTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 },
  emojiField: { width: 90, display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
  },
  input: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '8px 10px',
    border: '1.5px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
    color: 'var(--colour-text)',
    background: '#fff',
  },
  errorList: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#dc2626',
    margin: 0,
    paddingLeft: 18,
  },
  submitBtn: { alignSelf: 'flex-start', padding: '8px 20px', fontSize: '0.9rem' },
  emptyCell: { color: '#888', textAlign: 'center' },
  id: { fontFamily: 'var(--font-code)', fontSize: '0.8rem', color: '#6b7280' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actionBtn: { padding: '4px 10px', fontSize: '0.82rem' },
  ruleCell: { fontSize: '0.84rem', color: '#4b5563', maxWidth: 460 },
  badgeLabel: { display: 'flex', alignItems: 'center', gap: 10 },
  emoji: { fontSize: '1.4rem', lineHeight: 1 },
  title: {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
  },
  blurb: { display: 'block', fontSize: '0.8rem', color: '#6b7280' },
}
