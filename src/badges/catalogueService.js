// Firestore access for the Admin badge catalogue (`badgeCatalogue/{id}`; see ./catalogue.js).
// Admins write (the Admin Portal's Badges tab); teachers and admins read (TeacherView loads it
// once per session). Students can't read it: an awarded catalogue badge carries its own display
// snapshot on the decision instead.
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import {
  BADGE_CATALOGUE_COLLECTION,
  normaliseCatalogueRecord,
  sortCatalogue,
  validateCatalogueBadge,
} from './catalogue.js'

/** Every catalogue badge (archived ones included), in Admin-tab order. */
export async function fetchBadgeCatalogue() {
  const snap = await getDocs(collection(firestore, BADGE_CATALOGUE_COLLECTION))
  return sortCatalogue(snap.docs.map((d) => normaliseCatalogueRecord(d.id, d.data())))
}

function invalid(errors) {
  const error = new Error(errors.join(' '))
  error.errors = errors
  return error
}

/**
 * Adds (`isNew`) or edits a catalogue badge after checking it against the registry and the rest
 * of the catalogue (see validateCatalogueBadge). Throws with `error.errors` when it isn't valid.
 * Resolves to the saved entry.
 */
export async function saveCatalogueBadge(
  entry,
  { catalogue = [], isNew = true, updatedBy = null }
) {
  const errors = validateCatalogueBadge(entry, { catalogue, isNew })
  if (errors.length) throw invalid(errors)
  const id = String(entry.id).trim()
  const record = {
    emoji: String(entry.emoji).trim(),
    title: String(entry.title).trim(),
    blurb: String(entry.blurb).trim(),
    archived: !!entry.archived,
    updatedAt: serverTimestamp(),
    updatedBy: updatedBy ?? null,
  }
  await setDoc(doc(firestore, BADGE_CATALOGUE_COLLECTION, id), record)
  return normaliseCatalogueRecord(id, { ...record, updatedAt: Date.now() })
}

/**
 * Archives (or restores) a catalogue badge. An archived badge leaves the tutor's picker but still
 * renders wherever it was awarded. Badges are never deleted, so old reports keep their meaning.
 */
export async function setCatalogueBadgeArchived(id, archived, { updatedBy = null } = {}) {
  await setDoc(
    doc(firestore, BADGE_CATALOGUE_COLLECTION, id),
    { archived: !!archived, updatedAt: serverTimestamp(), updatedBy: updatedBy ?? null },
    { merge: true }
  )
}
