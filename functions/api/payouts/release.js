// POST /api/payouts/release  { booking_id, note }
// ops-only. Records that a booking's photographer share has been paid out
// via manual bank transfer (month-end cutoff, paid on the 25th of the
// following month) — this endpoint does not move money itself, ops does
// that directly with the bank details the photographer registered. Going
// through a Function (rather than a client-side Supabase update) still
// matters because it enforces ops-role authorization and the eligibility
// checks server-side, not just via RLS.
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { PHOTOGRAPHER_PAYOUT_RATE } from '../../_lib/pricing.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const GUARANTEE_WINDOW_DAYS = 30;

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

  const bookings = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  const booking = bookings[0];
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (booking.status !== 'paid') return jsonResponse({ error: 'この予約はまだ決済が完了していません。' }, 400);
  if (booking.payout_status === 'released') return jsonResponse({ error: 'この予約はすでに送金済みです。' }, 400);

  const eligibleDate = new Date(`${booking.booking_date}T00:00:00`);
  eligibleDate.setDate(eligibleDate.getDate() + GUARANTEE_WINDOW_DAYS);
  if (new Date() < eligibleDate) {
    return jsonResponse({ error: `保証期間中のため送金確定できません（${eligibleDate.toISOString().slice(0, 10)}以降に送金可能）。` }, 400);
  }

  const claims = await restSelect(env, 'guarantee_claims', { booking_id: `eq.${bookingId}`, select: 'status' });
  if (claims.some((c) => c.status === 'claimed')) {
    return jsonResponse({ error: '再撮影申請が審査中のため送金確定できません。先に保証審査を完了してください。' }, 400);
  }

  const bankAccounts = await restSelect(env, 'photographer_bank_accounts', {
    photographer_id: `eq.${booking.photographer_id}`,
    select: '*',
  });
  if (!bankAccounts[0]) {
    return jsonResponse({ error: 'カメラマンの振込先口座がまだ登録されていません。' }, 400);
  }

  const amount = Math.round(booking.total_price * PHOTOGRAPHER_PAYOUT_RATE);
  try {
    await restUpdate(env, 'bookings', { id: `eq.${bookingId}` }, {
      payout_status: 'released',
      payout_released_at: new Date().toISOString(),
      payout_note: note,
    });
    return jsonResponse({ success: true, amount });
  } catch (err) {
    console.error('payouts/release failed', err);
    return jsonResponse({ error: '更新に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
