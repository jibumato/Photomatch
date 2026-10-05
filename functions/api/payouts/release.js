// POST /api/payouts/release  { booking_id, note }
// ops-only. Records that a booking's photographer share (plan price × 50%
// + ¥1,100 per option, or the same-day cancellation compensation for a
// canceled booking — see photographerPayoutFor in js/data.js) has been paid out
// via manual bank transfer (month-end cutoff, paid on the 25th of the
// following month) — this endpoint does not move money itself, ops does
// that directly with the bank details the photographer registered. Going
// through a Function (rather than a client-side Supabase update) still
// matters because it enforces ops-role authorization and the eligibility
// checks server-side, not just via RLS.
import { addDaysToIso } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { photographerPayoutFor } from '../../_lib/pricing.js';

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
  // A canceled booking is only paid out when it carries a same-day
  // cancellation compensation; there's no shoot, so no guarantee window.
  const compensation = booking.status === 'canceled' && booking.photographer_cancel_comp > 0;
  if (booking.status !== 'paid' && !compensation) {
    return jsonResponse({ error: booking.status === 'canceled' ? 'このキャンセルにはカメラマンへの支払いがありません。' : 'この予約はまだ決済が完了していません。' }, 400);
  }
  if (booking.payout_status === 'released') return jsonResponse({ error: 'この予約はすでに送金済みです。' }, 400);
  if (booking.payout_hold) return jsonResponse({ error: `この予約の送金は保留中です（${booking.payout_hold_reason || '理由未記入'}）。確認してから、運営画面「予約の管理」で保留を解除してください。` }, 400);

  if (!compensation) {
    const eligibleDate = new Date(`${booking.booking_date}T00:00:00+09:00`);
    eligibleDate.setDate(eligibleDate.getDate() + GUARANTEE_WINDOW_DAYS);
    if (new Date() < eligibleDate) {
      return jsonResponse({ error: `保証期間中のため送金確定できません（${addDaysToIso(booking.booking_date, GUARANTEE_WINDOW_DAYS)}以降に送金可能）。` }, 400);
    }

    const claims = await restSelect(env, 'guarantee_claims', { booking_id: `eq.${bookingId}`, select: 'status' });
    if (claims.some((c) => c.status === 'claimed')) {
      return jsonResponse({ error: '再撮影申請が審査中のため送金確定できません。先に保証審査を完了してください。' }, 400);
    }
  }

  const bankAccounts = await restSelect(env, 'photographer_bank_accounts', {
    photographer_id: `eq.${booking.photographer_id}`,
    select: '*',
  });
  if (!bankAccounts[0]) {
    return jsonResponse({ error: 'カメラマンの振込先口座がまだ登録されていません。' }, 400);
  }

  const amount = photographerPayoutFor(booking);
  try {
    // Conditional, so a double click (or a hold set a moment ago) can't
    // record the same payout twice or release a held one.
    const updated = await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, payout_status: 'eq.pending', payout_hold: 'eq.false' }, {
      payout_status: 'released',
      payout_released_at: new Date().toISOString(),
      payout_note: note,
    });
    if (!updated.length) return jsonResponse({ error: 'この予約は送金済みか、保留中です。画面を読み込み直してください。' }, 409);
    return jsonResponse({ success: true, amount });
  } catch (err) {
    console.error('payouts/release failed', err);
    return jsonResponse({ error: '更新に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
