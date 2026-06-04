import React, { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { firestore, functions } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'

const createAccount  = httpsCallable(functions, 'createAccount')
const setUserRole    = httpsCallable(functions, 'setUserRole')
const disableAccount = httpsCallable(functions, 'disableAccount')
const enableAccount  = httpsCallable(functions, 'enableAccount')
const deleteAccount  = httpsCallable(functions, 'deleteAccount')

export default function AccountManagement() {
  const { user: currentUser } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newRole, setNewRole] = useState('teacher')
  const [formError, setFormError] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [snapshotError, setSnapshotError] = useState(null)

  useEffect(() => {
    return onSnapshot(
      collection(firestore, 'users'),
      (snap) => { setSnapshotError(null); setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))) },
      (err) => setSnapshotError(err.message),
    )
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)
    try {
      await createAccount({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        displayName: newDisplayName.trim(),
      })
      setNewEmail('')
      setNewPassword('')
      setNewDisplayName('')
      setNewRole('teacher')
      setShowForm(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  async function handleAction(fn, payload, label) {
    setActionError(null)
    try {
      await fn(payload)
    } catch (err) {
      setActionError(`${label}: ${err.message}`)
    }
  }

  return (
    <section style={s.section}>
      <div style={s.header}>
        <h2 style={s.title}>Account Management</h2>
        <button
          className="btn-primary"
          style={s.addBtn}
          onClick={() => { setShowForm(v => !v); setFormError(null) }}
        >
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={s.form}>
          <h3 style={s.formTitle}>New Account</h3>
          <div style={s.formRow}>
            <div style={s.field}>
              <label style={s.label}>Display Name</label>
              <input style={s.input} value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Ms Smith" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="teacher@school.co.uk" />
            </div>
          </div>
          <div style={s.formRow}>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input style={s.input} type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Role</label>
              <select style={s.select} value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {formError && <p style={s.error}>{formError}</p>}
          <button className="btn-secondary" style={s.submitBtn} type="submit" disabled={formLoading}>
            {formLoading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      )}

      {snapshotError && <p style={s.error}>Could not load accounts: {snapshotError}</p>}
      {actionError && <p style={s.error}>{actionError}</p>}

      <table style={s.table}>
        <thead>
          <tr>
            {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && (
            <tr><td colSpan={5} style={{ ...s.td, color: '#888', textAlign: 'center' }}>No accounts yet.</td></tr>
          )}
          {accounts.map(account => (
            <tr key={account.id}>
              <td style={s.td}>{account.displayName || '—'}</td>
              <td style={s.td}>{account.email}</td>
              <td style={s.td}>
                <select
                  style={s.roleSelect}
                  value={account.role}
                  disabled={account.id === currentUser?.uid}
                  onChange={e => handleAction(setUserRole, { uid: account.id, role: e.target.value }, 'Set role')}
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td style={s.td}>
                <span style={{ ...s.badge, background: account.disabled ? '#e5e7eb' : '#dcfce7', color: account.disabled ? '#6b7280' : '#15803d' }}>
                  {account.disabled ? 'Disabled' : 'Active'}
                </span>
              </td>
              <td style={{ ...s.td, display: 'flex', gap: 6 }}>
                {account.disabled ? (
                  <button
                    className="btn-ghost-outline"
                    style={s.actionBtn}
                    disabled={account.id === currentUser?.uid}
                    onClick={() => handleAction(enableAccount, { uid: account.id }, 'Enable')}
                  >
                    Enable
                  </button>
                ) : (
                  <button
                    className="btn-ghost-outline"
                    style={s.actionBtn}
                    disabled={account.id === currentUser?.uid}
                    onClick={() => handleAction(disableAccount, { uid: account.id }, 'Disable')}
                  >
                    Disable
                  </button>
                )}
                <button
                  className="btn-danger"
                  style={s.actionBtn}
                  disabled={account.id === currentUser?.uid}
                  onClick={() => {
                    if (window.confirm(`Permanently delete ${account.email}?`)) {
                      handleAction(deleteAccount, { uid: account.id }, 'Delete')
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {accounts.length > 0 && (
        <p style={s.note}>Role and disable/delete actions are unavailable for your own account.</p>
      )}
    </section>
  )
}

const s = {
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:   { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  addBtn:  { padding: '8px 18px', fontSize: '0.88rem' },
  form:    { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  formTitle: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--colour-text)', margin: 0 },
  formRow: { display: 'flex', gap: 12 },
  field:   { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  label:   { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--colour-text)' },
  input:   { fontFamily: 'var(--font-body)', fontSize: '0.9rem', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: 'var(--colour-text)', background: '#fff' },
  select:  { fontFamily: 'var(--font-body)', fontSize: '0.9rem', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: 'var(--colour-text)', background: '#fff', cursor: 'pointer' },
  submitBtn: { alignSelf: 'flex-start', padding: '8px 20px', fontSize: '0.9rem' },
  error:   { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  table:   { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' },
  th:      { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td:      { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  badge:   { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 },
  roleSelect: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' },
  actionBtn:  { padding: '4px 10px', fontSize: '0.82rem' },
  note:    { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#9ca3af', margin: 0 },
}
