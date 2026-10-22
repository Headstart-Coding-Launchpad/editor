# Next Word Activity

A Next Word task is an **activity** that shows how a language model predicts the next word. The
student picks a short text (or pastes their own), and the activity builds a **word-pair
(bigram) model** from it, live in the browser. The model is just counts of which word came
straight after which. The student can then:

1. **See the odds.** Type or choose a word and see bars for the words that follow it, each with
   the number in plain words ("net: 3 of 7 times").
2. **Predict then reveal.** Each `items` question gives a prompt; the student types the next
   word, presses **Reveal**, and sees the bars. It is marked right when the prediction is the
   most likely next word.
3. **Generate text** by sampling from the model, with an optional **temperature** slider
   (low = always the likeliest word, high = more surprising words). This is free play and is
   never marked.

There is no API and no network: nothing leaves the device. No Run button, personal sandbox,
sharing or carry-through. Progress is saved on the device, mirrored to the teacher's student
card, and reported when the student presses **Check my work**.

Write `type: next_word` on the task (the YAML shorthand for `taskType: activity` +
`activityType: next_word`, which also works). In the Builder, choose the **Activity** format and
pick **Next Word**; the Builder shows the task's validation but edit `texts` and `items` in
YAML.

## Complete example

```yaml
id: next-word-example
type: python
title: "Next Word example"
description: A short lesson using the Next Word activity.
tasks:
  - title: Predict the next word
    type: next_word
    description: Pick a text, look at the bars, then predict the next word.
    texts:
      - title: Football commentary
        body: "The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net."
      - title: Pets
        body: "The cat sat on the mat. The cat ran to the dog. The dog sat on the mat."
    allowPaste: true
    showTemperature: true
    items:
      - id: a
        prompt: the ball goes into the
        answer: net
      - id: b
        prompt: the keeper looks at the
        answer: net
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `next_word` in YAML (JSON: `taskType: activity` + `activityType: next_word`) |
| `texts` | Yes | One or more texts the student can pick from. Each has a `title` and a `body` (2 to about 4000 characters). Write every item `answer` for the **first** text. |
| `allowPaste` | No | `true` adds "Paste my own text". The pasted text is capped at 1200 characters. Default `false`. |
| `showTemperature` | No | `true` shows the temperature slider beside **Generate**. Default `false`; **Generate** is always there. |
| `items` | Yes | One or more predict-then-reveal questions. Each needs a unique `id`. |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`a`, `b`, ...). Keeps saved progress attached to the right question. |
| `prompt` | Yes | Words that stop where the student predicts the next one. Only the **last word** of the prompt matters to the model (a word-pair model has no memory of earlier words). |
| `answer` | Yes | One word: the most likely next word after the prompt's last word in the **first** text. Validated: if the first text says otherwise, the error names the real word. |

## How words are counted

- Words are split on spaces, line breaks, en/em dashes and ellipses (a plain hyphen inside a
  word stays).
- Each word is **lower-cased** and has **punctuation stripped from both ends**, so `Net.`,
  `"net"` and `net` are the same word. Apostrophes and hyphens inside a word stay (`don't`,
  `well-known`); curly apostrophes become straight ones.
- A **sentence end does not break the chain**: the last word of one sentence counts as followed
  by the first word of the next ("...the net. The keeper..." counts `net` then `the`).
- The same normalising is applied to the student's typed word, their prediction, a prompt's last
  word and an item `answer`, so capitals and punctuation never make a right answer wrong.

## Marking and hints

- Each item is **self-marking**: the student types one word and presses **Reveal** (or Enter).
  The bars appear and the item is marked. A wrong prediction gets a hint and a **Try again**
  button (it never gives the word away; the bars on screen do that after Reveal).
- The model comes from the text **the student chose**, not the text the author wrote `answer`
  for. An item is right when the prediction is a most-likely next word in the chosen text's
  model:
  - On the **first** text this is the same as matching `answer` (validation guarantees
    `answer` is a most-likely word of the first text).
  - On another text, or a pasted one, the model decides: `answer` is ignored and the model's top
    word is used.
  - **Ties:** if several words are tied for most likely (for example `b` once and `c` once after
    `a`), **any** of them is right. Validation accepts any tied word as `answer`.
  - If **nothing follows** the prompt's last word in the chosen text (for instance a pasted text
    that never says it, or it is the final word), the item cannot be right and the hint says to
    pick another text.
- An item counts only once **revealed**. **Check my work** passes the task when every item is
  right; otherwise it jumps to the first item not right and shows its hint.
- **Generate** and the temperature slider are free play: no check, no marks.

### Temperature

Generate starts at the typed word (or the text's first word) and picks each next word at random,
weighted by the counts raised to `1/temperature`. At 0 (up to 0.05) it always takes the
likeliest word; at 1 it follows the counts exactly; at 2 rarer words come up more. If it reaches
a word with nothing after it, it jumps to a random word that has something after it. The result
(up to 400 characters) is kept in the student's state so the tutor sees it.

## Teacher tools

The tutor sees, live and before anything is finished, what the student is doing:

- **Student card:** `<chosen text title> · n/m right` (or `No text yet`, `Your own text`),
  plus the usual progress. Item progress also goes to the session report ("2/3 items right").
- **Student modal** (read-only, same view the student has): the chosen text, the word they typed
  and its bars, every prediction (including a typed one **not yet revealed**), the marks and
  hints, the temperature and the generated text. Choosing a text, revealing, trying again,
  generating and a pasted text appear straight away; typing a word or prediction and moving the
  slider stream while the tutor is watching that student.
- **Edit answers** lets the tutor change the student's text, predictions and so on; an edit that
  makes every item right is marked as passed (teacher assisted).
- **Stage → Start again** clears the student's choices; **Complete (show answers)** picks the
  first text and fills in each `answer`.
- Go Live on an activity task is teacher-only: a student's work is never broadcast.

### Pasted text

The pasted text is held in the student's box and written to the student's state (and so to the
tutor) when they press **Use my text**, never per keystroke. It is capped at **1200 characters**
(`maxlength` on the box; anything longer is cut). It needs at least two words. The tutor
therefore sees a pasted text once the student has used it, not while it is being typed.

## Accessibility and devices

Text only; works on any device with or without a physical keyboard (touch uses the device's own
keyboard). Every control is a real button, radio, text box or slider at least 44px high, fully
keyboard operable, with visible focus. Every bar carries its number in text ("net: 3 of 7 times
(43%)"); the bar is only a picture of it. The temperature slider is labelled and announces its
value in words. Bar growth is switched off with `prefers-reduced-motion`.

## Validation

Every Next Word validation message is listed under "Next Word" in
[validation-errors.md](../validation-errors.md).
