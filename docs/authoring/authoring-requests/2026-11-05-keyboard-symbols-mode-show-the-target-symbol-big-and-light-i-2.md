# Keyboard symbols mode: show the target symbol big and light its key from the start

- **Status:** planned
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-11-05
- **Lessons blocked:** none yet

## Need

Level A Lesson 1 Find the Brackets practises ( ) , = and " before the first typed line. Ryan (preview, 5 Nov): the symbol to type should stand out much more, and the keys to press should be highlighted on the keyboard picture, otherwise the keyboard picture has no point. A symbols item shows its char at normal size and the key lights only after wrong presses; task highlight (key:<symbol>) is an error on activity tasks.

Closest existing capability (from `lessons capabilities`): Keyboard activity, symbols mode (platform-docs/activities/keyboard.md): per-item char and prompt only; find_key lights the key after two wrong presses; no option to show the target large or light the key up front. Task highlight is code tasks only (lesson-schema.md).

Current workaround and why it falls short: Item prompts name each symbol in words (Open bracket ( ). Fails the lesson's aim that first-time typists find each symbol before typing it: they still hunt the keyboard and only see the key after mistakes.

## Fun moment

Python Level A Lesson 1, Find the Brackets: a big glowing symbol and its key (and Shift) lit up on the keyboard picture, so a first-time typist spots it, presses it and sees it tick at once; a quick find-it game before their first line of code.

## Example task

    mode: symbols, showKey: true (light the target key, with Shift, from the start), items: [{id: a, char: "("}]

## Devices

Laptops with the on-screen keyboard picture; the picture is the point on any device.

## Notes

Same gap as watching request #132 (filed by the revision agent); refiled as requested by Ryan because he approved it 5 Nov 15:44 and a watching request cannot be approved.

## Resolution

Built on branch `feature/keyboard-symbols-showkey` (not merged yet). Activity `keyboard`:
`showKey: true` on `symbols` / `find_key` shows the target big with "Shift + 9" under it and
lights its key and both Shift keys from the start, with calm miss lines; each finished item saves
`tries` and the tutor card shows the hardest one. Keyboard tasks also take
`highlight: "key:<key>"` and the tutor's live Highlight menu (UK layout only). Docs:
[activities/keyboard.md](../activities/keyboard.md), [lesson-schema.md](../lesson-schema.md)
(`highlight`), CHANGELOG 2026-11-05.
