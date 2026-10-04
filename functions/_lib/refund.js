// Refunds part of a booking's card payment through Stripe and records the
// outcome on the booking. Shared by the customer cancel and the ops no-show
// cancel. Never throws: a failed refund leaves refund_status = 'failed',
// which the ops notification email flags for a manual refund.
import { stripe } from './stripe.js';
import { restUpdate } from './supabaseAdmin.js';

export async function refundBooking(env, booking, amount) {
  if (!(amount > 0)) return 'none';
  try {
    if (!booking.stripe_payment_intent_id) throw new Error('no payment intent on booking');
    const refund = await stripe.refunds.create(
      env,
      { payment_intent: booking.stripe_payment_intent_id, amount, metadata: { booking_id: booking.id } },
      // One refund per booking, so a retried request can't refund twice.
      { idempotencyKey: `cancel-refund-${booking.id}` },
    );
    await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { refund_status: 'succeeded', stripe_refund_id: refund.id })
      .catch((err) => console.error('refund ok but failed to record it', booking.id, refund.id, err));
    return 'succeeded';
  } catch (err) {
    console.error('refund failed', booking.id, err);
    await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { refund_status: 'failed' }).catch(() => {});
    return 'failed';
  }
}
