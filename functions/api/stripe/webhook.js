// POST /api/stripe/webhook
// Registered in the Stripe dashboard against this URL, subscribed to
// checkout.session.completed, checkout.session.expired, charge.refunded,
// charge.dispute.created and charge.dispute.closed.
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
    } else if (event.type === 'charge.refunded') {
      await handleRefunded(env, event.data.object, new URL(request.url).origin);
    } else if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      await handleDispute(env, event.type, event.data.object, new URL(request.url).origin);
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

async function bookingForPayment(env, paymentIntent) {
  if (!paymentIntent) return null;
  const [booking] = await restSelect(env, 'bookings', { stripe_payment_intent_id: `eq.${paymentIntent}`, select: '*' });
  return booking || null;
}

// A refund happened — through the app (already recorded) or by hand in the
// Stripe dashboard. Keep the DB in step with Stripe: record the refunded
// total, and if money went back on a booking that is still active, hold the
// photographer payout until ops has looked at it.
async function handleRefunded(env, charge, origin) {
  const booking = await bookingForPayment(env, charge.payment_intent);
  if (!booking) return;
  const refunded = charge.amount_refunded || 0;
  const patch = { stripe_refunded_total: refunded };
  // A refund that failed in the app and was then done by hand in Stripe.
  if (booking.status === 'canceled' && ['failed', 'pending'].includes(booking.refund_status) && refunded >= (booking.refund_amount || 0)) {
    patch.refund_status = 'succeeded';
  }
  const activeRefund = booking.status !== 'canceled' && refunded > 0 && booking.payout_status !== 'released';
  if (activeRefund && !booking.payout_hold) {
    patch.payout_hold = true;
    patch.payout_hold_reason = `Stripeで返金（¥${refunded.toLocaleString()}）があったため`;
  }
  await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, patch);
  if (activeRefund) {
    await notifyOps(
      env,
      '【要確認】Stripeで返金がありました（予約は有効のまま）',
      `予約ID：${booking.id}\n日時：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\n依頼者：${booking.customer_name || '-'}\n返金済み合計：¥${refunded.toLocaleString()}（支払い ¥${booking.total_price.toLocaleString()}）\n\nこの予約のカメラマンへの送金を保留にしました。予約をキャンセルするか、送金額を確認してから、運営画面「予約の管理」で保留を解除してください。`,
      origin,
    );
  }
}

// Chargebacks: hold the payout while a dispute is open; tell ops either way.
async function handleDispute(env, type, dispute, origin) {
  const booking = await bookingForPayment(env, dispute.payment_intent);
  if (!booking) return;
  if (type === 'charge.dispute.created') {
    if (booking.payout_status !== 'released') {
      await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { payout_hold: true, payout_hold_reason: 'チャージバック（不審請求の申し立て）が発生したため' });
    }
    await notifyOps(
      env,
      '【要対応】チャージバック（不審請求の申し立て）が発生しました',
      `予約ID：${booking.id}\n日時：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\n依頼者：${booking.customer_name || '-'}（${booking.customer_contact || '-'}）\n金額：¥${(dispute.amount || 0).toLocaleString()}\n理由：${dispute.reason || '-'}\n\n${booking.payout_status === 'released' ? 'この予約のカメラマンへの送金は、すでに済んでいます。' : 'カメラマンへの送金を保留にしました。'}Stripeの管理画面で、期限までに証拠を提出してください。`,
      origin,
    );
  } else {
    await notifyOps(
      env,
      `チャージバックが終了しました（${dispute.status === 'won' ? '勝訴：売上は戻りました' : '敗訴：返金扱い'}）`,
      `予約ID：${booking.id}\n日時：${booking.booking_date} ${booking.start_time.slice(0, 5)}〜\n\n${dispute.status === 'won' ? '運営画面「予約の管理」で、送金の保留を解除できます。' : '送金の保留は解除されていません。カメラマンへの支払いの扱いを決めてください。'}`,
      origin,
    );
  }
}
