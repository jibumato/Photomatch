// POST /api/bookings/cancel  { booking_id }
// A customer cancels their own booking. Runs server-side (rather than the
// browser updating the row directly) so the cancellation emails to the
// customer and photographer can't be skipped.
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { notifyBooking } from '../../_lib/notifications.js';

const CANCELABLE = ['pending_payment', 'paid', 'requested', 'confirmed'];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ error: '不正なリクエストです。' }, 400);
  }
  const bookingId = payload && payload.booking_id;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: 'id,client_id,status' });
  // Same response for "doesn't exist" and "not yours", so ids can't be probed.
  if (!booking || booking.client_id !== user.id) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!CANCELABLE.includes(booking.status)) return jsonResponse({ error: 'このご予約はキャンセルできません。' }, 409);

  // Conditional on the status we just read, so a concurrent cancel or
  // webhook can't be double-processed.
  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${bookingId}`, client_id: `eq.${user.id}`, status: `eq.${booking.status}` },
    { status: 'canceled' },
  );
  if (!updated.length) return jsonResponse({ error: 'このご予約はキャンセルできません。' }, 409);

  // An unpaid (pending_payment) booking was never confirmed to anyone, so
  // there's nothing to tell the photographer about.
  if (booking.status !== 'pending_payment') {
    await notifyBooking(env, bookingId, 'canceled', new URL(request.url).origin);
  }
  return jsonResponse({ ok: true });
}
