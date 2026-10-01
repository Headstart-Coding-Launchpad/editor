// UI badge registry: what React code (the tutor's suggestions panel and picker, the student's
// celebration) imports. Badges have no UI parts yet, so this re-exports the Node-safe registry
// (registry.pure.js); like src/activities/registry.js, UI-only additions belong here, never in the
// pure registry the CLI imports.
export {
  BADGE_IDS,
  getBadgeDefinition,
  getBadgeDefinitions,
  getBadgesByFormat,
  getBadgesByPattern,
  getHintableBadges,
  getRuleBackedBadges,
  getTutorOnlyBadges,
} from './registry.pure.js'
