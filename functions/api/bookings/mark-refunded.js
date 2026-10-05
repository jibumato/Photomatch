// POST /api/bookings/mark-refunded  { booking_id, note }
// ops-only. After an automatic refund failed and ops refunded by hand in the
// Stripe dashboard, record it so the customer's マイページ stops showing
// "運営より手続き中" and the ops "要対応" list clears.
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
  const note = String((payload && payload.note) || '').trim().slice(0, 500);
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: 'id,refund_status,cancel_note' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!['failed', 'pending'].includes(booking.refund_status)) return jsonResponse({ error: 'この予約には、手続き中の返金がありません。' }, 409);

  await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, refund_status: `eq.${booking.refund_status}` }, {
    refund_status: 'succeeded',
    cancel_note: [booking.cancel_note, `手動で返金済み（${new Date().toISOString().slice(0, 10)}${note ? ` ${note}` : ''}）`].filter(Boolean).join(' / '),
  });
  return jsonResponse({ ok: true });
}
