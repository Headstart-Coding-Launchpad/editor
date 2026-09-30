---
name: new-badge
description: Add a new Live Student Badge to the Headstart Coding platform, end to end. Use when asked to "add a badge", "make a new badge", "new live badge", "a badge for <behaviour>", to add a manual-only badge for tutors, or to make a new classroom behaviour (a signal) available to badge rules. Covers rule-backed and tutor-only registry badges (npm run new:badge), manual Admin-catalogue badges (no code), and new signals. Not for lesson-specific badges (concept, capstone, Level badges), which are a separate system.
---

# New badge

Pick the right kind first, then scaffold → implement → verify → document, one badge per branch.
Read the docs linked below instead of guessing; this skill is only the order of work.

Key references:

- Plan, principles and data model: `docs/architecture/live-badges-plan.md`
- Why it is built this way: `docs/adr/` (the live badges ADR)
- Authoring (patterns, `badgeOptions`, `badgeHints`, signals): `docs/authoring/badges.md`
- Contract: `src/badges/defineBadge.js`; rule helpers: `src/badges/rules.js`; timeline events:
  `src/badges/timeline.js`; worked examples: `src/badges/definitions/*.js`
- Runtime data (decisions, signals, catalogue snapshot): `docs/agents/runtime-model.md`

## 1. Which kind of badge?

Every badge must pass the core principle: it makes a **good learning behaviour** visible without
turning coding into a competition. No points, totals, ranks, streaks, or rewards for run counts,
code volume or time on the platform. If the idea fails that test, say so and stop.

| The badge… | Kind | Where |
|---|---|---|
| is judged by the tutor, and should reach classrooms without a deploy | **Manual (Admin catalogue)** | Admin Portal → Badges → Add. No code: see §2 |
| is judged by the tutor but belongs in every install (a core badge) | **Tutor-only registry badge** | `npm run new:badge -- <id> --emoji <e> --tutor-only`: see §3 |
| can be recognised from data the platform already records | **Rule-backed registry badge** | `npm run new:badge -- <id> --emoji <e>`: see §3–4 |
| needs data nothing records yet | **Rule-backed + a new signal** | §5 first (needs sign-off), then §3–4 |

Ask the user about anything that changes scope (tutor-only or rule-backed, auto-awardable,
what exactly triggers it, which modules) before writing code. Create a `feature/<id>-badge` branch.

## 2. Manual badge (Admin catalogue, no code)

1. Admin Portal → **Badges** → **Add badge**: emoji, title, blurb (the line on the student's
   card). The id comes from the title and can't be changed later.
2. Saving refuses an id a registry badge owns, and an emoji any badge (registry or catalogue,
   archived included) already uses. Stored in Firestore `badgeCatalogue/{id}`.
