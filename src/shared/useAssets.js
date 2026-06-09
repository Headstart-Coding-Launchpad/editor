import { useState, useEffect, useRef } from 'react'

let cachedManifest = null
let fetchPromise = null

function loadManifest() {
  if (cachedManifest) return Promise.resolve(cachedManifest)
  if (!fetchPromise) {
    fetchPromise = fetch(`${import.meta.env.BASE_URL}assets/manifest.json`)
      .then(r => {
        if (r.status === 404) return {}
        if (!r.ok) throw new Error(`asset manifest fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => {
        cachedManifest = data
        return data
      })
      .catch(err => {
        fetchPromise = null
        throw err
      })
  }
  return fetchPromise
}

export function useAssets() {
  const [manifest, setManifest] = useState(cachedManifest)
  const [loading, setLoading] = useState(!cachedManifest)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cachedManifest) {
      setManifest(cachedManifest)
      setLoading(false)
      return
    }
    loadManifest()
      .then(m => { setManifest(m); setLoading(false) })
      .catch(e => { setError(e); setLoading(false) })
  }, [])

  const manifestRef = useRef(manifest)
  manifestRef.current = manifest

  function lessonFolderAssets(lessonId) {
    const m = manifestRef.current
    if (!m || !lessonId) return []
    return m.lessons?.[lessonId] ?? []
  }

  function lessonAssets(lessonId, lessonType) {
    const m = manifestRef.current
    if (!m || !lessonId) return []
    const lesson = m.lessons?.[lessonId] ?? []
    const typed = (lessonType && m.shared?.[lessonType]) ? m.shared[lessonType] : []
    const common = m.shared?.common ?? []
    return [...lesson, ...typed, ...common]
  }

  function sharedAssets(type) {
    const m = manifestRef.current
    if (!m || !type) return []
    return m.shared?.[type] ?? []
  }

  return { lessonFolderAssets, lessonAssets, sharedAssets, loading, error, manifest }
}
