# Next-Word: student-picked look-back (1, 2 or 3 words)

- **Status:** planned
- **Branch:** feature/next-word-lookback (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 5 (predicting the next word) should let the student choose how many words back the model looks, so they see context change the output: 1 word gives nonsense, 3 words gives real-sounding sentences. This is the context window idea behind chatbots. Next-Word only looks back one word now.

Closest existing capability (from `lessons capabilities`): next_word (platform-docs/activities/next_word.md): counts which word follows one word. It lacks a look-back setting, and the stats panel can only show one-word contexts.

Current workaround and why it falls short: Tell students that real models look further back. This fails the lesson's design choice: the student never sees more context make the sentences better.

## Fun moment

Wow: slide from 1 to 3 and their own writing suddenly sounds like them. Dial: how many words back it looks. Theirs: their sentences. First used: AI Level 1 Lesson 5. Play: find the silliest sentence at look-back 1, then the most believable at 3.

## Example task

    - type: next_word
      panels: [stats, lookback]
      lookBack: 1        # starting value; the student can change it with the lookback panel (1-3)
      maxLookBack: 3

## Checks wanted

Marking unchanged (guesses count). Report the look-back each student finished on. With look-back 2, stats show 'after "the big": dog 2 of 3 times'. Falls back to fewer words when a longer context was never seen (say so in words: 'never saw "the big red", using "big red"').

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on `feature/next-word-lookback` (not merged): activity `next_word`, new `lookback` panel with `lookBack` and `maxLookBack` task fields. Docs: [activities/next_word.md](../activities/next_word.md); changelog 2026-10-28.