3. Tutors see it in the manual picker (student modal → More → 🏅 Award badge) on their next
   session load. It is never suggested. When awarded, its emoji, title and blurb are copied onto
   the decision (students can't read the catalogue), so the celebration, toast and summary work.
4. To retire one, **Archive** it: it leaves the picker but still renders in old sessions and
   reports. Never delete.

Nothing else to do: no deploy, no docs change. Done.

## 3. Scaffold a registry badge

```bash
npm run new:badge -- <id> --emoji <emoji> [--title "<Title>"] [--blurb "<Blurb>"] [--tutor-only] --dry-run
npm run new:badge -- <id> --emoji <emoji> ...
```

`<id>` is stored in decisions and reports: lowercase, underscores, never renamed later. The
scaffold creates `src/badges/definitions/<id>.js`, registers it in `src/badges/registry.pure.js`
(rule-backed after the last rule-backed badge, tutor-only at the end; `registry.js` re-exports
it), and adds rows to `docs/authoring/badges.md` and `docs/CODEBASE_MAP.md`. It refuses a taken
id or emoji. `npm test` passes on the untouched scaffold. Every place to change is marked
`TODO(new-badge)`.

Also check the Admin catalogue for a badge with the same id or emoji: a catalogue entry whose id
a registry badge now owns stops rendering (`normaliseCatalogueBadge` returns null). Archive or
rename it first.

A tutor-only badge is done once the blurb is written: skip to §6.

## 4. Implement the rule (in `src/badges/definitions/<id>.js`)

1. Replace the stub rule with a `src/badges/rules.js` helper:
   `firstInClassOnPattern` (optionally `firstTryOnly`), `realPassOnPattern`, `errorThenPass`,
   `uniqueFailsThenPass`, `anySignal`, `firstEditWithin`, `quizGroupFirstTry`. If none fits, add
   a helper there: pure, reads timelines only (never Firebase or React), honours the central
   anti-gaming guards (`isRealPass` / `getRealPass`), `badgeHints.suppress` (`taskAllowsBadge`)
   and removed tasks, and returns `candidate(...)` values. Add unit tests for a new helper in
   `src/badges/__tests__/badgeRules.test.js`.
2. `ruleText`: the exact rule, shown when a tutor hovers the badge. `reasonText`: what the tutor
   reads on the suggestion ("First to fix the bug in “Task 6”"); it only gets plain values.
   `blurb`: one short, warm line for ages 8–14.
3. `examples`: at least two, run by the generic test in `badgeRegistry.test.js` against
   `src/badges/exampleLesson.js` (or the example's own `lesson`). Cover the trigger, a pass that
   isn't real (assisted, override, complete code shown, big paste), a sandbox event if the rule
   reads one, and the "not this pattern" case.
4. `autoAwardable: true` only for a high-confidence rule. A pattern rule (`hintable`) can be
   named in `badgeHints.suggest`; lesson validation accepts it automatically.
5. Keep composed lessons in mind: never read `lesson.type`; the lesson index resolves each task's
   module (`src/badges/lessonIndex.js`).
6. Update the hard-coded lists in `src/badges/__tests__/badgeRegistry.test.js` if the badge
   joins them (auto-awardable, hintable).

## 5. A new signal (needs data-model sign-off)

A rule may only read the timeline events in `src/badges/timeline.js`. If the behaviour isn't one
of them, a new signal means a new logged field, and **every new Firebase field or node needs the
user's explicit data-model sign-off before any code** (AGENTS.md: don't deviate from the data
model). Stop and ask, with the exact path, shape, who writes it and how often.

Once approved:

1. Record it first occurrence only, or per run, never per keystroke, under
   `sessions/{lessonId}/studentSignals/{anonymousId}` (student-write for their own id), gated off
   for the presentation window and Builder preview. Add the writer to `useSession.js` and the
   reporting hook, the `database.rules.json` rule and `.validate`, and rules tests
   (`npm run test:rules`).
2. Add the event type and builder to `src/badges/timeline.js`, and map the stored data into it in
   `src/badges/liveTimeline.js`.
3. Document it: `docs/agents/runtime-model.md` ("Badge data"), the signals list in
   `docs/authoring/badges.md`, `docs/architecture/feature-impact-map.md`.

## 6. Docs

- `docs/authoring/badges.md`: fill in the row the generator added ("Suggested when", auto-award),
  and the pattern → badge and badge × module tables if the badge appears there.
- `docs/authoring/CHANGELOG.md`: a dated entry ending with the `Affects · Existing lessons ·
  Resolves` tag line if lessons can now tune or hint the badge.
- `docs/FEATURES.md` if the badge set is listed there.

## 7. Verify (all must pass)

```bash
npm test
npx eslint src cli scripts
npx prettier --write <changed files> && npm run format:check
npm run docs:check
npx vite build
node cli/cli.mjs lessons capabilities   # the badge is listed; CLI imports stay Node-safe
```

Then ask the user to check in a **real browser** with a teacher tab and two student tabs: the
suggestion appears for the right student, Award → card flip, chime and Coding moments pill, the
classmates' toast, the presentation window toast, Revoke, and the session report's Coding
moments section.

Commit on the feature branch; don't push or open a PR unless asked.
