# Moving Firestore from the US to Europe (Hub P24)

Status: **plan, waiting on Ryan's pick.** Nothing live has changed. Written 2026-10-18 for the
Hub handoff "plan moving Firestore from the US to Europe (P24)".

## Why

LaunchPad holds UK children's data (names on class rosters, session reports, feedback). Keeping
it in Europe is simpler for UK GDPR and for what we tell parents.

## Where everything is now (checked 2026-10-18 with the CLI service account)

| Service | Location | Children's data? | Move? |
|---|---|---|---|
| Firestore `(default)` | **`nam5` (United States multi-region)** | Yes: `classes` + `roster`, `sessionReports` (148), `feedback` (37), `sharedWork`, `users` (tutors) | **Yes, this plan** |
| Firestore `new-db` | `eur3` (Europe), created 2026-09-05 | Empty, not used by any code | Delete or reuse (below) |
| Realtime Database | `europe-west1` (Belgium) | Yes: live sessions | Already in Europe |
| Cloud Functions | `europe-west1` | Passes through only | Already in Europe |
| Storage bucket | **`US-EAST1`** | No: lesson and lesson-type assets only | Optional, later (below) |
| Firebase Auth | Google-global, no choice | Tutor and admin emails only; students have no accounts | Can't move; nothing to do |

Firestore is small: about 440 documents in all (100 lessons, 123 topics, 148 session reports,
37 feedback items, 10 levels, 9 guidelines, 4 classes, 2 users, a few more). The copy takes
minutes, not hours.

A Firestore database's location can't be changed in place, so the move means a new database and
a data copy.

## Options

### A. New named database in the same project (recommended)

Create a database called `eu` in the same project, copy the data across, then point the app, CLI,
Functions and rules at it.

- Auth, Realtime Database, Storage and Functions don't change. Tutors keep their logins, and
  students (login-less, anonymous ID in `localStorage`) notice nothing.
- `(default)` stays untouched as the rollback for 30 days, then is deleted with Ryan's OK.
- Code: the database id goes in one env var, read in the four places that open Firestore:
  `src/shared/firebase.js` (`getFirestore(app, id)`), `cli/firebase.mjs`, `functions/index.js`
  and `scripts/hsc-audit/cleanup.mjs`. Plus `firebase.json` (rules and indexes targeted at the
  `eu` database), the deploy workflow's env, and the rules-test emulator setup.
- Anything else reading Firestore with the service account must go through the CLI or set the
  database id. Lesson Gen and the Hub already use the CLI (through `launchpad-main`), so they pick
  it up when `main` moves.

### B. Delete `(default)` and recreate it in Europe

No code change, because the app keeps using `(default)`. But the old data has to be deleted
before the new database exists, so the only rollback is the export. Riskier for a small saving
in code. Not recommended.

### C. A new Firebase project

Moves everything (Storage too) but means a new Auth user base (tutor accounts re-created or
migrated), new config, new Functions deploy, new rules, a new Realtime Database and new hosting
links in lessons. Far more work and risk than the data needs. Not recommended.

## Location

| | `europe-west2` (London) | `eur3` (Belgium + Netherlands) |
|---|---|---|
| What we tell parents | "Stored in the UK" | "Stored in the EU" (adequate under UK GDPR) |
| Resilience | One region, several zones | Two regions, higher SLA |
| Price | Regional prices, about the same as now | Multi-region prices, a bit higher |
| Fits the rest | Realtime Database and Functions are in Belgium | Same continent either way |

**Recommended: `europe-west2` (London).** "Your child's work is stored in the UK" is the
simplest true line for parents, and at our size multi-region resilience isn't worth the extra.
(`new-db` is in `eur3` with an unhelpful name, so delete it rather than reuse it.)

## How the data moves

At about 440 documents, a short admin script beats a managed export/import: read every
collection and subcollection from `(default)`, write it to `eu` with the same ids, keep
`Timestamp`s as they are, then compare document counts and a checksum per collection. The
script goes in `scripts/` and runs from the CLI service account. A managed export to a bucket
is taken first anyway, as the backup.

## Steps and downtime

Best window: **half term, w/c 26 Oct** (no group classes). About an hour, done in a day session
with Ryan reachable.

1. Before: merge the code change behind the env var, still pointing at `(default)`. Full suite and
   rules tests green. Create `eu` in `europe-west2` with point-in-time recovery and delete
   protection on. Deploy rules and indexes to `eu`.
2. Freeze: no live sessions or Builder edits for the hour (tell tutors).
3. Managed export of `(default)` as the backup, then run the copy script and check the counts.
4. Switch: set the database id to `eu` in the deploy env and `cli/.env`, deploy the site and
   Functions. Check a lesson opens, a tutor logs in, the Admin portal lists users, a test session
   writes a report, and `lessons list` reads from `eu`.
5. After: `launchpad-main` follows `main`, so Lesson Gen's CLI moves with it. Update
   `docs/agents/runtime-model.md` and the Hub (`Status`, `Brand.md` if we add a "stored in the
   UK" claim).

## Rollback

Set the database id back to `(default)` and redeploy (minutes). Anything written to `eu` after
the switch is copied back with the same script in reverse. `(default)` is kept read-only (rules)
for 30 days, then deleted with Ryan's OK.

## Cost

Small either way. The Firestore free tier applies to one database per project, so `eu` may be
billed from the first read; at our volume (hundreds of documents, a few thousand reads a class)
that's pennies a month. Check the first bill after the move. No change for the other services.

## Storage bucket (separate, optional)

The bucket is in `US-EAST1` but holds only lesson pictures and sounds, no children's data. A
bucket can't move either, so moving it means a new bucket and rewriting asset URLs in every
lesson. Leave it for now; revisit if student uploads ever go to Storage.

## Decisions for Ryan

1. Option A, B or C (recommended **A**: new `eu` database, same project).
2. Location (recommended **`europe-west2`, London**).
3. Window (recommended **half term, w/c 26 Oct**, in a day session).
