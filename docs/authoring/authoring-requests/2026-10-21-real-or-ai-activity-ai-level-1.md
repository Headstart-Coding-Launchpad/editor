# Real-or-AI activity (AI Level 1)

- **Status:** planned
- **Kind:** activity
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 9 (and AI Level 2 Lesson 9) teaches spotting generated images and text and the limits of spotting. Needs pairs of images or texts; the student picks the AI one and names the tell from a list; the reveal says whether that tell is reliable. Marks itself. Backlog P46.

Closest existing capability (from `lessons capabilities`): Multiple-choice quiz with per-option explanations: can show one image and ask, but not a side-by-side pair plus a second 'which tell' choice with a shared reveal and score.

Current workaround and why it falls short: Two chained multiple-choice questions per pair. Works, but loses the side-by-side comparison and the running score the lesson's check is built on.

## Example task

    - type: activity
      activityType: real_or_ai
      tells: [hands, text_in_image, too_smooth, lighting, odd_detail, none_reliable]
      items:
        - kind: image          # image | text
          a: images/real-1.jpg
          b: images/ai-1.jpg
          answer: b
          tell: hands
          reliable: false
          reveal: "Hands used to give AI away, but newer models get them right, so don't rely on it."
    

## Checks wanted

Outcome: score per item (right pick) and whether the chosen tell matches. Marks itself; the reveal shows after each choice. itemProgress and score to the teacher card and session report.


## Devices

Side-by-side on desktop; stacked on phones and narrow tablets.

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (AI Literacy and AI Builders.md §7 AI Level 1 Lesson 9): Core activity for AI Level 1, January 2027

Cut to three activities for January (Hub-logged default yes, 2026-10-21). Content (the pairs) is Lesson Gen's work.

## Resolution

Built as the `real_or_ai` activity on branch `feature/real-or-ai-activity` (2026-10-22), waiting on Ryan's merge OK. Docs: [real_or_ai.md](../activities/real_or_ai.md). Task fields as in the example above, plus optional `altA` / `altB` (image alt text) and `kind: text` pairs. Picks and clues are mirrored to the tutor before Reveal; `itemProgress` is pairs picked right, and the report task summary has `itemResults[]` (right pick and clue match per pair). Revealing the last pair finishes the task whether right or wrong. Items are sealed in the stored lesson, like quiz answers.
