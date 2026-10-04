// POST /api/bookings/cancel  { booking_id }
// A customer cancels their own booking. Runs server-side (rather than the
// browser updating the row directly) so the refund and the cancellation
// emails to the customer, photographer and ops can't be skipped.
//
// The fee/refund split comes from cancellationQuote() in js/data.js — the
// same function the マイページ confirm dialog uses — so the amount the
// customer agreed to is the amount refunded.
import { cancellationQuote } from '../../../js/data.js';
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';
import { refundBooking } from '../../_lib/refund.js';
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

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
  // Same response for "doesn't exist" and "not yours", so ids can't be probed.
  if (!booking || booking.client_id !== user.id) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!CANCELABLE.includes(booking.status)) return jsonResponse({ error: 'このご予約はキャンセルできません。' }, 409);

  const quote = cancellationQuote(booking);
  if (!quote.allowed) {
    return jsonResponse({ error: '撮影開始時刻を過ぎたご予約は、マイページからキャンセルできません。お問い合わせください。' }, 409);
  }

  // Conditional on the status we just read, so a concurrent cancel or
  // webhook can't be double-processed. The refund amounts are recorded
  // before Stripe is called, so a refund that fails midway is still visible.
  const updated = await restUpdate(
    env,
    'bookings',
    { id: `eq.${bookingId}`, client_id: `eq.${user.id}`, status: `eq.${booking.status}` },
    {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      cancel_reason: 'customer',
      cancel_fee: quote.fee,
      refund_amount: quote.refund,
      refund_status: quote.refund > 0 ? 'pending' : 'none',
      photographer_cancel_comp: quote.photographerComp,
    },
  );
  if (!updated.length) return jsonResponse({ error: 'このご予約はキャンセルできません。' }, 409);

  // Close the unpaid Checkout page too, so it can't be paid after the
  // booking it belongs to was canceled. Already-closed sessions just error.
  if (booking.status === 'pending_payment' && booking.stripe_checkout_session_id) {
    await stripe.checkoutSessions.expire(env, booking.stripe_checkout_session_id).catch(() => {});
  }

  const refundStatus = await refundBooking(env, booking, quote.refund);

  // An unpaid (pending_payment) booking was never confirmed to anyone, so
  // there's nothing to tell the photographer about.
  if (booking.status !== 'pending_payment') {
    await notifyBooking(env, bookingId, 'canceled', new URL(request.url).origin);
  }
  return jsonResponse({ ok: true, fee: quote.fee, refund: quote.refund, refund_status: refundStatus });
}
