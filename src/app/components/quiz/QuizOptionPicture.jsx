import React from 'react'
import {
  optionHasPicture,
  optionPictureName,
  optionPictureSource,
} from '../../../shared/quizPictureOptions'

// The picture of a picture answer option (`image` URL or `emoji`, with `alt`), shared by the
// quiz card (fills its box, never cropped) and the tutor's thumbnails (StudentCard summary,
// "Correct answer" note, Builder). Returns null for an option with no picture.
//
// Validation is not enough here: a Builder save, a direct Firestore write or an import can store
// anything. So only an https image is ever loaded (lazily, with no referrer); otherwise, and when
// the image fails to load, the card shows the emoji, else the alt text in words, never an empty
// box. With no alt text (a validation error) the caption, else the option id, stands in for it, as
// the accessible name and the words: never an empty name or a '?'. `decorative`: the label beside it already says what it shows (tutor thumbnails), so the
// picture is hidden from screen readers rather than announced twice.
export function QuizOptionPicture({ option, size = null, style, decorative = false }) {
  const [failedSrc, setFailedSrc] = React.useState(null)
  if (!optionHasPicture(option)) return null
  const alt = typeof option.alt === 'string' ? option.alt.trim() : ''
  const name = optionPictureName(option)
  const source = optionPictureSource(option)
  const box = size
    ? { width: size, height: size, flexShrink: 0 }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%' }

  if (source?.kind === 'image' && failedSrc !== source.src) {
    return (
      <img
        src={source.src}
        alt={decorative ? '' : alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedSrc(source.src)}
        style={{ ...box, objectFit: 'contain', display: 'block', ...style }}
      />
    )
  }

  const fallbackEmoji = typeof option.emoji === 'string' ? option.emoji.trim() : ''
  if (fallbackEmoji) {
    return (
      <span
        {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
        data-quiz-picture="emoji"
        style={{
          ...box,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          fontSize: size
            ? Math.round(size * 0.75)
            : 'calc(var(--quiz-option-scale, 1) * clamp(3rem, 12vh, 7rem))',
          ...style,
        }}
      >
        {fallbackEmoji}
      </span>
    )
  }

  // No picture that can be shown: the alt text, in words, in the picture's place.
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : {})}
      data-quiz-picture="words"
      style={{
        ...box,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: size ? 2 : 8,
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
        overflow: 'hidden',
        fontSize: size ? '0.6rem' : '1.1rem',
        lineHeight: 1.25,
        color: 'var(--colour-text)',
        background: '#f9fafb',
        border: '1px dashed #d1d5db',
        borderRadius: 6,
        ...style,
      }}
    >
      {name}
    </span>
  )
}
