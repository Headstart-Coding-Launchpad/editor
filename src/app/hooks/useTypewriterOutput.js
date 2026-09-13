import { useEffect, useState } from 'react'

// Reveals program output with a retro typing animation. Both the classroom OutputPanel
// and the Builder's carried a byte-identical copy of this effect.
//
// Output arrives as a growing string, so the usual case is appending whatever is new.
// When it stops being a prefix of itself the program was re-run, and the reveal restarts
// from empty. Long output types in bigger chunks so a thousand-line dump doesn't take a
// minute to appear.
function nextChunkSize(remainingLength) {
  if (remainingLength > 500) return 25
  if (remainingLength > 200) return 12
  if (remainingLength > 100) return 6
  if (remainingLength > 50) return 3
  if (remainingLength > 20) return 2
  return 1
}

export function useTypewriterOutput(output) {
  const [displayedOutput, setDisplayedOutput] = useState('')

  useEffect(() => {
    if (!output) {
      setDisplayedOutput('')
      return
    }
    if (displayedOutput === output) return

    const timer = setTimeout(() => {
      setDisplayedOutput((prev) => {
        if (prev === output) return prev
        const current = output.startsWith(prev) ? prev : ''
        const remaining = output.slice(current.length)
        if (remaining.length === 0) return current
        return current + remaining.slice(0, nextChunkSize(remaining.length))
      })
    }, 12)

    return () => clearTimeout(timer)
  }, [output, displayedOutput])

  return displayedOutput
}
