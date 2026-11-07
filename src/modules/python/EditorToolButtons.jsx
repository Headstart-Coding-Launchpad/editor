import React from 'react'
import EmojiPickerButton from '../../shared/EmojiPickerButton'
import { useBlockGuidesOn } from '../../shared/blockGuidesSetting'

// The Python editor's Blocks and Emoji buttons, in one place for both places they show: the
// editor's own toolbar (PythonEditor, outside the calm host: the teacher's view, Builder, shared
// work) and the calm code row (StudentWorkspace). A fix here reaches both, so they cannot drift.

const BLOCKS_TITLE_ON = 'Hide the coloured brackets that show which lines belong to each block'
const BLOCKS_TITLE_OFF = 'Show coloured brackets for which lines belong to each block'

/**
 * Turns this device's block brackets on and off (useBlockGuidesOn, shared by every editor).
 * `showLabel: false` leaves only the bracket (a narrow code row); its name is still "Blocks".
 * Styles come from the host: `style`, `onStyle` while on, `iconStyle` for the bracket.
 */
export function BlocksButton({ style, onStyle, iconStyle, showLabel = true }) {
  const [on, setOn] = useBlockGuidesOn()
  return (
    <button
      type="button"
      style={{ ...style, ...(on ? onStyle : null) }}
      aria-pressed={on}
      aria-label="Blocks"
      title={on ? BLOCKS_TITLE_ON : BLOCKS_TITLE_OFF}
      onClick={() => setOn(!on)}
    >
      <span aria-hidden="true" style={iconStyle}>
        ⎣
      </span>
      {showLabel && 'Blocks'}
    </button>
  )
}

/** The 😊 Emoji picker, typing into the editor through `insert(text)`. */
export function EmojiButton({ insert, size }) {
  return <EmojiPickerButton size={size} onInsert={(emoji) => insert?.(emoji)} />
}
