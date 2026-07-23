import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TargetedStageOfferPreview } from '../TaskCheckResults'

describe('TargetedStageOfferPreview', () => {
  it('lets authors exercise the highest-priority linked stage from the feedback banner', async () => {
    const user = userEvent.setup()
    render(
      <TargetedStageOfferPreview
        lessonType="python"
        task={{ codeStages: [{ label: 'Loop reference', code: 'for name in names:\n  print(name)' }] }}
        incorrectCheckResults={[
          { passed: true, priority: 2, hint: 'Less specific', stageOffer: { stageIndex: 0, action: 'replace' } },
          { passed: true, priority: 1, hint: 'Use a loop', stageOffer: { stageIndex: 0, action: 'preview' } },
        ]}
      />,
    )

    expect(screen.getByText('Student feedback preview')).toBeInTheDocument()
    expect(screen.getByText('Use a loop')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show Loop reference/i }))
    expect(screen.getByText(/for name in names/i)).toBeInTheDocument()
  })
})
