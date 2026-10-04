// POST /api/bookings/no-show  { booking_id, note }
// ops-only. Treats a booking as a same-day cancellation because the customer
// arrived 15+ minutes late or didn't come (規約第5条): the plan price is kept
// as the cancellation fee, option fees are refunded to the card, and the
// photographer gets the same-day compensation instead of the shoot payout.
// Only possible after the shoot's start time and before its payout is sent.
import { noShowQuote } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { refundBooking } from '../../_lib/refund.js';
import { notifyBooking } from '../../_lib/notifications.js';

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
  const note = ((payload && payload.note) || '').trim() || null;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  const quote = noShowQuote(booking);
  if (!quote.allowed) {
    const reason = booking.payout_status === 'released'
      ? 'カメラマンへの送金が済んでいるため、遅刻キャンセルにできません。'
      : booking.status === 'canceled'
        ? 'この予約はすでにキャンセルされています。'
        : '撮影開始時刻を過ぎた、確定済みの予約だけが遅刻キャンセルにできます。';
    return jsonResponse({ error: reason }, 409);
  }

  // Conditional on the status/payout we just read, so a concurrent payout
  // release or a double click can't both go through.
  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${bookingId}`, status: `eq.${booking.status}`, payout_status: 'eq.pending' },
    {
      status: 'canceled',
      cancel_reason: 'no_show',
      canceled_at: new Date().toISOString(),
      cancel_fee: quote.fee,
      refund_amount: quote.refund,
      refund_status: quote.refund > 0 ? 'pending' : 'none',
      photographer_cancel_comp: quote.photographerComp,
      payout_note: note,
    },
  );
  if (!updated.length) return jsonResponse({ error: 'この予約は更新できませんでした。画面を再読み込みしてください。' }, 409);

  const refundStatus = await refundBooking(env, booking, quote.refund);
  await notifyBooking(env, bookingId, 'no_show', new URL(request.url).origin);
  return jsonResponse({ ok: true, fee: quote.fee, refund: quote.refund, refund_status: refundStatus, compensation: quote.photographerComp });
}
