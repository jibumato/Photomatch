// POST /api/bookings/payout-hold  { booking_id, hold, reason }
// ops-only. Stops (hold: true) or allows again (hold: false) the photographer
// payout for one booking. The Stripe webhook sets a hold automatically on a
// chargeback or a refund made in the Stripe dashboard; ops lifts it after
// checking.
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';

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
  const hold = payload && payload.hold;
  const reason = String((payload && payload.reason) || '').trim().slice(0, 300) || null;
  if (!bookingId || typeof hold !== 'boolean') return jsonResponse({ error: 'booking_id と hold が必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: 'id,payout_status' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (booking.payout_status === 'released') return jsonResponse({ error: '送金済みの予約です。' }, 409);

  await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, { payout_hold: hold, payout_hold_reason: hold ? (reason || '運営が保留') : null });
  return jsonResponse({ ok: true });
}
