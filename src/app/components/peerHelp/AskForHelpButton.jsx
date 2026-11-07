import React from 'react'
import { ASK_FOR_HELP_LABEL, HELP_REQUESTED_LABEL } from './helpLabel'

/**
 * '✋ Ask for help': the top-bar ✋ Help's own handler (HelpRequestContext). Once asked it says
 * so and a second tap does nothing, as the top-bar button does. Shared by the failed-check banner
 * (CheckFeedbackBanner) and the calm screen's hint nudge (TaskHintBox); its own module so neither
 * depends on the other.
 */
export function AskForHelpButton({ help, style }) {
  const requested = !!help.requested
  return (
    <button
      type="button"
      style={{ ...style, ...(requested ? { cursor: 'default', textDecoration: 'none' } : null) }}
      onClick={requested ? undefined : help.onAsk}
      aria-disabled={requested ? 'true' : undefined}
      title={requested ? 'Your tutor knows you need help' : 'Ask your tutor for help'}
    >
      {requested ? HELP_REQUESTED_LABEL : ASK_FOR_HELP_LABEL}
    </button>
  )
}

export default AskForHelpButton
