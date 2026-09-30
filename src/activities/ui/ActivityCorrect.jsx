// The ✓ that marks a completed activity step. It spins once when it mounts (`motion-spin-once`;
// the reduced-motion block in index.css turns that off), so callers render it only while the
// answer is correct and it celebrates the moment correctness appears.
export function SpinTick() {
  return <span className="act-correct-tick motion-spin-once">✓</span>
}

// The shared "✓ Correct" result line for activity StudentViews. `children` replaces the word
// ("Well done!"); the paragraph keeps role="status" so screen readers announce it.
export default function ActivityCorrect({ children = 'Correct' }) {
  return (
    <p className="act-result act-result--pass" role="status">
      <SpinTick /> {children}
    </p>
  )
}
