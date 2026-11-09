import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { user: { uid: 't1' }, role: 'teacher', loading: false }

vi.mock('../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: vi.fn(async (ref) => ({
    exists: () => true,
    data: () => ({ id: ref.id, type: 'composed', title: `Lesson ${ref.id}`, tasks: [] }),
  })),
}))
// BuilderView stands in with the real toolbar, so All lessons shows (or not) as it really does.
vi.mock('../views/BuilderView', async () => {
  const { default: BuilderToolbar } = await vi.importActual('../components/BuilderToolbar')
  return {
    default: ({ lesson, advanced, onNew }) => (
      <div data-testid="builder-view" data-advanced={String(advanced)}>
        <BuilderToolbar role={authState.role} errors={[]} onNew={onNew} />
        {lesson.id || 'blank'}
      </div>
    ),
  }
})
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }))

import BuilderApp from '../App'

function AdminStub() {
  const navigate = useNavigate()
  return (
    <div>
      Admin lessons page
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </div>
  )
}

function renderAt(entries) {
  return render(tree(entries))
}

function tree(entries) {
  return (
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/builder" element={<BuilderApp />} />
        <Route path="/admin/:tab?" element={<AdminStub />} />
        <Route path="/lesson/:id" element={<div>Lesson page</div>} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Lesson Builder entry (no start screen)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    authState.role = 'teacher'
    authState.loading = false
  })

  it('opens straight on the lesson in ?load=', async () => {
    renderAt(['/builder?load=l1'])
    const view = await screen.findByTestId('builder-view')
    expect(view).toHaveTextContent('l1')
    expect(view).toHaveAttribute('data-advanced', 'false')
  })

  it('with no lesson and no params, sends an admin to Admin > Lessons', async () => {
    authState.role = 'admin'
    renderAt(['/builder'])
    expect(await screen.findByText('Admin lessons page')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New lesson' })).not.toBeInTheDocument()
  })

  it('the redirect replaces history, so Back does not loop into the Builder', async () => {
    authState.role = 'admin'
    const user = userEvent.setup()
    renderAt(['/lesson/abc', '/builder'])
    await user.click(await screen.findByRole('button', { name: 'Browser back' }))
    expect(await screen.findByText('Lesson page')).toBeInTheDocument()
  })

  it('waits for auth before deciding where an admin goes', async () => {
    authState.role = null
    authState.loading = true
    const { rerender } = renderAt(['/builder'])
    expect(screen.queryByText('Admin lessons page')).not.toBeInTheDocument()
    expect(screen.queryByText(/home page/i)).not.toBeInTheDocument()
    authState.role = 'admin'
    authState.loading = false
    rerender(tree(['/builder']))
    expect(await screen.findByText('Admin lessons page')).toBeInTheDocument()
  })

  it('a non-admin with no lesson sees a one-line note with a link home', async () => {
    const user = userEvent.setup()
    renderAt(['/builder'])
    const link = await screen.findByRole('link', { name: /home page/i })
    expect(screen.queryByText('Admin lessons page')).not.toBeInTheDocument()
    await user.click(link)
    expect(screen.getByText('Home page')).toBeInTheDocument()
  })

  it('+ New Lesson (?advanced=1, no load) still opens a blank lesson in the editor', async () => {
    authState.role = 'admin'
    renderAt(['/builder?advanced=1'])
    const view = await screen.findByTestId('builder-view')
    expect(view).toHaveTextContent('blank')
    expect(view).toHaveAttribute('data-advanced', 'true')
    expect(screen.queryByText('Admin lessons page')).not.toBeInTheDocument()
  })

  it('Start fresh on the restore prompt sends an admin with no params to Admin', async () => {
    authState.role = 'admin'
    localStorage.setItem('headstart_builder_current', JSON.stringify({ id: 'l9', tasks: [] }))
    const user = userEvent.setup()
    renderAt(['/builder'])
    await user.click(await screen.findByRole('button', { name: 'Start fresh' }))
    expect(await screen.findByText('Admin lessons page')).toBeInTheDocument()
  })

  it('Start fresh with ?advanced=1 opens a blank lesson', async () => {
    authState.role = 'admin'
    localStorage.setItem('headstart_builder_current', JSON.stringify({ id: 'l9', tasks: [] }))
    const user = userEvent.setup()
    renderAt(['/builder?advanced=1'])
    await user.click(await screen.findByRole('button', { name: 'Start fresh' }))
    expect(await screen.findByTestId('builder-view')).toHaveTextContent('blank')
  })

  it('the toolbar All lessons takes an admin back to Admin > Lessons', async () => {
    authState.role = 'admin'
    const user = userEvent.setup()
    renderAt(['/builder?load=l1'])
    await user.click(await screen.findByRole('button', { name: 'All lessons' }))
    expect(await screen.findByText('Admin lessons page')).toBeInTheDocument()
  })

  it('a non-admin sees no All lessons button', async () => {
    renderAt(['/builder?load=l1'])
    expect(await screen.findByTestId('builder-view')).toHaveTextContent('l1')
    expect(screen.queryByRole('button', { name: 'All lessons' })).not.toBeInTheDocument()
  })

  it('All lessons still asks first when there are unsaved changes', async () => {
    authState.role = 'admin'
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    localStorage.setItem('headstart_builder_current', JSON.stringify({ id: 'l9', tasks: [] }))
    const user = userEvent.setup()
    try {
      renderAt(['/builder'])
      await user.click(await screen.findByRole('button', { name: 'Restore' }))
      await user.click(await screen.findByRole('button', { name: 'All lessons' }))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('builder-view')).toHaveTextContent('l9')
      await waitFor(() => expect(screen.queryByText('Admin lessons page')).not.toBeInTheDocument())
    } finally {
      confirm.mockRestore()
    }
  })
})
