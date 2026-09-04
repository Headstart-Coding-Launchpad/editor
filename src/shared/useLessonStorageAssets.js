import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDownloadURL, listAll, ref } from 'firebase/storage'
import { storage } from './firebase'
import { mergeStorageAssets } from './storageAssets'

function lessonAssetsPrefix(lessonId) {
  return `lessons/${lessonId}/assets`
}

function relativeStorageName(itemRef, prefix) {
  const path = itemRef.fullPath ?? itemRef.name
  const prefixWithSlash = prefix.endsWith('/') ? prefix : `${prefix}/`
  return path.startsWith(prefixWithSlash) ? path.slice(prefixWithSlash.length) : itemRef.name
}

async function listFolderAssets(folderRef, prefix) {
  const snap = await listAll(folderRef)
  const direct = await Promise.all(
    snap.items.map(async (itemRef) => ({
      name: relativeStorageName(itemRef, prefix),
      url: await getDownloadURL(itemRef),
    }))
  )
  const nested = await Promise.all(
    snap.prefixes.map((childRef) => listFolderAssets(childRef, prefix))
  )
  return [...direct, ...nested.flat()]
}

export function useLessonStorageAssets(lessonId, schemaAssets = []) {
  const [folderAssets, setFolderAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!lessonId) {
      setFolderAssets([])
      setLoading(false)
      setError(null)
      return
    }

    const prefix = lessonAssetsPrefix(lessonId)
    setLoading(true)
    setError(null)
    try {
      setFolderAssets(await listFolderAssets(ref(storage, prefix), prefix))
    } catch (err) {
      setFolderAssets([])
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    let alive = true
    async function load() {
      if (!lessonId) {
        if (alive) {
          setFolderAssets([])
          setLoading(false)
          setError(null)
        }
        return
      }

      const prefix = lessonAssetsPrefix(lessonId)
      setLoading(true)
      setError(null)
      try {
        const assets = await listFolderAssets(ref(storage, prefix), prefix)
        if (alive) setFolderAssets(assets)
      } catch (err) {
        if (alive) {
          setFolderAssets([])
          setError(err)
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [lessonId])

  const storageAssets = useMemo(
    () => mergeStorageAssets(schemaAssets, folderAssets),
    [schemaAssets, folderAssets]
  )

  return { storageAssets, folderAssets, loading, error, refresh }
}
