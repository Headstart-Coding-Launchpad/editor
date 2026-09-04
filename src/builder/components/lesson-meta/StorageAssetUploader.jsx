import React, { useEffect, useRef, useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../../../shared/firebase'
import { s } from './styles'

export default function StorageAssetUploader({ lessonId, storageAssets, onUpdate, onRefresh }) {
  const [uploads, setUploads] = useState({})
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  function handleFileSelect() {
    if (!lessonId) { alert('Set a lesson ID before uploading assets.'); return }
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,application/pdf,.svg'
    input.onchange = e => {
      for (const file of e.target.files) {
        uploadFile(file)
      }
    }
    input.click()
  }

  function uploadFile(file) {
    const storageRef = ref(storage, `lessons/${lessonId}/assets/${file.name}`)
    const task = uploadBytesResumable(storageRef, file)
    setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: null } }))
    task.on(
      'state_changed',
      snap => {
        if (!mountedRef.current) return
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setUploads(prev => ({ ...prev, [file.name]: { progress: pct, error: null } }))
      },
      err => {
        if (!mountedRef.current) return
        setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: err.message } }))
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          if (!mountedRef.current) return
          setUploads(prev => {
            const next = { ...prev }
            delete next[file.name]
            return next
          })
          onUpdate(prev => [...prev.filter(a => a.name !== file.name), { name: file.name, url, showInEditor: true }])
          onRefresh?.()
        } catch (err) {
          if (!mountedRef.current) return
          setUploads(prev => ({ ...prev, [file.name]: { progress: 100, error: err.message } }))
        }
      }
    )
  }

  async function handleDelete(asset) {
    if (!lessonId) return
    if (!confirm(`Delete "${asset.name}" from Firebase Storage?`)) return
    try {
      await deleteObject(ref(storage, `lessons/${lessonId}/assets/${asset.name}`))
    } catch (err) {
      if (err.code !== 'storage/object-not-found') {
        alert('Could not delete: ' + err.message)
        return
      }
    }
    onUpdate(prev => prev.filter(a => a.name !== asset.name))
    onRefresh?.()
  }

  const activeUploads = Object.entries(uploads)

  return (
    <div style={s.storageSection}>
      <div style={s.storageTitleRow}>
        <span style={s.fieldLabel}>Firebase Storage assets</span>
        <button className="btn-ghost" style={s.uploadAssetBtn} onClick={handleFileSelect}>
          Upload file
        </button>
      </div>
      {storageAssets.length === 0 && activeUploads.length === 0 && (
        <p style={s.summaryText}>No files uploaded. Use "Upload file" to add images or PDFs.</p>
      )}
      {activeUploads.map(([name, info]) => (
        <div key={name} style={s.storageRow}>
          <span style={s.assetPath}>{name}</span>
          {info.error
            ? <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>Error: {info.error}</span>
            : <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>{info.progress}%</span>
          }
        </div>
      ))}
      {storageAssets.map(asset => (
        <div key={asset.name} style={s.storageRow}>
          <a href={asset.url} target="_blank" rel="noopener noreferrer" style={s.assetPath} title={asset.url}>
            {asset.name}
          </a>
          <label style={s.showInEditorLabel}>
            <input
              type="checkbox"
              checked={!!asset.showInEditor}
              onChange={e => onUpdate(prev => [
                ...prev.filter(a => a.name !== asset.name),
                { ...asset, showInEditor: e.target.checked },
              ])}
            />
            Web editor
          </label>
          <button
            style={s.copyUrlBtn}
            onClick={() => navigator.clipboard.writeText(asset.url).catch(() => {})}
            title="Copy URL"
          >
            Copy URL
          </button>
          <button style={s.removeBtn} onClick={() => handleDelete(asset)} title="Delete">&times;</button>
        </div>
      ))}
    </div>
  )
}
