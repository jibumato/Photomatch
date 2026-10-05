// POST /api/stripe/webhook
// Registered in the Stripe dashboard against this URL, subscribed to
// checkout.session.completed (and optionally checkout.session.expired).
// Finalizing the booking here — rather than trusting the browser's redirect
// back to success_url — is what actually confirms payment; a customer
// closing the tab after paying must not leave the booking unpaid.
import { verifyStripeSignature, stripe } from '../../_lib/stripe.js';
import { restSelect, restUpdate } from '../../_lib/supabaseAdmin.js';
import { notifyBooking, notifyOps } from '../../_lib/notifications.js';
import { refundBooking } from '../../_lib/refund.js';

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const signature = request.headers.get('Stripe-Signature');

  try {
    await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (err) {
    return new Response('invalid payload', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata && session.metadata.booking_id;
      if (bookingId && session.payment_status === 'paid') {
        let chargeId = null;
        if (session.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(env, session.payment_intent, {
            expand: ['latest_charge'],
          });
          chargeId = typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : (paymentIntent.latest_charge && paymentIntent.latest_charge.id) || null;
        }
        const origin = new URL(request.url).origin;
        const [booking] = await restSelect(env, 'bookings', { id: `eq.${bookingId}`, select: '*' });
        if (!booking) {
          console.error('Stripe webhook: paid session for an unknown booking', bookingId);
        } else if (booking.status === 'pending_payment') {
          // Normal case — unless the slot was taken by someone else in the
          // meantime (checkout pages are closed after CHECKOUT_EXPIRES_MIN and the
          // slot is only given back later, so this is rare). Then the late
          // payer gets everything back instead of a double-booked slot.
          const clash = await findClash(env, booking);
          if (clash) {
            await cancelAndRefundInFull(env, booking, { paymentIntent: session.payment_intent, chargeId, reason: `同じ枠（${clash.start_time.slice(0, 5)}〜${clash.end_time.slice(0, 5)}）がすでに埋まっていたため`, origin });
          } else {
            // Conditional on pending_payment: Stripe may deliver this event more
            // than once, and only the delivery that actually flips the booking
            // to paid should send the confirmation emails.
            const updated = await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, status: 'eq.pending_payment' }, {
              status: 'paid',
              stripe_payment_intent_id: session.payment_intent || null,
              stripe_charge_id: chargeId,
            });
            if (updated.length) {
              await notifyBooking(env, bookingId, 'confirmed', origin);
            }
          }
        } else if (booking.status === 'canceled' && !booking.stripe_payment_intent_id) {
          // Paid after the booking was canceled (e.g. the customer canceled
          // while paying). No payment id on record yet = not refunded yet.
          await cancelAndRefundInFull(env, booking, { paymentIntent: session.payment_intent, chargeId, reason: 'キャンセル済みの予約に対して決済が完了したため', origin });
        }
        // Otherwise: a repeated delivery for a booking already handled.
      }
    } else if (event.type === 'checkout.session.expired') {
      // Free the slot immediately instead of waiting for the 20-minute
      // pending_payment staleness window in the booking_slots view.
      const session = event.data.object;
      const bookingId = session.metadata && session.metadata.booking_id;
      if (bookingId) {
        await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, status: 'eq.pending_payment' }, { status: 'canceled' });
      }
    }
  } catch (err) {
    console.error('Stripe webhook handling failed', err);
    // Returning 500 makes Stripe retry the webhook later.
    return new Response('internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const timeToMinutes = (t) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m; };

// Another confirmed booking of the same photographer overlapping this one.
async function findClash(env, booking) {
  const others = await restSelect(env, 'bookings', {
    photographer_id: `eq.${booking.photographer_id}`,
    booking_date: `eq.${booking.booking_date}`,
    status: 'in.(paid,confirmed,requested,completed)',
    select: 'id,start_time,end_time',
  });
  const start = timeToMinutes(booking.start_time);
  const end = timeToMinutes(booking.end_time);
  return others.find((o) => o.id !== booking.id && start < timeToMinutes(o.end_time) && end > timeToMinutes(o.start_time)) || null;
}

// The payment can't become a (valid) booking: record it, refund all of it, tell ops.
async function cancelAndRefundInFull(env, booking, { paymentIntent, chargeId, reason, origin }) {
  const patch = {
    status: 'canceled',
    cancel_reason: 'system',
    canceled_at: new Date().toISOString(),
    cancel_fee: 0,
    refund_amount: booking.total_price,
    refund_status: 'pending',
    photographer_cancel_comp: 0,
    stripe_payment_intent_id: paymentIntent || null,
    stripe_charge_id: chargeId,
  };
  // Conditional on the state we read, so a repeated delivery does nothing twice.
  const updated = await restUpdate(env, 'bookings', { id: `eq.${booking.id}`, status: `eq.${booking.status}` }, patch);
  if (!updated.length) return;
  const refundStatus = await refundBooking(env, { ...booking, ...patch }, booking.total_price);
  await notifyOps(
    env,
    `決済を取り消して全額返金しました${refundStatus === 'failed' ? '・要返金対応' : ''}`,
    `予約ID：${booking.id}\n依頼者：${booking.customer_name || '-'}（${booking.customer_contact || '-'}）\n日時：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\n金額：¥${booking.total_price.toLocaleString()}\n理由：${reason}\n返金：${refundStatus === 'succeeded' ? '自動返金済み' : refundStatus === 'failed' ? '自動返金に失敗しました。Stripeの管理画面から手動で返金してください' : '処理中'}\n\nお客様には、お手数ですがメールなどでご連絡ください。`,
    origin,
  );
}
