import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from './firebase'

const cache = {}
const shared = {} // one ref-counted Firestore listener per type

function subscribe(type, fn) {
  const e = (shared[type] ??= { subs: new Set() })
  e.unsub ??= onSnapshot(
    doc(firestore, 'lessonTypeAssets', type),
    (snap) => {
      cache[type] = snap.exists() ? snap.data() : {}
      e.subs.forEach((f) => f(cache[type]))
    },
    (err) => e.subs.forEach((f) => f(null, err))
  )
  e.subs.add(fn)
  return () => {
    e.subs.delete(fn)
    if (!e.subs.size) (e.unsub(), delete shared[type])
  }
}

export function useTypeAssets(lessonType) {
  const [data, setData] = useState(() => cache[lessonType] ?? null)
  const [loading, setLoading] = useState(!cache[lessonType])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!lessonType) {
      setLoading(false)
      return
    }
    setLoading(!cache[lessonType])
    setError(null)
    return subscribe(lessonType, (d, err) => {
      if (err) setError(err)
      else setData(d)
      setLoading(false)
    })
  }, [lessonType])

  return {
    typeStorageAssets: data?.storageAssets ?? [],
    defaultSprites: data?.defaultSprites ?? [],
    defaultBackdrops: data?.defaultBackdrops ?? [],
    defaultSounds: data?.defaultSounds ?? [],
    loading,
    error,
  }
}
