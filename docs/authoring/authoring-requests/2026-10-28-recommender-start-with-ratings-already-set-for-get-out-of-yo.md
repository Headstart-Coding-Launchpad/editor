# Recommender: start with ratings already set (for 'get out of your bubble')

- **Status:** planned
- **Branch:** feature/rec-start (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 9 runs as 'Steer your feed' missions in task text (cold review: do it with lesson content first). Mission 2, 'you're stuck in a bubble, get out', needs the task to open with ratings already set so the feed starts as a bubble.

Closest existing capability (from `lessons capabilities`): recommender (platform-docs/activities/recommender.md): goals switch (R113) and the kinds meter are live; every task starts with no ratings.

Current workaround and why it falls short: The student first builds a bubble themselves, then breaks it. Works but spends the lesson's time on setup and loses 'someone handed you this feed'.

## Fun moment

Wow: a feed that's all sport, and they break it open in a few taps. Dial: their ratings and the feed's goal. Theirs: their feed. First used: AI Level 1 Lesson 9. Play: fewest taps to escape.

## Example task

    - type: recommender
      goals: [like, watching, new]
      startRatings: { football: up, basketball: up, swimming: up, pizza: down, cats: down }   # new
      bubble: true

## Checks wanted

startRatings pre-fills ratings (marked as given, the student can change them); minRated counts only the student's own ratings. Report how many kinds the feed showed at the start and at the end.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built on branch `feature/rec-start` (not merged, no PR yet), in the existing `recommender` activity ([docs](../activities/recommender.md)). New task field `startRatings: { itemId: up | down }`: those ratings are set when the task opens, each with a small "set for you" tag, and the student can change or take them back. `minRated` counts only the student's own ratings (changed or new). The feed and bubble meter use the given ratings from the start. The kinds the feed showed at the start are in the shared state (`startKinds`), the tutor card (`feed 1 of 4 kinds (started at 1)`) and the report (`avgStartFeedKinds`, `openedUpCount`, next to `avgFeedKinds`). Field absent means the original behaviour exactly.
