// POST /api/stripe/webhook
// Registered in the Stripe dashboard against this URL, subscribed to
// checkout.session.completed (and optionally checkout.session.expired).
// Finalizing the booking here — rather than trusting the browser's redirect
// back to success_url — is what actually confirms payment; a customer
// closing the tab after paying must not leave the booking unpaid.
import { verifyStripeSignature, stripe } from '../../_lib/stripe.js';
import { restUpdate } from '../../_lib/supabaseAdmin.js';
import { notifyBooking } from '../../_lib/notifications.js';

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
        // Conditional on pending_payment: Stripe may deliver this event more
        // than once, and only the delivery that actually flips the booking
        // to paid should send the confirmation emails.
        const updated = await restUpdate(env, 'bookings', { id: `eq.${bookingId}`, status: 'eq.pending_payment' }, {
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent || null,
          stripe_charge_id: chargeId,
        });
        if (updated.length) {
          await notifyBooking(env, bookingId, 'confirmed', new URL(request.url).origin);
        }
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
