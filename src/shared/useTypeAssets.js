import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from './firebase'

const cache = {}

export function useTypeAssets(lessonType) {
  const [data, setData] = useState(() => cache[lessonType] ?? null)
  const [loading, setLoading] = useState(!cache[lessonType])

  useEffect(() => {
    if (!lessonType) { setLoading(false); return }
    setLoading(!cache[lessonType])
    const unsub = onSnapshot(
      doc(firestore, 'lessonTypeAssets', lessonType),
      snap => {
        const d = snap.exists() ? snap.data() : {}
        cache[lessonType] = d
        setData(d)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [lessonType])

  return {
    typeStorageAssets: data?.storageAssets ?? [],
    defaultSprites: data?.defaultSprites ?? [],
    loading,
  }
}
