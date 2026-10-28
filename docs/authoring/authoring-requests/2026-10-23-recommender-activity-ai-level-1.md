# Recommender activity (AI Level 1)

- **Status:** planned
- **Branch:** feature/recommender (built, not merged)
- **Kind:** activity
- **Requested by:** Ryan (approved by Ryan), 2026-10-23
- **Lessons blocked:** none yet

## Need

AI Level 1 teaches why your feed shows you what it does: the student rates a few items and gets recommendations from similar raters, and sees a filter bubble form when they only like one kind. Also hosts 'a tool, not a friend' (feeds built to keep you watching). Start with a preset 'class' of made-up raters plus the student's own ratings; shared real class ratings only if Dev says it's cheap.

Closest existing capability (from `lessons capabilities`): Nothing: no activity takes ratings or shows recommendations. Real-or-AI and Classifier don't model people's preferences.

Current workaround and why it falls short: Slides and a quiz on how feeds work. Fails the concept: students never see their own ratings drive what's recommended, or the bubble close in.

## Fun moment

Wow: it recommends things to them, sometimes weirdly well. Dial: their ratings (change one and the recommendations shift). Theirs: their own feed. First used: AI Level 1, about Lesson 8 (concept 11). Play: rate only one kind of thing and watch the feed shrink into a bubble, then break out.

## Example task

    - type: activity
      activityType: recommender
      items: [{id: football, emoji: ⚽, label: Football}, ...]   # 12-20 lesson-set items
      raters: preset            # preset made-up class; shared later
      showWhy: true             # 'because people like you liked...'
      bubble: true              # step that shows the bubble forming

## Checks wanted

Outcome: the student rates at least N items and opens the 'why' for one recommendation. Report itemProgress and how many items were rated.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too. No camera or microphone. Must stay smooth on a low-end Chromebook (cap the work per frame).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (Plans/LG-P8 Concept map - AI Level 1.md, concept 11 (recommenders and filter bubbles); about Lesson 8): Approved concept map (Ryan, 2026-10-23: 'These both sound excellent!')

Design brief (Ryan, 2026-10-22): the simplest version that works; simple and a bit silly beats clever; cut features before polish. Dev sizing was asked on handoff #100 and hasn't come back: please size it (rough size, Chromebook risks, what you'd cut first) before building. Data stays on the device; no live AI model.

## Resolution

Built as activity `recommender` on branch `feature/recommender` (not merged). Docs: `docs/authoring/activities/recommender.md`. Preset made-up class only (shared class ratings cut); items carry a `group` so the bubble meter can count kinds; `minRated` default 6; passes on rated + one Why? opened. Report: `recommenderResults`.
