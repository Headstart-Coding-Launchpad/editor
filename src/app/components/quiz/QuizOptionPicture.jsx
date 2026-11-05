import React from 'react'
import { optionHasPicture } from '../../../shared/quizPictureOptions'

// The picture of a picture answer option (`image` URL or `emoji`, with `alt`), shared by the
// quiz card (fills its box, never cropped) and the tutor's thumbnails (StudentCard summary,
// "Correct answer" note). Returns null for an option with no picture.
export function QuizOptionPicture({ option, size = null, style }) {
  if (!optionHasPicture(option)) return null
  const alt = option.alt ?? ''
  const box = size
    ? { width: size, height: size, flexShrink: 0 }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%' }
  if (option.image?.trim()) {
    return (
      <img
        src={option.image.trim()}
        alt={alt}
        draggable={false}
        style={{ ...box, objectFit: 'contain', display: 'block', ...style }}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label={alt}
      style={{
        ...box,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        fontSize: size ? Math.round(size * 0.75) : 'clamp(2.5rem, 9vh, 5.5rem)',
        ...style,
      }}
    >
      {option.emoji}
    </span>
  )
}
