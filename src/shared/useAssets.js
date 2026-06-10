export function useAssets() {
  function lessonFolderAssets() { return [] }
  function lessonAssets() { return [] }
  function sharedAssets() { return [] }
  return { lessonFolderAssets, lessonAssets, sharedAssets, loading: false, error: null, manifest: null }
}
