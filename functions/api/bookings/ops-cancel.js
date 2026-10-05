// POST /api/bookings/ops-cancel  { booking_id, refund_amount, reason, note }
// ops-only. Cancels a booking on the company's side — photographer can't make
// it, bad weather (規約第9条), or anything else ops decides — and refunds the
// amount ops chose (the full amount by default) through Stripe. The
// photographer gets no payout for it. Customer, photographer and ops are
// emailed. Not possible once the photographer's payout has been sent.
import { OPS_CANCEL_REASONS } from '../../../js/data.js';
import { verifyUser, getProfile, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { refundBooking } from '../../_lib/refund.js';
import { notifyBooking } from '../../_lib/notifications.js';

const CANCELABLE = ['pending_payment', 'paid', 'confirmed', 'requested'];

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
  const { booking_id: bookingId, reason } = payload || {};
  const note = String((payload && payload.note) || '').trim().slice(0, 500) || null;
  if (!bookingId) return jsonResponse({ error: 'booking_idが必要です。' }, 400);
  if (!OPS_CANCEL_REASONS[reason]) return jsonResponse({ error: 'キャンセルの理由を選んでください。' }, 400);

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile || profile.role !== 'ops') return jsonResponse({ error: '運営権限がありません。' }, 403);

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  if (!booking) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!CANCELABLE.includes(booking.status)) return jsonResponse({ error: 'この予約はキャンセルできません（すでにキャンセル済みなど）。' }, 409);
  if (booking.payout_status === 'released') return jsonResponse({ error: 'カメラマンへの送金が済んでいるため、ここからはキャンセルできません。' }, 409);

  const paid = booking.status === 'pending_payment' ? 0 : booking.total_price;
  const refund = payload.refund_amount == null ? paid : Number(payload.refund_amount);
  if (!Number.isInteger(refund) || refund < 0 || refund > paid) {
    return jsonResponse({ error: `返金額は0〜${paid.toLocaleString()}円の整数で指定してください。` }, 400);
  }

  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${bookingId}`, status: `eq.${booking.status}`, payout_status: 'eq.pending' },
    {
      status: 'canceled',
      cancel_reason: 'ops',
      cancel_note: `${OPS_CANCEL_REASONS[reason]}${note ? `（${note}）` : ''}`,
      canceled_at: new Date().toISOString(),
      cancel_fee: paid - refund,
      refund_amount: refund,
      refund_status: refund > 0 ? 'pending' : 'none',
      photographer_cancel_comp: 0,
    },
  );
  if (!updated.length) return jsonResponse({ error: '予約の状態が変わったため、キャンセルできませんでした。画面を読み込み直してください。' }, 409);

  const refundStatus = await refundBooking(env, booking, refund);
  if (booking.status !== 'pending_payment') {
    await notifyBooking(env, bookingId, 'ops_canceled', new URL(request.url).origin);
  }
  return jsonResponse({ ok: true, refund, refund_status: refundStatus });
}
