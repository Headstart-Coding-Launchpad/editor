import { decodeFileKey, encodeFileKey } from '../shared/fileKeys'

// A peer help snapshot (peerHelp/{lessonId}/{requestId}/snapshot): the stuck student's work as
// built by buildShareSnapshot, with file names encoded for Firebase keys.

function encodeFiles(files) {
  return Object.fromEntries(Object.entries(files ?? {}).map(([k, v]) => [encodeFileKey(k), v]))
}

export function encodeHelpSnapshot(snapshot) {
  return {
    taskId: snapshot?.taskId ?? null,
    lessonType: snapshot?.lessonType ?? null,
    code: snapshot?.code ?? '',
    files: encodeFiles(snapshot?.files),
    activeFile: snapshot?.activeFile ?? '',
    arcadeDesign: snapshot?.arcadeDesign ?? null,
    capturedAt: snapshot?.capturedAt ?? Date.now(),
  }
}

export function decodeHelpSnapshot(snapshot) {
  if (!snapshot) return null
  return {
    ...snapshot,
    files: Object.fromEntries(
      Object.entries(snapshot.files ?? {}).map(([k, v]) => [decodeFileKey(k), v])
    ),
  }
}
