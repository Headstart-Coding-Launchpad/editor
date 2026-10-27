# Moving Firestore from the US to Europe (Hub P24)

Status: **done 2026-10-27** with Ryan. The database is `london` (`europe-west2`), not `eu`: ids
need 4 or more characters. 484 documents copied, every collection matched; the site, Functions and
CLI use `london` (a40919d9). The backup export is in `gs://headstartcoding-repl-backups/2026-10-pre-eu`
(a US bucket: a `nam5` database can't export to the `us-east1` Storage bucket). `new-db` is deleted.
`(default)` is closed to the app and stays as the rollback until Ryan OKs deleting it (not before
2026-11-26). Below, read `eu` as `london`.

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

## Decisions (Ryan, 2026-10-18)

1. Option **A**: new `eu` database, same project.
2. Location **`europe-west2`, London**.
3. Window **half term, w/c 26 Oct**, in a day session. Delete `new-db` too.

## Runbook

About 75 minutes with Ryan there. Every command runs from the repo root on `main`. `(default)` is
never written to or deleted in this runbook.

### What is already in the code

- The app reads `VITE_FIRESTORE_DATABASE_ID` (`src/shared/firebase.js`); the CLI and
  `scripts/hsc-audit/cleanup.mjs` read `FIRESTORE_DATABASE_ID` (or the `VITE_` one);
  `functions/index.js` reads `FIRESTORE_DATABASE_ID`. Empty means `(default)`.
- `node scripts/firestore-copy.mjs` copies every document, subcollections included (also
  session reports under deleted lessons), with the same ids and Timestamps, then prints a count
  and checksum per collection for both sides. Without `--apply` it only reads. It never deletes.
  On 2026-10-18 the dry run counted **437 documents** in `(default)`.

### The day before

1. `npm test` green on `main`, everything pushed and deployed, and `launchpad-main` pulled.
2. Tell tutors: no live sessions or Builder edits during the slot.
3. Ryan: check `gcloud` is signed in to `headstartcoding-repl` (`gcloud config get project`).

### On the day

1. **Backup (5 min).** Managed export of `(default)`:
   `gcloud firestore export gs://headstartcoding-repl.firebasestorage.app/backups/2026-10-pre-eu --database="(default)"`.
   Wait for "SUCCESSFUL" (`gcloud firestore operations list`).
2. **Create `eu` (5 min).**
   `gcloud firestore databases create --database=eu --location=europe-west2 --type=firestore-native --delete-protection --enable-pitr`.
3. **Rules and indexes on `eu` (5 min).** In `firebase.json`, make `firestore` a list with one
   entry each for `(default)` and `eu`, both with `firestore.rules` and
   `firestore.indexes.json`, except that `(default)` uses `firestore.closed.rules` (no app
   access; the service account still reads it). Then `firebase deploy --only firestore`. From
   here until step 5 the live site can't reach Firestore, which is why the slot is frozen, and
   nothing can land in `(default)` after the copy.
4. **Copy (5 min).** `node scripts/firestore-copy.mjs --to eu --apply`. It must end with
   "Every collection matches." and 437 or more documents. If not, stop and look (nothing has
   switched yet).
5. **Switch (15 min).** On a branch, in one commit:
   - `.github/workflows/deploy.yml`: add `VITE_FIRESTORE_DATABASE_ID: eu` to the build env.
   - `functions/index.js`: change the `'(default)'` fallback to `'eu'` (deployed Functions
     don't get our `.env`).
   - `cli/.env` and the repo `.env` (local, not committed): `FIRESTORE_DATABASE_ID=eu` and
     `VITE_FIRESTORE_DATABASE_ID=eu`. Same in `launchpad-main`'s `cli/.env`.
   Merge, push (Pages deploys after CI), and `firebase deploy --only functions`.
6. **Checks (20 min).** On the live site, with the test tutor and a private window as a student:
   - Tutor signs in and lands on the Builder; Admin lists both users (reads `users`).
   - A lesson opens from the Builder list and as a student link (reads `lessons`).
   - A tutor's earlier work shows: an old session report opens in its lesson (reads
     `sessionReports`); the class roster page lists the classes.
   - Run a 2-minute test session: a student joins, runs code, the tutor sees it live, and
     ending it writes a session report. `node cli/cli.mjs lessons list` shows the lesson and
     `node scripts/firestore-copy.mjs --to eu` shows the new report on the `eu` side only.
   - Admin creates and deletes a throwaway tutor account (Functions write to `users` in `eu`).
   - Lesson Gen's CLI: `git -C <launchpad-main> pull --ff-only`, then a read-only `lessons list`.
7. **Delete `new-db` (2 min).** Check it is still empty
   (`node scripts/firestore-copy.mjs --from new-db` prints 0), then
   `gcloud firestore databases delete --database=new-db`.
8. **Write it up.** `docs/agents/runtime-model.md` (database id), the Hub outcome line,
   `Status\LaunchPad Dev.md`, and with Ryan's say-so a "stored in the UK" line for `Brand.md`.

### Rollback

Any check in step 6 fails and isn't a five-minute fix:

1. Revert the switch commit and push; set the `.env` lines back to empty;
   `firebase deploy --only functions`. The site is back on `(default)` once Pages deploys.
2. Point `(default)` back at `firestore.rules` in `firebase.json` and `firebase deploy --only firestore`.
3. Copy back anything written to `eu` since the switch:
   `node scripts/firestore-copy.mjs --from eu --to "(default)" --since <switch time> --apply`.
4. Leave `eu` in place to look at later; it costs pennies.

### After

`(default)` stays closed to the app (`firestore.closed.rules`) for 30 days. Deleting it is a separate OK from Ryan, after a backup
export of `eu`.
