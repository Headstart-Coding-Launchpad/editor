# Keyboard type_code mode: type a multi-line block of real code with indentation

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Typing for Coders' core activity is typing short real Python and HTML blocks, with indentation, marked for accuracy and speed. Every lesson uses it from Lesson 3 (quotes) onwards, and Lessons 7 (indentation and Tab) and 8 (copying accurately) can't run without it.

Closest existing capability (from `lessons capabilities`): Keyboard type_text (platform-docs/activities/keyboard.md): one line only, at most 200 characters, so no newlines or indentation. Python/HTML tasks with copyCode check the result but not accuracy or speed while typing.

Current workaround and why it falls short: Split code into single type_text lines (loses indentation and line structure), or use a real Python task with copyCode (no accuracy or speed marking). Fails Typing for Coders Lesson 7's headline skill (indentation and Tab) and Lesson 8's (copying a block accurately).

## Example task

    - type: activity
      activity: keyboard
      title: Type the loop
      mode: type_code
      language: python            # python | html (syntax colouring only)
      minAccuracy: 0.95
      targetCpm: 90               # optional speed goal, characters a minute
      items:
        - code: |
            for i in range(3):
                print("Hi")
        - code: |
            <ul>
              <li>Milk</li>
            </ul>
    

## Checks wanted

Self-marking, like type_text:
- Each typed character is marked right or wrong against `code`, including newlines and indentation. Leading indentation accepts Tab or the right number of spaces (Tab = 4 spaces for Python, 2 for HTML), so students learn Tab without being failed for spacing style.
- An item passes when accuracy >= minAccuracy at the end of the block. Speed is shown, and checked only when targetCpm is set.
- Report per item: accuracy, characters a minute, corrections (Backspace/Delete), time. Feeds typing history (P09) when that exists.
- Enter moves to the next line, and auto-indent is off, so the student types the indentation themselves.


## Devices

Physical keyboard required; omit or block on touch devices (on-screen keyboards hide symbols). Mac: Cmd for Ctrl as elsewhere; note keyboard.md's known UK Mac symbol layout gap.

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- Typing for Coders (Typing for Coders.md §6 Lessons 3–12 (core activity; Lesson 7 indentation, Lesson 8 copying accurately)): The course's main practice activity in every lesson.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->

Shipped 2026-10-14 on branch `feature/keyboard-type-code-falling-words` (not yet merged): Keyboard activity `mode: type_code` (`src/activities/keyboard/typeCode.js`). Items take a multi-line `code` (≤ 1000 characters, ≤ 30 lines); task fields `language` (python | html), `minAccuracy` (default 0.9) and optional `targetCpm`. Every character is marked, newlines and indentation included; Tab at the start of a line = 4 spaces (Python) / 2 (HTML), Enter with no auto-indent. Per item it records `accuracy`, `cpm`, `wpm`, `corrections`, `timeMs` (the shared typing-result shape). The on-screen keyboard is blocked. Docs: [activities/keyboard.md](../activities/keyboard.md#typing-code-type_code).
