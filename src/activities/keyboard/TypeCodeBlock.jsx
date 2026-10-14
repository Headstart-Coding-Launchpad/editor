import React from 'react'
import { codeColourClasses } from './typeCode.js'

// The type_code block: the code to copy in a monospace block, syntax coloured, with every typed
// character marked right (green) or wrong (red, underlined), a caret where the next character
// goes, faint dots for indentation spaces and a ↵ at each line end so students see the
// whitespace they have to type.
export default function TypeCodeBlock({ code, typed, language, showCaret = true }) {
  const colours = codeColourClasses(code, language)
  const chars = [...code]
  let lineStart = true
  const caret = showCaret ? <span className="act-caret" aria-hidden="true" /> : null
  return (
    <pre className="act-code-block" aria-hidden="true" data-testid="type-code-block">
      {chars.map((char, index) => {
        const leading = lineStart && char === ' '
        if (char === '\n') lineStart = true
        else if (char !== ' ') lineStart = false
        const typedChar = typed[index]
        const mark =
          typedChar === undefined ? null : typedChar === char ? 'act-char--ok' : 'act-char--bad'
        const cls = [
          mark ?? (colours[index] ? `act-code-${colours[index]}` : ''),
          leading || char === '\n' ? 'act-code-ws' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const shown = char === '\n' ? '↵' : leading ? '·' : char
        return (
          <React.Fragment key={index}>
            {index === typed.length && caret}
            <span className={cls || undefined} data-mark={mark ? mark.slice(10) : undefined}>
              {shown}
            </span>
            {char === '\n' && '\n'}
          </React.Fragment>
        )
      })}
      {typed.length >= chars.length && caret}
    </pre>
  )
}
