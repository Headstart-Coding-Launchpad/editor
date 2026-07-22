import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CheckFeedbackBanner from '../CheckFeedbackBanner'

// CheckFeedbackBanner imports MarkdownRenderer from shared/markdown.
// We do NOT mock it — letting it render keeps the tests honest and avoids
// masking real rendering issues.

describe('CheckFeedbackBanner', () => {
  describe('when no props are passed (no check result)', () => {
    it('renders a status region even without props (component always mounts)', () => {
      // The component always renders a div[role="status"] — it has no "null"
      // early-return branch. Verifying it mounts without crashing is the goal.
      render(<CheckFeedbackBanner />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('pass state (passed=true)', () => {
    it('renders the default success message', () => {
      render(<CheckFeedbackBanner passed={true} />)
      expect(screen.getByText('Correct!')).toBeInTheDocument()
    })

    it('renders a custom successMessage when provided', () => {
      render(<CheckFeedbackBanner passed={true} successMessage="Well done!" />)
      expect(screen.getByText('Well done!')).toBeInTheDocument()
    })

    it('renders non-blocking nudge text on pass', () => {
      render(<CheckFeedbackBanner passed={true} suggestion="Nice work. Try a clearer variable name." />)
      expect(screen.getByText('Correct!')).toBeInTheDocument()
      expect(screen.getByText(/clearer variable name/i)).toBeInTheDocument()
    })

    it('does not render the "Load complete code" button on pass', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={true} onShowCompleteCode={handler} />)
      expect(screen.queryByRole('button', { name: /Load complete code/i })).not.toBeInTheDocument()
    })

    it('renders the checkmark icon on pass', () => {
      render(<CheckFeedbackBanner passed={true} />)
      expect(screen.getByText('✓')).toBeInTheDocument()
    })
  })

  describe('fail state (passed=false)', () => {
    it('renders the default failure message when no suggestion is provided', () => {
      render(<CheckFeedbackBanner passed={false} />)
      expect(screen.getByText('Not quite, try again!')).toBeInTheDocument()
    })

    it('renders a custom failureMessage when provided and no suggestion', () => {
      render(<CheckFeedbackBanner passed={false} failureMessage="Have another go!" />)
      expect(screen.getByText('Have another go!')).toBeInTheDocument()
    })

    it('renders hint text from suggestion instead of failureMessage when suggestion is present', () => {
      render(<CheckFeedbackBanner passed={false} suggestion="Try using a **for loop**." />)
      // The suggestion is rendered via MarkdownRenderer — the plain text part should be present
      expect(screen.getByText(/Try using a/i)).toBeInTheDocument()
      // The default failureMessage should NOT appear when suggestion is provided
      expect(screen.queryByText('Not quite, try again!')).not.toBeInTheDocument()
    })

    it('renders the exclamation icon on fail', () => {
      render(<CheckFeedbackBanner passed={false} />)
      expect(screen.getByText('!')).toBeInTheDocument()
    })

    it('does not render the "Load complete code" button when onShowCompleteCode is not provided', () => {
      render(<CheckFeedbackBanner passed={false} />)
      expect(screen.queryByRole('button', { name: /Load complete code/i })).not.toBeInTheDocument()
    })

    it('renders the "Load complete code" button when onShowCompleteCode is provided and passed=false', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCompleteCode={handler} />)
      expect(screen.getByRole('button', { name: /Load complete code/i })).toBeInTheDocument()
    })

    it('calls onShowCompleteCode when the button is clicked', async () => {
      const user = userEvent.setup()
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCompleteCode={handler} />)
      await user.click(screen.getByRole('button', { name: /Load complete code/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('renders the "Ready to use it?" prompt text alongside the button', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCompleteCode={handler} />)
      expect(screen.getByText(/Ready to use it\?/i)).toBeInTheDocument()
    })
  })

  describe('onPreviewCompleteCode (non-destructive complete-code preview)', () => {
    it('does not render the "See complete code" button when onPreviewCompleteCode is not provided', () => {
      render(<CheckFeedbackBanner passed={false} />)
      expect(screen.queryByRole('button', { name: /See complete code/i })).not.toBeInTheDocument()
    })

    it('renders the "See complete code" button when onPreviewCompleteCode is provided and passed=false', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onPreviewCompleteCode={handler} />)
      expect(screen.getByRole('button', { name: /See complete code/i })).toBeInTheDocument()
    })

    it('calls onPreviewCompleteCode when the button is clicked', async () => {
      const user = userEvent.setup()
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onPreviewCompleteCode={handler} />)
      await user.click(screen.getByRole('button', { name: /See complete code/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('renders the "Want to see the complete code?" prompt text alongside the button', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onPreviewCompleteCode={handler} />)
      expect(screen.getByText(/Want to see the complete code\?/i)).toBeInTheDocument()
    })

    it('renders both the preview and load-into-editor buttons when both handlers are provided', () => {
      render(<CheckFeedbackBanner passed={false} onPreviewCompleteCode={vi.fn()} onShowCompleteCode={vi.fn()} />)
      expect(screen.getByRole('button', { name: /See complete code/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Load complete code/i })).toBeInTheDocument()
    })
  })

  describe('onShowCodeStage (code stage hint)', () => {
    it('does not render the "Move to next stage" button when onShowCodeStage is not provided', () => {
      render(<CheckFeedbackBanner passed={false} />)
      expect(screen.queryByRole('button', { name: /Move to next stage/i })).not.toBeInTheDocument()
    })

    it('renders the "Move to next stage" button when onShowCodeStage is provided and passed=false', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCodeStage={handler} />)
      expect(screen.getByRole('button', { name: /Move to next stage/i })).toBeInTheDocument()
    })

    it('calls onShowCodeStage when the button is clicked', async () => {
      const user = userEvent.setup()
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCodeStage={handler} />)
      await user.click(screen.getByRole('button', { name: /Move to next stage/i }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('does not render the "Move to next stage" button when passed=true', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={true} onShowCodeStage={handler} />)
      expect(screen.queryByRole('button', { name: /Move to next stage/i })).not.toBeInTheDocument()
    })

    it('shows stage hint prompt text alongside the button', () => {
      const handler = vi.fn()
      render(<CheckFeedbackBanner passed={false} onShowCodeStage={handler} stageActionLabel="Show reference" />)
      expect(screen.getByText(/Want a hint\?/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Show reference/i })).toBeInTheDocument()
    })
  })

  describe('suggestion edge cases', () => {
    it('treats a whitespace-only suggestion as empty and falls back to failureMessage', () => {
      render(<CheckFeedbackBanner passed={false} suggestion="   " />)
      expect(screen.getByText('Not quite, try again!')).toBeInTheDocument()
    })

    it('renders without crashing when passed is undefined', () => {
      render(<CheckFeedbackBanner />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
