// POST /api/payouts/release  { booking_id, note }
// ops-only. Records that one booking's photographer share (photographerPayoutFor
// in js/data.js) has been paid by bank transfer — this endpoint does not move
// money itself. The checks are in functions/_lib/payouts.js; the
// 「まとめて振込済みにする」 button uses /api/payouts/release-batch.
import { verifyUser, getProfile } from '../../_lib/supabaseAdmin.js';
import { releaseOne } from '../../_lib/payouts.js';

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
  const note = (payload && payload.note) || null;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  try {
    const result = await releaseOne(env, bookingId, note);
    if (result.error) return jsonResponse({ error: result.error }, result.status);
    return jsonResponse({ success: true, amount: result.amount });
  } catch (err) {
    console.error('payouts/release failed', err);
    return jsonResponse({ error: '更新に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
