import { createContext, useContext } from 'react'

// Live badge signal reporters for shared UI that sits deep inside a lesson (the CodeEditor, the
// Scratch workspace, Markdown topic links and the Topic Library dialog), so none of them needs
// the reporters threaded through as props. The classroom's StudentView provides it (see
// useStudentBadgeSignals); anywhere else (the Builder, the teacher's views) there is no provider
// and reporting is a no-op. The reporters do their own gating: a provider in the presentation
// window or a preview reports nothing.
//
// Value: { reportUserEdit(surface), reportAutocomplete(), reportTopicOpen(topicId, { source, via }) }
// or null.
export const BadgeSignalsContext = createContext(null)

export function useBadgeSignals() {
  return useContext(BadgeSignalsContext)
}
