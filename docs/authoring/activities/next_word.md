# Next Word Activity

A Next Word task is an **activity** that shows how a language model writes: one likely word at a
time. The student **writes their own sentences** (typing or pasting); a **word-pair (bigram)
model** learns from them live in the browser. The model is just counts of which word came
straight after which. Then:

1. **One big Next word button.** The model picks a word and it joins the sentence. The words it
   might pick show as 3-5 chips. A short spin runs over them and lands on the word it picked;
   the landed chip stays highlighted for a moment, and the word joins the sentence. A sentence
   ends when it picks `.` (or `!` / `?`): "The end!", and the next press starts a new sentence.
   **Start again** clears the sentence.
2. **Guess the most likely word (the round).** Before pressing, the student taps the chip they
   think is **most likely** to come next, then presses. They see a tick or a cross and a line
   like `Yes, "net" was the likeliest!` or `"ball" was likelier (3 of 5 times)`. Every guess
   counts, right or wrong. The task passes after `guesses` guesses (default 5); more guesses
   are bonus and free play. No Check button: it finishes by itself.
3. **Extra parts, switched on by the lesson** (`panels`): `stats`, `silly`, `voices`, `lookback`.

There is no API and no network: the model runs in the browser. No Run button, personal sandbox,
sharing or carry-through. Progress is saved on the device and mirrored to the teacher's student
card. An activity task is one round: a single goal that moves on by itself, with no in-task
navigation; the student sees `3 of 5 done`, with a green tick dot for each right guess and a
plain dot for each wrong one.

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
| `mode` | No | `guess` (default, the guessing round) or `write` (Go auto-write, see [Write mode](#write-mode)). |
| `maxWords` | No | Write mode: 3 to 40 (default 15). The most words it writes; it also stops at a sentence end. |
| `card` | No | Write mode: `headline` (newspaper), `post` (social post bubble) or `commentary` (speech line). Default `headline`. |
| `passAt` | No | Write mode: 1 to 10 (default 3). Kept cards that pass the task. |
| `guesses` | No | A whole number from 1 to 20 (default 5). The round: this many "Guess what it says next" guesses make the task pass. Right or wrong both count. |
| `panels` | No | A list of extra parts to show: `stats`, `silly`, `voices`, `lookback`. Missing means `[stats]`. `[]` shows none. Unknown values are errors. |
| `lookBack` | No | A whole number from 1 to `maxLookBack` (default 1). How many words back the model looks. With the `lookback` panel it is where the student starts and they can change it; without the panel it is fixed. |
| `maxLookBack` | No | A whole number from 1 to 3 (default 3). The most words back the student can pick with the `lookback` panel. |
| `texts` | No | Voices the student can switch to (only shown with the `voices` panel). Each has a `title`, a `body` (2 to about 4000 characters; 6000 in write mode) and an optional `emoji` for its card. |

### Panels

The lesson turns parts on so each screen stays simple.

| Panel | What it adds |
|---|---|
| `stats` | Bars of which words followed a word in what the model learned, each with the number in words ("cat: 2 of 3 times"). During the core it shows the step the student just guessed (never the one they are guessing); in bonus play and to the tutor it shows the current step. |
| `silly` | A **Sensible to Silly** slider. It is the temperature, named in words: low always takes the likeliest word, high lets rarer words come up. |
| `voices` | Cards with an emoji to switch which text the model learned from: each of the lesson's `texts`, plus **My writing**. Switching clears the sentence. Without this panel the model only learns from the student's own sentences and `texts` are not used. |

| `lookback` | A **How many words back should it look?** control: a **−** button, a button for each of 1, 2, 3 (up to `maxLookBack`) and a **+** button, all at least 44px. The model counts which word followed the last N words, so look-back 1 gives nonsense and 3 gives sentences that sound like the text. Changing it keeps the sentence and works the chips and stats out again; a tapped guess is dropped. |

### Look-back

- With look-back 2 the stats read `After "the big", these words came next:` then `dog: 2 of 3 times`. Contexts never reach back over a sentence end.
- When the longer context was never seen, it falls back to fewer words, down to one, and says so in words: `Never saw "the big red", using "big red".` A sentence shorter than the look-back just uses the words it has (no message).
- Marking is unchanged: a guess is right when the tapped word is (one of) the likeliest after the context in use, and guesses count right or wrong.
- Without `lookback` and with no `lookBack`, the task runs exactly as before (look-back 1).
- Example: `panels: [stats, lookback]`, `lookBack: 1`, `maxLookBack: 3`.

## Write mode

`mode: write` swaps the guessing round for a bot that writes. Example:

```yaml
- type: next_word
  title: Headline bot
  mode: write
  panels: [silly, voices, lookback]
  lookBack: 2          # default 2 in write mode
  maxWords: 15
  card: headline
  passAt: 3
  texts:
    - { title: Headlines, emoji: "📰", body: "...about 60 sentences..." }
```

- **Go!** (becomes **Stop** while writing) writes one sentence word by word, about 3 words a
  second (all at once with `prefers-reduced-motion`), using the current look-back and Silly
  setting. It stops at a sentence end, a dead end or `maxWords`.
- **Start with** picks the first word: `any word` or one of the words that start sentences in the
  pack.
- The output sits on a **card** styled by `card`. After a run, **Keep this card** saves it (up to
  10 cards, 200 characters each). **My cards: 1 of 3** shows what was kept. The task passes at
  `passAt` kept cards; more are bonus.
- **Copied word for word!** shows when the finished output equals a training sentence (case and
  punctuation ignored).
- **Tap a written word** to see why: `after "the big": dog 2 of 3 times` (the context it used and
  the counts, with a note if it had to use fewer words).
- **My writing** is always on screen. What the student types is added to the chosen pack (each of
  their sentences counts as 5 copies when the model counts what follows what, so a few lines of their
  own still show up against a big pack; **Copied word for word!** still checks the real sentences
  only), so the
  bot learns from both. The pack is the first `texts` entry, or any of them with the `voices`
  panel (My writing is not a separate voice here). A Silly / What it reads fold holds the slider
  and the voices; the `stats` panel is not used.
- The default screen has at most 5 controls: Go, Start with, look-back, My writing and the fold.
- **Tutor:** the card summary reads `2 of 3 cards kept · looked back 2 · 1 copied · latest:
  "..."`, and the read-only view shows the sentence as it grows, the copied badge and the kept
  cards (so a class vote can run on them). The session report adds `nextWordWriteResults`
  (`writtenCount`, `avgCardsKept`, `copiedCount`, `lookBackUsed`).
- Live badges: Perfect Round does not apply (there are no guesses) and Storyteller does not count.

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
- A **sentence end** (`.`, `!` or `?` at the end of a word) is kept as a word of its own, so the
  model can learn that a sentence may end after a word (`net` is followed by `.` 2 of 3 times).
  The end mark is then followed by the first word of the next sentence.
- The student's own sentences are capped at **1200 characters**. The model needs at least two
  words before the button works.

## The round and marking

- **Start a sentence** gives a first word (one of the busiest words the model knows). It is not
  a guess.
- After that, the chips show the up-to-5 likeliest words after the sentence's last word. During
  the core the button waits until the student has tapped a chip.
- **While a guess is pending the answer is not shown**: the chips are all one size (in
  alphabetical order, with no counts) and the stats panel shows the step before. Pressing the
  button reveals the sizes and numbers for that step; the landed chip stays highlighted for
  about 0.6 seconds before the next chips replace it. In bonus play, and to the tutor, sizes and
  stats always show.
- **Marking**: a guess is right when the tapped word is (one of) the most likely next words by
  count, ties included. That is separate from the random pick: with the slider turned to Silly,
  or just by chance, the model may pick a rarer word, which still joins the sentence. The line
  then adds `It picked "goes" this time - it doesn't always pick the likeliest.` The pick is
  made from the chips shown (the top five).
- When the model picks `.`, `!` or `?` the sentence is finished ("The end! 🎉"); the button
  reads **New sentence**, with no guess, and starts a fresh one. A sentence also stops at a word
  nothing follows (the end of the text): the button reads **Start a sentence** and adds a new
  first word.
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
  student is on My writing; `looked back 2` shows with the `lookback` panel, so the tutor sees the look-back each student finished on), plus `+2 bonus` after the core. Item progress also goes to the
  session report.
- **Student modal** (read-only, same view the student has, always with the odds shown): the
  sentence so far, the chip the student has tapped but not pressed yet ("Guessing: ..."), the
  last tick or cross, the slider, the look-back and the voice, and the student's own sentences. Taps, presses and
  voice switches appear straight away; typing and the slider stream while the tutor is watching
  that student.
- **Stage → Start again** clears the student's choices; **Complete (show answers)** finishes the
  round.
- Go Live on an activity task is teacher-only: a student's work is never broadcast.
- The tutor view cannot be edited (a student's own writing is theirs).

### The tutor sees the student's own sentences

Tutors see all student work live (the tutor visibility principle), so the student's own
sentences (capped at 1200 characters) go to Firebase with the model's sentence, the guess counts
and results (`history`: one `r`/`w` per guess), the voice and the slider. The tutor's view shows them read-only. Remind students not to write
anything personal, as with any task.

For the 📜 Storyteller badge the state also counts `generated`: the words the model has added while
learning from the student's own writing (at least two words of it; words made from the lesson's
texts do not count). It carries on across Start again and voice switches, and is sent with the
rest of the shared state. Old saves read as 0.

## The screen

Built on `ActivityLayout`. The sentence (large) and the word chips are on the left, with the one
filled button under them (Start a sentence, Next word, New sentence), the result line beside it and
Start again as a link. On the right (only what the lesson turns on): "My writing" folds to one line
("✎ My writing · 42 words") after the first guess, the voice chips (`voices`), the look-back switch
(`lookback`, one segmented 1 / 2 / 3 words control with no − and + around it), the Sensible / Silly slider
(`silly`) and "What it learned" (`stats`, display only). The default screen has about 5 controls (My
writing, chips, Next word, Start again, plus its fold header), at most 5 with look-back.

## Accessibility and devices

Text only; works on any device with or without a physical keyboard (touch uses the device's own
keyboard). Every control is a real button, text box or slider, at least 44px high (the main
button and the chips are bigger), fully keyboard operable, with visible focus. Every chip and
bar carries its number in text ("cat: 2 of 3 times"); size and bars are only a picture of it.
The slider is labelled and announces its value in words. With `prefers-reduced-motion` the spin
is skipped (the word just lands, and the landed chip still shows briefly), bars do not animate and
the tick does not spin.

## Validation

Every Next Word validation message is listed under "Next Word" in
[validation-errors.md](../validation-errors.md).
