// Tutor handles (#337, same rule as src/shared/sessionKey.js): 2-20 lower-case letters or digits.
// A handle is a custom claim on the tutor's account, used for their own live-session key and
// student links, so it must be a plain word that is safe in a Realtime Database key and a URL.
const HANDLE_PATTERN = /^[a-z0-9]{2,20}$/

function normaliseHandle(value) {
  const handle = String(value ?? '')
    .trim()
    .toLowerCase()
  return HANDLE_PATTERN.test(handle) ? handle : ''
}

module.exports = { normaliseHandle }
