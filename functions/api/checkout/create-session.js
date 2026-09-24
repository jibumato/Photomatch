// POST /api/checkout/create-session
// Re-validates the requested slot & price server-side (never trusts the
// client's numbers), creates the booking as `pending_payment`, then creates
// a Stripe Checkout Session for it and returns its URL for the browser to
// redirect to.
import { AREAS, SLOT_TIMES, BOOKING_LEAD_DAYS, TOTAL_BOOKING_DAYS, addMinutes } from '../../../js/data.js';
import { verifyUser, restSelect, restInsert, restUpdate } from '../../_lib/supabaseAdmin.js';
import { stripe } from '../../_lib/stripe.js';
import { optionsTotalFor } from '../../_lib/pricing.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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
  } = payload || {};

  if (!photographerId || !planName || !bookingDate || !startTime || !customerName || !customerContact) {
    return jsonResponse({ error: '入力内容をご確認ください。' }, 400);
  }
  if (!SLOT_TIMES.includes(startTime)) return jsonResponse({ error: '時間帯が不正です。' }, 400);
  const areaLabel = (AREAS.find((a) => a.key === area) || {}).label;
  if (!areaLabel) return jsonResponse({ error: 'エリアが不正です。' }, 400);

  // Booking window: BOOKING_LEAD_DAYS .. BOOKING_LEAD_DAYS + TOTAL_BOOKING_DAYS.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + BOOKING_LEAD_DAYS);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + BOOKING_LEAD_DAYS + TOTAL_BOOKING_DAYS);
  const requestedDate = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(requestedDate.getTime()) || requestedDate < minDate || requestedDate >= maxDate) {
    return jsonResponse({ error: 'ご指定の日付は予約可能な期間外です。' }, 400);
  }

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
  if (photographerRow.is_visible === false) {
    return jsonResponse({ error: '現在、このカメラマンは新規のご予約受付を休止しています。' }, 409);
  }

  const durationMin = plan.duration_min || 30;
  const slotCount = Math.max(1, Math.ceil(durationMin / 30));
  const startIndex = SLOT_TIMES.indexOf(startTime);
  if (startIndex === -1 || startIndex + slotCount > SLOT_TIMES.length) {
    return jsonResponse({ error: 'この時間帯には予約できません。' }, 400);
  }
  const endTime = addMinutes(startTime, durationMin);

  // Re-check availability server-side (bookings that hold the slot + closed shifts).
  const [existingBookings, closedShifts] = await Promise.all([
    restSelect(env, 'bookings', {
      photographer_id: `eq.${photographerId}`,
      booking_date: `eq.${bookingDate}`,
      status: 'neq.canceled',
      select: 'start_time,end_time,status,created_at',
    }),
    restSelect(env, 'shifts', {
      photographer_id: `eq.${photographerId}`,
      shift_date: `eq.${bookingDate}`,
      is_open: 'eq.false',
      select: 'start_time',
    }),
  ]);
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const staleCutoff = Date.now() - 20 * 60 * 1000;
  const isTaken = existingBookings.some((b) => {
    if (b.status === 'pending_payment' && new Date(b.created_at).getTime() < staleCutoff) return false;
    const bStart = timeToMinutes(b.start_time.slice(0, 5));
    const bEnd = timeToMinutes(b.end_time.slice(0, 5));
    return startMin < bEnd && endMin > bStart;
  });
  const closedTimes = new Set(closedShifts.map((s) => s.start_time.slice(0, 5)));
  const hitsClosed = SLOT_TIMES.slice(startIndex, startIndex + slotCount).some((t) => closedTimes.has(t));
  if (isTaken || hitsClosed) return jsonResponse({ error: 'この枠は既に埋まっています。別の日時をお選びください。' }, 409);

  const optionsTotal = optionsTotalFor(optionKeys);
  const totalPrice = plan.price + optionsTotal;

  const booking = await restInsert(env, 'bookings', {
    client_id: user.id,
    photographer_id: photographerId,
    plan_name: plan.name,
    plan_price: plan.price,
    duration_min: durationMin,
    area: areaLabel,
    booking_date: bookingDate,
    start_time: startTime,
    end_time: endTime,
    customer_name: customerName,
    customer_contact: customerContact,
    options: (optionKeys || []).map((key) => ({ key })),
    options_total: optionsTotal,
    total_price: totalPrice,
    status: 'pending_payment',
  });

  const origin = new URL(request.url).origin;
  try {
    const session = await stripe.checkoutSessions.create(env, {
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: totalPrice,
            tax_behavior: 'inclusive',
            product_data: { name: `${plan.name}（${photographerRow.name}さん）` },
          },
        },
      ],
      automatic_tax: { enabled: true },
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
