import React from 'react'

// Builder quiz-type picker icons (one per legacy quiz activity; each quiz_<type>/ui.jsx exposes
// its own as `BuilderIcon`).
export function QuizTypeIcon({ type }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  if (type === 'match')
    return (
      <svg {...common}>
        <path d="M7 7h.01" />
        <path d="M7 17h.01" />
        <path d="M17 7h.01" />
        <path d="M17 17h.01" />
        <path d="M8 7h8" />
        <path d="M8 17h8" />
      </svg>
    )
  if (type === 'blank')
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M4 12h6" />
        <path d="M14 12h6" />
        <path d="M4 17h16" />
      </svg>
    )
  if (type === 'answer')
    return (
      <svg {...common}>
        <path d="M4 5h16" />
        <path d="M4 12h10" />
        <path d="M4 19h7" />
        <path d="M15 18l2 2 4-5" />
      </svg>
    )
  if (type === 'poll')
    return (
      <svg {...common}>
        <path d="M4 6h10" />
        <path d="M4 12h16" />
        <path d="M4 18h7" />
      </svg>
    )
  if (type === 'confidence')
    return (
      <svg {...common}>
        <rect x="3" y="14" width="3" height="6" rx="1" />
        <rect x="8" y="10" width="3" height="10" rx="1" />
        <rect x="13" y="6" width="3" height="14" rx="1" />
        <rect x="18" y="2" width="3" height="18" rx="1" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="2" />
      <path d="M11 7h8" />
      <circle cx="7" cy="17" r="2" />
      <path d="M11 17h8" />
    </svg>
  )
}

export default QuizTypeIcon
