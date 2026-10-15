import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { CLASS_COLLECTION } from '../../shared/lessonForks'
import { subscribeRoster } from '../../shared/roster/rosterService'

// The live roster of one class ([{ id, displayName, … }], sorted by name), for the tutor's
// Match students panel and the Admin roster editor. Empty while there is no class.
export function useClassRoster(classId) {
  const [state, setState] = useState({ classId: null, roster: [], loading: false, error: null })

  useEffect(() => {
    if (!classId) {
      setState({ classId: null, roster: [], loading: false, error: null })
      return undefined
    }
    setState({ classId, roster: [], loading: true, error: null })
    return subscribeRoster(
      classId,
      (roster) => setState({ classId, roster, loading: false, error: null }),
      (error) => setState({ classId, roster: [], loading: false, error })
    )
  }, [classId])

  // Never hand back the previous class's roster while the next one loads.
  return state.classId === (classId || null)
    ? state
    : { classId: classId || null, roster: [], loading: !!classId, error: null }
}

// The active (unarchived) class records, sorted by name, for a stock lesson's class picker.
// `classes` is publicly readable (firestore.rules); read only while `enabled`.
export function useClassList(enabled) {
  const [classes, setClasses] = useState([])
  useEffect(() => {
    if (!enabled) return undefined
    return onSnapshot(
      collection(firestore, CLASS_COLLECTION),
      (snap) =>
        setClasses(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((cls) => !cls.archived)
            .map((cls) => ({ id: cls.id, name: String(cls.name ?? cls.id) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        ),
      () => setClasses([])
    )
  }, [enabled])
  return classes
}
