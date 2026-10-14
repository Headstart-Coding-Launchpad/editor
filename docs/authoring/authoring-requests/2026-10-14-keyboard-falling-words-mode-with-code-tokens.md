# Keyboard falling_words mode with code tokens

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Typing for Coders opens every lesson with a falling-words fluency warm-up using code tokens (print(, </p>, for i in), not just words. Imports backlog item P10, extended to tokens with symbols and spaces.

Closest existing capability (from `lessons capabilities`): Keyboard type_text (keyboard.md): a static line to copy; no timed, game-like mode.

Current workaround and why it falls short: A type_text warm-up of code tokens. Works, but fails the Interesting pillar for a warm-up repeated in all 12 lessons, which is why Ryan marked it Launch.

## Example task

    - type: activity
      activity: keyboard
      title: Falling code
      mode: falling_words
      durationSeconds: 90
      words: ["print(", "</p>", "for i in", "if x ==", "<h1>", "input(", "[1, 2]", "\"hi\""]
    

## Checks wanted

- Tokens fall from the top; typing a token exactly clears it. Missed tokens reach the bottom and cost a life or points.
- Tokens may contain symbols and spaces (code tokens, not just words), typed exactly including Shift symbols.
- Passes when the time runs out (it's a warm-up, so it always completes); the score is the outcome.
- Report: tokens cleared, missed, accuracy, characters a minute. Feeds typing history (P09).


## Devices

Physical keyboard required; omit or block on touch devices (on-screen keyboards hide symbols). Mac: Cmd for Ctrl as elsewhere; note keyboard.md's known UK Mac symbol layout gap.

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- Typing for Coders (Typing for Coders.md §6 every lesson's warm-up): Warm-up in every lesson.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
