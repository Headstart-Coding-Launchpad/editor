// Image Lab: the student's "Save my picture" button on the Stage pane.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { saveStagePicture } = vi.hoisted(() => ({ saveStagePicture: vi.fn(async () => true) }))
vi.mock('../savePicture.js', () => ({
  saveStagePicture,
  stagePictureFileName: (title) => `${title || 'my'}-picture.png`,
}))

const { default: StagePane } = await import('../StagePane.jsx')

const drawing = [{ type: 'background', colour: '#ff0000' }]

describe('StagePane Save my picture', () => {
  it('offers the button in the student workspace once there is a drawing', async () => {
    render(<StagePane commands={drawing} saveTitle="green-screen" />)
    const button = screen.getByRole('button', { name: 'Save my picture' })
    await userEvent.click(button)
    await waitFor(() =>
      expect(saveStagePicture).toHaveBeenCalledWith(drawing, 'green-screen-picture.png')
    )
  })

  it('hides it without a drawing, without saveTitle and in the compact tutor views', () => {
    const { rerender } = render(<StagePane commands={[]} saveTitle="" />)
    expect(screen.queryByTestId('stage-save-picture')).toBeNull()
    rerender(<StagePane commands={drawing} />)
    expect(screen.queryByTestId('stage-save-picture')).toBeNull()
    rerender(<StagePane commands={drawing} saveTitle="" compact />)
    expect(screen.queryByTestId('stage-save-picture')).toBeNull()
  })
})
