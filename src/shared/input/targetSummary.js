// A tiny, serialisable summary of HOW a student used a workspace surface (the Desktop), for the
// input_* checks (./checks.js). Counts gestures per semantic target kind (data-input-kind: file,
// folder, window, icon), drags by source → drop-target kind, shortcuts by how they were issued
// (keyboard vs menu), and Shift vs Caps Lock capitals. Counts are capped, so the summary only
// changes a bounded number of times however long the student works — callers re-check (and
// write) on change, never per keystroke. Raw events stay in the in-memory recorder.
// Pure: Node-safe.

import { comboOf } from './events.js'
import { recognizeGestures } from './gestures.js'
import { createInputRecorder } from './recorder.js'
import { typedCharacters } from './summary.js'

export const INPUT_TARGET_KINDS = ['file', 'folder', 'window', 'icon']
// How a shortcut's action was issued: a key combo, or the equivalent menu/toolbar command.
export const SHORTCUT_VIA = ['keyboard', 'menu']
export const DEFAULT_SUMMARY_CAP = 5

// Keys that count as a shortcut on their own (no Ctrl/Cmd/Alt needed): F1–F12 and Delete.
const LONE_SHORTCUT_KEYS = /^(f([1-9]|1[0-2])|delete)$/

export function isShortcutCombo(combo) {
  const parts = String(combo ?? '').split('+')
  const key = parts[parts.length - 1]
  return parts.includes('mod') || parts.includes('alt') || LONE_SHORTCUT_KEYS.test(key)
}

export function emptyInputSummary() {
  return { gestures: {}, drops: {}, shortcuts: {}, shiftCapitals: 0, capsLockCapitals: 0 }
}

function add(obj, key, amount, cap) {
  if (!amount) return
  obj[key] = Math.min(cap, (obj[key] ?? 0) + amount)
}

function addNested(obj, outer, inner, amount, cap) {
  if (!amount) return
  obj[outer] = obj[outer] ?? {}
  add(obj[outer], inner, amount, cap)
}

// Summarise one list of normalised events (events.js) into the summary shape:
//   gestures:  { double_click: { any: 2, file: 1, folder: 1 }, drag: { any: 1, file: 1 } }
//   drops:     { 'file>folder': 1, 'any>folder': 1 }   // drags by source kind > drop kind
//   shortcuts: { 'mod+c': { keyboard: 1, menu: 1 } }
//   shiftCapitals, capsLockCapitals
// Zero counts are omitted. Command events ({ kind: 'command', combo, via }) record a menu or
// toolbar action that has a keyboard shortcut.
export function summarizeTargetedInput(events, { cap = DEFAULT_SUMMARY_CAP } = {}) {
  const summary = emptyInputSummary()
  const list = Array.isArray(events) ? events : []
  for (const gesture of recognizeGestures(list.filter((e) => e.pointerType))) {
    addNested(summary.gestures, gesture.gesture, 'any', 1, cap)
    if (gesture.targetKind) addNested(summary.gestures, gesture.gesture, gesture.targetKind, 1, cap)
    if (gesture.gesture === 'drag' && gesture.toTargetKind) {
      add(summary.drops, `any>${gesture.toTargetKind}`, 1, cap)
      if (gesture.targetKind) {
        add(summary.drops, `${gesture.targetKind}>${gesture.toTargetKind}`, 1, cap)
      }
    }
  }
  for (const event of list) {
    if (event.kind === 'keydown' && !event.repeat) {
      const combo = comboOf(event)
      if (combo && isShortcutCombo(combo)) addNested(summary.shortcuts, combo, 'keyboard', 1, cap)
    } else if (event.kind === 'command' && event.combo && SHORTCUT_VIA.includes(event.via)) {
      addNested(summary.shortcuts, event.combo, event.via, 1, cap)
    }
  }
  const typed = typedCharacters(list)
  summary.shiftCapitals = Math.min(cap, typed.filter((c) => c.method === 'shift').length)
  summary.capsLockCapitals = Math.min(cap, typed.filter((c) => c.method === 'caps_lock').length)
  return summary
}

export function mergeInputSummaries(a, b, { cap = DEFAULT_SUMMARY_CAP } = {}) {
  const merged = emptyInputSummary()
  for (const source of [a, b]) {
    if (!source) continue
    for (const [gesture, counts] of Object.entries(source.gestures ?? {})) {
      for (const [kind, n] of Object.entries(counts)) {
        addNested(merged.gestures, gesture, kind, n, cap)
      }
    }
    for (const [key, n] of Object.entries(source.drops ?? {})) add(merged.drops, key, n, cap)
    for (const [combo, counts] of Object.entries(source.shortcuts ?? {})) {
      for (const [via, n] of Object.entries(counts)) addNested(merged.shortcuts, combo, via, n, cap)
    }
    merged.shiftCapitals = Math.min(cap, merged.shiftCapitals + (source.shiftCapitals ?? 0))
    merged.capsLockCapitals = Math.min(
      cap,
      merged.capsLockCapitals + (source.capsLockCapitals ?? 0)
    )
  }
  return merged
}

// Events after which nothing earlier can change a later gesture, so the recorded segment can be
// folded into the running totals (keeps memory bounded and stops the ring buffer from evicting
// gestures the student already made).
const SEGMENT_END_KINDS = new Set(['click', 'dblclick', 'contextmenu', 'keydown', 'command'])

// An in-memory recorder for one surface and one task attempt: record normalised events, read the
// running summary. Never persisted or synced; only summary() leaves it.
export function createInputTally({ cap = DEFAULT_SUMMARY_CAP, maxEvents } = {}) {
  const recorder = createInputRecorder(maxEvents ? { maxEvents } : undefined)
  let committed = emptyInputSummary()
  let pressed = false
  let nativeDrag = false
  // Open hovers (targetId → its pointerenter), carried into the next segment so a hover that
  // spans a commit still measures its dwell.
  const hovering = new Map()

  function commit() {
    committed = mergeInputSummaries(committed, summarizeTargetedInput(recorder.events(), { cap }), {
      cap,
    })
    recorder.reset()
    for (const enter of hovering.values()) recorder.record(enter)
  }

  return {
    record(event) {
      if (!event?.kind) return
      recorder.record(event)
      if (event.kind === 'pointerdown') pressed = true
      if (event.kind === 'pointerup' || event.kind === 'pointercancel') pressed = false
      if (event.kind === 'dragstart') nativeDrag = true
      if (event.kind === 'drop' || event.kind === 'dragend') nativeDrag = false
      if (event.kind === 'pointerenter' && event.targetId) hovering.set(event.targetId, event)
      if (event.kind === 'pointerleave') hovering.delete(event.targetId)
      if (SEGMENT_END_KINDS.has(event.kind) && !pressed && !nativeDrag) commit()
    },
    summary() {
      return mergeInputSummaries(committed, summarizeTargetedInput(recorder.events(), { cap }), {
        cap,
      })
    },
    reset() {
      recorder.reset()
      committed = emptyInputSummary()
      pressed = false
      nativeDrag = false
      hovering.clear()
    },
  }
}
