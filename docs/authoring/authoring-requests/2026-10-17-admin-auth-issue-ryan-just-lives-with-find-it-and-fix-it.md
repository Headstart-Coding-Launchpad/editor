# Admin auth issue Ryan 'just lives with': find it and fix it

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 8. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md: "Admin: AI says Problem; Ryan says the page is good, but the auth issue is real and "we just live with it"." HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md, group 28 (Problem): "The test tutor (teacher role) opening Admin sees a bare 'Sign in' form, with no 'you need an admin account' message and no way back" and "The tutor header shows an Admin button to teacher accounts". The review couldn't see Admin as an admin.

Closest existing capability (from `lessons capabilities`): The Admin Portal sign-in. The exact fault isn't recorded: Ryan named it in the interview but didn't describe it.

Current workaround and why it falls short: Ryan works around it. Not a lesson objective; a tutor-time cost every time.

## Checks wanted

- Ask Ryan for the symptom (when it happens, and what he does to get past it) and record it in the request's outcome.
- Fix that fault, so an admin reaches Admin without the workaround.
- Teacher accounts either don't see the Admin button, or get a clear 'needs an admin account' message with a way back.

## Devices

Desktop.

## Notes

The first step is diagnosis; the interview records only that the issue exists.

## Resolution

Ryan, 2026-10-17 (symptom): signed in, he opens Admin (or a second tab) and is bounced to the sign-in page, then signs in again.

Branch `fix/admin-auth-new-tab-bounce`. Cause: `src/shared/firebase.js` used `getAuth()` then `setPersistence(browserLocal)`. `getAuth()` puts IndexedDB first, so every newly opened tab (Admin, Builder, preview, a second tab) moved the saved user out of localStorage into IndexedDB and back again. The removal fired a storage event that read as a sign-out in every other open tab; when the move back took over the 1s bounce grace in `AuthContext`, that tab went to /login. Fix: `initializeAuth` with localStorage first (session storage, then IndexedDB last only to rescue a user the old code left there), and no `setPersistence`. Regression test: `src/shared/__tests__/firebaseAuthPersistence.test.js`.

Teacher accounts: already shipped with the HSC Audit fixes (93b3cfb8). The Admin button only shows for admin accounts, and a teacher opening /admin sees "You need an admin account to see this page" with Go back.
