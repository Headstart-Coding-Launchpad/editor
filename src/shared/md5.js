// A small MD5 (RFC 1321) for asset names in exported Scratch projects: a `.sb3` names every
// costume and sound file by the MD5 of its bytes, and WebCrypto has no MD5. Not for security.
// Pure, Node-safe.

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = Array.from(
  { length: 64 },
  (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0
)

function toBytes(input) {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  return new TextEncoder().encode(String(input ?? ''))
}

/** The MD5 of a string (UTF-8) or bytes, as 32 lowercase hex characters. */
export function md5(input) {
  const bytes = toBytes(input)
  const length = bytes.length
  // Pad to 56 mod 64, then the bit length as a 64-bit little-endian number.
  const paddedLength = (((length + 8) >>> 6) + 1) << 6
  const buffer = new Uint8Array(paddedLength)
  buffer.set(bytes)
  buffer[length] = 0x80
  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, (length << 3) >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(length / 0x20000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const M = new Uint32Array(16)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(offset + i * 4, true)
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F
      let g
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }
  let hex = ''
  for (const word of [a0, b0, c0, d0]) {
    for (let i = 0; i < 4; i++) hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
  }
  return hex
}
