import React, { Component, Fragment } from 'react'

/**
 * Catches a render error in one part of the screen so the rest keeps working (deep review
 * 2026-11-10, R2). Only the wrapped pane is replaced, by a calm card with one Try again button
 * that mounts the pane again; the pane's state lives above it (useStudentCodeState, the session),
 * so the child's code comes back with it. Nothing is written anywhere.
 *
 * variant 'child' (student screens): emoji, "Something went wrong.", "Your code is safe".
 * variant 'tutor' (dashboard card, Student View Modal, admin routes): a plain line naming the pane.
 * `resetKey`: a change (another task, another student) clears the error by itself.
 * `compact`: a one-line strip, for small slots such as a student row.
 */
export default class RenderErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, attempt: 0, resetKey: props.resetKey }
    this.retry = this.retry.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey, error: null }
    }
    return null
  }

  componentDidCatch(error, info) {
    console.error(`[RenderErrorBoundary] ${this.props.label ?? 'pane'} hit an error`, error, info)
  }

  retry() {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))
  }

  render() {
    const { error, attempt } = this.state
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>
    const { variant = 'child', label = 'This pane', compact = false } = this.props
    if (variant === 'tutor') {
      return (
        <div
          role="alert"
          data-testid="render-error-fallback"
          style={compact ? s.tutorCompact : s.tutor}
        >
          <span>{label} hit an error.</span>
          <button
            type="button"
            className="btn-secondary"
            style={s.tutorButton}
            onClick={this.retry}
          >
            Try again
          </button>
        </div>
      )
    }
    return (
      <div role="alert" data-testid="render-error-fallback" style={s.child}>
        <span style={s.emoji} aria-hidden="true">
          😵‍💫
        </span>
        <p style={s.title}>Something went wrong.</p>
        <p style={s.body}>Tap to try again. Your code is safe 💾</p>
        <button type="button" className="btn-secondary" style={s.childButton} onClick={this.retry}>
          Try again 🔄
        </button>
      </div>
    )
  }
}

const s = {
  child: {
    flex: 1,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 24,
    textAlign: 'center',
    background: '#fff',
    borderRadius: 8,
    boxSizing: 'border-box',
  },
  emoji: { fontSize: 44, lineHeight: 1 },
  title: {
    margin: '6px 0 0',
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--colour-primary)',
  },
  body: { margin: 0, fontSize: 15, color: '#4b5563' },
  childButton: {
    marginTop: 10,
    minHeight: 44,
    padding: '10px 22px',
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 10,
  },
  tutor: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    minHeight: 120,
    fontSize: 14,
    color: '#374151',
    background: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: 8,
  },
  tutorCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    fontSize: 13,
    color: '#374151',
    background: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: 8,
  },
  tutorButton: { padding: '4px 12px', fontSize: 13, borderRadius: 6 },
}
