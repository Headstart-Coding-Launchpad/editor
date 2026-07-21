import React from 'react'
import AssetBrowser from '../../../shared/AssetBrowser'
import { s } from './styles'

export default function AssetSummary({ assets, assetsPath, storageAssets }) {
  const staticCount = assets?.length ?? 0
  const storageCount = storageAssets?.length ?? 0

  let text
  if (staticCount > 0) {
    text = `${staticCount} static asset${staticCount !== 1 ? 's' : ''} listed in lesson JSON`
  } else if (storageCount > 0) {
    text = `${storageCount} Firebase Storage asset${storageCount !== 1 ? 's' : ''} found for this lesson`
  } else {
    text = 'No assets found. Upload files via Firebase Storage above.'
  }

  const showBrowser = (staticCount > 0 && assetsPath) || storageCount > 0

  return (
    <div style={s.assetSummary}>
      <span style={s.fieldLabel}>Asset files</span>
      <p style={s.summaryText}>{text}</p>
      {showBrowser && (
        <AssetBrowser
          assetsPath={assetsPath}
          assets={assets}
          storageAssets={storageAssets}
          copyMode="relative"
          style={s.assetBrowserInPanel}
        />
      )}
    </div>
  )
}
