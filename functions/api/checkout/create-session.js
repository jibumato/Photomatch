// POST /api/checkout/create-session
// Re-validates the requested slot & price server-side (never trusts the
// client's numbers), creates the booking as `pending_payment`, then creates
// a Stripe Checkout Session for it and returns its URL for the browser to
// redirect to.
import {
  AREAS, SLOT_TIMES, MONITOR_PLAN_NAMES, monitorPriceFor, monitorBookingCounts, areasFor, HIDDEN_AREAS,
  EXTRA_OPTIONS, CHECKOUT_EXPIRES_MIN, isValidCustomerGender, needsGenderForOptions,
} from '../../../js/data.js';
import { verifyUser, restSelect, restInsert, restUpdate } from '../../_lib/supabaseAdmin.js';
import { bookingWindowError, checkSlot } from '../../_lib/slots.js';
import { stripe } from '../../_lib/stripe.js';
import { optionsTotalFor } from '../../_lib/pricing.js';

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

  const user = await verifyUser(request);
  if (!user) return jsonResponse({ error: 'ログインが必要です。' }, 401);

  const {
    photographer_id: photographerId,
    plan_name: planName,
    booking_date: bookingDate,
    start_time: startTime,
    area,
    customer_name: customerName,
    customer_contact: customerContact,
    option_keys: optionKeys,
    customer_gender: requestedGender,
  } = payload || {};

  if (!photographerId || !planName || !bookingDate || !startTime || !customerName || !customerContact) {
    return jsonResponse({ error: '入力内容をご確認ください。' }, 400);
  }
  if (!SLOT_TIMES.includes(startTime)) return jsonResponse({ error: '時間帯が不正です。' }, 400);
  const areaLabel = (AREAS.find((a) => a.key === area) || {}).label;
  if (!areaLabel) return jsonResponse({ error: 'エリアが不正です。' }, 400);

  // Booking window (BOOKING_LEAD_DAYS .. + TOTAL_BOOKING_DAYS, in Japan time).
  const windowError = bookingWindowError(bookingDate);
  if (windowError) return jsonResponse({ error: windowError }, 400);

  const [photographer, plans] = await Promise.all([
    restSelect(env, 'photographers', { id: `eq.${photographerId}`, select: '*' }),
    restSelect(env, 'plans', { photographer_id: `eq.${photographerId}`, name: `eq.${planName}`, select: '*' }),
  ]);
  const photographerRow = photographer[0];
  const plan = plans[0];
  if (!photographerRow) return jsonResponse({ error: 'カメラマンが見つかりません。' }, 404);
  if (!plan) return jsonResponse({ error: 'プランが見つかりません。' }, 404);
  // The client already hides unavailable photographers, but re-check here
  // since this is the actual point of no return (money changes hands).
  if (photographerRow.is_visible === false || photographerRow.is_paused === true) {
    return jsonResponse({ error: '現在、このカメラマンは新規のご予約受付を休止しています。' }, 409);
  }
  if (HIDDEN_AREAS.includes(photographerRow.area)) {
    return jsonResponse({ error: '現在、このカメラマンの担当エリアでは新規のご予約受付を休止しています。' }, 409);
  }
  if (!areasFor(photographerRow.area).some((a) => a.label === areaLabel)) {
    return jsonResponse({ error: 'このカメラマンの担当エリア外のため、ご予約できません。' }, 400);
  }

  const durationMin = plan.duration_min || 30;
  // Re-check availability server-side: the slot must be opened by the
  // photographer (closed is the default) and not held by another booking.
  const slot = await checkSlot(env, { photographerId, bookingDate, startTime, durationMin });
  if (slot.error) return jsonResponse({ error: slot.error }, 409);
  const endTime = slot.endTime;

  // Monitor price: an accepted monitor applicant gets half price on the
  // Standard / Smartphone plan, once. Applied automatically here — the
  // booking screen only displays what this decides.
  let planPrice = plan.price;
  let monitorApplicationId = null;
  if (MONITOR_PLAN_NAMES.includes(plan.name)) {
    const [app] = await restSelect(env, 'monitor_applications', {
      client_id: `eq.${user.id}`, status: 'eq.accepted', select: 'id', order: 'applied_at.asc', limit: '1',
    });
    if (app) {
      const used = await restSelect(env, 'bookings', {
        monitor_application_id: `eq.${app.id}`, select: 'status,created_at',
      });
      if (!used.some((b) => monitorBookingCounts(b))) {
        planPrice = monitorPriceFor(plan.price);
        monitorApplicationId = app.id;
      }
    }
  }

  // The customer's gender: from this form, else from their profile. The
  // 異性スタッフ写真セレクト option needs a male/female customer (an opposite-
  // gender staff member picks the photo).
  const [customerProfile] = await restSelect(env, 'profiles', { id: `eq.${user.id}`, select: 'gender' });
  const customerGender = isValidCustomerGender(requestedGender) ? requestedGender : (customerProfile && customerProfile.gender) || null;
  if (needsGenderForOptions(optionKeys) && !['male', 'female'].includes(customerGender)) {
    return jsonResponse({ error: '「異性スタッフ写真セレクト」は、性別を「男性」または「女性」で登録した方のみご利用いただけます。' }, 400);
  }

  // Keep only known option keys, once each: the charge, the stored options and
  // the photographer payout (¥1,100 per option) must all count the same list.
  const validOptionKeys = EXTRA_OPTIONS.map((o) => o.key).filter((k) => (Array.isArray(optionKeys) ? optionKeys : []).includes(k));
  const optionsTotal = optionsTotalFor(validOptionKeys);
  const totalPrice = planPrice + optionsTotal;

  const booking = await restInsert(env, 'bookings', {
    client_id: user.id,
    photographer_id: photographerId,
    plan_name: plan.name,
    plan_price: planPrice,
    monitor_application_id: monitorApplicationId,
    customer_gender: customerGender,
    duration_min: durationMin,
    area: areaLabel,
    booking_date: bookingDate,
    start_time: startTime,
    end_time: endTime,
    customer_name: customerName,
    customer_contact: customerContact,
    options: validOptionKeys.map((key) => ({ key })),
    options_total: optionsTotal,
    total_price: totalPrice,
    status: 'pending_payment',
  });

  // Remember the gender on the account too (the browser can't write profiles),
  // so the next booking is pre-filled. Best effort.
  if (customerGender && customerProfile && !customerProfile.gender) {
    await restUpdate(env, 'profiles', { id: `eq.${user.id}` }, { gender: customerGender }).catch(() => {});
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await stripe.checkoutSessions.create(env, {
      mode: 'payment',
      // Card only: delayed methods (konbini, bank transfer) complete after
      // checkout, which the webhook doesn't wait for — the slot would be
      // released while the customer is still on their way to pay.
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: totalPrice,
            product_data: { name: `${plan.name}${monitorApplicationId ? '・モニター価格' : ''}（${photographerRow.name}さん）` },
          },
        },
      ],
      // Closed after CHECKOUT_EXPIRES_MIN so a page left open can't be paid
      // once the slot has been given back to someone else.
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRES_MIN * 60,
      metadata: { booking_id: booking.id },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      success_url: `${origin}/booking.html?id=${photographerId}&paid_booking=${booking.id}`,
      cancel_url: `${origin}/booking.html?id=${photographerId}&canceled=1`,
    });
    await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { stripe_checkout_session_id: session.id });
    return jsonResponse({ url: session.url });
  } catch (err) {
    // Free the slot immediately rather than waiting for the 20-minute
    // pending_payment staleness window if Stripe session creation failed.
    await restUpdate(env, 'bookings', { id: `eq.${booking.id}` }, { status: 'canceled' }).catch(() => {});
    console.error('create-session failed', err);
    return jsonResponse({ error: '決済ページの作成に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
}
