export function mergeStorageAssets(schemaAssets = [], folderAssets = [], { defaultShowInEditor = true } = {}) {
  const schemaByName = new Map()
  for (const asset of schemaAssets ?? []) {
    if (!asset?.name) continue
    schemaByName.set(asset.name, asset)
  }

  const used = new Set()
  const merged = []
  const sortedFolderAssets = [...(folderAssets ?? [])]
    .filter(asset => asset?.name)
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const folderAsset of sortedFolderAssets) {
    const schemaAsset = schemaByName.get(folderAsset.name)
    used.add(folderAsset.name)
    merged.push({
      ...schemaAsset,
      ...folderAsset,
      showInEditor: schemaAsset?.showInEditor ?? folderAsset.showInEditor ?? defaultShowInEditor,
    })
  }

  for (const asset of schemaAssets ?? []) {
    if (asset?.name && !used.has(asset.name)) merged.push(asset)
  }

  return merged
}
