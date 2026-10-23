# Next Word Activity

A Next Word task is an **activity** that shows how a language model writes: one likely word at a
time. The student **writes their own sentences** (typing or pasting); a **word-pair (bigram)
model** learns from them live in the browser. The model is just counts of which word came
straight after which. Then:

1. **One big Next word button.** The model picks a word and it joins the sentence. The words it
   might pick show as 3-5 chips, sized by how likely they are. A short spin runs over them and
   lands on the word it picked. **Start again** clears the sentence.
2. **Guess what it says next (the round).** Before pressing, the student taps the chip they
   think it will pick, then presses. They see a tick or a cross and a line like
   `It picked "mat"!`. Every guess counts, right or wrong. The task passes after `guesses`
   guesses (default 5); more guesses are bonus and free play. No Check button: it finishes by
   itself.
3. **Extra parts, switched on by the lesson** (`panels`): `stats`, `silly`, `voices`.

There is no API and no network: the model runs in the browser. No Run button, personal sandbox,
sharing or carry-through. Progress is saved on the device and mirrored to the teacher's student
card. An activity task is one round: a single goal that moves on by itself, with no in-task
navigation; the student sees `3 of 5 done`.

Write `type: next_word` on the task (the YAML shorthand for `taskType: activity` +
`activityType: next_word`, which also works). In the Builder, choose the **Activity** format and
pick **Next Word**: it edits the guesses count, ticks the panels, and edits the voices (texts).

## Complete example

```yaml
id: next-word-example
type: python
title: "Next Word example"
description: A short lesson using the Next Word activity.
tasks:
  - title: Guess the next word
    type: next_word
    description: Write some sentences, then guess which word it will pick next.
    guesses: 5
    panels: [stats, silly, voices]
    texts:
      - title: Football commentator
        emoji: "⚽"
        body: "The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net."
      - title: Pirate
        emoji: "🏴‍☠️"
        body: "Arr matey the sea is wild. The ship sails the sea. The pirate loves the sea."
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `next_word` in YAML (JSON: `taskType: activity` + `activityType: next_word`) |
| `guesses` | No | A whole number from 1 to 20 (default 5). The round: this many "Guess what it says next" guesses make the task pass. Right or wrong both count. |
| `panels` | No | A list of extra parts to show: `stats`, `silly`, `voices`. Missing means `[stats]`. `[]` shows none. Unknown values are errors. |
| `texts` | No | Voices the student can switch to (only shown with the `voices` panel). Each has a `title`, a `body` (2 to about 4000 characters) and an optional `emoji` for its card. |

### Panels

The lesson turns parts on so each screen stays simple.

| Panel | What it adds |
|---|---|
| `stats` | For the sentence's last word, bars of which words followed it in what the model learned, each with the number in words ("cat: 2 of 3 times"). |
| `silly` | A **Sensible to Silly** slider. It is the temperature, named in words: low always takes the likeliest word, high lets rarer words come up. |
| `voices` | Cards with an emoji to switch which text the model learned from: each of the lesson's `texts`, plus **My writing**. Switching clears the sentence. Without this panel the model only learns from the student's own sentences and `texts` are not used. |

## Removed fields

The old predict-then-reveal `items` (and `answer`), the separate probability bars, `allowPaste`
and `showTemperature` are gone. A lesson that still has them keeps validating: they are
ignored, and the task runs as the guessing round with the default panels. Add `panels` and
`guesses` to use the new parts.

## How words are counted

- Words are split on spaces, line breaks, en/em dashes and ellipses (a plain hyphen inside a
  word stays).
- Each word is **lower-cased** and has **punctuation stripped from both ends**, so `Net.`,
  `"net"` and `net` are the same word. Apostrophes and hyphens inside a word stay (`don't`,
  `well-known`); curly apostrophes become straight ones.
- A **sentence end does not break the chain**: the last word of one sentence counts as followed
  by the first word of the next.
- The student's own sentences are capped at **1200 characters**. The model needs at least two
  words before the button works.

## The round and marking

- **Start a sentence** gives a first word (one of the busiest words the model knows). It is not
  a guess.
- After that, the chips show the up-to-5 likeliest words after the sentence's last word. During
  the core the button waits until the student has tapped a chip. The result line says whether
  the guess matched the word it picked.
- Guessing is about the **picked** word, not the likeliest one: with the slider turned to Silly
  the model may pick a rarer word, and the guess is only right if it matches. The pick is made
  from the chips shown (the top five).
- If the sentence reaches a word nothing follows, the button reads **Start a sentence** again
  and adds a new first word.
- After the core, a bonus banner shows and guesses are optional; the count of bonus guesses
  shows.
- **Play** is free: there is no wrong answer, no hint and no Check button. The task passes by
  itself when the core guesses are done.

### Temperature

Each pick is random, weighted by the counts raised to `1/temperature`. At 0 (up to 0.05) it
always takes the likeliest word; at 1 it follows the counts exactly; at 2 rarer words come up
more.

## Teacher tools

The tutor sees, live and before anything is finished, what the student has:

- **Student card:** `3/5 guessed · 2 right · 14 own words` (the own-words part shows when the
  student is on My writing), plus `+2 bonus` after the core. Item progress also goes to the
  session report.
- **Student modal** (read-only, same view the student has): the sentence so far, the chip the
  student has tapped but not pressed yet ("Guessing: ..."), the last tick or cross, the slider
  and the voice, and how many words of their own the student has written. Taps, presses and
  voice switches appear straight away; typing and the slider stream while the tutor is watching
  that student.
- **Stage → Start again** clears the student's choices; **Complete (show answers)** finishes the
  round.
- Go Live on an activity task is teacher-only: a student's work is never broadcast.
- The tutor view cannot be edited (a student's own writing is theirs).

### Privacy: the student's own sentences

The student's own sentences stay **on their device**. What goes to Firebase, the tutor's card
and the attempt log is the sentence the model wrote, the guess counts, the voice, the slider
and the **number** of words the student wrote, never the words themselves. (The tutor can see
the model's sentence and the counts; if a class needs to read the writing itself, the student
can show it on their screen.)

## Accessibility and devices

Text only; works on any device with or without a physical keyboard (touch uses the device's own
keyboard). Every control is a real button, text box or slider, at least 44px high (the main
button and the chips are bigger), fully keyboard operable, with visible focus. Every chip and
bar carries its number in text ("cat: 2 of 3 times"); size and bars are only a picture of it.
The slider is labelled and announces its value in words. With `prefers-reduced-motion` the spin
is skipped (the word just lands), bars do not animate and the tick does not spin.

## Validation

Every Next Word validation message is listed under "Next Word" in
[validation-errors.md](../validation-errors.md).
