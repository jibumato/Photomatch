// Temp password handed from ops to a photographer. 14 chars of base64 minus
// the symbols, so it pastes cleanly; ops copies it rather than typing it.
export function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 14);
}
