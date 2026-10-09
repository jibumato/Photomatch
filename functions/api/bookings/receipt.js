// POST /api/bookings/receipt  { booking_id }
// The customer's Stripe receipt for a paid booking: returns the link to the
// Stripe-hosted receipt page (with a PDF download) for the card payment, so
// マイページ can offer 「領収書」. Only the booking's own customer can get it.
// The receipt is Stripe's standard one (no addressee/但し書き); a receipt with
// a name on it is issued by ops on request (see the FAQ).
import { verifyUser, restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
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

  const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: 'id,client_id,total_price,status,stripe_charge_id,stripe_payment_intent_id' });
  // Same answer for "doesn't exist" and "not yours".
  if (!booking || booking.client_id !== user.id) return jsonResponse({ error: '予約が見つかりません。' }, 404);
  if (!booking.total_price || booking.status === 'pending_payment' || !(booking.stripe_charge_id || booking.stripe_payment_intent_id)) {
    return jsonResponse({ error: 'この予約には、領収書の対象となるお支払いがありません。' }, 404);
  }

  try {
    let chargeId = booking.stripe_charge_id;
    if (!chargeId) {
      const intent = await stripe.paymentIntents.retrieve(env, booking.stripe_payment_intent_id);
      chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : (intent.latest_charge && intent.latest_charge.id);
      if (chargeId) await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { stripe_charge_id: chargeId }).catch(() => {});
    }
    if (!chargeId) return jsonResponse({ error: '領収書がまだ準備できていません。時間をおいてお試しください。' }, 409);
    const charge = await stripe.charges.retrieve(env, chargeId);
    if (!charge.receipt_url) return jsonResponse({ error: '領収書がまだ準備できていません。時間をおいてお試しください。' }, 409);
    return jsonResponse({ url: charge.receipt_url });
  } catch (err) {
    console.error('receipt failed', err);
    return jsonResponse({ error: '領収書を取得できませんでした。時間をおいて、もう一度お試しください。' }, 502);
  }
}
