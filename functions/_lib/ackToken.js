// Signed link for the photographer's "予約を確認しました" button in the
// booking email, so it works without logging in. The token is an HMAC of the
// booking id and the time the confirmation was requested, so a link from an
// earlier email stops working once the booking is rescheduled (a new request).
const enc = new TextEncoder();

async function hmac(env, message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(`photomatch-booking-ack:${env.SUPABASE_SERVICE_ROLE_KEY}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return [...sig].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// The DB returns timestamps as "…+00:00" while we write "…Z", so sign the
// normalized instant rather than the string as stored.
export function ackToken(env, bookingId, ackRequestedAt) {
  return hmac(env, `${bookingId}|${new Date(ackRequestedAt).toISOString()}`);
}

export async function verifyAckToken(env, bookingId, ackRequestedAt, token) {
  if (!token || !ackRequestedAt) return false;
  const expected = await ackToken(env, bookingId, ackRequestedAt);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function ackUrl(env, origin, booking) {
  const token = await ackToken(env, booking.id, booking.ack_requested_at);
  return `${origin}/api/bookings/ack?id=${encodeURIComponent(booking.id)}&t=${token}`;
}
