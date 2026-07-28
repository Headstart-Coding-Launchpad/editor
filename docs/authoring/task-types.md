# Task Types Overview

A plain-language summary of the kinds of tasks a lesson can be built from. No field names or YAML here — for that, see `docs/authoring/AUTHORING_GUIDE.md`.

## Code Task

Students write or arrange code (or blocks) and run it. An automatic check tells them whether they got it right. In a composed lesson, each code task selects a workspace module — Python, Arcade Kit, HTML/CSS/JS, Scratch, Filesystem, or Electronics — but they all work the same way from the student's side: try it, run it, get feedback.

## Information Task

Just something for students to read — no editor, no check. Used to explain a concept before students try it themselves, to recap what they just learned, or to introduce the lesson.

## Quiz Task

An interactive question with no code editor. Students pick an answer, drag tiles, or type a short response. See `docs/authoring/quiz-types.md` for the different quiz styles.

## Group

A small, ordered bundle of tasks nested inside one entry — a way of keeping a handful of closely related tasks together as a single step in the lesson.
