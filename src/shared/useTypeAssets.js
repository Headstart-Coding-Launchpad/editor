import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from './firebase'

const cache = {}
// One shared Firestore listener per type, ref-counted across mounted workspaces.
const shared = {}

function subscribe(lessonType, onData, onError) {
  let entry = shared[lessonType]
  if (!entry) {
    entry = { subs: new Set(), unsub: null }
    shared[lessonType] = entry
    entry.unsub = onSnapshot(
      doc(firestore, 'lessonTypeAssets', lessonType),
      (snap) => {
        const d = snap.exists() ? snap.data() : {}
        cache[lessonType] = d
        entry.subs.forEach((sub) => sub.onData(d))
      },
      (err) => entry.subs.forEach((sub) => sub.onError(err))
    )
  }
  const sub = { onData, onError }
  entry.subs.add(sub)
  return () => {
    entry.subs.delete(sub)
    if (entry.subs.size === 0) {
      entry.unsub()
      delete shared[lessonType]
    }
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
    return subscribe(
      lessonType,
      (d) => {
        setData(d)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
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
