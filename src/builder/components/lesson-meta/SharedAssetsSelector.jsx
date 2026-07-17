import React from 'react'
import { s } from './styles'

export default function SharedAssetsSelector({ typeStorageAssets, sharedAssetNames, onChange }) {
  const selected = sharedAssetNames !== null ? new Set(sharedAssetNames) : null

  function toggle(name) {
    if (selected === null) {
      onChange(typeStorageAssets.map(a => a.name).filter(n => n !== name))
    } else if (selected.has(name)) {
      onChange([...selected].filter(n => n !== name))
    } else {
      onChange([...selected, name])
    }
  }

  return (
    <div style={s.storageSection}>
      <span style={s.fieldLabel}>Shared assets in web editor</span>
      <p style={s.summaryText}>Choose which shared assets are available in this lesson&rsquo;s asset browser.</p>
      {typeStorageAssets.map(asset => {
        const checked = selected === null ? true : selected.has(asset.name)
        return (
          <label key={asset.name} style={s.showInEditorLabel}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(asset.name)}
            />
            {asset.name}
          </label>
        )
      })}
    </div>
  )
}
