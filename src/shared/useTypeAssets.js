import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from './firebase'

const cache = {}

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
    const unsub = onSnapshot(
      doc(firestore, 'lessonTypeAssets', lessonType),
      (snap) => {
        const d = snap.exists() ? snap.data() : {}
        cache[lessonType] = d
        setData(d)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
    return unsub
  }, [lessonType])

  return {
    typeStorageAssets: data?.storageAssets ?? [],
    defaultSprites: data?.defaultSprites ?? [],
    defaultBackdrops: data?.defaultBackdrops ?? [],
    loading,
    error,
  }
}
