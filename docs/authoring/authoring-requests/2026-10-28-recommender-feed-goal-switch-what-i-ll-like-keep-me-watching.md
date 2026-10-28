# Recommender: feed goal switch (what I'll like, keep me watching, something new)

- **Status:** planned
- **Branch:** feature/recommender (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 9 (recommenders and filter bubbles, with 'a tool, not a friend') should let the student switch what the feed aims for, so they see a feed tuned to keep them watching narrow into a bubble. Builds on feature/recommender (#100).

Closest existing capability (from `lessons capabilities`): recommender (feature/recommender docs/authoring/activities/recommender.md): one goal (similar raters' likes) and the bubble meter. It lacks a goal choice.

Current workaround and why it falls short: Discuss it. This fails the design choice: the student never sees the goal change their own feed.

## Fun moment

Wow: flip to 'keep me watching' and their feed shrinks to one kind; flip to 'something new' and it opens up. Dial: the feed's goal. Theirs: their feed. First used: AI Level 1 Lesson 9. Play: which goal would they want an app to use?

## Example task

    - type: recommender
      bubble: true
      goals: [like, watching, new]   # student switch; 'watching' leans hard on their most-liked kind, 'new' mixes in kinds they haven't rated

## Checks wanted

Switching goal recomputes the feed and the bubble meter at once, and Why? says the goal ('Because you liked lots of sport, and this feed wants you to keep watching'). Marking unchanged. Report goals tried.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on branch `feature/recommender` (not merged, no PR yet), in the existing `recommender` activity ([docs](../activities/recommender.md)). New task field `goals: [like, watching, new]`: a student switch (buttons at least 44px) that recomputes the feed and bubble meter at once; **Why?** names the goal; the goal and the goals tried are in the shared state, tutor card and report (`goalCounts`). Field absent means the original feed exactly. Passing unchanged.
