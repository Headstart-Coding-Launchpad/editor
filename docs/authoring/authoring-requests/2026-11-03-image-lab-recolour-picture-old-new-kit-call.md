# Image Lab: recolour(picture, old, new) kit call

- **Status:** built (branch feature/image-lab-recolour, not merged; waiting on Ryan's merge OK)
- **Kind:** tooling
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-11-03
- **Lessons blocked:** Python::Level 1::9 (Level 1 Lesson 9 - Booleans/flags Milestone (Secret spy photo))

## Need

Python L1 L9 (Secret spy photo) must disguise a picture's real colour and restore it on the right password at Level 1. The only way today is a for/range/len/indexing loop over the picture (spy[i]), taught in L2 L8, L3 L3 and L3B L2, so students either can't write it or it has to be locked given code (Ryan rejected heavy locking, 3 Nov). A one-line call lets students write both steps themselves.

Closest existing capability (from `lessons capabilities`): Image Lab in platform-docs/python.md (load_image, grid, rgb, red/green/blue, snapshot): gives the picture as a list and colour helpers, no whole-picture recolour.

Current workaround and why it falls short: Given locked for-loop (rejected: over half the starter locked, untaught syntax) or a reveal with no recolouring (changes the Milestone).

## Example task

    spy = load_image("pixel_fox", size=16)\nrecolour(spy, real, disguise)\n...\nif unlocked:\n    recolour(spy, disguise, real)\ngrid(spy, width=16)

## Notes

Lessons that hit this gap:

- Python::Level 1::9 (Level 1 Lesson 9 - Booleans/flags Milestone (Secret spy photo)) — blocks the lesson's headline objective: Ryan chose option A in #lesson-gen 3 Nov 11:07 (recolour call) over reworking the reveal; Code waits on it.

## Resolution

Built on branch `feature/image-lab-recolour` (LaunchPad Dev, 2026-11-03), not yet on main.

- `recolour(picture, old, new)` is part of the `stage` module (`from stage import *`), in
  `src/shared/stage/stagePicturesPy.js`. It changes the list in place and returns `None`; the next
  `grid(spy, width=16)` shows it. Recolouring back restores the picture exactly.
- Matching: exact, no tolerance. `load_image("pixel_fox")` pixels are exact colour names, so none
  is needed; colours match however they are written (`"orange"`, `"#FFA500"`, `(255, 165, 0)`),
  and `new` is stored as written, so `spy[i] == "royalblue"` holds afterwards. On photos it only
  changes pixels of exactly that hex code (keep it to pixel art).
- Errors are plain words naming `recolour()`: unknown colour, a picture in quotes ("use the
  picture's name without quotes"), a tuple, missing values, unknown keywords.
- Docs: [stage.md → Image Lab](../stage.md#10-image-lab-pictures-are-lists) (the spy photo
  example), [python.md](../python.md), CHANGELOG 2026-11-03.
- Tutor view: nothing new; the Stage already shows on the tutor card and in StudentModal.
