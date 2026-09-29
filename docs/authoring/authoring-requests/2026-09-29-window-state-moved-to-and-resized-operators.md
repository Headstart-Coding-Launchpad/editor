# window_state moved_to and resized operators

- **Status:** planned
- **Kind:** check type
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

window_state operators that check a window was moved (into a zone of the screen) and resized, measured against the student's real desktop size. Mouse and Keyboard Lesson 6 (Window Wrangler) teaches moving and resizing windows. The Desktop source spec lists both 'window moved' and 'window resized' among its practical checks (§17) and teaches them in its Lesson 4, but desktop-module-roadmap.md never built them.

Closest existing capability (from `lessons capabilities`): window_state (opened, closed, minimized, maximized) and windows_arranged_side_by_side (which assumes a 1200px viewport). Nothing checks a window's position or size.

Current workaround and why it falls short: Check minimise, close and side-by-side only. The move and resize parts of Lesson 6 go unchecked, so a child can pass the Window Wrangler Mission without ever moving or resizing a window, which fails that lesson's headline objective.

## Example task

    - title: Window Wrangler
      type: desktop
      explainer: Drag the Logbook to the right side of the screen and make the Map smaller.
      check:
        - type: window_state
          appId: textEditor
          operator: moved_to
          zone: right_half      # left_half | right_half | top_half | bottom_half | top_left | top_right | bottom_left | bottom_right
        - type: window_state
          appId: browser
          operator: resized
          size: smaller         # smaller | larger than its starting size; or minWidth / minHeight / maxWidth / maxHeight as fractions of the desktop
        - type: input_gesture
          gesture: drag
          targetKind: window
    

## Checks wanted

- Outcome `moved_to`: the window's centre is inside the named zone of the student's actual desktop area (tolerant, outcome-based, like `windows_arranged_side_by_side`, not exact pixels). A window that is minimised or maximised does not count as moved.
- Outcome `resized`: the window is `smaller` or `larger` than its starting size by a meaningful margin, or meets `minWidth`/`minHeight`/`maxWidth`/`maxHeight` given as fractions of the actual desktop. Maximising doesn't count as resizing.
- Method (optional, existing check): `input_gesture` `drag` with `targetKind: window`, so moving by dragging the title bar can be required.
- Also please make `windows_arranged_side_by_side` use the student's real desktop size instead of the assumed 1200px viewport, since the same geometry code serves both.


## Devices

Mouse and Keyboard blocks tablets (strict input checks), so no touch behaviour is needed; drag on a trackpad works as a mouse drag.

## Notes

Course: Mouse and Keyboard Skills ('Computer Confidence'), ages 7+. Effort estimate from the proposal: S. Includes the side-by-side 1200px fix listed as a known gap in desktop.md and the roadmap's Phase 1. Source: Platform Backlog P23; Mouse and Keyboard Skills.md §5 Lesson 6; Digital Literacy Foundations.pdf §17 and Lesson 4.

### Decisions (Ryan, 2026-09-29)

- `resized` counts when the window's area changes by at least 15% from its size when it opened. Each window records its starting size when it opens.
- The real desktop bounds (measured in `WindowManager.jsx`) go into desktop state and the check context, which also fixes the 1200px fallback in `checks.js` and `Window.jsx`.

## Resolution

Branch `feature/window-state-moved-resized`: `window_state` `moved_to` (zones) and `resized` (`size`, fractional min/max limits, 15% area margin); the desktop state records the measured `viewport` and each window's `startWidth`/`startHeight`; `windows_arranged_side_by_side` uses the real desktop size. Docs: [desktop.md](../desktop.md#moving-and-resizing-windows).
