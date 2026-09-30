// The keyboard shortcuts that count for ⌨️ Keyboard Wizard (docs/architecture/live-badges-plan.md,
// "Keyboard Wizard shortcuts"). One list, so it's easy to extend: add an entry and the detector
// and the rule both pick it up. Pure.
//
// Keys are matched on the lesson work area (editor, Blockly or Desktop surface), never the whole
// window. `mod` is Ctrl on Windows / ChromeOS and Cmd on a Mac. Copy, cut, paste and select-all
// are deliberately missing, AltGr combinations (reported as Ctrl+Alt) never count, and keys pressed
// inside iframes (the HTML preview, Arcade) aren't seen.
//
// Entry: { id, label, keys: [{ key, mod?, shift?, editorOnly? }] | null, source? }
// - `key` is a KeyboardEvent.key value, compared case-insensitively;
// - `editorOnly`: counts only in a code editor (Tab would otherwise move focus);
// - `source: 'desktop'`: reported by the Desktop input recorder rather than matched here.
export const KEYBOARD_WIZARD_SHORTCUTS = Object.freeze(
  [
    {
      id: 'run',
      label: 'Ctrl+Enter',
      description: 'Run',
      keys: [{ key: 'Enter', mod: true }],
    },
    {
      id: 'undo',
      label: 'Ctrl+Z',
      description: 'Undo',
      keys: [{ key: 'z', mod: true }],
    },
    {
      id: 'redo',
      label: 'Ctrl+Y',
      description: 'Redo',
      keys: [
        { key: 'y', mod: true },
        { key: 'z', mod: true, shift: true },
      ],
    },
    {
      id: 'toggle_comment',
      label: 'Ctrl+/',
      description: 'Toggle comment',
      keys: [{ key: '/', mod: true }],
    },
    {
      id: 'indent',
      label: 'Tab',
      description: 'Indent',
      keys: [{ key: 'Tab', editorOnly: true }],
    },
    {
      id: 'outdent',
      label: 'Shift+Tab',
      description: 'Outdent',
      keys: [{ key: 'Tab', shift: true, editorOnly: true }],
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Forward delete, or delete a selected block',
      keys: [{ key: 'Delete' }],
    },
    {
      id: 'find',
      label: 'Ctrl+F',
      description: 'Find',
      keys: [{ key: 'f', mod: true }],
    },
    {
      id: 'save',
      label: 'Ctrl+S',
      description: 'Save',
      keys: [{ key: 's', mod: true }],
    },
    {
      id: 'desktop_shortcut',
      label: 'a Desktop app shortcut',
      description: 'A Desktop app action done by keyboard rather than the menu',
      keys: null,
      source: 'desktop',
    },
  ].map((entry) => Object.freeze({ ...entry, keys: entry.keys && Object.freeze(entry.keys) }))
)

export const KEYBOARD_WIZARD_SHORTCUT_IDS = Object.freeze(
  KEYBOARD_WIZARD_SHORTCUTS.map((shortcut) => shortcut.id)
)

export function getKeyboardWizardShortcut(id) {
  return KEYBOARD_WIZARD_SHORTCUTS.find((shortcut) => shortcut.id === id) ?? null
}

/**
 * The listed shortcut a keydown is, or null. `event` is a KeyboardEvent (or the same fields);
 * `inEditor` says whether focus is in a code editor. AltGr (Ctrl+Alt) never matches, and
 * neither does any other Alt combination.
 */
export function matchKeyboardWizardShortcut(event, { inEditor = false } = {}) {
  if (!event || typeof event.key !== 'string' || event.altKey) return null
  if (event.getModifierState?.('AltGraph')) return null
  const mod = !!(event.ctrlKey || event.metaKey)
  const key = event.key.toLowerCase()
  for (const shortcut of KEYBOARD_WIZARD_SHORTCUTS) {
    const match = (shortcut.keys ?? []).some(
      (combo) =>
        combo.key.toLowerCase() === key &&
        !!combo.mod === mod &&
        !!combo.shift === !!event.shiftKey &&
        (!combo.editorOnly || inEditor)
    )
    if (match) return shortcut
  }
  return null
}

/**
 * The Desktop app actions that count as `desktop_shortcut` when done by keyboard (the menu and
 * toolbar offer the same commands; see the Desktop's COMMAND_COMBOS). Combos are the input
 * library's canonical form (src/shared/input/events.js comboOf): Ctrl and Cmd are both 'mod'.
 */
export const DESKTOP_KEYBOARD_COMBOS = Object.freeze(['mod+c', 'mod+x', 'mod+v'])

/** Whether a canonical key combo, pressed on the Desktop surface, is a Desktop app shortcut. */
export function isDesktopKeyboardShortcut(combo) {
  return typeof combo === 'string' && DESKTOP_KEYBOARD_COMBOS.includes(combo)
}
