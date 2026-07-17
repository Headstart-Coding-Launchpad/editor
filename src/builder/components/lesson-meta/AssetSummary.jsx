import React from 'react'
import AssetBrowser from '../../../shared/AssetBrowser'
import { s } from './styles'

export default function AssetSummary({ assets, assetsPath, storageAssets }) {
  const count = assets?.length ?? 0

  let text
  if (count > 0) {
    text = `${count} asset${count !== 1 ? 's' : ''} listed in lesson JSON`
  } else {
    text = 'No static assets listed. Upload files via Firebase Storage above.'
  }

  const showBrowser = (count > 0 && assetsPath) || storageAssets?.length > 0

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
