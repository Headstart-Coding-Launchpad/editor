# Learning tree: card deck dragged into bins, and a 20 Questions test

- **Status:** planned
- **Branch:** feature/tree-deck (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 8 (AI you can explain). Ryan: 'better now I see it in action... the UX isn't great'. Students shouldn't fill a blank form; they sort a ready-made deck and the tree grows live, then the tree plays 20 Questions about a NEW card. Not Guess Who: a tree trained on two bins can only guess a bin, never name a card (cold review).

Closest existing capability (from `lessons capabilities`): learning_tree (platform-docs/activities/learning_tree.md): student types a name and ticks features per example; studentPicksFeatures, studentDepth and the lit path are live.

Current workaround and why it falls short: The current add-an-example form with testItems. Works, but the UX hides the tree's idea behind data entry.

## Fun moment

Wow: it reads their taste and explains exactly why. Dial: how they sort and which questions it may use. Theirs: their tree. First used: AI Level 1 Lesson 8. Play: sort so it gets every new card right with the fewest questions.

## Example task

    - type: learning_tree
      deck:                         # new: pre-tagged cards the student only sorts
        - { name: Apple, emoji: "🍎", yes: [is_fruit_or_veg, is_crunchy] }
        - { name: Doughnut, emoji: "🍩", yes: [has_sugar, is_fried] }
      labels: ["I'd eat it", "No thanks"]   # the student may rename the bins
      studentLabels: true
      twentyQuestions: true          # test: the tree asks the student about a new card, guesses its bin
      testItems: [...]               # the new cards (not in the deck)

## Checks wanted

Drag (or tap then tap a bin) moves a card into a bin and the tree regrows at once. 20 Questions: the tree asks its questions one at a time about a mystery new card (the student answers yes/no from the card shown), lights the path, and says its guess; the student marks right/wrong. Passes as today (passAt on test items). If the student's own bins can't be split by the features, say so in words ('it can only use the questions it was given').

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built on `feature/tree-deck` (not merged): `learning_tree` deck mode with `deck`, `studentLabels`
and `twentyQuestions`. Docs: [activities/learning_tree.md](../activities/learning_tree.md), CHANGELOG
2026-10-28. With `studentLabels`, passing counts the 20 Questions rounds the student marks right (lesson author's call, 2026-10-28).
