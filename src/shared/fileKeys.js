export function encodeFileKey(name) {
  return name.replace(/\./g, '__dot__')
}

export function decodeFileKey(key) {
  return key.replace(/__dot__/g, '.')
}
