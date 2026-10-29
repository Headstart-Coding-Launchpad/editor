# Next-Word: 'bot that writes like ___' (Go auto-write, copied badge, output card)

- **Status:** planned
- **Branch:** feature/next-word-write (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lessons 5-7 (taught from January 2027). Ryan found the guessing round boring: 'train an AI to sound like us... give it a starting word and watch it go... something for them to really build'. Students build a bot that writes like something (headlines, match commentary, themselves) and show off what it writes. MUST SHIP BY ABOUT MID-DECEMBER.

Closest existing capability (from `lessons capabilities`): next_word (platform-docs/activities/next_word.md): student guesses the next word; look-back 1-3 (R107); texts capped at about 4000 characters, own writing about 1200. No auto-write, no output card, no copy detection.

Current workaround and why it falls short: Today's guessing round. Fails Ryan's 'something to really build': nothing the student makes writes on its own or can be shown off.

## Fun moment

Wow: their bot writes a headline nobody ever wrote, in the style they taught it. Dial: what it learns from, how far back it looks, how silly. Theirs: their bot and its best cards. First used: AI Level 1 Lesson 5. Play: make the funniest believable headline; catch it copying.

## Example task

    - type: next_word
      mode: write            # new: Go auto-write instead of the guessing round
      panels: [stats, silly, voices, lookback]
      lookBack: 2            # 2 words back is the sweet spot for ~60-sentence packs
      maxWords: 15           # stops at a sentence end or this many words
      card: headline         # headline | post | commentary: how the output is styled
      texts:
        - { title: Headlines, emoji: "📰", body: "...about 60 sentences..." }

## Checks wanted

Go writes word by word (watchable pace) from a first word the student picks, using the current look-back and Silly setting; stops at a full stop or maxWords. When the output matches a training sentence word for word, show a 'Copied word for word!' badge. The student can keep a card (their best output) and the tutor sees it on the student card for a class vote. Passes after N kept cards (default 3). Report cards kept, look-back used, copied count. Raise the texts cap only if a 60-sentence pack doesn't fit.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built on branch `feature/next-word-write` (not merged, no PR yet) as `mode: write` on the existing `next_word` activity; docs: [activities/next_word.md](../activities/next_word.md). Task fields `mode`, `maxWords`, `card` (headline, post, commentary), `passAt`. Lesson author additions: My writing stays on screen and ADDS to the chosen pack, look-back starts at 2, and tapping a written word says why it was picked. The texts cap is 6000 characters in write mode only (4000 otherwise).
