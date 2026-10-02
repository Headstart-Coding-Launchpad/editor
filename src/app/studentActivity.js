import { peerHelpPairsByStudent } from '../shared/peerHelp'

// What each student is doing right now, for the teacher: the "Now:" line on a StudentCard and
// the class summary strip above the grid (ClassActivityStrip). Pure: reads the session, the
// teacher's peer help data and the Topic Library.
//
// Most important first; a card shows the first as "Now:" and the rest as icons:
//   🤝 helping / being helped (peer help)
//   👀 looking at / ▶ trying a "Show to class" broadcast (students/{id}/watchingLive)
//   📤 viewing a classmate's shared work (viewingShareId)
//   📖 reading a Topic Library topic (currentTopicId)
//   🧪 in their own sandbox (inPersonalSandbox)
// Only online students are doing anything.

const nameOf = (session, id) => session?.students?.[id]?.displayName ?? 'a classmate'

function possessive(name) {
  return `${name}’s`
}

/**
 * @returns {{ kind, group, icon, text, title }[]} `text` follows "Now:" on the card; `group`
 *   is what the class strip counts by (e.g. everyone looking at the same broadcast).
 */
export function studentActivities({ student, session, peerPairs = {}, topics = null }) {
  if (!student?.online) return []
  const id = student.anonymousId
  const out = []

  const pair = peerPairs[id]
  if (pair?.role === 'helping') {
    const partner = nameOf(session, pair.partnerId)
    out.push({
      kind: 'helping',
      group: `pair:${id}`,
      icon: '🤝',
      text: `helping ${partner}`,
      title: `Helping ${partner} (peer help)`,
    })
  } else if (pair?.role === 'being_helped') {
    const partner = nameOf(session, pair.partnerId)
    out.push({
      kind: 'being_helped',
      group: `pair:${pair.partnerId}`,
      icon: '🤝',
      text: `helped by ${partner}`,
      title: `Being helped by ${partner} (peer help)`,
    })
  } else if (pair?.role === 'offered' || pair?.role === 'asked') {
    out.push({
      kind: 'peer_waiting',
      group: 'peer_waiting',
      icon: '🤝',
      text: pair.role === 'asked' ? 'says a classmate can help' : 'waiting for a helper',
      title:
        pair.role === 'asked'
          ? 'Says a classmate may help: open them to check their work and offer it'
          : 'Offered to the class, waiting for a helper',
    })
  }

  const live = session?.teacherLive
  if (
    student.watchingLive &&
    live?.active &&
    live.mode === 'panel' &&
    live.sourceStudentId !== id
  ) {
    const owner = possessive(live.sourceStudentName ?? 'a classmate')
    out.push(
      student.watchingLive === 'try'
        ? {
            kind: 'trying',
            group: 'trying',
            icon: '▶',
            text: `trying ${owner} work`,
            title: `Running a copy of ${owner} work (Show to class)`,
          }
        : {
            kind: 'looking',
            group: 'looking',
            icon: '👀',
            text: `looking at ${owner} work`,
            title: `Watching ${owner} work (Show to class)`,
          }
    )
  }

  if (student.viewingShareId) {
    const sharer = session?.sharedWorkspaces?.[student.viewingShareId]?.sharerName
    const owner = sharer ? possessive(sharer) : 'a classmate’s'
    out.push({
      kind: 'shared',
      group: 'shared',
      icon: '📤',
      text: `viewing ${owner} shared work`,
      title: `Viewing ${owner} shared work`,
    })
  }

  if (student.currentTopicId) {
    const title = topics?.find((t) => t.id === student.currentTopicId)?.title
    out.push({
      kind: 'topic',
      group: 'topic',
      icon: '📖',
      text: `reading “${title ?? student.currentTopicId}”`,
      title: `Reading the topic “${title ?? student.currentTopicId}”`,
    })
  }

  if (student.inPersonalSandbox) {
    out.push({
      kind: 'sandbox',
      group: 'sandbox',
      icon: '🧪',
      text: 'in their own sandbox',
      title: 'In their personal sandbox',
    })
  }
  return out
}

/** Every student's activities: { [anonymousId]: activity[] }. */
export function classActivities({ session, peerHelp = null, topics = null }) {
  const peerPairs = peerHelpPairsByStudent({
    requests: peerHelp?.allRequests,
    peerHelp: peerHelp?.allPeerHelp,
    offers: session?.peerHelpOffers,
  })
  return Object.fromEntries(
    Object.values(session?.students ?? {})
      .filter((student) => student?.anonymousId)
      .map((student) => [
        student.anonymousId,
        studentActivities({ student, session, peerPairs, topics }),
      ])
  )
}

/**
 * The class summary strip: one entry per group, most important first, with who is in it.
 * A helping pair is one entry ("🤝 Ali → Sam").
 * @returns {{ group, icon, text, studentIds }[]}
 */
export function summariseClassActivities({ session, activities }) {
  const groups = new Map()
  for (const [studentId, list] of Object.entries(activities ?? {})) {
    for (const activity of list) {
      const entry = groups.get(activity.group) ?? { ...activity, studentIds: [] }
      entry.studentIds.push(studentId)
      groups.set(activity.group, entry)
    }
  }
  const order = [
    'helping',
    'being_helped',
    'peer_waiting',
    'looking',
    'trying',
    'shared',
    'topic',
    'sandbox',
  ]
  const live = session?.teacherLive
  const owner = possessive(live?.sourceStudentName ?? 'a classmate')
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((entry) => {
      const n = entry.studentIds.length
      const helperId = entry.group.startsWith('pair:') ? entry.group.slice(5) : null
      const text = helperId
        ? (() => {
            const stuckId = entry.studentIds.find((id) => id !== helperId)
            return `${nameOf(session, helperId)} → ${stuckId ? nameOf(session, stuckId) : 'a classmate'}`
          })()
        : {
            peer_waiting: `${n} want a classmate’s help`,
            looking: `${n} looking at ${owner} work`,
            trying: `${n} trying ${owner} work`,
            shared: `${n} viewing shared work`,
            topic: `${n} reading a topic`,
            sandbox: `${n} in their sandbox`,
          }[entry.kind]
      return { group: entry.group, icon: entry.icon, text, studentIds: entry.studentIds }
    })
}
