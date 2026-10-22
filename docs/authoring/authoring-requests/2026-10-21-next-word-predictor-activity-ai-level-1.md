# Next-Word Predictor activity (AI Level 1)

- **Status:** planned
- **Kind:** activity
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 6 teaches that language models predict the next word from patterns. Needs a live word-pair (n-gram) model built from a short text the student picks, probability bars for the next word, predict-then-reveal items, and a generate button with a temperature slider. No API, no network. Backlog P43 (n-gram version only).

Closest existing capability (from `lessons capabilities`): Activity registry and multiple-choice quizzes: can ask 'what comes next?' but can't build a model from the student's text or show probabilities.

Current workaround and why it falls short: Multiple-choice quiz on fixed sentences. Fails the lesson's objective that students see probabilities come from their own text's patterns.

## Example task

    - type: activity
      activityType: next_word
      texts:                   # student picks one, or pastes their own (allowPaste)
        - title: Football commentary
          body: "..."
      allowPaste: true
      items:                   # predict-then-reveal questions
        - prompt: "the ball goes into the"
          answer: net          # most likely next word in the chosen text
      showTemperature: true
    

## Checks wanted

Outcome: each predict item answered with the model's most likely next word (self-marking, per item). The generate button and temperature slider are free play with no check. itemProgress per item to the teacher card.


## Devices

Text only; works on any device. The later local-LLM version (P57, WebGPU) is not part of this request.

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (AI Literacy and AI Builders.md §7 AI Level 1 Lesson 6): Core activity for AI Level 1, January 2027

Cut to three activities for January (Hub-logged default yes, 2026-10-21).

## Resolution

Built as the `next_word` activity on branch `feature/next-word-activity` (2026-10-22), waiting on Ryan's merge OK. Docs: [activities/next_word.md](../activities/next_word.md). Decisions: the student's chosen text builds the model; an item is right when the revealed prediction is a most-likely next word of that model (any word tied for most likely counts); `answer` is validated against the first text and ignored on other or pasted texts. Pasted text is capped at 1200 characters and written on "Use my text", not per keystroke. Needs no database rules change.
