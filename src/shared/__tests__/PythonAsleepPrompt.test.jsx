// "Python fell asleep" (deep review R3, review fixes 10 Nov): one Reload button that always
// reloads, says "Your code is safe" only where the reload really brings the code back, and
// comes back if the reload could not happen.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PythonAsleepPrompt from '../PythonAsleepPrompt'

describe('PythonAsleepPrompt', () => {
  it('promises the code is safe only with codeSafe', () => {
    const { rerender } = render(<PythonAsleepPrompt codeSafe onReload={vi.fn()} />)
    expect(screen.getByTestId('python-asleep')).toHaveTextContent(
      '😴 Python fell asleep. Your code is safe 💾'
    )
    rerender(<PythonAsleepPrompt onReload={vi.fn()} />)
    const prompt = screen.getByTestId('python-asleep')
    expect(prompt).toHaveTextContent('😴 Python fell asleep. Tap Reload to start Python again')
    expect(prompt.textContent).not.toMatch(/safe/)
  })

  it('turns the button back on when the reload throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onReload = vi.fn(() => {
      throw new Error('storage blocked')
    })
    render(<PythonAsleepPrompt codeSafe onReload={onReload} />)
    const button = screen.getByRole('button', { name: 'Reload 🔄' })
    fireEvent.click(button)
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(button).not.toBeDisabled()
    vi.restoreAllMocks()
  })
})
