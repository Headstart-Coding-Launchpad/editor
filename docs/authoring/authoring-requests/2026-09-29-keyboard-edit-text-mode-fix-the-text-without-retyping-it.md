# Keyboard edit_text mode: fix the text without retyping it

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-29
- **Lessons blocked:** none yet

## Need

A Keyboard activity mode where the student starts with a line containing mistakes and fixes it in place with the arrow keys, Backspace, Delete and (extension) Shift+Arrow selection. It must check the final text AND that the student edited it rather than retyping it. Mouse and Keyboard Lesson 9 (Typo Detectives) teaches exactly this: Backspace vs Delete and moving the cursor to edit. It is also the bridge to editing code in Scratch and Python. The Desktop source spec (docs/architecture/Digital Literacy Foundations.pdf, Lesson 2) teaches the same skill ('correct deliberate errors', 'move the text cursor without deleting existing text') but only as an outcome.

Closest existing capability (from `lessons capabilities`): Keyboard activity find_key (can ask for Backspace or Delete, but only as a key press with no text) and type_text (types a fresh line). Desktop Text Editor plus fs_file_content checks only the final text. Nothing can tell whether the student edited or retyped.

Current workaround and why it falls short: find_key for Backspace/Delete plus a Text Editor task checked by fs_file_content. That checks the result only, so a child can pass by deleting the whole line and retyping it, which fails Lesson 9's headline objective (editing with Backspace, Delete and the arrow keys).

## Example task

    - title: Fix the garbled transmission
      type: keyboard
      mode: edit_text
      description: Fix the mistakes in the captain's message. Don't type it all again!
      minKept: 0.9            # optional, default 0.9: share of the already-correct characters that must survive
      items:
        - id: a
          start: "the rocket is redy to lanch"
          target: "The rocket is ready to launch."
          prompt: Use the arrow keys to get to each mistake
        - id: b
          start: "Captain  Ada  says hello"
          target: "Captain Ada says hello"
          requireKeys: [Delete]   # optional: keys that must be used at least once while editing
          prompt: Put the cursor before each extra space and press Delete
        - id: c
          start: "Launch at noon noon"
          target: "Launch at noon"
          requireKeys: [Shift+ArrowLeft]   # extension: select, then delete
    

## Checks wanted

- Outcome: the item's text equals `target` exactly (case and punctuation included). The item finishes itself when it does, like the other Keyboard modes.
- Method: it was edited, not retyped. At least `minKept` (default 0.9) of the characters in `start` that already match `target` must still be the original characters at the end: never deleted and typed again. Selecting everything and retyping, or deleting the whole line and retyping it, fails this.
- Method (optional, per item): every key in `requireKeys` was pressed at least once during the edit (named keys as in `find_key`, plus Shift+Arrow selection combos). This is how Lesson 9 makes Backspace and Delete both get used.
- Hints, in the Keyboard activity's short style: "You typed it all again. Try moving the cursor to the mistake with the arrow keys." / "Put the cursor just before the extra letter and press Delete." / "Backspace deletes to the left, Delete deletes to the right."
- Teacher: the usual n/m done on the card, and the modal shows which items were retyped rather than edited.
- Optional follow-on (could be a separate request later): the same "edited, not retyped" test as a Desktop input check for Text Editor, so the Lesson 9 Mission (fix a message in Text Editor) can check the method too, not just `fs_file_content`.


## Devices

- Physical keyboard needed. On the on-screen keyboard it only works if that keyboard gains arrow keys and Delete; otherwise treat edit_text items as hardwareOnly and show the "needs a keyboard" note.
- Mac and Chromebook: the keys being taught have different names or combinations there (the Mac "delete" key is Backspace, fn+delete is Delete; Chromebook has no Delete key, Alt+Backspace). `requireKeys: [Delete]` must accept each platform's equivalent. See the separate Mac and Chromebook equivalents request.


## Notes

Course: Mouse and Keyboard Skills ('Computer Confidence'), ages 7+ (raised from 5-8 on 29 Sep 2026), so the default hint style for 8-14 fits. Effort estimate from the proposal: M. The 'edited, not retyped' rule (minKept 0.9, requireKeys) is a proposal for Ryan to confirm at approval. Source: Platform Backlog P08; Mouse and Keyboard Skills.md §5 Lesson 9.

### Decisions (Ryan, 2026-09-29)

- "Edited, not retyped" uses the longest common subsequence (LCS) of `start` and `target` as the baseline: pass when at least `minKept` (default 0.9) of those original characters were never deleted. This settles cases like "noon noon" where more than one alignment is possible.
- Selection is required with a generic `select` token (`requireKeys: [Backspace, Delete, select]`): any Shift+Arrow or Shift+Home/End selection counts. Exact combos such as `Shift+ArrowLeft` are not supported.
- Paste is blocked and spellcheck/autocorrect are off on the edit box (Mac and Chromebook autocorrect could otherwise fix the mistakes for the child). v1 treats edit_text items as `hardwareOnly` on the on-screen keyboard.

## Resolution

Branch `feature/keyboard-edit-text-mode`: Keyboard activity (`activityType: keyboard`) mode `edit_text` with `start` / `target`, `minKept` (LCS-based, default 0.9), `requireKeys` (incl. `select`), `showTarget`; paste/drop blocked, no spellcheck/autocorrect (custom edit box); on-screen keyboard shows a needs-a-keyboard note. Docs: [activities/keyboard.md](../activities/keyboard.md). The Desktop Text Editor "edited, not retyped" follow-on is not included.

Merged to main in `fc94c03` (2026-09-29).
