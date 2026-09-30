// The Admin badge catalogue (docs/architecture/live-badges-plan.md, "Admin catalogue"): manual-only
// badges an admin adds in the Admin Portal's Badges tab, stored in Firestore
// `badgeCatalogue/{id}` as `{ emoji, title, blurb, archived, updatedAt, updatedBy }`. They need
// no deploy, have no rule, and are never suggested. Pure and Node-safe: the validation here is what
// the Admin tab and catalogueService.js enforce on save. badgeDisplay.js renders the entries.
import { BADGE_IDS, getBadgeDefinitions } from './registry.pure.js'

export const BADGE_CATALOGUE_COLLECTION = 'badgeCatalogue'

export const CATALOGUE_TITLE_MAX = 40
export const CATALOGUE_BLURB_MAX = 120
export const CATALOGUE_ID_MAX = 40
// Grapheme clusters are hard to count without Intl.Segmenter, so the emoji cap is on UTF-16 units:
// enough for a flag or a skin-toned, ZWJ-joined emoji, not for a sentence.
export const CATALOGUE_EMOJI_MAX = 16

const ID_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * The key two emoji are compared by: trimmed, without variation selectors (U+FE0E / U+FE0F), so
 * "⌨️" and "⌨" count as the same badge emoji.
 */
export function emojiKey(emoji) {
  return String(emoji ?? '')
    .trim()
    .replace(/[︎️]/g, '')
}

/** A catalogue id from a title: "Great Teamwork!" → "great_teamwork". */
export function makeCatalogueId(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, CATALOGUE_ID_MAX)
    .replace(/_+$/, '')
}

/** A Firestore doc (id + data) as a catalogue entry `{ id, emoji, title, blurb, archived, ... }`. */
export function normaliseCatalogueRecord(id, data = {}) {
  return {
    id: String(id),
    emoji: typeof data.emoji === 'string' ? data.emoji.trim() : '',
    title: typeof data.title === 'string' ? data.title.trim() : '',
    blurb: typeof data.blurb === 'string' ? data.blurb.trim() : '',
    archived: !!data.archived,
    updatedAt: data.updatedAt ?? null,
    updatedBy: data.updatedBy ?? null,
  }
}

/** Catalogue entries in Admin-tab order: live ones first, then archived, each by title. */
export function sortCatalogue(entries) {
  return [...(entries ?? [])].sort(
    (a, b) =>
      Number(!!a.archived) - Number(!!b.archived) ||
      String(a.title).localeCompare(String(b.title)) ||
      String(a.id).localeCompare(String(b.id))
  )
}

/**
 * Every reason a catalogue badge can't be saved, as plain sentences (empty when it can).
 *
 * - `entry`: `{ id, emoji, title, blurb }`.
 * - `catalogue`: the catalogue as it stands (archived entries included: their emoji stay taken,
 *   so an old report can never show two badges with one emoji).
 * - `isNew`: adding (the id must be free) rather than editing (the id is fixed).
 */
export function validateCatalogueBadge(entry, { catalogue = [], isNew = true } = {}) {
  const errors = []
  const id = String(entry?.id ?? '').trim()
  const emoji = String(entry?.emoji ?? '').trim()
  const title = String(entry?.title ?? '').trim()
  const blurb = String(entry?.blurb ?? '').trim()

  if (!id) errors.push('Add an id.')
  else if (!ID_PATTERN.test(id) || id.length > CATALOGUE_ID_MAX) {
    errors.push(
      `The id must be lowercase letters, digits and underscores, starting with a letter (at most ${CATALOGUE_ID_MAX} characters).`
    )
  } else if (BADGE_IDS.includes(id)) {
    errors.push(`"${id}" is a built-in badge id. Pick another.`)
  } else if (isNew && catalogue.some((other) => other.id === id)) {
    errors.push(`A catalogue badge already uses the id "${id}".`)
  }

  if (!emoji) errors.push('Add an emoji.')
  else if (emoji.length > CATALOGUE_EMOJI_MAX || /\s/.test(emoji)) {
    errors.push('The emoji must be a single emoji.')
  } else {
    const key = emojiKey(emoji)
    const builtIn = getBadgeDefinitions().find((badge) => emojiKey(badge.emoji) === key)
    const listed = catalogue.find((other) => other.id !== id && emojiKey(other.emoji) === key)
    if (builtIn) errors.push(`${emoji} is already the ${builtIn.title} badge.`)
    else if (listed) errors.push(`${emoji} is already the ${listed.title || listed.id} badge.`)
  }

  if (!title) errors.push('Add a title.')
  else if (title.length > CATALOGUE_TITLE_MAX) {
    errors.push(`Keep the title to ${CATALOGUE_TITLE_MAX} characters.`)
  }
  if (!blurb) errors.push('Add a blurb (the line the student sees on their card).')
  else if (blurb.length > CATALOGUE_BLURB_MAX) {
    errors.push(`Keep the blurb to ${CATALOGUE_BLURB_MAX} characters.`)
  }
  return errors
}

/**
 * The display fields copied onto a decision when a catalogue badge is awarded
 * (`badges/{id}/{badgeId}.badge`). Students can't read Firestore `badgeCatalogue`, so this
 * snapshot is what their celebration, toast, sticker sheet and Badge Summary render. Null for
 * a registry badge, which every client already knows.
 */
export function catalogueBadgeSnapshot(badge) {
  if (!badge?.catalogue) return null
  return {
    emoji: String(badge.emoji ?? '').slice(0, CATALOGUE_EMOJI_MAX),
    title: String(badge.title ?? '').slice(0, CATALOGUE_TITLE_MAX),
    blurb: String(badge.blurb ?? '').slice(0, CATALOGUE_BLURB_MAX),
  }
}
