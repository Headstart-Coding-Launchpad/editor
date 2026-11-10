# Product: what LaunchPad is

The single page that says what LaunchPad is and is not. Open it before designing a feature or screen. Longer rules live in [CLAUDE.md](../CLAUDE.md) and [agents/project-rules.md](agents/project-rules.md); this page links to them instead of repeating them.

## Mission

LaunchPad is the classroom Headstart Coding tutors teach in: a calm place for a child to make something that works, with a tutor who can see every screen and step in.

## Principles

1. **The tutor sees everything and can act.** Live, before submit, with at least one action (nudge, highlight, hint, edit, award). Questions to answer for every feature: [project-rules.md](agents/project-rules.md#tutor-visibility-tutors-see-everything-and-can-always-help).
2. **Fun first.** A child should want to keep going. The result on screen should work and be worth showing.
3. **Calm student screens.** One primary action, visibly the biggest thing on screen (Run, on a code task). Controls sit in at most five labelled groups (for example navigation, code tools, symbols, output, help); a row of symbol keys counts as one group; rarely used controls go behind one "More".
4. **It must work in class.** Live lessons in small groups on the classroom's own devices; a slow or flaky connection must not stop a child.
5. **Mistakes are safe.** Nothing a child does can lose their work or break the lesson for others.
6. **Lessons are cheap to make.** Authoring should be quick, so tutors and the lesson pipeline can keep the library growing.
7. **Children's data is minimal.** Students are login-less; store only what the lesson and the tutor need.

## Not

- Not a product for other schools, for now. It serves Headstart Coding classes.
- Not a general code editor or an LMS.
- Not an AI tutor. The tutor is a person.
- Not solo-first. Solo and playground modes exist, but the live classroom is the product.

## Student screens vs tutor screens

- **Student screens** (Classroom `/lesson/:lessonId` and anything a child sees) are calm: one primary action, at most five control groups (see principle 3), the work as the visual priority. Must fit 1366x768 and tablets (1024x768).
- **Tutor, Admin and Builder screens** may be dense and scannable, and need to work at PC sizes only.

[UI_STYLE_GUIDE.md](UI_STYLE_GUIDE.md) covers visual patterns; its "dense and scannable" rule applies to tutor, Admin and Builder screens only.

## Engineering rules in one place

- No backend server or API, ever. The live site is static, on GitHub Pages; Firebase supplies auth, Firestore, Realtime DB, Storage and the existing Cloud Functions.
- Students are login-less: an anonymous id in `localStorage` (never `sessionStorage`). Teachers and admins use Firebase email/password.
- No new dependencies without asking.
- No per-keystroke Firebase writes unless the `activeStudentView` rule applies; the debounced drafts in [runtime-model.md](agents/runtime-model.md) are the exception.
- File keys go through `encodeFileKey` / `decodeFileKey`.
- Never commit `.env`, `cli/.env` or credentials.
- Everything else (Firebase data model, localStorage keys, URLs, session states, shared modules): [CLAUDE.md](../CLAUDE.md) and [project-rules.md](agents/project-rules.md).
